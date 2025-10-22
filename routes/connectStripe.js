import dotenv from "dotenv";
dotenv.config({ path: "./config/config.env" });

import express from "express";
import Stripe from "stripe";
import axios from "axios";
import User from "../models/User.js";
import BusinessStripeSales from "../models/businessStripeSales.js";

const router = express.Router();

//  Stripe Initialization with validation
if (!process.env.STRIPE_SECRET_KEY) {
  console.error(" STRIPE_SECRET_KEY is missing in environment variables!");
  throw new Error("Missing Stripe Secret Key in environment");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


// 1️ Generate Stripe Connect URL
router.get("/connect/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) return res.status(400).json({ message: "Missing userId in request" });

  try {
    const stripeAuthUrl = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${process.env.STRIPE_CLIENT_ID}&scope=read_write&redirect_uri=${process.env.STRIPE_REDIRECT_URI}&state=${userId}`;

    res.json({ stripeAuthUrl });
  } catch (err) {
    console.error("Stripe connect error:", err);
    res.status(500).json({ message: "Failed to generate Stripe Connect URL" });
  }
});

// 2️ Stripe OAuth Callback
router.get("/stripe/callback", async (req, res) => {
  const { code, state: userId } = req.query;

  if (!code || !userId)
    return res.status(400).json({ message: "Missing Stripe authorization code or userId" });

  try {
    const response = await axios.post("https://connect.stripe.com/oauth/token", null, {
      params: {
        grant_type: "authorization_code",
        client_id: process.env.STRIPE_CLIENT_ID,
        client_secret: process.env.STRIPE_SECRET_KEY,
        code,
      },
    });

    const { access_token, refresh_token, stripe_user_id } = response.data;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Business not found" });

    await User.findByIdAndUpdate(userId, {
      stripe: {
        accountId: stripe_user_id,
        accessToken: access_token,
        refreshToken: refresh_token,
      },
    });

    res.json({
      message: "Stripe account connected successfully!",
      userId,
      stripeUserId: stripe_user_id,
    });
  } catch (error) {
    console.error("Stripe OAuth Error:", error.response?.data || error.message);
    res.status(500).json({
      message: "Stripe OAuth failed",
      error: error.response?.data?.error_description || error.message,
    });
  }
});

// 3️ Fetch Transactions
router.get("/transactions/:userId", async (req, res) => {
  let { userId } = req.params;
  userId = userId.trim(); 

  if (!userId) return res.status(400).json({ message: "Missing userId" });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Business not found" });
    if (!user?.stripe?.accountId)
      return res.status(400).json({ message: "Stripe not connected for this user" });

    const charges = await stripe.charges.list(
      { limit: 20 },
      { stripeAccount: user.stripe.accountId }
    );

    const transactions = charges.data.map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      created: tx.created,
      description: tx.description,
    }));

    let sales = await BusinessStripeSales.findOne({ businessId: user._id });
    if (!sales)
      sales = new BusinessStripeSales({ businessId: user._id, transactions });
    else sales.transactions = transactions;

    await sales.save();

    res.json({ message: "Transactions fetched successfully", transactions });
  } catch (error) {
    console.error("Transaction fetch error:", error);
    res.status(500).json({
      message: "Failed to fetch transactions",
      error: error.message,
    });
  }
});

export default router;
