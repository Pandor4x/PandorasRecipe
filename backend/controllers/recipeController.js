const pool = require('../models/db');

// Get recipes (optionally by category)
const getRecipes = async (req, res) => {
  const { category } = req.query;
  try {
    let query = "SELECT * FROM recipes";
    const params = [];
    if (category) {
      // case-insensitive, trim-insensitive comparison
      query += " WHERE lower(trim(category)) = lower(trim($1))";
      params.push(category);
    }
    const result = await pool.query(query, params);
    const recipes = result.rows;
    // Attach reviews for each recipe so list endpoints include review data (used by trending cards)
    for (let i = 0; i < recipes.length; i++) {
      try {
        const revRes = await pool.query('SELECT id, uid, reviewer, text, rating, created_at FROM reviews WHERE recipe_id=$1 ORDER BY created_at DESC', [recipes[i].id]);
        recipes[i].reviews = revRes.rows;
      } catch (e) {
        // Non-fatal: if fetching reviews fails for a recipe, continue without reviews
        recipes[i].reviews = [];
      }
    }
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single recipe by id
const getRecipeById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM recipes WHERE id=$1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Recipe not found' });
    const recipe = result.rows[0];
    // Fetch reviews from separate reviews table
    const revRes = await pool.query('SELECT id, uid, reviewer, text, rating, created_at FROM reviews WHERE recipe_id=$1 ORDER BY created_at DESC', [id]);
    recipe.reviews = revRes.rows; // array of review objects
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add recipe (admin)
const addRecipe = async (req, res) => {
  const { title, category, image, created_by, description, ingredients, instructions, favorite } = req.body;
  // normalize category (trim)
  const normalizedCategory = category ? category.toString().trim() : null;
  // Prefer authenticated user id if available (verifyAdmin middleware sets req.user)
  const createdBy = (req.user && req.user.id) ? req.user.id : (created_by || null);
  try {
    console.log('addRecipe called by user:', req.user ? req.user.id : null);
    console.log('addRecipe payload:', { title, category, image, description, ingredients, instructions, favorite });
    const result = await pool.query(
      `INSERT INTO recipes (title, category, image, created_by, description, ingredients, instructions, favorite)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [title, normalizedCategory, image || null, createdBy, description || null, ingredients || null, instructions || null, favorite || false]
    );
    res.json({ message: "Recipe added!", recipe: result.rows[0] });
  } catch (err) {
    console.error('Error in addRecipe:', err);
    res.status(500).json({ error: err.message });
  }
};

// Update recipe (admin)
const updateRecipe = async (req, res) => {
  const { id } = req.params;
  const { title, category, image, description, ingredients, instructions, favorite } = req.body;
  const normalizedCategory = category ? category.toString().trim() : null;
  try {
    const result = await pool.query(
      `UPDATE recipes SET title=$1, category=$2, image=$3, description=$4, ingredients=$5, instructions=$6, favorite=$7 WHERE id=$8 RETURNING *`,
      [title, normalizedCategory, image || null, description || null, ingredients || null, instructions || null, favorite || false, id]
    );
    res.json({ message: "Recipe updated!", recipe: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete recipe (admin)
const deleteRecipe = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM recipes WHERE id=$1", [id]);
    res.json({ message: "Recipe deleted!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add a review to a recipe (public)
const addReview = async (req, res) => {
  const { id } = req.params;
  const { uid, reviewer, text, rating } = req.body;
  try {
    // ensure recipe exists
    const cur = await pool.query('SELECT id FROM recipes WHERE id=$1', [id]);
    if (cur.rows.length === 0) return res.status(404).json({ error: 'Recipe not found' });
    const insert = await pool.query(
      'INSERT INTO reviews (recipe_id, uid, reviewer, text, rating) VALUES ($1,$2,$3,$4,$5) RETURNING id, recipe_id, uid, reviewer, text, rating, created_at',
      [id, uid || null, reviewer || 'Anonymous', text || '', rating || 0]
    );
    res.json({ message: 'Review added', review: insert.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add/update rating for a recipe (public)
const addRating = async (req, res) => {
  const { id } = req.params;
  const { uid, rating } = req.body;
  if (!uid) return res.status(400).json({ error: 'uid required' });
  try {
    const cur = await pool.query('SELECT ratings FROM recipes WHERE id=$1', [id]);
    if (cur.rows.length === 0) return res.status(404).json({ error: 'Recipe not found' });
    let existing = cur.rows[0].ratings || {};
    // ensure object
    if (!existing || Array.isArray(existing)) existing = {};
    existing[uid] = Number(rating) || 0;
    await pool.query('UPDATE recipes SET ratings=$1 WHERE id=$2', [JSON.stringify(existing), id]);
    res.json({ message: 'Rating saved', ratings: existing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getRecipes, getRecipeById, addRecipe, updateRecipe, deleteRecipe, addReview, addRating };
