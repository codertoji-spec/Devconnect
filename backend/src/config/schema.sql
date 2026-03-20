-- Run this file once to set up your database
-- Command: psql -U postgres -d devcollab -f schema.sql

-- Users table: stores registered users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Rooms table: each collaborative coding session
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  room_code VARCHAR(10) UNIQUE NOT NULL,  -- Short code users share to join
  language VARCHAR(50) DEFAULT 'javascript',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Code snapshots: saves code history for each room
CREATE TABLE IF NOT EXISTS code_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  code TEXT DEFAULT '',
  saved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  saved_at TIMESTAMP DEFAULT NOW()
);

-- Room participants: tracks who has access to which room
CREATE TABLE IF NOT EXISTS room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(room_id, user_id)  -- A user can only join a room once
);

-- Chat messages inside a room
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  username VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW()
);
