/*
 * SISTec Smart IoT Monitoring System 2026
 * Hardware: ESP8266 (ESP-12F), DHT11, Soil Moisture, IR Sensor, Active Buzzer, I2C LCD
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>

// ==========================================
// CONFIGURATION
// ==========================================
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Render Backend URLs (Replace with your actual Render URL)
const String serverUrl = "https://your-backend.onrender.com/api/sensor-data";

// ==========================================
// PIN DEFINITIONS
// ==========================================
#define DHTPIN D5          // DHT11 Data Pin
#define DHTTYPE DHT11      // Sensor Type
#define SOIL_PIN A0        // Soil Moisture Analog Pin
#define IR_PIN D6          // IR Sensor Out Pin
#define BUZZER_PIN D7      // Buzzer Positive Pin
// I2C LCD Pins: SDA -> D2, SCL -> D1 (Default for Wire library on ESP8266)

// ==========================================
// COMPONENT INITIALIZATION
// ==========================================
DHT dht(DHTPIN, DHTTYPE);
LiquidCrystal_I2C lcd(0x27, 16, 2); // Address 0x27, 16 columns, 2 rows

// Global Variables
int objectCount = 0;
int irPreviousState = HIGH; // HIGH means no object
String currentLcdText = "SISTec IoT";

// Variables for holding sensor data
float temperature = 0.0;
float humidity = 0.0;
int soilMoistureRaw = 0;
int soilMoisturePercent = 0;
int irCurrentState = HIGH;

void setup() {
  Serial.begin(115200);
  
  // Pin Modes
  pinMode(IR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW); // Ensure buzzer is off
  
  // Init Sensors & LCD
  dht.begin();
  Wire.begin(D2, D1); // SDA, SCL
  lcd.init();
  lcd.backlight();
  
  // Connect to WiFi
  lcd.setCursor(0, 0);
  lcd.print("CONNECTING WiFi");
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    lcd.setCursor(0, 1);
    lcd.print("...........");
  }
  
  Serial.println("\nCONNECTED TO WiFi");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("CONNECTED TO WiFi");
  lcd.setCursor(0, 1);
  lcd.print("-- WELCOME --");
  delay(2000);
}

void loop() {
  // 1. Read Sensors
  temperature = dht.readTemperature();
  humidity = dht.readHumidity();
  
  // Soil Moisture mapping (0-1023 to 0-100%)
  // Note: Usually dry is 1023, wet is 0 for these sensors. Adjust map() if reversed.
  soilMoistureRaw = analogRead(SOIL_PIN);
  soilMoisturePercent = map(soilMoistureRaw, 1023, 0, 0, 100); 
  if(soilMoisturePercent < 0) soilMoisturePercent = 0;
  if(soilMoisturePercent > 100) soilMoisturePercent = 100;

  // 2. Object Detection & Buzzer Logic
  irCurrentState = digitalRead(IR_PIN);
  if (irPreviousState == HIGH && irCurrentState == LOW) { // Object Detected (Transition)
    objectCount++;
    Serial.println("Object Detected!");
    
    // Play Buzzer Beep
    digitalWrite(BUZZER_PIN, HIGH);
    
    // LCD Notification
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("OBJECT DETECTED!");
    lcd.setCursor(0, 1);
    lcd.print("BUZZER ON");
    
    delay(300); // 300ms beep
    digitalWrite(BUZZER_PIN, LOW);
    delay(700); // Complete the 1s delay requested by user
  }
  irPreviousState = irCurrentState;

  // 3. Display Sequence on LCD (as per user flow)
  
  // TEMPERATURE
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("TEMPERATURE");
  lcd.setCursor(0, 1);
  lcd.print(temperature);
  lcd.print((char)223); // Degree symbol
  lcd.print("C");
  delay(2000);

  // HUMIDITY
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("HUMIDITY");
  lcd.setCursor(0, 1);
  lcd.print(humidity);
  lcd.print("%");
  delay(2000);

  // SOIL MOISTURE
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SOIL MOISTURE");
  lcd.setCursor(0, 1);
  lcd.print(soilMoisturePercent);
  lcd.print("%");
  delay(2000);

  // OBJECT COUNT
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("OBJECT COUNT");
  lcd.setCursor(0, 1);
  lcd.print(objectCount);
  delay(2000);

  // 4. Send Data to Backend & Fetch LCD Message
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SENDING DATA TO");
  lcd.setCursor(0, 1);
  lcd.print("WEB SERVER....");
  delay(1000);
  
  sendSensorData();
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("DATA SENT...!!");
  delay(1000);

  // DISPLAY LCD TEXT
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SISTec DISPLAY");
  lcd.setCursor(0, 1);
  lcd.print(currentLcdText);
  delay(3000);
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

void sendSensorData() {
  if (WiFi.status() == WL_CONNECTED) {
    std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
    client->setInsecure();
    
    HTTPClient https;
    if (https.begin(*client, serverUrl)) {
      https.addHeader("Content-Type", "application/json");
      
      // Construct JSON payload
      String payload = "{";
      payload += "\"temperature\":" + String(temperature) + ",";
      payload += "\"humidity\":" + String(humidity) + ",";
      payload += "\"soilMoisture\":" + String(soilMoisturePercent) + ",";
      payload += "\"irStatus\":" + String(irCurrentState) + ",";
      payload += "\"objectCount\":" + String(objectCount);
      payload += "}";
      
      int httpCode = https.POST(payload);
      if (httpCode > 0) {
        Serial.printf("[HTTPS] POST... code: %d\n", httpCode);
        if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
          String response = https.getString();
          // Extract lcdMessage manually to avoid ArduinoJson dependency
          int lcdIndex = response.indexOf("\"lcdMessage\":\"");
          if (lcdIndex != -1) {
            int startIndex = lcdIndex + 14;
            int endIndex = response.indexOf("\"", startIndex);
            if (endIndex != -1) {
              currentLcdText = response.substring(startIndex, endIndex);
            }
          }
        }
      } else {
        Serial.printf("[HTTPS] POST... failed, error: %s\n", https.errorToString(httpCode).c_str());
      }
      https.end();
    }
  }
}
