// server.js
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 10000;

// --- Firebase Init ---
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://test-56b2b-default-rtdb.firebaseio.com'
});
const rtdb = admin.database();

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // ✅ only once
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---
// Test route
app.get('/hello', (req, res) => res.send('Hello, world!'));

// Fetch data as JSON
app.get('/data', async (req, res) => {
  const snapshot = await rtdb.ref('locations').once('value');
  const items = snapshot.val();
  const itemsArray = items ? Object.keys(items).map(key => ({ id: key, ...items[key] })) : [];
  res.json({ items: itemsArray });
});

// Add new location via API
app.post('/add-location', async (req, res) => {
  const newRef = await rtdb.ref('locations').push(req.body);
  res.status(201).json({ message: 'Location added', id: newRef.key });
});

// --- Website Routes ---
// Welcome page
app.get('/', (req, res) => {
  res.render('home');
});

// Locations page
app.get('/locations', async (req, res) => {
  const snapshot = await rtdb.ref('locations').once('value');
  const items = snapshot.val();
  const itemsArray = items ? Object.keys(items).map(key => ({ id: key, ...items[key] })) : [];
  res.render('locations', { locations: itemsArray });
});

// Add location form
app.get('/add-location-form', (req, res) => {
  res.render('add-location');
});

app.post('/submit-location', async (req, res) => {
  const { name, lat, lng } = req.body;
  await rtdb.ref('locations').push({ name, lat, lng });
  res.redirect('/locations');
});

// About page
app.get('/about', (req, res) => {
  res.render('about');
});

// --- Start Server ---
app.listen(PORT, () => console.log(`✅ Running at http://localhost:${PORT}`));
