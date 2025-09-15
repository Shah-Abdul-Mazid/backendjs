// app.js (or server.js)

const express = require('express');
const admin = require('firebase-admin'); // Import the Firebase Admin SDK
const app = express();
const PORT = process.env.PORT || 10000;

// --- Firebase Admin SDK Initialization ---
// IMPORTANT: Replace the path with your service account key file
const serviceAccount = require('./serviceAccountKey.json'); // './' means current folder

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://test-56b2b-default-rtdb.firebaseio.com'
});

// Get a reference to the Realtime Database service
const rtdb = admin.database();

// --- Middleware ---
app.use(express.json()); // Parse JSON request bodies
app.set('view engine', 'ejs'); // Set EJS as templating engine

// --- Firebase Connectivity Check on Startup ---
(async () => {
  try {
    await rtdb.ref('/').once('value');
    console.log('✅ Successfully connected to Firebase Realtime Database!');
  } catch (error) {
    console.error('❌ Failed to connect to Firebase Realtime Database:', error.message);
  }
})();

// --- Routes ---

// /hello route
app.get('/hello', (req, res) => {
  res.send('Hello, world! Kire Soytan Prottoy kmn aso!!!');
});

// /data route
app.get('/data', async (req, res) => {
  try {
    const snapshot = await rtdb.ref('locations').once('value');
    const items = snapshot.val();
    const itemsArray = items ? Object.keys(items).map(key => ({ id: key, ...items[key] })) : [];
    res.render('data', { 
      message: 'This is your data endpoint, fetched from Firebase Realtime Database!', 
      items: itemsArray 
    });
  } catch (error) {
    console.error('Error fetching data from Firebase Realtime Database:', error);
    res.status(500).send('Failed to fetch data from database');
  }
});

// /add-location route
app.post('/add-location', async (req, res) => {
  try {
    const newLocation = req.body;
    const newRef = await rtdb.ref('locations').push(newLocation);
    res.status(201).json({ 
      message: 'Location added successfully!', 
      id: newRef.key, 
      location: newLocation 
    });
  } catch (error) {
    console.error('Error adding location to Firebase Realtime Database:', error);
    res.status(500).send('Failed to add location');
  }
});

// /check-db route
app.get('/check-db', async (req, res) => {
  try {
    await rtdb.ref('/').once('value'); 
    console.log('ℹ️ /check-db called: Firebase connection successful');
    res.json({ 
      status: 'connected', 
      message: 'Successfully connected to Firebase Realtime Database' 
    });
  } catch (error) {
    console.error('ℹ️ /check-db called: Firebase connection failed', error.message);
    res.status(500).json({ 
      status: 'disconnected', 
      message: 'Failed to connect to Firebase Realtime Database',
      error: error.message
    });
  }
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
