require("dotenv").config();
const express = require("express");
const app = express();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Note = require("./models/Note");

// Configure storage for uploaded files with security and uniqueness
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

// Multer upload middleware with strict PDF file filtering
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

const port = process.env.PORT || 3000;

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

// Home route with error handling
app.get("/", async (req, res) => {
  try {
    const notes = await Note.find().sort({ createdAt: -1 });
    res.render("index", { notes });
  } catch (err) {
    console.error("Error fetching notes:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Add note form route
app.get("/add", (req, res) => {
  res.render("add");
});

// Handle adding a note with PDF upload and error handling
app.post("/add", upload.single("pdf"), async (req, res) => {
  try {
    let pdfPath = "";
    if (req.file) {
      pdfPath = "/uploads/" + req.file.filename;
    }

    const title = req.body.title ? req.body.title.trim() : "";
    const content = req.body.content ? req.body.content.trim() : "";

    if (!title || !content) {
      if (req.file) {
        fs.unlink(path.join(__dirname, req.file.path), () => {});
      }
      return res.status(400).send("Title and content are required.");
    }

    await Note.create({
      title: title,
      content: content,
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

// Route to open edit page
app.get("/edit/:id", async (req, res) => {
  try {
    const noteId = req.params.id;
    const note = await Note.findById(noteId);
    if (!note) {
      return res.status(404).send("Note not found");
    }
    res.render("edit", { note });
  } catch (err) {
    console.error("Error fetching note for edit:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Route to update note with optional PDF replacement and cleanup
app.post("/edit/:id", upload.single("pdf"), async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      if (req.file) {
        fs.unlink(path.join(__dirname, req.file.path), () => {});
      }
      return res.status(404).send("Note not found");
    }

    const title = req.body.title ? req.body.title.trim() : note.title;
    const content = req.body.content ? req.body.content.trim() : note.content;
    let pdfPath = note.pdf;

    if (req.file) {
      // Delete old PDF from disk if it exists
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

// Route to delete note and its associated PDF file from disk
app.post("/delete/:id", async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (note) {
      // Delete associated PDF file if it exists
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
