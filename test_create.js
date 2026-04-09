require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected");
    const u = await User.create({ name: "ManualTest", password: "password" });
    console.log("Created user:", u);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

check();
