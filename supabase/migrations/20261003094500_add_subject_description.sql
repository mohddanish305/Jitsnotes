-- Migration: Add optional description column to subjects
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS description text;
