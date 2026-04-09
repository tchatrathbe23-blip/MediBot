require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected");
    const count = await User.countDocuments();
    console.log("User count:", count);
    const users = await User.find().limit(5);
    console.log("Users:", users);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

check();
