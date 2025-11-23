-- Migration: add description, ingredients, instructions, favorite to recipes
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS ingredients TEXT,
  ADD COLUMN IF NOT EXISTS instructions TEXT,
  ADD COLUMN IF NOT EXISTS favorite BOOLEAN DEFAULT FALSE;

-- Ensure existing rows have favorite set
UPDATE recipes SET favorite = FALSE WHERE favorite IS NULL;