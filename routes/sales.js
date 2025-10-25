import express from "express";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config({ path: "./config/config.env" });

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Helper to format Stripe payment
function formatStripePayment(payment) {
  return {
    transactionId: payment.id,
    amount: (payment.amount / 100).toFixed(2),
    currency: payment.currency.toUpperCase(),
    status: payment.status,
    description: payment.description || "No description",
    date: new Date(payment.created * 1000).toLocaleDateString(),
    time: new Date(payment.created * 1000).toLocaleTimeString(),
    customerId: payment.customer || "N/A",
    customerEmail: payment.billing_details?.email || "N/A",
    paymentMethod: payment.payment_method_details?.card
      ? `${payment.payment_method_details.card.brand.toUpperCase()} **** ${payment.payment_method_details.card.last4}`
      : payment.payment_method_details?.type || "N/A",
  };
}

// GET: All Stripe transactions
router.get("/actual_sales", async (req, res) => {
  try {
    const charges = await stripe.charges.list({ limit: 50 });
    const transactions = charges.data.map(formatStripePayment);

    res.json({
      message: "Stripe transactions fetched successfully",
      transactions,
    });
  } catch (err) {
    console.error("Error fetching Stripe transactions:", err);
    res.status(500).json({
      message: "Failed to fetch Stripe transactions",
      error: err.message,
    });
  }
});

// GET: Refunds only
router.get("/refunds", async (req, res) => {
  try {
    const refunds = await stripe.refunds.list({ limit: 50 });

    const transactions = refunds.data.map((r) => ({
      refundId: r.id,
      amount: (r.amount / 100).toFixed(2),
      currency: r.currency.toUpperCase(),
      status: r.status,
      reason: r.reason || "N/A",
      created: new Date(r.created * 1000).toLocaleString(),
      paymentIntent: r.payment_intent || "N/A",
    }));

    res.json({
      message: "Stripe refunds fetched successfully",
      refunds: transactions,
    });
  } catch (err) {
    console.error("Error fetching Stripe refunds:", err);
    res.status(500).json({
      message: "Failed to fetch Stripe refunds",
      error: err.message,
    });
  }
});

// NEW: GET transactions for a specific customer
router.get("/actual_sales/:customerId", async (req, res) => {
  const { customerId } = req.params;

  if (!customerId) return res.status(400).json({ message: "Missing customerId" });

  try {
    const charges = await stripe.charges.list({ limit: 50, customer: customerId });
    const transactions = charges.data.map(formatStripePayment);

    res.json({
      message: `Stripe transactions fetched for customer ${customerId}`,
      customerId,
      transactions,
    });
  } catch (err) {
    console.error(`Error fetching transactions for customer ${customerId}:`, err);
    res.status(500).json({
      message: `Failed to fetch transactions for customer ${customerId}`,
      error: err.message,
    });
  }
});

export default router;
