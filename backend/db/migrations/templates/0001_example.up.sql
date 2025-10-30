-- Migration: Create example table with users
-- Version: 0001
-- Description: Demonstrates a reversible migration pattern with proper constraints

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create index on username
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert example data (optional, for demonstration)
INSERT INTO users (email, username, full_name)
VALUES 
  ('admin@example.com', 'admin', 'System Administrator'),
  ('user@example.com', 'user', 'Example User')
ON CONFLICT (email) DO NOTHING;
