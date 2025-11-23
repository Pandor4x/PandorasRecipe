const pool = require('../models/db');

// GET /api/favorites - return full recipe records favorited by current user
const getFavorites = async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const q = `SELECT recipes.* FROM favorites JOIN recipes ON favorites.recipe_id = recipes.id WHERE favorites.user_id = $1 ORDER BY favorites.created_at DESC`;
    const result = await pool.query(q, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('getFavorites error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/favorites/ids - return array of recipe ids favorited by user
const getFavoriteIds = async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const q = `SELECT recipe_id FROM favorites WHERE user_id = $1`;
    const result = await pool.query(q, [userId]);
    const ids = result.rows.map(r => r.recipe_id);
    res.json({ ids });
  } catch (err) {
    console.error('getFavoriteIds error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/favorites/:recipeId - toggle favorite for current user
const toggleFavorite = async (req, res) => {
  const userId = req.user && req.user.id;
  const recipeId = Number(req.params.recipeId);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!recipeId) return res.status(400).json({ error: 'Invalid recipe id' });

  try {
    // check existing
    const check = await pool.query('SELECT id FROM favorites WHERE user_id = $1 AND recipe_id = $2', [userId, recipeId]);
    if (check.rows.length) {
      await pool.query('DELETE FROM favorites WHERE user_id = $1 AND recipe_id = $2', [userId, recipeId]);
      return res.json({ removed: true });
    }
    await pool.query('INSERT INTO favorites(user_id, recipe_id) VALUES($1,$2)', [userId, recipeId]);
    res.json({ added: true });
  } catch (err) {
    console.error('toggleFavorite error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getFavorites, getFavoriteIds, toggleFavorite };
