#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ===== WiFi Configuration =====
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// ===== MQTT Configuration =====
const char* mqtt_server = "YOUR_SERVER_IP";  // Replace with your server's IP address
const int mqtt_port = 1883;
const char* mqtt_client_id = "ESP32_IOT_Device";

// ===== Device Configuration =====
String macAddress = "";  // Will be set from ESP32 MAC address
String topic_up = "";    // home/sensors/{MAC}/up
String topic_down = "";  // home/sensors/{MAC}/down

// ===== Sensor Configuration =====
// Indoor sensor (DHT22)
#define DHT_INDOOR_PIN 4
#define DHT_TYPE DHT22
DHT dhtIndoor(DHT_INDOOR_PIN, DHT_TYPE);

// Outdoor sensor (DHT22) - optional, use different pin
#define DHT_OUTDOOR_PIN 5
DHT dhtOutdoor(DHT_OUTDOOR_PIN, DHT_TYPE);

// ===== AC Control Pins =====
#define AC_POWER_PIN 2
#define AC_MODE_PIN_1 18
#define AC_MODE_PIN_2 19

// ===== State Variables =====
struct ACState {
  String power = "OFF";
  String mode = "COOL";
  float target_temp = 25.0;
  bool automation_mode = false;
};

ACState acState;

// ===== Timing =====
unsigned long lastSensorRead = 0;
const unsigned long sensorInterval = 5000;  // Read sensors every 5 seconds
unsigned long lastMQTTReconnect = 0;
const unsigned long mqttReconnectInterval = 5000;

WiFiClient espClient;
PubSubClient client(espClient);

// ===== Function Declarations =====
void setup_wifi();
void reconnect_mqtt();
void callback(char* topic, byte* payload, unsigned int length);
void publishSensorData();
void handleACCommand(JsonDocument& doc);
void setACPower(String power);
void setACMode(String mode);
String getMacAddress();

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Get MAC address
  macAddress = getMacAddress();
  topic_up = "home/sensors/" + macAddress + "/up";
  topic_down = "home/sensors/" + macAddress + "/down";

  Serial.println("\n=== ESP32 IoT Device ===");
  Serial.print("MAC Address: ");
  Serial.println(macAddress);
  Serial.print("Topic UP: ");
  Serial.println(topic_up);
  Serial.print("Topic DOWN: ");
  Serial.println(topic_down);

  // Initialize sensors
  dhtIndoor.begin();
  dhtOutdoor.begin();

  // Initialize AC control pins
  pinMode(AC_POWER_PIN, OUTPUT);
  pinMode(AC_MODE_PIN_1, OUTPUT);
  pinMode(AC_MODE_PIN_2, OUTPUT);
  digitalWrite(AC_POWER_PIN, LOW);  // AC OFF by default

  // Connect to WiFi
  setup_wifi();

  // Setup MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  // Maintain MQTT connection
  if (!client.connected()) {
    unsigned long now = millis();
    if (now - lastMQTTReconnect > mqttReconnectInterval) {
      lastMQTTReconnect = now;
      reconnect_mqtt();
    }
  }
  client.loop();

  // Read and publish sensor data periodically
  unsigned long now = millis();
  if (now - lastSensorRead > sensorInterval) {
    lastSensorRead = now;
    publishSensorData();
  }
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("");
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("");
    Serial.println("WiFi connection failed!");
  }
}

void reconnect_mqtt() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, reconnecting...");
    setup_wifi();
    return;
  }

  if (client.connected()) {
    return;
  }

  Serial.print("Attempting MQTT connection...");
  
  if (client.connect(mqtt_client_id)) {
    Serial.println("connected!");
    
    // Subscribe to command topic
    if (client.subscribe(topic_down.c_str())) {
      Serial.print("Subscribed to: ");
      Serial.println(topic_down);
    } else {
      Serial.println("Failed to subscribe!");
    }
  } else {
    Serial.print("failed, rc=");
    Serial.print(client.state());
    Serial.println(" try again in 5 seconds");
  }
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  
  // Convert payload to string
  char message[length + 1];
  for (int i = 0; i < length; i++) {
    message[i] = (char)payload[i];
  }
  message[length] = '\0';
  
  Serial.println(message);

  // Parse JSON
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, message);

  if (error) {
    Serial.print("JSON parsing failed: ");
    Serial.println(error.c_str());
    return;
  }

  // Handle the command
  handleACCommand(doc);
}

