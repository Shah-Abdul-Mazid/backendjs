// index.js
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

// Return JSON data for locations
app.get('/data', async (req, res) => {
  try {
    const snapshot = await rtdb.ref('location').once('value');
    const items = snapshot.val();
    const itemsArray = items ? Object.keys(items).map(key => ({ id: key, ...items[key] })) : [];
    res.json({ items: itemsArray });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch locations' });
  }
});

// Add location via API POST
app.post('/add-location', async (req, res) => {
  try {
    const newRef = await rtdb.ref('location').push(req.body);
    res.status(201).json({ message: 'Location added', id: newRef.key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add location' });
  }
});

// --- Website Routes ---
// Home page
app.get('/', (req, res) => res.render('home'));

// Locations table page
app.get('/locations', async (req, res) => {
  try {
    const snapshot = await rtdb.ref('location').once('value');
    const items = snapshot.val();
    const itemsArray = items ? Object.keys(items).map(key => ({ id: key, ...items[key] })) : [];
    res.render('location', { locations: itemsArray }); // Ensure file is location.ejs
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to load locations');
  }
});

// Add location form page
app.get('/add-location-form', (req, res) => res.render('add-location'));

// Handle location submission from form
app.post('/submit-location', async (req, res) => {
  const { name, lat, lng } = req.body;
  try {
    await rtdb.ref('location').push({ name, lat, lng });
    res.redirect('/locations');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to submit location');
  }
});

// About page
app.get('/about', (req, res) => res.render('about'));

// --- Start Server ---
app.listen(PORT, () => console.log(`✅ Running at http://localhost:${PORT}`));
