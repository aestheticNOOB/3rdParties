import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  payment_intent_id: String,
  customer_id: String,
  customer_name: String,
  amount: String,
  currency: String,
  description: String,
  payment_method: String,
  status: String,
  date: String,
  time: String,
}, { timestamps: true });

export const Transaction = mongoose.model("Transaction", transactionSchema);

export const getAllTransactions = async () => {
  return await Transaction.find().sort({ createdAt: -1 }).lean();
}; 