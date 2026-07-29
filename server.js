// It will take .env file and config() will load the environment variables from .env file into process.env
// process.env is a global object that contains all the environment variables of the current process
require("dotenv").config();
const express = require("express");
const app = express();

// multer ka mtlb hn ki ye ek middleware hai jo file upload ko handle karta hai
const multer = require("multer");
// aur ya path ka mtlb hn ki ye ek module hai jo file path ko handle karta hai
const path = require("path");



// configure storage for uploaded files
const storage = multer.diskStorage({

    // where file will be saved
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },

    // file name
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// create upload middleware
const upload = multer({ storage });





// isse hum Note model ko import karenge jo models/Note.js me define kiya gaya hai
const Note = require("./models/Note");

const port = 3000;

// isse hum MongoDB ke saath connect karenge
// phle hum mongoose package ko import karenge
const mongoose = require("mongoose");

// mongoose.connect() ka use karke hum MongoDB ke saath connect karenge express server ko
mongoose.connect(process.env.MONGO_URI)
    // agar connection successful hua to then() function chalega
  .then(() => {
    console.log("MongoDB Connected");
  })
  // nhi to catch() function chalega aur error print hoga
  .catch((err) => {
    console.log(err);
  });

// static files
// Express ko batata hai ki hum public folder ke andar ki static files (CSS, JS, images) ko serve karna chahte hain
app.use(express.static("public"));

// make uploaded files accessible from browser
app.use("/uploads", express.static("uploads"));

// Express ko batata hai ki hum EJS template engine use kar rahe hain
// ab hum views folder ke andar ki .ejs files ko res.render() se bhej sakte hain
// ya batata hn ki hum EJS template engine use kar rahe hain
app.set("view engine", "ejs");

// temporary storage for notes
// notes ko store karne ke liye ek array banaya hai
// const notes = [
//   {
//     title: "My First Note",
//     content: "This is the content of my first note.",
//   },
//   {
//     title: "My Second Note",
//     content: "This is the content of my second note.",
//   },
//   {
//     title: "My Third Note",
//     content: "This is the content of my third note.",
//   },
//   {
//     title: "My Fourth Note",
//     content: "This is the content of my fourth note.",
//   },
//   {
//     title: "My Fifth Note",
//     content: "This is the content of my fifth note.",
//   },
//   {
//     title: "My Sixth Note",
//     content: "This is the content of my sixth note.",
//   },
//   {
//     title: "My Seventh Note",
//     content: "This is the content of my seventh note.",
//   },
// ];

// form se bheja gaya data read karne ke liye
// ya ek middle ware hai jo form data ko parse karta hai aur req.body me store karta hai
// ya kam kaisa krta hai ki agar form se data bheja gaya hai to usko read karne ke liye ye middleware use hota hai
app.use(express.urlencoded({ extended: true }));

// Browser jab localhost:3000 open karta hai
// tab backend ko GET request bhejta hai.
// app.get("/", (req, res) => {}) ka matlab hai:
// agar user home page '/' maange, to ye function chalega
// aur backend browser ko response bhejega.

// Route ka kaam hai specific URL ke liye code chalana
// agar browser '/' (home page) request kare
// to ye function execute hoga
app.get("/", async(req, res) => {
  console.log("got the request from home page '/' ");
  // await ka mtlb hn ki ye function asynchronous hai aur ye Note.find() ka result ka wait karega
  // “Database se saare notes lao.”
//   note.find () ka mtlb hn ki Note model ke saare documents ko find karo
// .sort {-1} ka mtlb hn ki saare notes ko descending order me sort karo mtlb jo 
// phle bna wo phle 
  const notes = await Note.find().sort({ createdAt: -1 });
  // for (let i = 0; i < notes.length; i++) {
  //   console.log(notes[i]);
  // }

  // res is used to send data to frontend by server
  // req is used to get data from frontend to server
  res.render("index", { notes });
});

app.get("/add", (req, res) => {
  // console.log("got the request from add page '/add' ");
  res.render("add");
});

// form ka data receive karne wala route
// app.post() ka matlab hai ki ye route POST requests ko handle karega
// jab browser form ka data server ko bhejega tab ye function execute hoga
app.post("/add", upload.single("pdf"), async (req, res) => {
  console.log(req.body);
  // when form is submitted, the data is received in req.body
  // after that we can store the data in notes array

  // default empty path
  let pdfPath = "";

  // if user uploaded a file
  if (req.file) {
    pdfPath = "/uploads/" + req.file.filename;
  }

  const { title, content } = req.body;
  // note ko create karne ke liye Note model ka use karke database me document create karenge
  await Note.create({
    title: title,
    content: content,
    pdf: pdfPath,
  });

  // redirect to home page after adding note
  res.redirect("/");
  // In Express, you can only call a response method
  //  (res.send, res.redirect, res.render, res.json, etc.) once per request.
  // ek bar mn ek hi response bhej sakte hn, isliye res.redirect() ke baad res.send() nahi use kar sakte hn
  // res.send("Note received successfully ✅");
});


// route to open edit page
app.get("/edit/:id", async (req, res) => {

    // get note id from URL
    const noteId = req.params.id;

    // find note from MongoDB
    const note = await Note.findById(noteId);

    // send note data to edit.ejs
    res.render("edit", { note });
});


// route to update note
app.post("/edit/:id", async (req, res) => {

    // get updated data from form
    const { title, content } = req.body;

    // update note in MongoDB
    await Note.findByIdAndUpdate(req.params.id, {
        title: title,
        content: content
    });

    // go back to home page
    res.redirect("/");
});


// Toh Express sochat ki browser se bilkul exact word "id" aane wala hai (/delete/id).
// Jab browser real MongoDB ID bhejata (jaise /delete/65b2f8a9...), 
// toh Express match nahi kar pata aur 404 Not Found error de deta!
app.post("/delete/:id", async (req, res) => {
  console.log("DELETE ROUTE HIT");
  console.log(req.params.id);

  await Note.findByIdAndDelete(req.params.id);

  res.redirect("/");
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`app started at localhost:${PORT}`);
});
