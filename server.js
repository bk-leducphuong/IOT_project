const express = require("express");
const bcrypt = require("bcrypt");
const session = require("express-session");
const bodyParser = require("body-parser");
const { User, Device } = require("./database/models");
const { connectDB } = require("./database/connect");
connectDB();

const { client } = require("./mqtt");

const app = express();
const PORT = 3000;

// Middleware
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(
  session({
    secret: "a-secret-key-for-the-session",
    resave: false,
    saveUninitialized: true,
  }),
);

// Routes
app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.render("login", {
        error: "Username and password are required",
      });
    }

    const user = await User.findOne({ username });

    if (!user) {
      return res.render("login", { error: "Invalid username or password" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      req.session.userId = user._id;
      return res.redirect("/dashboard");
    } else {
      return res.render("login", { error: "Invalid username or password" });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.render("login", { error: "An error occurred during login" });
  }
});

app.get("/signup", (req, res) => {
  res.render("signup", { error: null });
});

app.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.redirect("/login");
  } catch (error) {
    res.render("signup", { error: "Username already exists" });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.get("/dashboard", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  try {
    const user = await User.findById(req.session.userId);
    const devices = await Device.find({ _id: { $in: user.device_ids } });
    res.render("dashboard", { user, devices });
  } catch (error) {
    res.redirect("/login");
  }
});

app.post("/add-device", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  try {
    const { macAddress } = req.body;
    const user = await User.findById(req.session.userId);
    if (user && macAddress) {
      // Create a new device if it doesn't exist
      let device = await Device.findById(macAddress);
      if (!device) {
        device = new Device({ _id: macAddress });
        await device.save();
      }
      // Add device to user's list if not already there
      if (!user.device_ids.includes(macAddress)) {
        user.device_ids.push(macAddress);
        await user.save();
      }
      res.redirect("/dashboard");
    }
  } catch (error) {
    res.status(500).send("Error adding device");
  }
});

app.post("/toggle-automation", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  try {
    const { macAddress } = req.body;
    const device = await Device.findById(macAddress);
    if (device) {
      device.automation_mode = !device.automation_mode;
      await device.save();
    }
    res.redirect("/dashboard");
  } catch (error) {
    res.status(500).send("Error toggling automation");
  }
});

app.post("/update-temp", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  try {
    const { macAddress, action } = req.body;
    const device = await Device.findById(macAddress);
    if (device) {
      if (action === "warmer") {
        device.target_temp += 1;
      } else if (action === "colder") {
        device.target_temp -= 1;
      }
      await device.save();
    }
    res.redirect("/dashboard");
  } catch (error) {
    res.status(500).send("Error updating temperature");
  }
});

app.post("/update-humidity", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  try {
    const { macAddress, action } = req.body;
    const device = await Device.findById(macAddress);
    if (device) {
      if (action === "increase") {
        device.target_rh += 1;
      } else if (action === "decrease") {
        device.target_rh -= 1;
      }
      // Ensure humidity stays within reasonable bounds (0-100%)
      if (device.target_rh < 0) device.target_rh = 0;
      if (device.target_rh > 100) device.target_rh = 100;
      await device.save();
    }
    res.redirect("/dashboard");
  } catch (error) {
    res.status(500).send("Error updating humidity");
  }
});

app.post("/set-power", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  try {
    const { macAddress, power } = req.body;
    const device = await Device.findById(macAddress);
    if (device) {
      device.power = power;
      client.publish(
        `home/sensors/${macAddress}/down`,
        JSON.stringify({
          action: "SET_POWER",
          power: power,
        }),
      );
      console.log(`Sent power change to ${macAddress}: ${power}`);
      await device.save();
    }
    res.redirect("/dashboard");
  } catch (error) {
    res.status(500).send("Error updating power");
  }
});

app.post("/set-mode", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  try {
    const { macAddress, mode } = req.body;
    const device = await Device.findById(macAddress);
    if (device && ["DRY", "COOL", "FAN", "HEAT"].includes(mode)) {
      device.mode = mode;
      await device.save();

      // Publish mode change via MQTT if device is powered on
      if (device.power === "ON") {
        client.publish(
          `home/sensors/${macAddress}/down`,
          JSON.stringify({
            action: "SET_MODE",
            mode: mode,
          }),
        );
        console.log(`Sent mode change to ${macAddress}: ${mode}`);
      }
    }
    res.redirect("/dashboard");
  } catch (error) {
    res.status(500).send("Error updating mode");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
