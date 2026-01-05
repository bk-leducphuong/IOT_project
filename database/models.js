const mongoose = require("mongoose");

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  device_ids: [{ type: String }],
});

const User = mongoose.model("User", userSchema);

// Device Schema
const deviceSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // MAC Address
  target_temp: { type: Number, default: 25 },
  target_rh: { type: Number, default: 60 },
  current_temp: { type: Number },
  current_rh: { type: Number },
  automation_mode: { type: Boolean, default: false },
  power: { type: String, enum: ["ON", "OFF"], default: "OFF" },
  mode: { type: String, enum: ["DRY", "COOL", "FAN", "HEAT"], default: "COOL" },
});

const Device = mongoose.model("Device", deviceSchema);

// Action Log Schema
const actionLogSchema = new mongoose.Schema({
  actor: { type: String, required: true, enum: ["AUTOMATION", "USER"] },
  actionType: { type: String, required: true, enum: ["SET_POWER", "SET_MODE"] },
  description: { type: String, required: false, default: "" },
  timestamp: { type: Date, required: true },
  deviceMacAddress: { type: String, required: true },
});

const ActionLog = mongoose.model("ActionLog", actionLogSchema);

module.exports = { User, Device, ActionLog };
