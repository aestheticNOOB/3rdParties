import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config({ path: "./config/config.env" });

const stripe = new Stripe(process.env.STRIPE_KEY);

export const getStripePayments = async () => {
  const payments = await stripe.paymentIntents.list({ limit: 50 });
  return payments.data.map(p => ({
    payment_intent_id: p.id,
    customer_id: p.customer || "N/A",
    customer_name: p.customer || "N/A",
    amount: (p.amount / 100).toFixed(2),  // Stripe amounts are in cents
    currency: p.currency.toUpperCase(),
    description: p.description || "No description",
    payment_method: p.payment_method_types[0] || "N/A",
    status: p.status,
    date: new Date(p.created * 1000).toLocaleDateString(),
    time: new Date(p.created * 1000).toLocaleTimeString(),
  }));
};
