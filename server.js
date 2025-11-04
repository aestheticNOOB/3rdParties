import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.config.js";

import authRoutes from "./routes/auth.js";
import connectStripeRoutes from "./routes/connectStripe.js";
import salesRoutes from "./routes/sales.js";
import customerRoutes from "./routes/customer.js"; 
import StripeConnection from "./routes/StripeConnect.js" ;
import XeroRoutes from "./routes/Xero.js";

dotenv.config({ path: "./config/config.env" });

// Connect to MongoDB
connectDB();

const app = express();
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/connect",StripeConnection)
app.use("/connection", connectStripeRoutes); // Stripe connect routes
app.use("/sales", salesRoutes);           // Actual sales routes
app.use("/customers", customerRoutes);    // Customer data routes
app.use("/xero", XeroRoutes);


app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

const PORT = process.env.PORT || 3007;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
