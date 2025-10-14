import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import dbConfig from "./config/db.config.js";
import createSalesRouter from "./routes/sales.js";

dotenv.config({ path: "./config/config.env" });

const app = express();
app.use(cors());
app.use(express.json());

// --- MongoDB connection ---
const mongoURI = `mongodb://${dbConfig.HOST}:${dbConfig.PORT}/${dbConfig.DB}`;
mongoose.connect(mongoURI)
  .then(() => console.log(" MongoDB connected"))
  .catch(err => console.error(" MongoDB connection error:", err));

// --- Routes ---
app.use("/sales", createSalesRouter());

// --- Start server ---
const PORT = process.env.PORT || 3007;
app.listen(PORT, () => console.log(` Server running on port ${PORT}`));
