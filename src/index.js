// index.js
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 10000;

// --- Firebase Init ---
const serviceAccount = require(path.join(__dirname, './serviceAccountKey.json'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://test-56b2b-default-rtdb.firebaseio.com' // Replace with your actual DB URL if different
});
const rtdb = admin.database();

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- Views setup ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views')); // points to src/views

// --- Static files ---
app.use(express.static(path.join(__dirname, 'src/public')));

// ---------------------
// 🔁 API Routes
// ---------------------

app.get('/hello', (req, res) => res.send('Hello, world!'));

// ✅ API: Get location data as JSON
app.get('/data', async (req, res) => {
  try {
    const snapshot = await rtdb.ref('location').once('value');
    const items = snapshot.val();
    const itemsArray = items
      ? Object.keys(items).map(key => ({ id: key, ...items[key] }))
      : [];
    res.render('data', {
      message: 'Live Bus Location Data',
      items: itemsArray
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to load data');
  }
});

// ✅ API: Add location via raw POST (JSON)
app.post('/add-location', async (req, res) => {
  try {
    const newRef = await rtdb.ref('location').push(req.body);
    res.status(201).json({ message: 'Location added', id: newRef.key });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add location', error: err.message });
  }
});

// ---------------------
// 🌐 Website Routes
// ---------------------

// Home Page
app.get('/', (req, res) => res.render('home'));

// View all locations in a table (location.ejs)
app.get('/locations', async (req, res) => {
  try {
    const snapshot = await rtdb.ref('location').once('value');
    const items = snapshot.val();
    const itemsArray = items
      ? Object.keys(items).map(key => ({ id: key, ...items[key] }))
      : [];
    res.render('location', { locations: itemsArray });
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to load locations');
  }
});

// Form to add a location
app.get('/add-location-form', (req, res) => res.render('add-location'));

// Handle form submission from add-location.ejs
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

// About Page
app.get('/about', (req, res) => res.render('about'));

// ---------------------
// 🚀 Start Server
// ---------------------
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
