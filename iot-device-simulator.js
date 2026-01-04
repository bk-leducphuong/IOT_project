const mqtt = require("mqtt");

const MQTT_BROKER_URL = "mqtt://localhost:1883";
const MAC_ADDRESS = "12:34:56:78:90:AB"; // Replace with your device's MAC address

const UP_TOPIC = `home/sensors/${MAC_ADDRESS}/up`;
const DOWN_TOPIC = `home/sensors/${MAC_ADDRESS}/down`;

const client = mqtt.connect(MQTT_BROKER_URL);

client.on("connect", () => {
  console.log("Connected to MQTT broker");

  // Subscribe to the 'down' topic
  client.subscribe(DOWN_TOPIC, (err) => {
    if (err) {
      console.error("Subscription error:", err);
    } else {
      console.log(`Subscribed to topic: ${DOWN_TOPIC}`);
    }
  });

  // Publish sensor data every 5 seconds
  setInterval(() => {
    const temperature1 = (Math.random() * 10 + 20).toFixed(2); // 20-30°C
    const humidity1 = (Math.random() * 20 + 50).toFixed(2); // 50-70%
    const temperature2 = (Math.random() * 15 + 15).toFixed(2); // 15-30°C
    const humidity2 = (Math.random() * 30 + 40).toFixed(2); // 40-70%
    const payload = JSON.stringify({
      temperature1: parseFloat(temperature1),
      humidity1: parseFloat(humidity1),
      temperature2: parseFloat(temperature2),
      humidity2: parseFloat(humidity2),
    });

    client.publish(UP_TOPIC, payload, (err) => {
      if (err) {
        console.error("Publish error:", err);
      } else {
        console.log(`Published to ${UP_TOPIC}: ${payload}`);
      }
    });
  }, 5000);
});

client.on("message", (topic, message) => {
  console.log(`Received message from ${topic}: ${message.toString()}`);
});

client.on("error", (err) => {
  console.error("MQTT client error:", err);
});
