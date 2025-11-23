const express = require('express');
const router = express.Router();
const { getRecipes, getRecipeById, addRecipe, updateRecipe, deleteRecipe, addReview, addRating } = require('../controllers/recipeController');

// Public
router.get("/", getRecipes);
router.get("/:id", getRecipeById);
// Public endpoints for reviews/ratings
router.post('/:id/reviews', addReview);
router.post('/:id/rate', addRating);

const { verifyAdmin } = require('../middleware/authMiddleware');

// Admin routes
router.post("/", verifyAdmin, addRecipe);
router.put("/:id", verifyAdmin, updateRecipe);
router.delete("/:id", verifyAdmin, deleteRecipe);

module.exports = router;
