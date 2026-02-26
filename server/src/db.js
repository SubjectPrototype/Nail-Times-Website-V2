const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is required");
}

mongoose.set("strictQuery", true);

async function connectDb() {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });
}

module.exports = { connectDb };
