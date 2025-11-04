import express from "express";
import Stripe from "stripe";
import axios from "axios";
import dotenv from "dotenv";
import User from "../models/User.js";
import BusinessStripeSales from "../models/businessStripeSales.js";

dotenv.config({ path: "./config/config.env" });

const router = express.Router();
const THIRD_PARTY_URL = process.env["3rdPartyURL"];

if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_CLIENT_ID) {
  throw new Error("Missing Stripe keys in environment");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Generate Stripe Connect URL
router.get("/connect/:userId", (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ message: "Missing userId" });

  const redirectUri = `${THIRD_PARTY_URL}/connect/stripe/callback`;
  const stripeAuthUrl = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${process.env.STRIPE_CLIENT_ID}&scope=read_write&redirect_uri=${redirectUri}&state=${userId}`;

  res.json({ stripeAuthUrl });
});

// Stripe OAuth Callback
router.get("/stripe/callback", async (req, res) => {
  const { code, state: userId } = req.query;
  if (!code || !userId)
    return res.status(400).json({ message: "Missing code or userId" });

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

    await User.findByIdAndUpdate(userId, {
      stripe: {
        accountId: stripe_user_id,
        accessToken: access_token,
        refreshToken: refresh_token,
      },
    });

    res.json({ message: "Stripe account connected successfully", stripeUserId: stripe_user_id });
  } catch (err) {
    res.status(500).json({ message: "Stripe OAuth failed", error: err.response?.data?.error_description || err.message });
  }
});

// Fetch Stripe transactions
router.get("/transactions/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user || !user.stripe?.accountId)
      return res.status(404).json({ message: "Stripe account not connected" });

    const charges = await stripe.charges.list({ limit: 50 }, { stripeAccount: user.stripe.accountId });

    const transactions = charges.data.map((tx) => ({
      transactionId: tx.id,
      amount: (tx.amount / 100).toFixed(2),
      currency: tx.currency,
      date: new Date(tx.created * 1000).toLocaleString(),
      description: tx.description || "",
      status: tx.status,
      source: "stripe",
      paymentMethod: tx.payment_method_details?.card
        ? `${tx.payment_method_details.card.brand.toUpperCase()} **** ${tx.payment_method_details.card.last4}`
        : "N/A",
      customerEmail: tx.billing_details?.email || "N/A",
    }));

    await BusinessStripeSales.findOneAndUpdate({ businessId: user._id }, { transactions }, { upsert: true });

    res.json({ message: "Transactions fetched successfully", transactions });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch transactions", error: err.message });
  }
});

export default router;