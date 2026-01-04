const mongoose = require("mongoose");

// MongoDB Connection
exports.connectDB = async () => {
  const MONGO_URI = "mongodb://localhost:27017/iot_project"; // Replace with your MongoDB connection string
  await mongoose
    .connect(MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.log(err));
};
