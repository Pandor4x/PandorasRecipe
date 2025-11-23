-- Migration: create reviews table to store reviews separately
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  recipe_id INT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  uid VARCHAR(255),
  reviewer VARCHAR(255),
  text TEXT,
  rating INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- If you previously had reviews in recipes.reviews JSONB, consider migrating them manually.
