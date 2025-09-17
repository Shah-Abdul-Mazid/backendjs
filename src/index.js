const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

// --- Firebase Init ---
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } catch (err) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON');
    process.exit(1);
  }
} else if (fs.existsSync(path.join(__dirname, 'serviceAccountKey.json'))) {
  serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
} else {
  console.error('❌ No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT_KEY or add serviceAccountKey.json locally.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://test-56b2b-default-rtdb.firebaseio.com'
});

const rtdb = admin.database();

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- Views setup ---
const viewsPath = path.join(__dirname, 'views');
console.log('Views folder path:', viewsPath);
app.set('view engine', 'ejs');
app.set('views', viewsPath);

// --- Static files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---

// Simple test route
app.get('/hello', (req, res) => res.send('Hello, world!'));

// POST endpoint for ESP32 / Arduino to send GPS data
app.post('/update_gps', async (req, res) => {
  const { bus_id, latitude, longitude } = req.body;

  // Validate input data
  if (!bus_id || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ message: 'Missing required fields: bus_id, latitude, longitude' });
  }

  // Optional: validate latitude & longitude number ranges
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ message: 'Latitude and longitude must be numbers' });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ message: 'Latitude or longitude out of range' });
  }

  try {
    const recorded_at = new Date().toISOString();

    // Push new location data under 'bus_locations'
    const ref = await rtdb.ref('bus_locations').push({
      bus_id,
      latitude,
      longitude,
      recorded_at
    });

    console.log(`✅ GPS data saved for bus_id=${bus_id} with key=${ref.key}`);
    res.status(200).json({ message: 'GPS data saved successfully', key: ref.key });
  } catch (err) {
    console.error('❌ Failed to save GPS data:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all bus locations as JSON
app.get('/data', async (req, res) => {
  try {
    const snapshot = await rtdb.ref('bus_locations').once('value');
    const items = snapshot.val();

    const itemsArray = items
      ? Object.entries(items).map(([id, data]) => ({
          id,
          bus_id: data.bus_id,
          latitude: data.latitude,
          longitude: data.longitude,
          recorded_at: data.recorded_at || 'N/A'
        }))
      : [];

    res.json({ items: itemsArray });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch bus data' });
  }
});

// Render bus locations page
app.get('/buslocations', async (req, res) => {
  try {
    const snapshot = await rtdb.ref('bus_locations').once('value');
    const items = snapshot.val();

    const itemsArray = items
      ? Object.entries(items).map(([id, data]) => ({
          id,
          bus_id: data.bus_id,
          latitude: data.latitude,
          longitude: data.longitude,
          recorded_at: data.recorded_at || 'N/A'
        }))
      : [];

    res.render('location', { locations: itemsArray });
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to load bus locations');
  }
});

// Add bus via API POST
app.post('/addbusforms', async (req, res) => {
  const { bus_id, name } = req.body;
  try {
    const busesRef = rtdb.ref('buses');
    await busesRef.push({ bus_id, name });
    res.redirect('/addbusforms');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to add bus');
  }
});

// Add bus location via API POST
app.post('/addbuslocationforms', async (req, res) => {
  const { bus_id, latitude, longitude } = req.body;
  try {
    const locationsRef = rtdb.ref('bus_locations');
    await locationsRef.push({ bus_id, latitude, longitude });
    res.redirect('/addbuslocationforms');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to add location');
  }
});

// Add bus location with recorded_at via API POST
app.post('/submit-bus-location', async (req, res) => {
  const { bus_id, latitude, longitude, recorded_at } = req.body;
  try {
    const locationsRef = rtdb.ref('bus_locations');
    await locationsRef.push({ bus_id, latitude, longitude, recorded_at });
    res.redirect('/addbuslocationforms');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to submit bus location');
  }
});

// Website Routes
app.get('/', (req, res) => res.render('home'));
app.get('/addbusforms', (req, res) => res.render('addbusforms'));
app.get('/addbuslocationforms', (req, res) => res.render('addbuslocationforms'));
app.get('/about', (req, res) => res.render('about'));

// Start Server
app.listen(PORT, () => console.log(`✅ Running at http://localhost:${PORT}`));
