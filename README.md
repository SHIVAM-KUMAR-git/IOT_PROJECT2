# SISTec Smart IoT Monitoring System 2026

Welcome to the SISTec Smart IoT Monitoring System! This project provides a complete end-to-end IoT solution featuring an ESP8266 hardware edge device, a Node.js Express backend, and a modern Tailwind CSS dashboard.

## Features
- **Live Sensor Monitoring**: Temperature, Humidity, Soil Moisture, and Object Detection.
- **Object Counting & Alerts**: IR Sensor detects objects, increments count, triggers a buzzer, and logs history.
- **LCD Integration**: Real-time sensor display and custom message fetching from the dashboard.
- **Blynk Control**: Control physical LEDs directly from the dashboard via the Blynk API.
- **Responsive Dashboard**: Glassmorphism UI, Dial Gauges, Chart.js live graphs.

## Project Structure
```
project/
│
├── backend/               # Node.js Express Server
│   ├── server.js          # API logic & routes
│   ├── db.json            # Local JSON Database
│   ├── lcd.txt            # Temporary storage for LCD messages
│   └── package.json       # Node dependencies
│
├── public/                # Frontend Web Dashboard
│   ├── index.html         # Login Page
│   ├── register.html      # Registration Page
│   ├── dashboard.html     # Main UI
│   ├── style.css          # Custom styles & animations
│   └── app.js             # API integration and Chart.js logic
│
├── esp8266/               # Hardware Firmware
│   └── esp8266_code.ino   # Arduino code for ESP8266
│
└── README.md
```

---

## 🚀 Installation & Setup Steps

### 1. Backend Setup
1. Open terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. The server runs at `http://localhost:3000`. It automatically serves the frontend files from the `public` folder.
5. Open your browser and go to `http://localhost:3000` to view the login page.

### 2. Arduino IDE Setup
1. Open Arduino IDE and go to **File -> Preferences**.
2. Add the ESP8266 board manager URL: `http://arduino.esp8266.com/stable/package_esp8266com_index.json`
3. Go to **Tools -> Board -> Boards Manager**, search for `esp8266`, and install it.
4. Select your board (e.g., **NodeMCU 1.0 (ESP-12E Module)**).
5. Install necessary libraries via **Sketch -> Include Library -> Manage Libraries**:
   - `DHT sensor library` by Adafruit
   - `LiquidCrystal I2C` by Frank de Brabander
   - `ArduinoJson` (optional, if you plan to parse complex JSON in the future)

### 3. ESP8266 Firmware Flashing
1. Open `esp8266/esp8266_code.ino`.
2. Update the WiFi Credentials:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```
3. Update the Server URLs (if deploying to Render):
   ```cpp
   const String serverUrl = "https://your-backend.onrender.com/api/sensor-data";
   const String lcdApiUrl = "https://your-backend.onrender.com/api/lcd-message";
   ```
4. Connect the ESP8266 via USB and upload the code.

---

## ☁️ Render Deployment Steps

Since the backend is built with Node.js and uses an inbuilt JSON database, it is "Render deploy-ready".

1. **Push to GitHub**:
   Upload this entire project folder to a GitHub repository.

2. **Deploy on Render**:
   - Go to [Render.com](https://render.com) and sign in.
   - Click **New +** and select **Web Service**.
   - Connect your GitHub account and select your repository.
   - Configure the Web Service:
     - **Name**: `sistec-iot-backend`
     - **Root Directory**: `backend` (Important!)
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
   - Click **Create Web Service**.

3. **HTTPS Compatibility**:
   Render automatically provisions an SSL certificate (HTTPS). The provided ESP8266 code uses `BearSSL::WiFiClientSecure` and `client->setInsecure()` which bypasses the strict certificate fingerprint checking, ensuring it connects perfectly to Render's dynamic SSL.

> **Note on JSON Database**: Render's free tier uses ephemeral file storage. Every time the server restarts or deploys, `db.json` and `lcd.txt` will reset. For production persistence, either attach a Render persistent disk (Paid) or connect to a cloud database like MongoDB Atlas.

---

## 🔌 Hardware Connections
- **DHT11**: DATA → D5
- **Soil Moisture**: Analog OUT → A0
- **IR Sensor**: OUT → D6
- **Buzzer**: Positive → D7, Negative → GND
- **LCD I2C**: SDA → D2, SCL → D1 (Address 0x27)

Enjoy your SISTec Smart IoT System!
