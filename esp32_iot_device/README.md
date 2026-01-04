# ESP32 IoT Device Program

This ESP32 program connects to your IoT server via MQTT to send sensor data and receive AC control commands.

## Features

- ✅ WiFi connection
- ✅ MQTT client for bidirectional communication
- ✅ DHT22 sensor support (indoor and outdoor)
- ✅ AC control via GPIO pins
- ✅ Automatic reconnection
- ✅ JSON message parsing

## Hardware Requirements

- ESP32 development board
- DHT22 temperature/humidity sensors (2x - indoor and outdoor)
- AC control relay module (optional, for actual AC control)
- Jumper wires

## Pin Configuration

### Sensors
- **DHT22 Indoor**: Pin 4
- **DHT22 Outdoor**: Pin 5

### AC Control
- **AC Power**: Pin 2
- **AC Mode Pin 1**: Pin 18
- **AC Mode Pin 2**: Pin 19

*Note: Adjust pins based on your hardware setup*

## Installation

1. **Install Arduino IDE** (if not already installed)
   - Download from: https://www.arduino.cc/en/software

2. **Install ESP32 Board Support**
   - In Arduino IDE: File → Preferences
   - Add to Additional Board Manager URLs:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Tools → Board → Boards Manager
   - Search for "ESP32" and install "esp32 by Espressif Systems"

3. **Install Required Libraries**
   - **WiFi** (built-in)
   - **PubSubClient**: Tools → Manage Libraries → Search "PubSubClient" → Install
   - **ArduinoJson**: Tools → Manage Libraries → Search "ArduinoJson" → Install
   - **DHT sensor library**: Tools → Manage Libraries → Search "DHT sensor library" → Install

4. **Configure the Program**
   - Open `esp32_iot_device.ino` in Arduino IDE
   - Update the following constants:
     ```cpp
     const char* ssid = "YOUR_WIFI_SSID";
     const char* password = "YOUR_WIFI_PASSWORD";
     const char* mqtt_server = "YOUR_SERVER_IP";  // e.g., "192.168.1.100"
     ```

5. **Upload to ESP32**
   - Connect ESP32 via USB
   - Select board: Tools → Board → ESP32 Dev Module
   - Select port: Tools → Port → (your ESP32 port)
   - Click Upload button

## MQTT Topics

### Publishing (ESP32 → Server)
- **Topic**: `home/sensors/{MAC_ADDRESS}/up`
- **Payload Format**:
  ```json
  {
    "temperature1": 25.5,
    "humidity1": 60,
    "temperature2": 28.0,
    "humidity2": 65
  }
  ```

### Subscribing (Server → ESP32)
- **Topic**: `home/sensors/{MAC_ADDRESS}/down`
- **Command Format**:
  ```json
  {
    "action": "SET_AC",
    "power": "ON",
    "mode": "COOL",
    "target_temp": 24,
    "reason": "Mechanical cooling (G36)"
  }
  ```
  or
  ```json
  {
    "action": "SET_POWER",
    "power": "OFF"
  }
  ```

## AC Control

The program controls AC via GPIO pins:
- **Power Control**: Pin 2 (HIGH = ON, LOW = OFF)
- **Mode Control**: Pins 18 & 19 (binary encoding for 4 modes)

### Mode Encoding
- **DRY**: Pin1=LOW, Pin2=LOW
- **COOL**: Pin1=HIGH, Pin2=LOW
- **FAN**: Pin1=LOW, Pin2=HIGH
- **HEAT**: Pin1=HIGH, Pin2=HIGH

*Note: Adjust the `setACMode()` function based on your actual AC control hardware (IR, relay, etc.)*

## Testing

1. **Serial Monitor**
   - Open Serial Monitor (115200 baud)
   - Check for connection messages
   - Verify sensor readings
   - Monitor MQTT messages

2. **Verify MQTT Connection**
   - Check server logs for incoming messages
   - Send test commands from dashboard
   - Verify ESP32 receives and processes commands

## Troubleshooting

### WiFi Connection Issues
- Verify SSID and password are correct
- Check WiFi signal strength
- Ensure 2.4GHz network (ESP32 doesn't support 5GHz)

### MQTT Connection Issues
- Verify server IP address is correct
- Check if MQTT broker is running (port 1883)
- Ensure firewall allows port 1883
- Check server logs for connection attempts

### Sensor Reading Issues
- Verify DHT22 connections (VCC, GND, DATA)
- Check if pull-up resistor is needed (usually 4.7kΩ)
- Try different pins if readings fail
- Program will use simulated data if sensors fail

### AC Control Not Working
- Verify GPIO pin connections
- Check if relay module is properly connected
- Adjust pin numbers in code if needed
- Modify `setACMode()` function for your hardware

## Customization

### Change Sensor Reading Interval
```cpp
const unsigned long sensorInterval = 5000;  // Change to desired milliseconds
```

### Use Different Pins
Update pin definitions at the top of the file:
```cpp
#define DHT_INDOOR_PIN 4
#define AC_POWER_PIN 2
// etc.
```

### Add More Sensors
Add sensor initialization and reading in `publishSensorData()` function.

## License

This code is provided as-is for your IoT project.
