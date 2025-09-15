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

// Authentication middleware
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];

  // Check for special admin token bypass
  if (token === 'admin-token-123') {
    req.user = { uid: 'admin', isAdmin: true, email: 'admin' };
    return next();
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (err) {
    console.error('Error verifying token:', err);
    res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

// Admin-only middleware
const isAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
};

// --- Views setup ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---

// Return JSON data for locations (original, secured)
app.get('/data', authenticate, async (req, res) => {
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

// Add location via API POST (original, secured)
app.post('/add-location', authenticate, async (req, res) => {
  try {
    const newRef = await rtdb.ref('location').push(req.body);
    res.status(201).json({ message: 'Location added', id: newRef.key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add location' });
  }
});

// Admin: Add a new bus
app.post('/admin/add-bus', authenticate, isAdmin, async (req, res) => {
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

// Admin: Deactivate a bus
app.put('/admin/deactivate-bus/:busId', authenticate, isAdmin, async (req, res) => {
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

// Add bus location (admin or user)
app.post('/add-bus-location', authenticate, async (req, res) => {
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

// Get latest bus location (admin or user)
app.get('/bus-location/:busId', authenticate, async (req, res) => {
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

// --- Website Routes ---

// Home page (public)
app.get('/', (req, res) => res.render('home'));

// Locations table page (secured)
app.get('/locations', authenticate, async (req, res) => {
  try {
    const snapshot = await rtdb.ref('location').once('value');
    const items = snapshot.val();
    const itemsArray = items ? Object.keys(items).map(key => ({ id: key, ...items[key] })) : [];
    res.render('location', { locations: itemsArray });
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to load locations');
  }
});

// Add location form page (secured)
app.get('/add-location-form', authenticate, (req, res) => res.render('add-location'));

// Handle location submission from form (secured)
app.post('/submit-location', authenticate, async (req, res) => {
  const { name, lat, lng } = req.body;
  try {
    await rtdb.ref('location').push({ name, lat, lng });
    res.redirect('/locations');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to submit location');
  }
});

// List all buses and their locations (admin or user)
app.get('/bus-locations', authenticate, async (req, res) => {
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

    res.render('bus-locations', { buses: busesArray, isAdmin: req.user.isAdmin || false });
  } catch (err) {
    console.error('Error rendering bus locations:', err);
    res.status(500).send('Failed to load bus locations');
  }
});

// Admin: Add bus form
app.get('/admin/add-bus-form', authenticate, isAdmin, (req, res) => {
  res.render('add-bus');
});

// Admin: Handle bus submission from form
app.post('/admin/submit-bus', authenticate, isAdmin, async (req, res) => {
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

// Add location form (admin or user)
app.get('/add-bus-location-form', authenticate, (req, res) => {
  res.render('add-bus-location');
});

// Handle location submission from form (admin or user)
app.post('/submit-bus-location', authenticate, async (req, res) => {
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
    console.error(err);
    res.status(500).send('Failed to submit bus location');
  }
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// Serve auth.js for client-side authentication handling
app.get('/auth.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.js'));
});