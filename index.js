const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
app.use(cors());
// Increase body size limit to allow base64 images from the frontend when necessary.
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Serve frontend static files from sibling `recipe bookletsss` folder
const frontendDir = path.join(__dirname, '..', 'recipe bookletsss');
app.use(express.static(frontendDir));

// Ensure uploads directory exists and serve uploaded files
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Multer setup for image uploads
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, uploadsDir);
	},
	filename: function (req, file, cb) {
		const ext = path.extname(file.originalname) || '.jpg';
		cb(null, Date.now().toString() + ext);
	}
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Helpful direct routes for auth/login pages
app.get(['/auth.html', '/login.html', '/auth', '/login'], (req, res) => {
	res.sendFile(path.join(frontendDir, 'login.html'));
});

// Image upload endpoint (admin only)
const { verifyAdmin } = require('./middleware/authMiddleware');
app.post('/api/upload', verifyAdmin, upload.single('image'), (req, res) => {
	if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
	// return public URL for saved file
	const publicUrl = `/uploads/${req.file.filename}`;
	res.json({ message: 'Uploaded', filename: req.file.filename, url: publicUrl });
});

// Routes
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const recipeRoutes = require('./routes/recipeRoutes');
const contactRoutes = require('./routes/contactRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');

app.use('/api/users', userRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/favorites', favoriteRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// JSON error handler for payload too large (body-parser)
app.use((err, req, res, next) => {
	if (!err) return next();
	if (err.type === 'entity.too.large' || err.status === 413) {
		console.warn('Request body too large:', (req.headers['content-length'] || 'unknown'));
		return res.status(413).json({ error: 'Payload too large. Reduce image size or increase server limit.' });
	}
	next(err);
});
