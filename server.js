import dotenv from "dotenv";
dotenv.config({ path: "./config/config.env" });

import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import connectDB from "./config/db.config.js";
import createSalesRouter from "./routes/sales.js";
import authRoutes from "./routes/auth.js";
import connectStripe from "./routes/connectStripe.js";

const app = express();
app.use(cors());
app.use(express.json());

// Connect DB
connectDB();

// Routes
app.use("/sales", createSalesRouter());
app.use("/sales", authRoutes);
app.use("/stripe", connectStripe);

app.get("/", (req, res) => res.send("Server running successfully!"));

// Start server
const PORT = process.env.PORT || 3007;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
