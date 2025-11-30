require("dotenv").config();

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const axios = require("axios");
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const Tesseract = require("tesseract.js");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

// Models
const User = require("./models/User");
const Report = require("./models/Reports");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// --------------------------------------------------
// 🌍 CONNECT TO MONGODB ATLAS
// --------------------------------------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("🌍 Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB Atlas Error:", err));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET;

// File upload folder
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({ dest: uploadDir });

// Gemini API settings
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// --------------------------------------------------
// 🔐 AUTH MIDDLEWARE
// --------------------------------------------------
function verifyToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid token" });

    req.userId = decoded.id;
    next();
  });
}

// --------------------------------------------------
// 📝 SIGNUP
// --------------------------------------------------
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const exists = await User.findOne({ email });
    if (exists)
      return res.json({ success: false, message: "Email already used" });

    const hashed = await bcrypt.hash(password, 10);

    await User.create({ name, email, password: hashed });

    res.json({ success: true, message: "Signup successful" });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Signup failed" });
  }
});

// --------------------------------------------------
// 🔑 LOGIN
// --------------------------------------------------
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.json({ success: false, message: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid)
    return res.json({ success: false, message: "Incorrect password" });

  const token = jwt.sign({ id: user._id }, JWT_SECRET, {
    expiresIn: "24h",
  });

  res.json({
    success: true,
    message: "Login successful",
    token,
    name: user.name,
  });
});

// --------------------------------------------------
// 🤖 ANALYZE ROUTE
// --------------------------------------------------
app.post("/analyze", verifyToken, upload.single("file"), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ insight: "No file uploaded." });

  const filePath = req.file.path;
  let fileContent = "";

  try {
    const mime = req.file.mimetype;

    if (mime === "application/pdf") {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      fileContent = data.text || "";
    } else if (
      mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      fileContent = result.value;
    } else if (mime.startsWith("image/")) {
      const result = await Tesseract.recognize(filePath, "eng");
      fileContent = result.data.text;
    } else {
      fileContent = fs.readFileSync(filePath, "utf8");
    }

    // SEND TO GEMINI
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          { parts: [{ text: `Analyze this medical report:\n${fileContent}` }] }
        ],
      }
    );

    const insight =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No insight returned.";

    // SAVE TO ATLAS
    await Report.create({
      userId: req.userId,
      content: insight,
      createdAt: new Date(),
    });

    res.json({ success: true, insight });

  } catch (err) {
    console.error("❌ ERROR:", err.response?.data || err);
    res.status(500).json({ success: false, insight: "Failed to analyze" });
  } finally {
    fs.unlinkSync(filePath);
  }
});

// --------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🔥 Server running on port ${PORT}`)
);
