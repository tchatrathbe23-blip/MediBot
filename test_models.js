require("dotenv").config();
const axios = require("axios");

const key = process.env.GEMINI_API_KEY;
const models = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"];

async function test() {
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    try {
      console.log(`Testing ${model}...`);
      const resp = await axios.post(url, { contents: [{ parts: [{ text: "hi" }] }] });
      console.log(`✅ ${model} works!`);
      return;
    } catch (err) {
      console.log(`❌ ${model} failed: ${err.response?.status} - ${err.response?.data?.error?.message}`);
    }
  }
}

test();
