import express from "express";
import Stripe from "stripe";
import axios from "axios";
import dotenv from "dotenv";
import Business from "../models/Business.js";

dotenv.config({ path: "./config/config.env" });

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST /connect/connect -> generate Stripe connect URL
router.post("/connect", async (req, res) => {
  const { BID } = req.body;
  if (!BID) return res.status(400).json({ message: "Missing BID in request body" });

  try {
    const business = await Business.findOne({ BID });
    if (!business) return res.status(404).json({ message: "Business not found" });

    // Use THIRD_PARTY_URL or BASE_URL for redirect
    const redirectUri = `${process.env.THIRD_PARTY_URL}/connect/stripe/callback`;

    // Stripe OAuth endpoints are always fixed
    const stripeAuthUrl = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${process.env.STRIPE_CLIENT_ID}&scope=read_write&redirect_uri=${redirectUri}&state=${BID}`;

    res.json({
      message: "Stripe Connect URL generated",
      BID,
      stripeAuthUrl
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to generate Stripe connect URL", error: err.message });
  }
});

// GET /connect/stripe/callback -> handle Stripe OAuth
router.get("/stripe/callback", async (req, res) => {
  const { code, state: BID } = req.query;
  if (!code || !BID) return res.status(400).json({ message: "Missing code or BID" });

  try {
    const response = await axios.post(`https://connect.stripe.com/oauth/token`, null, {
      params: {
        grant_type: "authorization_code",
        client_id: process.env.STRIPE_CLIENT_ID,
        client_secret: process.env.STRIPE_SECRET_KEY,
        code
      }
    });

    const { access_token, refresh_token, stripe_user_id } = response.data;

    await Business.findOneAndUpdate(
      { BID },
      { 
        stripe: {
          accountId: stripe_user_id,
          accessToken: access_token,
          refreshToken: refresh_token,
          connected: true,
          connectedAt: new Date()
        }
      },
      { new: true }
    );

    res.json({ message: "Stripe account connected successfully", BID, stripe_user_id });
  } catch (err) {
    res.status(500).json({ message: "Stripe OAuth failed", error: err.response?.data?.error_description || err.message });
  }
});

// POST /connect/transactions -> fetch Stripe transactions
router.post("/transactions", async (req, res) => {
  const { BID } = req.body;
  if (!BID) return res.status(400).json({ message: "Missing BID in request body" });

  try {
    const business = await Business.findOne({ BID });
    if (!business?.stripe?.accountId)
      return res.status(404).json({ message: "Stripe account not connected for this business" });

    const allTransactions = [];
    let hasMore = true;
    let startingAfter = null;

    while (hasMore) {
      const params = { limit: 100 };
      if (startingAfter) params.starting_after = startingAfter;

      const balanceTxns = await stripe.balanceTransactions.list(params, {
        stripeAccount: business.stripe.accountId
      });

      for (const tx of balanceTxns.data) {
        allTransactions.push({
          transactionId: tx.id,
          amount: (tx.amount / 100).toFixed(2),
          currency: tx.currency.toUpperCase(),
          date: new Date(tx.created * 1000).toLocaleString(),
          type: tx.type,
          description: tx.description || tx.reporting_category || "N/A",
          status: tx.status || "N/A",
          fee: tx.fee ? (tx.fee / 100).toFixed(2) : "0.00",
          net: tx.net ? (tx.net / 100).toFixed(2) : "0.00",
          customerEmail: tx.source?.billing_details?.email || "N/A",
          paymentMethod: tx.source?.payment_method_details?.type || "N/A",
          sourceId: tx.source?.id || "N/A"
        });
      }

      hasMore = balanceTxns.has_more;
      if (hasMore) startingAfter = balanceTxns.data[balanceTxns.data.length - 1].id;
    }

    res.json({ message: "Transactions fetched successfully", count: allTransactions.length, transactions: allTransactions });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch transactions", error: err.message });
  }
});

export default router;
