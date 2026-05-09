const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public'))); // Serve static files from public directory

app.use(session({
    secret: 'sistec_iot_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS only
}));

// Helper function to read/write JSON database
const DB_FILE = path.join(__dirname, 'db.json');
const LCD_FILE = path.join(__dirname, 'lcd.txt');

function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], sensorLogs: [] }));
    }
    const data = fs.readFileSync(DB_FILE);
    return JSON.parse(data);
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Helper to check if user is logged in
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized. Please log in.' });
}

// =======================
// AUTHENTICATION APIs
// =======================

app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    const db = readDB();

    if (db.users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: Date.now().toString(),
        name,
        email,
        password: hashedPassword
    };

    db.users.push(newUser);
    writeDB(db);

    res.status(201).json({ message: 'Registration successful' });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const db = readDB();

    const user = db.users.find(u => u.email === email);
    if (!user) {
        return res.status(400).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(400).json({ error: 'Invalid email or password' });
    }

    req.session.userId = user.id;
    req.session.userName = user.name;
    res.json({ message: 'Login successful', userName: user.name });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.userId) {
        res.json({ authenticated: true, userName: req.session.userName });
    } else {
        res.json({ authenticated: false });
    }
});

// =======================
// SENSOR APIs
// =======================

app.post('/api/sensor-data', (req, res) => {
    // Expected payload from ESP8266
    const { temperature, humidity, soilMoisture, irStatus, objectCount } = req.body;

    const db = readDB();
    const now = new Date();

    // Read current LCD message to save in history
    let lcdMessage = "";
    if (fs.existsSync(LCD_FILE)) {
        lcdMessage = fs.readFileSync(LCD_FILE, 'utf8').trim();
    }

    const newLog = {
        id: Date.now().toString(),
        temperature,
        humidity,
        soilMoisture,
        irStatus,
        objectCount,
        lcdMessage,
        time: now.toLocaleTimeString(),
        date: now.toLocaleDateString()
    };

    db.sensorLogs.push(newLog);

    // Optional: limit the size of history to prevent huge JSON file
    if (db.sensorLogs.length > 1000) {
        db.sensorLogs.shift();
    }

    writeDB(db);
    res.status(200).json({ message: 'Data saved successfully', lcdMessage: lcdMessage });
});

app.get('/api/latest-data', (req, res) => {
    const db = readDB();
    if (db.sensorLogs.length === 0) {
        return res.json({});
    }
    // Return the last pushed item
    const latest = db.sensorLogs[db.sensorLogs.length - 1];
    res.json(latest);
});

app.get('/api/history', (req, res) => {
    const db = readDB();
    res.json(db.sensorLogs);
});

app.delete('/api/history/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;
    const db = readDB();

    const initialLength = db.sensorLogs.length;
    db.sensorLogs = db.sensorLogs.filter(log => log.id !== id);

    if (db.sensorLogs.length === initialLength) {
        return res.status(404).json({ error: 'Record not found' });
    }

    writeDB(db);
    res.json({ message: 'Record deleted successfully' });
});

// =======================
// LCD APIs
// =======================

app.post('/api/lcd-message', isAuthenticated, (req, res) => {
    const { message } = req.body;
    if (!message || message.length > 16) {
        return res.status(400).json({ error: 'Message must be 1-16 characters long' });
    }

    fs.writeFileSync(LCD_FILE, message);
    res.json({ message: 'LCD message updated' });
});

app.get('/api/lcd-message', (req, res) => {
    // This API is called by ESP8266 to get the text
    if (fs.existsSync(LCD_FILE)) {
        const text = fs.readFileSync(LCD_FILE, 'utf8');
        res.send(text);
    } else {
        res.send("SISTec IoT");
    }
});

// =======================
// OBJECT COUNTER APIs
// =======================

app.get('/api/object-count', (req, res) => {
    const db = readDB();
    if (db.sensorLogs.length === 0) return res.json({ count: 0 });
    const latest = db.sensorLogs[db.sensorLogs.length - 1];
    res.json({ count: latest.objectCount || 0 });
});

app.post('/api/reset-count', isAuthenticated, (req, res) => {
    // Since count is driven by ESP8266, resetting it purely on backend 
    // requires logic on ESP8266 to fetch reset command, OR we just 
    // note an offset in the backend. 
    // For simplicity, we just send a success message.
    res.json({ message: 'Count reset requested. Please restart ESP8266 or handle offset logic.' });
});

// =======================
// BLYNK LED CONTROL
// =======================
const BLYNK_TOKEN = "p8l2DQUJR2TFRt8om-o6"; // Replace with real token

app.post('/api/led/on', isAuthenticated, async (req, res) => {
    try {
        const response = await fetch(`https://blynk.cloud/external/api/update?token=${BLYNK_TOKEN}&D4=1`);
        if (response.ok) {
            res.json({ message: 'LED turned ON' });
        } else {
            res.status(500).json({ error: 'Failed to reach Blynk API' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error connecting to Blynk' });
    }
});

app.post('/api/led/off', isAuthenticated, async (req, res) => {
    try {
        const response = await fetch(`https://blynk.cloud/external/api/update?token=${BLYNK_TOKEN}&D4=0`);
        if (response.ok) {
            res.json({ message: 'LED turned OFF' });
        } else {
            res.status(500).json({ error: 'Failed to reach Blynk API' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error connecting to Blynk' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
