import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // using environment variable if available, else fallback to local DB
    const uri =
      process.env.MONGO_URI ||
      `mongodb://localhost:27017/DB`;

    if (!uri) {
      throw new Error(" MONGO_URI not found in environment variables or config.");
    }

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10s timeout for better error clarity
    });

    console.log(` MongoDB Connected Successfully`);
  } catch (error) {
    console.error(" MongoDB Connection Failed!");
    console.error(`Error: ${error.message}`);
    process.exit(1); 
  }
};

export default connectDB;
