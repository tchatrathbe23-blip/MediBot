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
const Appointment = require("./models/Appointment");
const Medication = require("./models/Medication");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// INCREASE TIMEOUTS for Render
const server = app.listen(process.env.PORT || 3000, () => {
  console.log(`🔥 Server running on port ${process.env.PORT || 3000}`);
});
server.timeout = 120000; // 2 minutes
server.keepAliveTimeout = 120000;

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
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// --------------------------------------------------
// 📂 File Upload Setup
// --------------------------------------------------
// --- FILE UPLOAD CONFIG ---
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// --------------------------------------------------
// 🔐 AUTH MIDDLEWARE
// --------------------------------------------------
const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) {
    console.log("Auth Error: No token provided");
    return res.status(403).json({ message: "No token provided." });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log("Auth Error: Invalid token");
      return res.status(401).json({ message: "Failed to authenticate token." });
    }
    req.userId = decoded.id;
    next();
  });
};
 
app.post("/signup", async (req, res) => {
  console.log("POST: signup");

  try {
    const { name, password } = req.body;

    // Validate input
    if (!name || !password) {
      return res.json({ success: false, message: "Name and password are required" });
    }

    const exists = await User.findOne({ name });
    console.log('User exists:', exists);

    if (exists) {
      return res.json({ success: false, message: "Name already taken" });
    }

    const hashed = await bcrypt.hash(password, 10);

    await User.create({ name, password: hashed });

    return res.json({ success: true, message: "Signup successful" });

  } catch (err) {
    console.error("Signup error:", err);
    return res.json({ success: false, message: "Signup failed: " + err.message });
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



app.post("/forgot-password", async (req, res) => {
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

    let attempts = 0;
    const maxAttempts = 5; // Increased attempts
    let response;

    while (attempts < maxAttempts) {
      try {
        console.log(`AI Attempt ${attempts + 1}/${maxAttempts}...`);
        response = await axios.post(
          `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
          {
            contents: [{ parts: [{ text: ANALYSIS_PROMPT }] }],
          }
        );
        break; 
      } catch (err) {
        attempts++;
        const isQuota = err.response && err.response.status === 429;
        
        if (isQuota && attempts < maxAttempts) {
          console.log(`⚠️ Quota hit. Waiting 20s for reset... (Attempt ${attempts}/${maxAttempts})`);
          await new Promise((resolve) => setTimeout(resolve, 20000));
        } else {
          console.error("AI Error details:", err.response?.data || err.message);
          throw err;
        }
      }
    }

    const insight =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No insight returned.";

    await Report.create({
      userId: req.userId,
      content: insight,
      createdAt: new Date(),
    });

    return res.json({ success: true, insight });

  } catch (err) {
    const status = err.response?.status || 500;
    const errorMsg = err.response?.data?.error?.message || err.message;
    
    console.error(`❌ Analyze Error (${status}):`, errorMsg);

    return res.status(status).json({ 
      success: false, 
      insight: `Analysis Error: ${errorMsg}` 
    });
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
// 📅 APPOINTMENTS
// --------------------------------------------------
app.get("/appointments", verifyToken, async (req, res) => {
  try {
    const list = await Appointment.find({ userId: req.userId }).sort({ date: 1 });
    res.json({ success: true, appointments: list });
  } catch (err) {
    res.json({ success: false, message: "Error fetching appointments" });
  }
});

app.post("/appointments", verifyToken, async (req, res) => {
  try {
    const { title, doctor, date, time, location } = req.body;
    const apt = await Appointment.create({ userId: req.userId, title, doctor, date, time, location });
    res.json({ success: true, appointment: apt });
  } catch (err) {
    res.json({ success: false, message: "Error creating appointment" });
  }
});

// --------------------------------------------------
// 💊 MEDICATIONS
// --------------------------------------------------
app.get("/medications", verifyToken, async (req, res) => {
  try {
    const list = await Medication.find({ userId: req.userId });
    res.json({ success: true, medications: list });
  } catch (err) {
    res.json({ success: false, message: "Error fetching medications" });
  }
});

app.post("/medications", verifyToken, async (req, res) => {
  try {
    const { name, dosage, schedule, notes } = req.body;
    const med = await Medication.create({ userId: req.userId, name, dosage, schedule, notes });
    res.json({ success: true, medication: med });
  } catch (err) {
    res.json({ success: false, message: "Error saving medication" });
  }
});

// --------------------------------------------------
// 👤 PROFILE & FEEDBACK
// --------------------------------------------------
app.post("/update-profile", verifyToken, async (req, res) => {
  try {
    const { name } = req.body;
    await User.findByIdAndUpdate(req.userId, { name });
    res.json({ success: true, message: "Profile updated" });
  } catch (err) {
    res.json({ success: false, message: "Update failed" });
  }
});

app.post("/submit-feedback", verifyToken, async (req, res) => {
  try {
    // We'll just log feedback for now or save to a simple collection if needed
    console.log(`Feedback from ${req.userId}:`, req.body);
    res.json({ success: true, message: "Feedback submitted" });
  } catch (err) {
    res.json({ success: false });
  }
});

// --------------------------------------------------
// 🤖 GENERAL AI CHAT (Medi-Assistant)
app.post("/chat", verifyToken, async (req, res) => {
  try {
    const { message } = req.body;

    // 🌟 Fetch latest report for context
    const latestReport = await Report.findOne({ userId: req.userId }).sort({ createdAt: -1 });
    const context = latestReport ? `CONTEXT REPORT:\n${latestReport.content}\n` : "No medical report uploaded yet.";

    const CHAT_PROMPT = `
You are MediBot Assistant, a helpful medical companion. 
Use the following context to answer the user's question, but keep it professional.

${context}

USER QUESTION: ${message}

Rules:
1. If the user says "hi", just be friendly.
2. If they ask about the report, use the context.
3. Keep it concise.
`;

    let attempts = 0;
    const maxAttempts = 3;
    let chatResponse;

    while (attempts < maxAttempts) {
      try {
        chatResponse = await axios.post(
          `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
          { contents: [{ parts: [{ text: CHAT_PROMPT }] }] }
        );
        break;
      } catch (err) {
        attempts++;
        if (err.response?.status === 429 && attempts < maxAttempts) {
          console.log(`⚠️ Chat Quota hit. Waiting 15s... (${attempts}/${maxAttempts})`);
          await new Promise(r => setTimeout(r, 15000));
        } else {
          throw err;
        }
      }
    }

    const reply = chatResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm processing your data, one moment...";
    res.json({ success: true, reply });

  } catch (err) {
    console.error("CHAT ERROR:", err.message);
    res.json({ success: false, message: "Assistant offline - Try again in 30s" });
  }
});

// Server already listening at the top with timeout set
