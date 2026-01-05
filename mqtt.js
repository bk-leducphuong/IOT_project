const mqtt = require("mqtt");
const { g36Control } = require("./algorithm");
const { Device, ActionLog } = require("./database/models");

// MQTT Client
const MQTT_BROKER_URL = "mqtt://localhost:1883";
const client = mqtt.connect(MQTT_BROKER_URL);

client.on("connect", () => {
  console.log("MQTT client connected");
  client.subscribe(`home/sensors/+/up`, (err) => {
    if (err) {
      console.error("MQTT subscription error:", err);
    }
  });
});

// Helper function to validate sensor payload
function validateSensorPayload(data) {
  return (
    data &&
    typeof data.temperature1 === "number" &&
    typeof data.humidity1 === "number" &&
    typeof data.temperature2 === "number" &&
    typeof data.humidity2 === "number" &&
    !isNaN(data.temperature1) &&
    !isNaN(data.humidity1) &&
    !isNaN(data.temperature2) &&
    !isNaN(data.humidity2)
  );
}

client.on("message", async (topic, message) => {
  // console.log(`Received message on topic ${topic}: ${message.toString()}`);
  try {
    const data = JSON.parse(message.toString());
    const macAddress = topic.split("/")[2];
    console.log(`Received message on topic ${topic}: ${message.toString()}`);

    /* data format:
     * {
     *   temperature1: number,  // Indoor temperature (°C)
     *   humidity1: number,    // Indoor relative humidity (%)
     *   temperature2: number, // Outdoor temperature (°C)
     *   humidity2: number,    // Outdoor relative humidity (%)
     * }
     * */

    if (data && validateSensorPayload(data)) {
      const device = await Device.findById(macAddress);

      // Save current temperature and humidity
      if (device) {
        device.current_temp = data.temperature1;
        device.current_rh = data.humidity1;
        await device.save();
      }

      // Only process if device exists, automation is enabled, and power is ON
      if (device && device.automation_mode && device.power === "ON") {
        // Call the G36 control algorithm
        const controlResult = g36Control({
          T_room: data.temperature1,
          RH_room: data.humidity1,
          T_outdoor: data.temperature2,
          userTempSet: device.target_temp,
          userRHSet: device.target_rh,
        });

        // Update device mode in database
        if (
          controlResult.mode !== "OFF" &&
          controlResult.mode !== device.mode
        ) {
          device.mode = controlResult.mode;
          await device.save();
        }

        // Prepare MQTT command based on algorithm result
        if (controlResult.mode === "OFF") {
          // Within comfort deadband - turn off AC
          if (device.power === "ON") {
            device.power = "OFF";
            await device.save();

            const mqttPayload = JSON.stringify({
              action: "SET_POWER",
              power: "OFF",
            });

            client.publish(`home/sensors/${macAddress}/down`, mqttPayload);

            // Log action
            const actionLog = new ActionLog({
              actor: "AUTOMATION",
              actionType: "SET_POWER",
              description: `AC turned OFF - ${controlResult.reason}`,
              timestamp: new Date(),
              deviceMacAddress: macAddress,
            });
            await actionLog.save();

            console.log(
              `Sent AC_OFF command to ${macAddress} - Reason: ${controlResult.reason}`,
            );
          }
        } else {
          // Ensure device power is ON for active modes
          if (device.power !== "ON") {
            device.power = "ON";
            await device.save();
          }

          // Send mode and target temperature command
          const mqttCommand = {
            action: "SET_AC",
            power: "ON",
            mode: controlResult.mode,
            reason: controlResult.reason,
          };

          // Only include target_temp if it's not null
          if (controlResult.targetTemperature !== null) {
            mqttCommand.target_temp = controlResult.targetTemperature;
          }

          client.publish(
            `home/sensors/${macAddress}/down`,
            JSON.stringify(mqttCommand),
          );

          // Log action
          const actionLog = new ActionLog({
            actor: "AUTOMATION",
            actionType: "SET_MODE",
            description: `Mode set to ${controlResult.mode}, target temp: ${controlResult.targetTemperature ?? "N/A"}°C - ${controlResult.reason}`,
            timestamp: new Date(),
            deviceMacAddress: macAddress,
          });
          await actionLog.save();

          console.log(
            `Sent AC command to ${macAddress}: mode=${controlResult.mode}, ` +
              `target_temp=${controlResult.targetTemperature ?? "N/A"}, ` +
              `reason=${controlResult.reason}`,
          );
        }
      }
    }
  } catch (err) {
    console.error("Error processing MQTT message:", err);
  }
});

module.exports = { client };
