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
  console.error('❌ No Firebase credentials found.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://bus-tracker-default-rtdb.firebaseio.com' // Update with your Firebase project URL
});

const rtdb = admin.database();

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- Views setup ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---

// Add a new bus (no auth)
app.post('/admin/add-bus', async (req, res) => {
  try {
    const { bus_id, name } = req.body;

    if (!bus_id || typeof bus_id !== 'string' || bus_id.trim() === '') {
      return res.status(400).json({ message: 'Invalid bus_id' });
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ message: 'Invalid bus name' });
    }

    const busSnapshot = await rtdb.ref(`buses/${bus_id}`).once('value');
    if (busSnapshot.exists()) {
      return res.status(400).json({ message: `Bus ${bus_id} already exists` });
    }

    await rtdb.ref(`buses/${bus_id}`).set({
      name: name.trim(),
      created_at: new Date().toISOString(),
      active: true
    });

    res.status(201).json({ message: `Bus ${bus_id} added`, bus_id, name });
  } catch (err) {
    console.error('Error adding bus:', err);
    res.status(500).json({ message: 'Failed to add bus' });
  }
});

// Deactivate a bus (no auth)
app.put('/admin/deactivate-bus/:busId', async (req, res) => {
  try {
    const { busId } = req.params;

    const busSnapshot = await rtdb.ref(`buses/${busId}`).once('value');
    if (!busSnapshot.exists()) {
      return res.status(404).json({ message: `Bus ${busId} not found` });
    }

    await rtdb.ref(`buses/${busId}`).update({
      active: false,
      updated_at: new Date().toISOString()
    });

    res.json({ message: `Bus ${busId} deactivated` });
  } catch (err) {
    console.error('Error deactivating bus:', err);
    res.status(500).json({ message: 'Failed to deactivate bus' });
  }
});

// Add bus location (no auth)
app.post('/add-bus-location', async (req, res) => {
  try {
    const { bus_id, latitude, longitude, recorded_at } = req.body;

    const busSnapshot = await rtdb.ref(`buses/${bus_id}`).once('value');
    if (!busSnapshot.exists() || !busSnapshot.val().active) {
      return res.status(400).json({ message: `Invalid or inactive bus_id: ${bus_id}` });
    }

    if (isNaN(latitude) || latitude < -90 || latitude > 90 || isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ message: 'Invalid latitude or longitude' });
    }

    const newRef = await rtdb.ref(`bus_locations/${bus_id}`).push({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      recorded_at: recorded_at || new Date().toISOString()
    });

    res.status(201).json({
      message: 'Bus location added',
      bus_id,
      location_id: newRef.key
    });
  } catch (err) {
    console.error('Error adding bus location:', err);
    res.status(500).json({ message: 'Failed to add bus location' });
  }
});

// Get latest bus location (no auth)
app.get('/bus-location/:busId', async (req, res) => {
  try {
    const busId = req.params.busId;

    const busSnapshot = await rtdb.ref(`buses/${busId}`).once('value');
    if (!busSnapshot.exists() || !busSnapshot.val().active) {
      return res.status(400).json({ message: `Invalid or inactive bus_id: ${busId}` });
    }

    const snapshot = await rtdb
      .ref(`bus_locations/${busId}`)
      .orderByChild('recorded_at')
      .limitToLast(1)
      .once('value');

    const data = snapshot.val();
    if (data && Object.keys(data).length > 0) {
      const key = Object.keys(data)[0];
      const location = data[key];
      res.json({
        bus_id: busId,
        latitude: location.latitude || 'N/A',
        longitude: location.longitude || 'N/A',
        recorded_at: location.recorded_at || 'N/A',
        location_id: key
      });
    } else {
      res.json({
        bus_id: busId,
        latitude: 'N/A',
        longitude: 'N/A',
        recorded_at: `No data found for ${busId}`,
        location_id: null
      });
    }
  } catch (err) {
    console.error('Error fetching bus location:', err);
    res.status(500).json({
      bus_id: req.params.busId,
      latitude: 'N/A',
      longitude: 'N/A',
      recorded_at: `Error fetching data: ${err.message}`,
      location_id: null
    });
  }
});

// Home page
app.get('/', (req, res) => res.render('home'));

// List all buses and their locations (no auth)
app.get('/bus-locations', async (req, res) => {
  try {
    const busesSnapshot = await rtdb.ref('buses').once('value');
    const locationsSnapshot = await rtdb.ref('bus_locations').once('value');

    const buses = busesSnapshot.val() || {};
    const locations = locationsSnapshot.val() || {};

    const busesArray = Object.keys(buses)
      .filter(busId => buses[busId].active)
      .map(busId => ({
        bus_id: busId,
        name: buses[busId].name,
        locations: locations[busId]
          ? Object.keys(locations[busId]).map(key => ({
              id: key,
              ...locations[busId][key]
            }))
          : []
      }));

    res.render('bus-locations', { buses: busesArray, isAdmin: false });
  } catch (err) {
    console.error('Error rendering bus locations:', err);
    res.status(500).send('Failed to load bus locations');
  }
});

// Add bus form (no auth)
app.get('/admin/add-bus-form', (req, res) => {
  res.render('add-bus');
});

// Handle bus submission from form (no auth)
app.post('/admin/submit-bus', async (req, res) => {
  try {
    const { bus_id, name } = req.body;

    if (!bus_id || typeof bus_id !== 'string' || bus_id.trim() === '') {
      return res.status(400).send('Invalid bus_id');
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).send('Invalid bus name');
    }

    const busSnapshot = await rtdb.ref(`buses/${bus_id}`).once('value');
    if (busSnapshot.exists()) {
      return res.status(400).send(`Bus ${bus_id} already exists`);
    }

    await rtdb.ref(`buses/${bus_id}`).set({
      name: name.trim(),
      created_at: new Date().toISOString(),
      active: true
    });

    res.redirect('/bus-locations');
  } catch (err) {
    console.error('Error adding bus:', err);
    res.status(500).send('Failed to add bus');
  }
});

// Add location form (no auth)
app.get('/add-bus-location-form', (req, res) => {
  res.render('add-bus-location');
});

// Handle location submission from form (no auth)
app.post('/submit-bus-location', async (req, res) => {
  try {
    const { bus_id, latitude, longitude, recorded_at } = req.body;

    const busSnapshot = await rtdb.ref(`buses/${bus_id}`).once('value');
    if (!busSnapshot.exists() || !busSnapshot.val().active) {
      return res.status(400).send(`Invalid or inactive bus_id: ${bus_id}`);
    }

    if (isNaN(latitude) || latitude < -90 || latitude > 90 || isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).send('Invalid latitude or longitude');
    }

    await rtdb.ref(`bus_locations/${bus_id}`).push({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      recorded_at: recorded_at || new Date().toISOString()
    });

    res.redirect('/bus-locations');
  } catch (err) {
    console.error('Error adding bus location:', err);
    res.status(500).send('Failed to add bus location');
  }
});

// About page
app.get('/about', (req, res) => res.render('about'));

// Remove login routes completely (no login needed)

// --- Start Server ---
app.listen(PORT, () => console.log(`✅ Running at http://localhost:${PORT}`));
