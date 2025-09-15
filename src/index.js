require('dotenv').config(); // ✅ Load environment variables from .env

const express = require('express');
const mysql = require('mysql2');
const app = express();
const PORT = process.env.PORT || 10000;

// ✅ Use environment variables for DB connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'root',
  database: process.env.DB_NAME || 'test_data'
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('❌ Error connecting to MySQL:', err.message);
    return;
  }
  console.log('✅ Connected to MySQL database');
});

// Middleware
app.use(express.json());
app.set('view engine', 'ejs');

// Routes
app.get('/hello', (req, res) => {
  res.send('Hello, world! Kire Soytan Prottoy kmn aso!!!');
});

app.get('/data', (req, res) => {
  const query = 'SELECT * FROM locations';
  db.query(query, (err, results) => {
    if (err) {
      console.error('❌ Error executing query:', err.message);
      return res.status(500).send('Database query failed');
    }
    res.render('data', { message: 'This is your data endpoint', items: results });
  });
});

app.get('/check-db', (req, res) => {
  db.ping((err) => {
    if (err) {
      console.error('❌ MySQL connection failed:', err.message);
      return res.status(500).json({
        status: 'disconnected',
        message: 'Failed to connect to MySQL database'
      });
    }
    res.json({
      status: 'connected',
      message: 'Successfully connected to MySQL database'
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
