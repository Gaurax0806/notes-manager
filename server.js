require("dotenv").config();
const express = require("express");
const app = express();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const session = require("express-session");

const Note = require("./models/Note");
const User = require("./models/User");

// Configure storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, "uploads");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/pdf") {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed!"), false);
        }
    }
});

const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
  })
  .catch((err) => {
    console.log("MongoDB connection error:", err);
  });

// Static files
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || "notes_manager_super_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.redirect("/login");
};

// --- AUTHENTICATION ROUTES ---

app.get("/signup", (req, res) => {
    if (req.session && req.session.userId) {
        return res.redirect("/");
    }
    res.render("signup");
});

app.post("/signup", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.render("signup", { error: "All fields are required." });
        }

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.render("signup", { error: "Username or email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            username: username.trim(),
            email: email.trim().toLowerCase(),
            password: hashedPassword
        });

        req.session.userId = newUser._id;
        req.session.username = newUser.username;
        res.redirect("/");
    } catch (err) {
        console.error("Signup error:", err);
        res.render("signup", { error: "An error occurred during signup." });
    }
});

app.get("/login", (req, res) => {
    if (req.session && req.session.userId) {
        return res.redirect("/");
    }
    res.render("login");
});

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.render("login", { error: "All fields are required." });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user) {
            return res.render("login", { error: "Invalid email or password." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render("login", { error: "Invalid email or password." });
        }

        req.session.userId = user._id;
        req.session.username = user.username;
        res.redirect("/");
    } catch (err) {
        console.error("Login error:", err);
        res.render("login", { error: "An error occurred during login." });
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error("Logout error:", err);
        res.redirect("/login");
    });
});

// --- NOTE ROUTES (Protected) ---

// Home route with search, category filter, and pin sorting
app.get("/", isAuthenticated, async (req, res) => {
  try {
    const { search, category } = req.query;
    let query = { userId: req.session.userId };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } }
      ];
    }

    // Sort pinned notes first, then by creation date descending
    const notes = await Note.find(query).sort({ isPinned: -1, createdAt: -1 });
    const user = { username: req.session.username };

    res.render("index", { notes, user, search, category });
  } catch (err) {
    console.error("Error fetching notes:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Add note form route
app.get("/add", isAuthenticated, (req, res) => {
  res.render("add");
});

// Handle adding a note
app.post("/add", isAuthenticated, upload.single("pdf"), async (req, res) => {
  try {
    let pdfPath = "";
    if (req.file) {
      pdfPath = "/uploads/" + req.file.filename;
    }

    const title = req.body.title ? req.body.title.trim() : "";
    const content = req.body.content ? req.body.content.trim() : "";
    const category = req.body.category || "General";

    if (!title || !content) {
      if (req.file) {
        fs.unlink(path.join(__dirname, req.file.path), () => {});
      }
      return res.status(400).send("Title and content are required.");
    }

    await Note.create({
      userId: req.session.userId,
      title: title,
      content: content,
      category: category,
      pdf: pdfPath,
    });

    res.redirect("/");
  } catch (err) {
    console.error("Error adding note:", err);
    if (req.file) {
      fs.unlink(path.join(__dirname, req.file.path), () => {});
    }
    res.status(500).send(err.message || "Error adding note");
  }
});

// Route to pin/unpin note
app.post("/pin/:id", isAuthenticated, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.session.userId });
    if (note) {
      note.isPinned = !note.isPinned;
      await note.save();
    }
    res.redirect("/");
  } catch (err) {
    console.error("Error pinning note:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Route to open edit page
app.get("/edit/:id", isAuthenticated, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.session.userId });
    if (!note) {
      return res.status(404).send("Note not found");
    }
    res.render("edit", { note });
  } catch (err) {
    console.error("Error fetching note for edit:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Route to update note
app.post("/edit/:id", isAuthenticated, upload.single("pdf"), async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.session.userId });
    if (!note) {
      if (req.file) {
        fs.unlink(path.join(__dirname, req.file.path), () => {});
      }
      return res.status(404).send("Note not found");
    }

    const title = req.body.title ? req.body.title.trim() : note.title;
    const content = req.body.content ? req.body.content.trim() : note.content;
    const category = req.body.category || note.category;
    let pdfPath = note.pdf;

    if (req.file) {
      if (note.pdf) {
        const oldPdfFullPath = path.join(__dirname, note.pdf);
        if (fs.existsSync(oldPdfFullPath)) {
          fs.unlink(oldPdfFullPath, (unlinkErr) => {
            if (unlinkErr) console.error("Error deleting old PDF file:", unlinkErr);
          });
        }
      }
      pdfPath = "/uploads/" + req.file.filename;
    }

    note.title = title;
    note.content = content;
    note.category = category;
    note.pdf = pdfPath;
    await note.save();

    res.redirect("/");
  } catch (err) {
    console.error("Error updating note:", err);
    if (req.file) {
      fs.unlink(path.join(__dirname, req.file.path), () => {});
    }
    res.status(500).send(err.message || "Error updating note");
  }
});

// Route to delete note
app.post("/delete/:id", isAuthenticated, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.session.userId });
    if (note) {
      if (note.pdf) {
        const pdfFullPath = path.join(__dirname, note.pdf);
        if (fs.existsSync(pdfFullPath)) {
          fs.unlink(pdfFullPath, (unlinkErr) => {
            if (unlinkErr) console.error("Error deleting PDF file:", unlinkErr);
          });
        }
      }
      await Note.findByIdAndDelete(req.params.id);
    }
    res.redirect("/");
  } catch (err) {
    console.error("Error deleting note:", err);
    res.status(500).send("Internal Server Error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`app started at localhost:${PORT}`);
});
