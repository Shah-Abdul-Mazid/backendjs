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

// POST endpoint for Arduino to send GPS data
app.post('/update_gps', async (req, res) => {
  const { bus_id, latitude, longitude } = req.body;

  if (!bus_id || !latitude || !longitude) {
    return res.status(400).json({ message: 'Missing required fields: bus_id, latitude, longitude' });
  }

  try {
    const recorded_at = new Date().toISOString();

    await rtdb.ref('bus_locations').push({
      bus_id,
      latitude,
      longitude,
      recorded_at
    });

    console.log(`Received GPS: bus_id=${bus_id}, lat=${latitude}, lng=${longitude}`);
    res.status(200).json({ message: 'GPS data saved successfully' });
  } catch (err) {
    console.error('Failed to save GPS data:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// JSON API returning all bus location data
app.get('/data', async (req, res) => {
  try {
    const snapshot = await rtdb.ref('bus_locations').once('value');
    const items = snapshot.val();
    const itemsArray = items
      ? Object.keys(items).map(key => ({
          id: key,
          bus_id: items[key].bus_id,
          latitude: items[key].latitude,
          longitude: items[key].longitude,
          recorded_at: items[key].recorded_at || 'N/A'
        }))
      : [];

    res.json({ items: itemsArray });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch bus data' });
  }
});

// Render page showing bus locations
app.get('/buslocations', async (req, res) => {
  try {
    const snapshot = await rtdb.ref('bus_locations').once('value');
    const items = snapshot.val();
    const itemsArray = items
      ? Object.keys(items).map(key => ({
          id: key,
          bus_id: items[key].bus_id,
          latitude: items[key].latitude,
          longitude: items[key].longitude,
          recorded_at: items[key].recorded_at || 'N/A'
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
    const snapshot = await busesRef.once('value');
    if (!snapshot.exists()) {
      await busesRef.set({});
      return res.redirect('/addbusforms');
    }
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
    const snapshot = await locationsRef.once('value');
    if (!snapshot.exists()) {
      await locationsRef.set({});
    }
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
    const snapshot = await locationsRef.once('value');
    if (!snapshot.exists()) {
      await locationsRef.set({});
    }
    await locationsRef.push({ bus_id, latitude, longitude, recorded_at });
    res.redirect('/addbuslocationforms');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to submit bus location');
  }
});

// --- Website Routes ---

// Home page
app.get('/', (req, res) => res.render('home'));

// Add bus form page
app.get('/addbusforms', (req, res) => res.render('addbusforms'));

// Add bus location form page
app.get('/addbuslocationforms', (req, res) => res.render('addbuslocationforms'));

// About page
app.get('/about', (req, res) => res.render('about'));

// --- Start Server ---
app.listen(PORT, () => console.log(`✅ Running at http://localhost:${PORT}`));
