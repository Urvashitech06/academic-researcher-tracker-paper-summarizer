-- =============================================================================
-- Scholar's Home - AI-Powered Academic Research Tracker & Paper Summarizer
-- Database Schema: 3rd Normal Form (3NF) Relational Architecture
-- =============================================================================

-- 1. Users Table
-- Stores user accounts, encrypted password hashes, and profiles
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Migration support for existing database instances
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);

-- 2. Papers Table
-- Stores research paper entities.
-- Foreign Key: user_id -> users(user_id) with ON DELETE CASCADE
CREATE TABLE IF NOT EXISTS papers (
    paper_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    summary TEXT,
    abstract_raw TEXT,
    file_path VARCHAR(500),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tags Table
-- Stores distinct taxonomy tags in 3NF (eliminates repeating groups and duplicate strings)
CREATE TABLE IF NOT EXISTS tags (
    tag_id SERIAL PRIMARY KEY,
    tag_name VARCHAR(100) UNIQUE NOT NULL
);

-- 4. Paper_Tags Junction Table (Many-to-Many)
-- Resolves M:N relationship between Papers and Tags.
-- Composite Primary Key: (paper_id, tag_id)
-- Cascades on paper or tag deletion
CREATE TABLE IF NOT EXISTS paper_tags (
    paper_id INTEGER NOT NULL REFERENCES papers(paper_id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
    PRIMARY KEY (paper_id, tag_id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_papers_user_id ON papers(user_id);
CREATE INDEX IF NOT EXISTS idx_papers_uploaded_at ON papers(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_paper_tags_tag_id ON paper_tags(tag_id);

-- Seed Default Primary Researcher User (Default password: Password123!)
-- Hash generated via werkzeug.security.generate_password_hash('Password123!', method='pbkdf2:sha256')
INSERT INTO users (email, password_hash, full_name) 
VALUES (
    'researcher@scholarshome.edu',
    'scrypt:32768:8:1$bh1v1vYjqI9iH4IO$1cef3b85506f3eb093ce131d5360f3168e6f0e1cfab3d828ca26424ac189e19042afdf0b8ade1ccb3c0070c0696e4f7ec1bceaa3aa2ef7ad79b0719b6e10bf02',
    'Dr. Elena Vance'
) 
ON CONFLICT (email) DO NOTHING;
