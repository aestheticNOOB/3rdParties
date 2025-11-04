import mongoose from "mongoose";

const salesSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  transactions: [
    {
      id: String,
      amount: Number,
      currency: String,
      status: String,
      created: Number,
      description: String,
    },
  ],
});

export default mongoose.model("BusinessStripeSales", salesSchema);
