-- Migration: add reviews JSONB column to recipes
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS reviews JSONB DEFAULT '[]'::jsonb;

-- Ensure existing rows have an array
UPDATE recipes SET reviews = '[]'::jsonb WHERE reviews IS NULL;