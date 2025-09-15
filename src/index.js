require('dotenv').config(); 

const express = require('express');
const mysql = require('mysql2');
const app = express();
const PORT = process.env.PORT || 10000;

const db = mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'root',
  database: process.env.DB_NAME || 'test_data'
});

db.connect((err) => {
  if (err) {
    console.error('❌ MySQL connection failed:', err.message);
    return;
  }
  console.log('✅ Connected to MySQL database');
});

app.use(express.json());
app.set('view engine', 'ejs');

app.get('/hello', (req, res) => {
  res.send('Hello, world! Kire Soytan Prottoy kmn aso!!!');
});

app.get('/data', (req, res) => {
  const query = 'SELECT * FROM locations';
  db.query(query, (err, results) => {
    if (err) {
      console.error('❌ Query failed:', err.message);
      return res.status(500).send('Database query failed');
    }
    res.render('data', { message: 'This is your data endpoint', items: results });
  });
});

app.get('/check-db', (req, res) => {
  db.ping((err) => {
    if (err) {
      console.error('❌ Ping failed:', err.message);
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

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
