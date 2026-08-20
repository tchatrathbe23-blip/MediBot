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

const dns = require("node:dns");
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {}

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

// --------------------------------------------------
// 🌍 CONNECT TO MONGODB ATLAS
// --------------------------------------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("🌍 Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

const JWT_SECRET = process.env.JWT_SECRET;

const { GoogleGenerativeAI } = require("@google/generative-ai");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.6-27b",
  "groq/compound-mini"
];

// Unified High-Performance AI Caller
async function callAI({ systemPrompt, userPrompt, temperature = 0.3 }) {
  if (GROQ_API_KEY) {
    for (const model of GROQ_MODELS) {
      try {
        console.log(`🤖 Attempting Groq with model: ${model}...`);
        const res = await axios.post(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            model,
            messages: [
              { role: "system", content: systemPrompt || "You are MediBot, an expert clinical AI assistant." },
              { role: "user", content: userPrompt }
            ],
            temperature,
            max_tokens: 4096
          },
          {
            headers: {
              "Authorization": `Bearer ${GROQ_API_KEY}`,
              "Content-Type": "application/json"
            },
            timeout: 35000
          }
        );
        const reply = res.data?.choices?.[0]?.message?.content;
        if (reply && reply.trim().length > 0) {
          console.log(`✅ Groq success (${model})`);
          return reply.trim();
        }
      } catch (err) {
        console.warn(`⚠️ Groq model ${model} error:`, err.response?.data?.error?.message || err.message);
      }
    }
  }

  // Fallback to Gemini if Groq fails
  if (GEMINI_API_KEY) {
    try {
      console.log("🤖 Fallback: Attempting Gemini 2.0 Flash...");
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const fullPrompt = `${systemPrompt ? systemPrompt + "\n\n" : ""}${userPrompt}`;
      const result = await model.generateContent(fullPrompt);
      const reply = result.response.text();
      if (reply && reply.trim().length > 0) {
        console.log("✅ Gemini success");
        return reply.trim();
      }
    } catch (geminiErr) {
      console.warn("⚠️ Gemini fallback failed:", geminiErr.message);
    }
  }

  throw new Error("All AI engines (Groq and Gemini) were unable to process the request.");
}

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
  let token = req.headers["authorization"];

  if (!token) {
    return res.status(200).json({ success: false, message: "No token provided." });
  }

  // Handle "Bearer <token>" format
  if (token.startsWith("Bearer ")) {
    token = token.slice(7);
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log("Auth Error:", err.message);
      return res.status(200).json({ success: false, message: "Session expired. Please login again." });
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

app.post("/post-here", (req, res) => {
  console.log(req.body)
  return res.send("This is post: test")
})




app.post("/followup", verifyToken, async (req, res) => {
  try {
    const { insight, mode, userMessage, detailLevel = 3 } = req.body;

    if (!insight && !userMessage) {
      return res.json({ success: false, message: "No medical context provided" });
    }

    let systemPrompt = "You are MediBot, an empathetic and highly knowledgeable clinical AI specialist.";
    let userPrompt = "";

    if (mode === "diet") {
      userPrompt = `Based strictly on the following clinical medical findings:
"""
${insight}
"""
Generate an individualized, clinical-grade Diet & Nutritional Strategy (Detail Level: ${detailLevel}/5).
Include:
- Priority Foods to consume & Key Nutrients
- Foods and substances to restrict or avoid
- Sample daily meal framework
- Hydration and electrolyte considerations
Format cleanly with Markdown headers and bullet points.`;
    } else if (mode === "exercise") {
      userPrompt = `Based strictly on the following clinical medical findings:
"""
${insight}
"""
Generate an individualized, clinical-grade Exercise & Physical Therapy Protocol (Detail Level: ${detailLevel}/5).
Include:
- Recommended cardiovascular & resistance exercises
- Target heart rate / intensity guidance & weekly volume
- Specific exercises/movements to avoid given the findings
- Warm-up & cool-down recovery recommendations
Format cleanly with Markdown headers and bullet points.`;
    } else if (mode === "preset" || mode === "chat") {
      userPrompt = `Based on the following clinical report findings:
"""
${insight}
"""
Answer the user's specific follow-up question:
"${userMessage}"

Detail level: ${detailLevel}/5. Deliver a structured, accurate, and easy-to-understand explanation formatted in clean Markdown.`;
    } else {
      userPrompt = `Medical Report Context:\n"""\n${insight}\n"""\n\nQuestion / Request: ${userMessage || "Provide practical next steps."}`;
    }

    const reply = await callAI({ systemPrompt, userPrompt, temperature: 0.35 });

    return res.json({
      success: true,
      reply
    });

  } catch (err) {
    console.error("FOLLOWUP ERROR:", err);
    return res.json({
      success: false,
      message: "Failed to generate follow-up response: " + err.message
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
You are MediBot, an elite clinical AI diagnostic assistant. Analyze the uploaded medical report in detail and provide a comprehensive, structured clinical evaluation.

MEDICAL REPORT CONTENT:
"""
${fileContent}
"""

Please format your response strictly using clean, valid Markdown as follows:

# 🏥 Clinical Diagnostic Summary

## 1. 📊 Key Medical Biomarkers & Test Findings
Format the core test values into a markdown table with columns: [Test Parameter, Measured Result, Reference Range, Clinical Status (Normal / High / Low / Critical)].

## 2. 🩺 Diagnostic Assessment & Clinical Impressions
- **Primary / Indicated Conditions:**
- **Secondary / Potential Risk Factors:**
- **Inconclusive / Requiring Corroboration:**

## 3. 👨‍⚕️ Clinical Recommendations & Specialist Referrals
Detail specific medical specialists, tests to repeat, or monitoring protocols recommended.

## 4. 🥗 Personalized Nutrition & Dietary Action Plan
Actionable nutritional advice, foods to eat, foods to avoid, and hydration guidelines based directly on these test values.

## 5. 🏃 Exercise & Physical Activity Protocols
Safe exercise frequency, intensity, activities to prioritize or avoid.

## 6. ⚠️ Critical Warning Signs & Precautions
Symptoms or red flags requiring immediate physician consultation or urgent care.

Rules:
- Base all insights strictly on data in the report. Do not fabricate numerical values.
- Keep the language compassionate, authoritative, and structured.
`;

    const systemPrompt = "You are MediBot, an expert clinical analysis AI designed to assist patients in understanding their medical test reports.";
    const insight = await callAI({ systemPrompt, userPrompt: ANALYSIS_PROMPT, temperature: 0.25 });

    await Report.create({
      userId: req.userId,
      content: insight,
      createdAt: new Date(),
    });

    return res.json({ success: true, insight });

  } catch (err) {
    console.error("❌ Analyze Error:", err.message);
    return res.status(200).json({
      success: false,
      insight: `Analysis Error: ${err.message || "Failed to analyze document"}`
    });
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

app.delete("/appointments/:id", verifyToken, async (req, res) => {
  try {
    await Appointment.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ success: true, message: "Appointment deleted" });
  } catch (err) {
    res.json({ success: false, message: "Delete failed" });
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

app.delete("/medications/:id", verifyToken, async (req, res) => {
  try {
    await Medication.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ success: true, message: "Medication deleted" });
  } catch (err) {
    res.json({ success: false, message: "Delete failed" });
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
// --------------------------------------------------
app.post("/chat", verifyToken, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.json({ success: false, message: "Please provide a question." });
    }

    // 🌟 Fetch latest report for context
    const latestReport = await Report.findOne({ userId: req.userId }).sort({ createdAt: -1 });
    const user = await User.findById(req.userId);
    const userName = user ? user.name : "Patient";

    const context = latestReport
      ? `PATIENT'S RECENT MEDICAL RECORD:\n"""\n${latestReport.content}\n"""`
      : "No previous medical reports on record.";

    const systemPrompt = `You are MediBot Assistant, an intelligent, empathetic, and professional medical companion chatting with ${userName}.
You have direct access to their medical report history context below:
${context}

Instructions:
1. Greet warmly and address the patient by name when appropriate.
2. If asked about their report, refer precisely to the biomarkers, conclusions, or recommendations in the context.
3. If they ask about symptoms, diet, or lifestyle, provide clear, safe, evidence-based recommendations formatted with bold highlights and bullet points.
4. Always clarify that you provide clinical AI guidance, and advise consulting their physician for formal prescriptions.
5. Keep responses crisp, neat, and formatted with clean Markdown.`;

    const reply = await callAI({
      systemPrompt,
      userPrompt: message,
      temperature: 0.5
    });

    res.json({ success: true, reply });

  } catch (err) {
    console.error("CHAT ERROR:", err.message);
    res.json({ success: false, message: "MediBot Assistant is momentarily recalibrating. Please try again." });
  }
});

// --------------------------------------------------
// 🚀 START SERVER
// --------------------------------------------------
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
server.timeout = 120000; // 2 minutes
server.keepAliveTimeout = 120000;
