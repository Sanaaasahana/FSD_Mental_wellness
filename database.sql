-- Create database tables for MindfulSpace mental wellness app

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    birthdate DATE,
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Moods table for daily mood tracking
CREATE TABLE moods (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    mood VARCHAR(50) NOT NULL,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- Gratitude entries table
CREATE TABLE gratitude (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Journal entries table
CREATE TABLE journal_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'personal',
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Journal likes table
CREATE TABLE journal_likes (
    id SERIAL PRIMARY KEY,
    journal_id INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(journal_id, user_id)
);

-- Journal comments table
CREATE TABLE journal_comments (
    id SERIAL PRIMARY KEY,
    journal_id INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Connection requests table
CREATE TABLE connection_requests (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sender_id, receiver_id)
);

-- Connections table
CREATE TABLE connections (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'accepted',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user1_id, user2_id),
    CHECK (user1_id < user2_id)
);

-- Create indexes for better performance
CREATE INDEX idx_moods_user_date ON moods(user_id, date);
CREATE INDEX idx_gratitude_user ON gratitude(user_id);
CREATE INDEX idx_journal_user ON journal_entries(user_id);
CREATE INDEX idx_journal_public ON journal_entries(is_public);
CREATE INDEX idx_journal_category ON journal_entries(category);
CREATE INDEX idx_journal_likes_journal ON journal_likes(journal_id);
CREATE INDEX idx_journal_comments_journal ON journal_comments(journal_id);
CREATE INDEX idx_connection_requests_receiver ON connection_requests(receiver_id);
CREATE INDEX idx_connections_users ON connections(user1_id, user2_id);

-- Create triggers to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_connection_requests_updated_at BEFORE UPDATE ON connection_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


