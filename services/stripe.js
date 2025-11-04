import axios from "axios";

export async function getStripePayments(stripeAccountId) {
  try {
    const response = await axios.get("https://api.stripe.com/v1/charges", {
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_KEY}`,
        "Stripe-Account": stripeAccountId,
      },
      params: { limit: 50 },
    });

    return response.data.data.map((c) => ({
      transactionId: c.id,
      amount: c.amount / 100,
      currency: c.currency,
      date: new Date(c.created * 1000),
      description: c.description || "",
      status: c.status,
      source: "stripe",
    }));
  } catch (err) {
    console.error("❌ Error fetching Stripe transactions:", err.response?.data || err.message);
    return [];
  }
}
