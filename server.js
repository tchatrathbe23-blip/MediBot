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
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// --------------------------------------------------
// 🌍 CONNECT TO MONGODB ATLAS
// --------------------------------------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("🌍 Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

const JWT_SECRET = process.env.JWT_SECRET;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// --------------------------------------------------
// 📂 File Upload Setup
// --------------------------------------------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

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

app.post("/signup", async (req, res) => {

  console.log("POST: signup")

  try {
    const { name, password } = req.body;

    const exists = await User.findOne({ name });
    console.log('-------------------------')
    console.log(exists)
    console.log('-------------------------')


  

    if (exists)
      return res.json({ success: false, message: "Name already taken" });

    const hashed = await bcrypt.hash(password, 10);

    await User.create({ name, password: hashed });

    res.json({ success: true, message: "Signup successful" });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Signup failed" });
  }
});


app.post("/post-here",(req,res)=>{
  console.log(req.body)
  return res.send("This is post: test")
})




app.post("/followup", verifyToken, async (req, res) => {
  try {
    const { insight, mode, userMessage, detailLevel } = req.body;

    if (!insight) {
      return res.json({ success: false, message: "No base insight provided" });
    }

    // 🌟 Build dynamic prompt depending on mode
    let prompt = "";

    if (mode === "diet") {
      prompt = `
You are a medical assistant. Based only on the following analyzed medical report:

"${insight}"

Generate a clear, personalized DIET PLAN (detail level: ${detailLevel}/5).
Format it cleanly using bullet points with short explanations.
Do NOT invent medical values.
`;
    }

    else if (mode === "exercise") {
      prompt = `
You are a medical assistant. Based only on the following analyzed medical report:

"${insight}"

Generate a safe EXERCISE GUIDANCE plan (detail level: ${detailLevel}/5).
Explain what to do, what to avoid, and provide intensity notes.
`;
    }

    else if (mode === "preset") {
      prompt = `
Based on the following analyzed medical report:

"${insight}"

Answer the user's question:
"${userMessage}"

Keep language simple and clean. Detail level: ${detailLevel}/5.
`;
    }

    else if (mode === "chat") {
      prompt = `
You are the AI assistant analyzing this report:

"${insight}"

Now answer the user's follow-up question:
"${userMessage}"

Respond clearly, with smooth formatting and no invented data.
`;
    }

    else {
      prompt = `
Based on the following medical insight:
"${insight}"
Answer appropriately.
`;
    }

    // 🌟 Call Gemini
    const geminiResponse = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      }
    );

    const reply =
      geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response generated.";

    return res.json({
      success: true,
      reply
    });

  } catch (err) {
    console.error("FOLLOWUP ERROR:", err);
    return res.json({
      success: false,
      message: "Failed to generate follow-up response"
    });
  }
});




app.post("/login", async (req, res) => {

  const { name, password } = req.body;

  const user = await User.findOne({ name });
  if (!user) return res.json({ success: false, message: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid)
    return res.json({ success: false, message: "Incorrect password" });

  const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "24h" });

  res.json({
    success: true,
    message: "Login successful",
    token,
    name: user.name,
  });
});



app.post("/forgot", async (req, res) => {
  try {
    const { name } = req.body;

    const user = await User.findOne({ name });
    if (!user) return res.json({ success: false, message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetOtp = otp;
    user.resetOtpExpire = Date.now() + 10 * 60 * 1000; // 10 min
    await user.save();

    return res.json({
      success: true,
      message: "OTP generated successfully",
      otp, // DISPLAY for now
    });
  } catch (error) {
    console.error(error);
    return res.json({ success: false, message: "Server error" });
  }
});

app.post("/reset-password", async (req, res) => {
  try {
    const { name, otp, newPassword } = req.body;

    const user = await User.findOne({ name });
    if (!user) return res.json({ success: false, message: "User not found" });

    if (user.resetOtp !== otp)
      return res.json({ success: false, message: "Invalid OTP" });

    if (user.resetOtpExpire < Date.now())
      return res.json({ success: false, message: "OTP expired" });

    const hashed = await bcrypt.hash(newPassword, 10);

    user.password = hashed;
    user.resetOtp = null;
    user.resetOtpExpire = null;

    await user.save();

    return res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error(error);
    return res.json({ success: false, message: "Server error" });
  }
});

// --------------------------------------------------
// SIMPLE TEST ROUTE
// --------------------------------------------------
app.get("/test", (req, res) => {
  return res.send("Hello");
});

// --------------------------------------------------
// 💾 SAVE REPORT
// --------------------------------------------------
app.post("/save-report", verifyToken, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content)
      return res.json({ success: false, message: "No content provided" });

    await Report.create({
      userId: req.userId,
      content,
      createdAt: new Date(),
    });

    res.json({ success: true, message: "Report saved" });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    res.json({ success: false, message: "Failed to save" });
  }
});

// --------------------------------------------------
// 🤖 ANALYZE MEDICAL REPORT
// --------------------------------------------------
app.post("/analyze", verifyToken, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ insight: "No file uploaded." });

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

    const ANALYSIS_PROMPT = `
You are a medical analysis AI. Analyze this medical report and generate clean, structured insights.

INPUT REPORT:
${fileContent}

OUTPUT FORMAT STRICTLY:

1. Key Medical Findings
2. Possible Conditions (Likely / Possible / Uncertain)
3. Doctor Visit Recommendation
4. Diet Recommendations
5. Exercise Recommendations
6. Additional Insights

Rules:
- Do NOT invent values.
- Keep language simple.
`;

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: ANALYSIS_PROMPT }] }] }
    );

    const insight =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No insight returned.";

    await Report.create({
      userId: req.userId,
      content: insight,
      createdAt: new Date(),
    });

    res.json({ success: true, insight });
  } catch (err) {
    console.error("❌ Analyze Error:", err);
    res.status(500).json({ success: false, insight: "Failed to analyze" });
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
});

// --------------------------------------------------
// 📄 GET USER REPORTS
// --------------------------------------------------
app.get("/my-reports", verifyToken, async (req, res) => {
  try {
    const reports = await Report.find({ userId: req.userId }).sort({
      createdAt: -1,
    });

    res.json({ success: true, reports });
  } catch (err) {
    console.error("FETCH REPORTS ERROR:", err);
    res.json({ success: false, message: "Failed to fetch reports" });
  }
});

// --------------------------------------------------
// 🚀 START SERVER
// --------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));
