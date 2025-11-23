// index.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();

// ---------- Middleware ----------
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// ---------- PostgreSQL Setup ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Render PostgreSQL
});

pool.connect()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('PostgreSQL connection error', err));

// Make pool accessible via req for routes
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// ---------- Frontend Static Files ----------
// Put your frontend inside backend repo under /frontend
const frontendDir = path.join(__dirname, 'frontend');
app.use(express.static(frontendDir));

// Optional root route for Render health check
app.get('/', (req, res) => {
  res.send('Backend is running!');
});

// ---------- Uploads ----------
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, Date.now().toString() + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ---------- Routes ----------
const authRoutes = require('./routes/authRoutes');
const recipeRoutes = require('./routes/recipeRoutes');
const contactRoutes = require('./routes/contactRoutes');
const userRoutes = require('./routes/userRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/users', userRoutes);
app.use('/api/favorites', favoriteRoutes);

// Example protected upload route (make sure verifyAdmin exists)
const { verifyAdmin } = require('./middleware/authMiddleware');
app.post('/api/upload', verifyAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const publicUrl = `/uploads/${req.file.filename}`;
  res.json({ message: 'Uploaded', filename: req.file.filename, url: publicUrl });
});

// ---------- Error Handling ----------
app.use((err, req, res, next) => {
  if (!err) return next();
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({ error: 'Payload too large. Reduce image size.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ---------- Start Server ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
