const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middleware/authMiddleware');
const { getFavorites, getFavoriteIds, toggleFavorite } = require('../controllers/favoritesController');

router.get('/', verifyAuth, getFavorites);
router.get('/ids', verifyAuth, getFavoriteIds);
router.post('/:recipeId', verifyAuth, toggleFavorite);

module.exports = router;
