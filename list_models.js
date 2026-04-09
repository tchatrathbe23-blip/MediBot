require("dotenv").config();
const axios = require("axios");
const key = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

axios.get(url)
  .then(resp => {
    console.log("MODELS:", resp.data.models.map(m => m.name).join(", "));
  })
  .catch(err => console.log("ERROR:", err.response?.status, err.response?.data?.error?.message));
