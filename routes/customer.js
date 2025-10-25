import express from "express";
import Stripe from "stripe";
import dotenv from "dotenv";
import User from "../models/User.js";
import B2BStripeCustomers from "../models/B2BStripeCustomers.js";

dotenv.config({ path: "./config/config.env" });

const router = express.Router();

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is missing in environment");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const initMonthlyData = () => ({
  January: { actual: 0 },
  February: { actual: 0 },
  March: { actual: 0 },
  April: { actual: 0 },
  May: { actual: 0 },
  June: { actual: 0 },
  July: { actual: 0 },
  August: { actual: 0 },
  September: { actual: 0 },
  October: { actual: 0 },
  November: { actual: 0 },
  December: { actual: 0 },
});

router.get("/actual_customer/:businessId", async (req, res) => {
  const { businessId } = req.params;

  try {
    const user = await User.findById(businessId);
    if (!user) return res.status(404).json({ message: "Business not found" });
    if (!user.stripe?.accountId)
      return res.status(400).json({ message: "Stripe account not connected for this business" });

    // Fetch customers from Stripe
    const customersList = await stripe.customers.list(
      { limit: 100 },
      { stripeAccount: user.stripe.accountId }
    );

    const currentYear = new Date().getFullYear();
    const monthlyData = initMonthlyData();

    customersList.data.forEach((customer) => {
      const createdDate = new Date(customer.created * 1000);
      const month = createdDate.toLocaleString("en-US", { month: "long" });
      if (monthlyData[month]) monthlyData[month].actual += 1;
    });

    const totalCustomers = customersList.data.length;
    const averageCustomers = totalCustomers ? Math.floor(totalCustomers / 12) : 0;

    const customerData = {
      contact: user._id.toString(),
      message: "Customers actuals details retrieved",
      target_market: "Business owners",
      data: {
        [currentYear]: {
          total_customers: totalCustomers,
          average_customers: averageCustomers,
          monthly_data: monthlyData,
        },
      },
    };

    
    const updated = await B2BStripeCustomers.findOneAndUpdate(
      { businessId: user._id },
      { ...customerData, businessId: user._id },
      { upsert: true, new: true }
    );

    
    const output = {
      contact: updated.contact,
      message: updated.message,
      target_market: updated.target_market,
      updatedAt: updated.updatedAt,
      data: updated.data,
    };

    res.json(output);
  } catch (err) {
    console.error("Error fetching customers for business:", err);
    res.status(500).json({ message: "Failed to fetch customers", error: err.message });
  }
});

export default router;
