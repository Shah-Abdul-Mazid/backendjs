const express = require('express');
const mysql = require('mysql2');
const app = express();
const PORT = process.env.PORT || 10000;

// MySQL connection configuration
const db = mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: 'root',
  database: 'test_data',
  port: 3306
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// Middleware
app.use(express.json());
app.set('view engine', 'ejs'); // Set EJS as the templating engine

// /hello route
app.get('/hello', (req, res) => {
  res.send('Hello, world! Kire Soytan Prottoy kmn aso!!!');
});

// /data route (rendering HTML table instead of JSON)
app.get('/data', (req, res) => {
  const query = 'SELECT * FROM locations'; // Adjust if your table name differs
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Database query failed');
    }
    // Render EJS template with table data
    res.render('data', { message: 'This is your data endpoint', items: results });
  });
});

// /check-db route
app.get('/check-db', (req, res) => {
  db.ping((err) => {
    if (err) {
      console.error('MySQL connection failed:', err);
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
  console.log(`Server is running on port ${PORT}`);
}
);