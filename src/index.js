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
const viewsPath = path.join(__dirname, 'views'); // Make sure 'views/' is next to index.js
console.log('Views folder path:', viewsPath);
app.set('view engine', 'ejs');
app.set('views', viewsPath);

// --- Static files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---
app.get('/hello', (req, res) => res.send('Hello, world!'));

// Return JSON data for buses
app.get('/data', async (req, res) => {
  try {
    const snapshot = await rtdb.ref('buses').once('value');
    const items = snapshot.val();
    const itemsArray = items ? Object.keys(items).map(key => ({ id: key, ...items[key] })) : [];
    res.json({ items: itemsArray });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch buses' });
  }
});

// Return JSON data for bus locations
app.get('/bus-locations-data', async (req, res) => {
  try {
    const snapshot = await rtdb.ref('bus_locations').once('value');
    const items = snapshot.val();
    const itemsArray = items ? Object.keys(items).map(key => ({ id: key, ...items[key] })) : [];
    res.json({ items: itemsArray });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch bus locations' });
  }
});

// Add bus via API POST
app.post('/add-bus', async (req, res) => {
  const { bus_id, name } = req.body;
  try {
    await rtdb.ref('buses').push({ bus_id, name });
    res.redirect('/bus-locations');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to add bus');
  }
});

// Add location via API POST
app.post('/add-location', async (req, res) => {
  const { bus_id, latitude, longitude } = req.body;
  try {
    await rtdb.ref('bus_locations').push({ bus_id, latitude, longitude });
    res.redirect('/bus-locations');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to add location');
  }
});

// Add bus location with recorded_at via API POST
app.post('/submit-bus-location', async (req, res) => {
  const { bus_id, latitude, longitude, recorded_at } = req.body;
  try {
    await rtdb.ref('bus_locations').push({ bus_id, latitude, longitude, recorded_at });
    res.redirect('/bus-locations');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to submit bus location');
  }
});

// --- Website Routes ---
// Home page
app.get('/', (req, res) => res.render('home'));

// Bus locations page
app.get('/bus-locations', async (req, res) => {
  try {
    const snapshot = await rtdb.ref('bus_locations').once('value');
    const items = snapshot.val();
    const itemsArray = items ? Object.keys(items).map(key => ({ id: key, ...items[key] })) : [];
    res.render('location', { locations: itemsArray }); // Ensure file is location.ejs
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to load bus locations');
  }
});

// Add bus form page
app.get('/add-bus-form', (req, res) => res.render('add-bus-form'));

// Add location form page
app.get('/add-location-form', (req, res) => res.render('add-location'));

// Add bus location form page
app.get('/add-bus-location', (req, res) => res.render('add-bus-location'));

// About page
app.get('/about', (req, res) => res.render('about'));

// --- Start Server ---
app.listen(PORT, () => console.log(`✅ Running at http://localhost:${PORT}`));