void handleACCommand(JsonDocument& doc) {
  String action = doc["action"] | "";

  Serial.print("Received action: ");
  Serial.println(action);

  if (action == "SET_POWER") {
    String power = doc["power"] | "OFF";
    setACPower(power);
    acState.power = power;
    Serial.print("AC Power set to: ");
    Serial.println(power);
  }
  else if (action == "SET_AC" || action == "SET_MODE") {
    // Handle SET_AC command (includes mode, power, target_temp)
    if (doc.containsKey("power")) {
      String power = doc["power"];
      setACPower(power);
      acState.power = power;
    }

    if (doc.containsKey("mode")) {
      String mode = doc["mode"];
      setACMode(mode);
      acState.mode = mode;
      Serial.print("AC Mode set to: ");
      Serial.println(mode);
    }

    if (doc.containsKey("target_temp")) {
      acState.target_temp = doc["target_temp"];
      Serial.print("Target temperature set to: ");
      Serial.println(acState.target_temp);
    }

    if (doc.containsKey("reason")) {
      Serial.print("Reason: ");
      Serial.println(doc["reason"].as<String>());
    }
  }
}

void setACPower(String power) {
  if (power == "ON") {
    digitalWrite(AC_POWER_PIN, HIGH);
    Serial.println("AC turned ON");
  } else {
    digitalWrite(AC_POWER_PIN, LOW);
    Serial.println("AC turned OFF");
  }
}

void setACMode(String mode) {
  // Control AC mode using 2 pins (4 modes: DRY, COOL, FAN, HEAT)
  // This is a simple example - adjust based on your AC control hardware
  if (mode == "DRY") {
    digitalWrite(AC_MODE_PIN_1, LOW);
    digitalWrite(AC_MODE_PIN_2, LOW);
  } else if (mode == "COOL") {
    digitalWrite(AC_MODE_PIN_1, HIGH);
    digitalWrite(AC_MODE_PIN_2, LOW);
  } else if (mode == "FAN") {
    digitalWrite(AC_MODE_PIN_1, LOW);
    digitalWrite(AC_MODE_PIN_2, HIGH);
  } else if (mode == "HEAT") {
    digitalWrite(AC_MODE_PIN_1, HIGH);
    digitalWrite(AC_MODE_PIN_2, HIGH);
  }
  Serial.print("AC Mode set to: ");
  Serial.println(mode);
}

void publishSensorData() {
  // Read indoor sensor
  float indoorTemp = dhtIndoor.readTemperature();
  float indoorHumi = dhtIndoor.readHumidity();

  // Read outdoor sensor
  float outdoorTemp = dhtOutdoor.readTemperature();
  float outdoorHumi = dhtOutdoor.readHumidity();

  // Check if readings are valid
  if (isnan(indoorTemp) || isnan(indoorHumi)) {
    Serial.println("Failed to read indoor DHT sensor!");
    // Use simulated data if sensor fails
    indoorTemp = 25.0 + (random(0, 50) - 25) / 10.0;  // 22.5-27.5°C
    indoorHumi = 50.0 + (random(0, 30) - 15);  // 35-65%
  }

  if (isnan(outdoorTemp) || isnan(outdoorHumi)) {
    Serial.println("Failed to read outdoor DHT sensor!");
    // Use simulated data if sensor fails
    outdoorTemp = 28.0 + (random(0, 60) - 30) / 10.0;  // 25-31°C
    outdoorHumi = 60.0 + (random(0, 40) - 20);  // 40-80%
  }

  // Create JSON payload
  JsonDocument doc;
  doc["temperature1"] = round(indoorTemp * 10) / 10.0;  // Round to 1 decimal
  doc["humidity1"] = round(indoorHumi);
  doc["temperature2"] = round(outdoorTemp * 10) / 10.0;
  doc["humidity2"] = round(outdoorHumi);

  // Serialize to string
  String payload;
  serializeJson(doc, payload);

  // Publish to MQTT
  if (client.connected()) {
    if (client.publish(topic_up.c_str(), payload.c_str())) {
      Serial.print("Published sensor data: ");
      Serial.println(payload);
    } else {
      Serial.println("Failed to publish sensor data!");
    }
  } else {
    Serial.println("MQTT not connected, cannot publish!");
  }
}

String getMacAddress() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  
  char macStr[18];
  snprintf(macStr, sizeof(macStr), "%02X:%02X:%02X:%02X:%02X:%02X",
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  
  return String(macStr);
}
