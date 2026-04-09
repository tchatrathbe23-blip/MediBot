require("dotenv").config();
const axios = require("axios");
const key = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${key}`;

axios.post(url, { contents: [{ parts: [{ text: "hi" }] }] })
  .then(() => console.log("SUCCESS!"))
  .catch(err => console.log("ERROR:", err.response?.status, err.response?.data?.error?.message));
