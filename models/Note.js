// import mongoose library of mongoodb
const mongoose = require("mongoose");

// structure of a note document
// schema is a blueprint of a document in a collection
const noteSchema = new mongoose.Schema({
  title: {
    type: String, // type ka mtlb hn ki title field ka data type String hoga
    required: true, // required ka mtlb hn ki title field ko empty nahi chhod sakte
  },

  content: {
    type: String, // type ka mtlb hn ki content field ka data type String hoga
    required: true, // required ka mtlb hn ki content field ko empty nahi chhod sakte
  },

  pdf: {
    type: String, // type ka mtlb hn ki pdf field ka data type String hoga
  },

  createdAt: {
    type: Date, // type ka mtlb hn ki createdAt field ka data type Date hoga
    default: Date.now,
    // default ka mtlb hn ki agar createdAt field ko empty chhod diya to usme
    // current date and time automatically aa jayega
  },
});

// create Note model
// iska mtlb hn ki Note model ka use karke hum notes collection me documents create kar sakte hain
// Agar aap mongoose.model("Product", productSchema) likhenge  Database mein products collection banega.
module.exports = mongoose.model("Note", noteSchema);
