const express = require('express');
const admin = require('firebase-admin');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

// --- Firebase Admin SDK Initialization ---
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://test-56b2b-default-rtdb.firebaseio.com'
});

const rtdb = admin.database();

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // for form data
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

// --- Firebase Startup Check + Create 'buses' if not exists ---
(async () => {
  try {
    await rtdb.ref('/').once('value');
    console.log('✅ Successfully connected to Firebase Realtime Database!');

    const busesSnapshot = await rtdb.ref('buses').once('value');
    if (!busesSnapshot.exists()) {
      await rtdb.ref('buses').set({});
      console.log('🚍 Created "buses" table in Firebase.');
    }
  } catch (error) {
    console.error('❌ Firebase Init Error:', error.message);
  }
})();

// --- Routes ---

// Hello
app.get('/hello', (req, res) => {
  res.send('Hello, world!!!');
});

// Basic location data (if still needed)
app.get('/data', async (req, res) => {
  try {
    const snapshot = await rtdb.ref('location').once('value');
    const items = snapshot.val();
    const itemsArray = items ? Object.keys(items).map(key => ({ id: key, ...items[key] })) : [];
    res.render('data', {
      message: 'This is your data endpoint, fetched from Firebase Realtime Database!',
      items: itemsArray
    });
  } catch (error) {
    res.status(500).send('Failed to fetch data');
  }
});

// --- BUS FEATURE ROUTES ---

// GET: Show all buses & their locations
app.get('/bus-locations', async (req, res) => {
  try {
    const snapshot = await rtdb.ref('buses').once('value');
    const buses = snapshot.val() || {};
    const busesArray = Object.entries(buses).map(([id, data]) => ({ id, ...data }));
    res.render('bus-locations', { buses: busesArray });
  } catch (error) {
    res.status(500).send('Failed to fetch bus data');
  }
});

// GET: Add Bus form
app.get('/add-bus-form', (req, res) => {
  res.render('add-bus');
});

// POST: Add new bus
app.post('/add-bus', async (req, res) => {
  const { name, route } = req.body;
  try {
    const newBusRef = rtdb.ref('buses').push();
    await newBusRef.set({
      name,
      route,
      location: null
    });
    res.redirect('/bus-locations');
  } catch (error) {
    res.status(500).send('Failed to add bus');
  }
});

// GET: Add Bus Location form
app.get('/add-bus-location-form', async (req, res) => {
  try {
    const snapshot = await rtdb.ref('buses').once('value');
    const buses = snapshot.val() || {};
    res.render('add-bus-location', { buses });
  } catch (error) {
    res.status(500).send('Error loading form');
  }
});

// POST: Add/Update location of a specific bus
app.post('/add-bus-location', async (req, res) => {
  const { busId, latitude, longitude } = req.body;
  try {
    await rtdb.ref(`buses/${busId}/location`).set({ latitude, longitude });
    res.redirect('/bus-locations');
  } catch (error) {
    res.status(500).send('Failed to update bus location');
  }
});

// --- Connectivity Checker ---
app.get('/check-db', async (req, res) => {
  try {
    await rtdb.ref('/').once('value');
    res.json({
      status: 'connected',
      message: 'Successfully connected to Firebase Realtime Database'
    });
  } catch (error) {
    res.status(500).json({
      status: 'disconnected',
      message: 'Failed to connect to Firebase',
      error: error.message
    });
  }
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
