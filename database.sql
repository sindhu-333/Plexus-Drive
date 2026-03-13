-- PlexusDrive Database Schema
-- Created for Netlify deployment
-- This file contains all the necessary tables and data for the PlexusDrive application

-- Create custom enums first (drop if exists to avoid conflicts)
DROP TYPE IF EXISTS analysis_state CASCADE;
CREATE TYPE analysis_state AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Create functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_folders_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create tables in dependency order

-- 1. Users table (base table, no dependencies)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP WITHOUT TIME ZONE,
    profile_picture TEXT,
    bio TEXT,
    phone VARCHAR(20),
    date_of_birth DATE,
    location VARCHAR(255),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    theme VARCHAR(20) DEFAULT 'light',
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    email_notifications BOOLEAN DEFAULT true,
    storage_limit BIGINT DEFAULT 5368709120, -- 5GB default
    email_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    verification_token_expires TIMESTAMP WITHOUT TIME ZONE,
    account_status VARCHAR(20) DEFAULT 'pending'
);

-- 2. Folders table (depends on users for self-referencing)
CREATE TABLE folders (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Files table (depends on users and folders)
CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    filepath TEXT NOT NULL,
    filesize BIGINT NOT NULL,
    mimetype VARCHAR(100),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    analysis_status analysis_state DEFAULT 'pending',
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    dropbox_path TEXT,
    file_hash VARCHAR(64),
    is_shared BOOLEAN DEFAULT false,
    share_count INTEGER DEFAULT 0,
    folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
    last_accessed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active'
);

-- 4. File AI Results table (depends on files)
CREATE TABLE file_ai_results (
    id SERIAL PRIMARY KEY,
    file_id INTEGER UNIQUE NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    summary TEXT,
    keywords JSONB,
    sentiment VARCHAR(50),
    document_category VARCHAR(100),
    content_summary TEXT,
    key_topics TEXT[],
    file_category VARCHAR(50),
    complexity_score INTEGER,
    technical_tags TEXT[],
    content_type VARCHAR(50),
    extracted_text TEXT,
    analysis_metadata JSONB,
    confidence_scores JSONB,
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Jobs table (depends on files)
CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. File Shares table (depends on files and users)
CREATE TABLE file_shares (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    shared_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    share_type VARCHAR(20) DEFAULT 'public' NOT NULL,
    share_token VARCHAR(255) UNIQUE NOT NULL,
    shared_with_email VARCHAR(255),
    access_level VARCHAR(20) DEFAULT 'view' NOT NULL,
    expires_at TIMESTAMP WITHOUT TIME ZONE,
    password_protected BOOLEAN DEFAULT false,
    password_hash VARCHAR(255),
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITHOUT TIME ZONE,
    last_accessed_ip VARCHAR(45),
    message TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Share Access Logs table (depends on file_shares)
CREATE TABLE share_access_logs (
    id SERIAL PRIMARY KEY,
    share_id INTEGER NOT NULL REFERENCES file_shares(id) ON DELETE CASCADE,
    accessed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    action VARCHAR(20) DEFAULT 'view',
    success BOOLEAN DEFAULT true
);

-- 8. File Favorites table (depends on users and files)
CREATE TABLE file_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, file_id)
);

-- 9. Notifications table (depends on users)
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50) DEFAULT 'info',
    action_type VARCHAR(100),
    action_data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- 10. Notification Preferences table (depends on users)
CREATE TABLE notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    file_upload_notifications BOOLEAN DEFAULT true,
    share_notifications BOOLEAN DEFAULT true,
    storage_alerts BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance optimization

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_email_verified ON users(email_verified);
CREATE INDEX idx_users_reset_token ON users(reset_token);
CREATE INDEX idx_users_verification_token ON users(verification_token);
CREATE INDEX idx_users_updated_at ON users(updated_at);

-- Files indexes
CREATE INDEX idx_files_folder_id ON files(folder_id);
CREATE INDEX idx_files_last_accessed_at ON files(last_accessed_at DESC);
CREATE INDEX idx_files_user_last_accessed ON files(user_id, last_accessed_at DESC);
CREATE INDEX idx_files_status ON files(status);
CREATE INDEX idx_files_active ON files(user_id, status) WHERE status = 'active';

-- Folders indexes
CREATE INDEX idx_folders_user_id ON folders(user_id);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);

-- File shares indexes
CREATE INDEX idx_file_shares_file_id ON file_shares(file_id);
CREATE INDEX idx_file_shares_token ON file_shares(share_token);
CREATE INDEX idx_file_shares_shared_by ON file_shares(shared_by);
CREATE INDEX idx_file_shares_email ON file_shares(shared_with_email);
CREATE INDEX idx_file_shares_active ON file_shares(is_active);
CREATE INDEX idx_file_shares_expires ON file_shares(expires_at);

-- Share access logs indexes
CREATE INDEX idx_share_access_logs_share_id ON share_access_logs(share_id);
CREATE INDEX idx_share_access_logs_accessed_at ON share_access_logs(accessed_at);

-- File favorites indexes
CREATE INDEX idx_file_favorites_user_id ON file_favorites(user_id);
CREATE INDEX idx_file_favorites_file_id ON file_favorites(file_id);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_action_type ON notifications(action_type);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_files_updated_at 
    BEFORE UPDATE ON files 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folders_updated_at 
    BEFORE UPDATE ON folders 
    FOR EACH ROW EXECUTE FUNCTION update_folders_updated_at_column();

-- Insert default data (optional - for development/testing)
-- You can uncomment these lines if you want some default data

-- INSERT INTO users (name, email, password, email_verified, account_status) VALUES 
-- ('Test User', 'test@example.com', '$2b$10$example.hash.here', true, 'active');

-- Comments for deployment:
-- 1. This file creates a complete database schema for PlexusDrive
-- 2. All tables are created in dependency order to avoid foreign key errors
-- 3. Includes all necessary indexes for performance
-- 4. Includes triggers for automatic timestamp updates
-- 5. Uses SERIAL for auto-incrementing IDs (PostgreSQL specific)
-- 6. All constraints and relationships are properly defined
-- 7. Ready for production deployment on Netlify with PostgreSQL