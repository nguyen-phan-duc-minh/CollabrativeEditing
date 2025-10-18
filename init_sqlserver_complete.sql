-- =============================================
-- MMT Document Collaboration Platform
-- Complete Database Schema for SQL Server
-- =============================================

-- Drop existing tables (in reverse dependency order)
IF OBJECT_ID('recent_activities', 'U') IS NOT NULL DROP TABLE recent_activities;
IF OBJECT_ID('file_attachments', 'U') IS NOT NULL DROP TABLE file_attachments;
IF OBJECT_ID('audit_logs', 'U') IS NOT NULL DROP TABLE audit_logs;
IF OBJECT_ID('notification_settings', 'U') IS NOT NULL DROP TABLE notification_settings;
IF OBJECT_ID('user_presence', 'U') IS NOT NULL DROP TABLE user_presence;
IF OBJECT_ID('workspace_members', 'U') IS NOT NULL DROP TABLE workspace_members;
IF OBJECT_ID('comments', 'U') IS NOT NULL DROP TABLE comments;
IF OBJECT_ID('operations', 'U') IS NOT NULL DROP TABLE operations;
IF OBJECT_ID('versions', 'U') IS NOT NULL DROP TABLE versions;
IF OBJECT_ID('permissions', 'U') IS NOT NULL DROP TABLE permissions;
IF OBJECT_ID('documents', 'U') IS NOT NULL DROP TABLE documents;
IF OBJECT_ID('document_folders', 'U') IS NOT NULL DROP TABLE document_folders;
IF OBJECT_ID('team_workspaces', 'U') IS NOT NULL DROP TABLE team_workspaces;
IF OBJECT_ID('user_preferences', 'U') IS NOT NULL DROP TABLE user_preferences;
IF OBJECT_ID('user_sessions', 'U') IS NOT NULL DROP TABLE user_sessions;
IF OBJECT_ID('users', 'U') IS NOT NULL DROP TABLE users;

-- =============================================
-- Core Tables
-- =============================================

-- Users table - Authentication and profiles
CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    email NVARCHAR(255) NOT NULL UNIQUE,
    display_name NVARCHAR(255),
    avatar_url NVARCHAR(512),
    google_id NVARCHAR(255) UNIQUE,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Create indexes for users
CREATE INDEX IX_users_email ON users(email);
CREATE INDEX IX_users_google_id ON users(google_id);

-- User sessions - Login tracking
CREATE TABLE user_sessions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    session_token NVARCHAR(255) NOT NULL UNIQUE,
    device_info NVARCHAR(255),
    ip_address NVARCHAR(45), -- IPv6 support
    login_at DATETIME2 DEFAULT GETUTCDATE(),
    last_activity DATETIME2 DEFAULT GETUTCDATE(),
    expires_at DATETIME2 NOT NULL,
    is_active BIT DEFAULT 1,
    
    CONSTRAINT FK_user_sessions_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for user_sessions
CREATE INDEX IX_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IX_user_sessions_session_token ON user_sessions(session_token);

-- User preferences - Settings storage
CREATE TABLE user_preferences (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    preference_key NVARCHAR(100) NOT NULL,
    preference_value NTEXT,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_user_preferences_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for user_preferences
CREATE INDEX IX_user_preferences_user_id ON user_preferences(user_id);

-- Team workspaces - Collaborative workspaces
CREATE TABLE team_workspaces (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(255) NOT NULL,
    description NTEXT,
    owner_id INT NOT NULL,
    invite_code NVARCHAR(50) UNIQUE,
    is_private BIT DEFAULT 1,
    max_members INT DEFAULT 50,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_team_workspaces_owner_id FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for team_workspaces
CREATE INDEX IX_team_workspaces_owner_id ON team_workspaces(owner_id);
CREATE INDEX IX_team_workspaces_invite_code ON team_workspaces(invite_code);

-- Workspace members - Team membership
CREATE TABLE workspace_members (
    id INT IDENTITY(1,1) PRIMARY KEY,
    workspace_id INT NOT NULL,
    user_id INT NOT NULL,
    role NVARCHAR(10) CHECK (role IN ('admin', 'editor')) DEFAULT 'editor',
    joined_at DATETIME2 DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_workspace_members_workspace_id FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE,
    CONSTRAINT FK_workspace_members_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for workspace_members
CREATE INDEX IX_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IX_workspace_members_user_id ON workspace_members(user_id);

-- Document folders - Organization
CREATE TABLE document_folders (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(255) NOT NULL,
    description NTEXT,
    owner_id INT NOT NULL,
    parent_folder_id INT,
    workspace_id INT,
    color NVARCHAR(7), -- Hex color code
    is_public BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_document_folders_owner_id FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT FK_document_folders_parent_folder_id FOREIGN KEY (parent_folder_id) REFERENCES document_folders(id) ON DELETE CASCADE,
    CONSTRAINT FK_document_folders_workspace_id FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE
);

-- Create indexes for document_folders
CREATE INDEX IX_document_folders_owner_id ON document_folders(owner_id);
CREATE INDEX IX_document_folders_parent_folder_id ON document_folders(parent_folder_id);
CREATE INDEX IX_document_folders_workspace_id ON document_folders(workspace_id);

-- =============================================
-- Document System
-- =============================================

-- Documents - Core document storage with secure hash IDs
CREATE TABLE documents (
    id NVARCHAR(16) PRIMARY KEY, -- Secure hash-based ID
    type NVARCHAR(16) CHECK (type IN ('doc', 'code', 'whiteboard', 'sheet')) DEFAULT 'doc',
    title NVARCHAR(255) NOT NULL DEFAULT 'Untitled Document',
    owner_id INT NOT NULL,
    workspace_id INT,
    folder_id INT,
    share_token NVARCHAR(64) UNIQUE,
    current_version INT DEFAULT 0,
    content NTEXT,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    is_archived BIT DEFAULT 0,
    
    CONSTRAINT FK_documents_owner_id FOREIGN KEY (owner_id) REFERENCES users(id),
    CONSTRAINT FK_documents_workspace_id FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE,
    CONSTRAINT FK_documents_folder_id FOREIGN KEY (folder_id) REFERENCES document_folders(id) ON DELETE SET NULL
);

-- Create indexes for documents
CREATE INDEX IX_documents_owner_id ON documents(owner_id);
CREATE INDEX IX_documents_workspace_id ON documents(workspace_id);
CREATE INDEX IX_documents_folder_id ON documents(folder_id);
CREATE INDEX IX_documents_created_at ON documents(created_at);
CREATE INDEX IX_documents_share_token ON documents(share_token);

-- Permissions - Document access control
CREATE TABLE permissions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    document_id NVARCHAR(16) NOT NULL,
    user_id INT NOT NULL,
    role NVARCHAR(10) CHECK (role IN ('owner', 'editor', 'viewer')) NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_permissions_document_id FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    CONSTRAINT FK_permissions_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for permissions
CREATE INDEX IX_permissions_document_id ON permissions(document_id);
CREATE INDEX IX_permissions_user_id ON permissions(user_id);

-- Versions - Document version history
CREATE TABLE versions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    document_id NVARCHAR(16) NOT NULL,
    version_no INT NOT NULL,
    created_by INT NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    snapshot_content NTEXT NOT NULL,
    snapshot_ref NVARCHAR(512),
    
    CONSTRAINT FK_versions_document_id FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    CONSTRAINT FK_versions_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Create indexes for versions
CREATE INDEX IX_versions_document_id ON versions(document_id);

-- Operations - Operational transforms for collaboration
CREATE TABLE operations (
    id INT IDENTITY(1,1) PRIMARY KEY,
    document_id NVARCHAR(16) NOT NULL,
    version_no INT NOT NULL,
    user_id INT NOT NULL,
    op_type NVARCHAR(20) NOT NULL,
    op_payload NTEXT NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_operations_document_id FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    CONSTRAINT FK_operations_user_id FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indexes for operations
CREATE INDEX IX_operations_document_id ON operations(document_id);
CREATE INDEX IX_operations_version_no ON operations(version_no);
CREATE INDEX IX_operations_created_at ON operations(created_at);

-- Comments - Document annotations
CREATE TABLE comments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    document_id NVARCHAR(16) NOT NULL,
    author_id INT NOT NULL,
    anchor NTEXT, -- JSON anchor data
    content NTEXT NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    resolved BIT DEFAULT 0,
    resolved_by INT,
    resolved_at DATETIME2,
    
    CONSTRAINT FK_comments_document_id FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    CONSTRAINT FK_comments_author_id FOREIGN KEY (author_id) REFERENCES users(id),
    CONSTRAINT FK_comments_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(id)
);

-- Create indexes for comments
CREATE INDEX IX_comments_document_id ON comments(document_id);
CREATE INDEX IX_comments_author_id ON comments(author_id);
CREATE INDEX IX_comments_created_at ON comments(created_at);

-- =============================================
-- Real-time Features
-- =============================================

-- User presence - Real-time collaboration tracking
CREATE TABLE user_presence (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    document_id NVARCHAR(16) NOT NULL,
    cursor_position INT DEFAULT 0,
    selection_start INT,
    selection_end INT,
    status NVARCHAR(20) CHECK (status IN ('online', 'idle', 'offline')) DEFAULT 'online',
    last_seen DATETIME2 DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_user_presence_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT FK_user_presence_document_id FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Create indexes for user_presence
CREATE INDEX IX_user_presence_user_id ON user_presence(user_id);
CREATE INDEX IX_user_presence_document_id ON user_presence(document_id);

-- =============================================
-- System Features
-- =============================================

-- Notification settings - User notification preferences
CREATE TABLE notification_settings (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    notification_type NVARCHAR(50) NOT NULL, -- 'comment', 'mention', 'document_shared', etc.
    is_enabled BIT DEFAULT 1,
    delivery_method NVARCHAR(20) CHECK (delivery_method IN ('email', 'push', 'in_app')) DEFAULT 'in_app',
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_notification_settings_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for notification_settings
CREATE INDEX IX_notification_settings_user_id ON notification_settings(user_id);

-- Audit logs - System activity tracking
CREATE TABLE audit_logs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT,
    document_id NVARCHAR(16),
    action NVARCHAR(100) NOT NULL, -- 'create', 'edit', 'delete', 'share', etc.
    entity_type NVARCHAR(50) NOT NULL, -- 'document', 'comment', 'permission', etc.
    entity_id INT,
    old_values NTEXT, -- JSON string of old values
    new_values NTEXT, -- JSON string of new values
    ip_address NVARCHAR(45),
    user_agent NVARCHAR(500),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_audit_logs_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT FK_audit_logs_document_id FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Create indexes for audit_logs
CREATE INDEX IX_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IX_audit_logs_document_id ON audit_logs(document_id);
CREATE INDEX IX_audit_logs_created_at ON audit_logs(created_at);

-- File attachments - Document file uploads
CREATE TABLE file_attachments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    document_id NVARCHAR(16) NOT NULL,
    uploaded_by INT NOT NULL,
    file_name NVARCHAR(255) NOT NULL,
    file_size INT NOT NULL, -- in bytes
    file_type NVARCHAR(100), -- MIME type
    file_path NVARCHAR(500) NOT NULL, -- Storage path
    file_hash NVARCHAR(64), -- SHA-256 for deduplication
    is_embedded BIT DEFAULT 0, -- Whether file is embedded in document
    upload_date DATETIME2 DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_file_attachments_document_id FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    CONSTRAINT FK_file_attachments_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Create indexes for file_attachments
CREATE INDEX IX_file_attachments_document_id ON file_attachments(document_id);

-- Recent activities - User activity tracking
CREATE TABLE recent_activities (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    document_id NVARCHAR(16) NOT NULL,
    activity_type NVARCHAR(50) NOT NULL, -- 'viewed', 'edited', 'commented', 'shared'
    activity_data NTEXT, -- JSON string with additional activity data
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_recent_activities_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT FK_recent_activities_document_id FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Create indexes for recent_activities
CREATE INDEX IX_recent_activities_user_id ON recent_activities(user_id);
CREATE INDEX IX_recent_activities_document_id ON recent_activities(document_id);
CREATE INDEX IX_recent_activities_created_at ON recent_activities(created_at);

-- =============================================
-- Sample Data
-- =============================================

-- Insert sample users
INSERT INTO users (email, display_name, google_id, created_at, updated_at) VALUES
('admin@example.com', 'System Administrator', NULL, GETUTCDATE(), GETUTCDATE()),
('editor@example.com', 'Content Editor', NULL, GETUTCDATE(), GETUTCDATE()),
('viewer@example.com', 'Document Viewer', NULL, GETUTCDATE(), GETUTCDATE());

-- Insert sample workspace
DECLARE @workspace_id INT;
INSERT INTO team_workspaces (name, description, owner_id, invite_code, is_private, max_members, created_at, updated_at) 
VALUES ('Company Projects', 'Main workspace for company documents and collaboration', 1, 'PROJ2025', 0, 10, GETUTCDATE(), GETUTCDATE());
SET @workspace_id = SCOPE_IDENTITY();

-- Add workspace members
INSERT INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES
(@workspace_id, 2, 'editor', GETUTCDATE()),
(@workspace_id, 3, 'editor', GETUTCDATE());

-- Insert sample folder
DECLARE @folder_id INT;
INSERT INTO document_folders (name, description, owner_id, workspace_id, color, is_public, created_at, updated_at)
VALUES ('Important Documents', 'Critical company documents', 1, @workspace_id, '#3B82F6', 1, GETUTCDATE(), GETUTCDATE());
SET @folder_id = SCOPE_IDENTITY();

-- Insert sample documents with secure hash IDs
INSERT INTO documents (id, title, owner_id, workspace_id, folder_id, content, created_at, updated_at) VALUES
('a1b2c3d4e5f6g7h8', 'Team Meeting Minutes', 1, @workspace_id, NULL, 
 '<h1>Team Meeting Minutes</h1><p><strong>Date:</strong> October 17, 2025</p><h2>Agenda</h2><ul><li>Project updates</li><li>New features discussion</li><li>Next sprint planning</li></ul>', 
 GETUTCDATE(), GETUTCDATE()),

('h8g7f6e5d4c3b2a1', 'Project Specifications', 2, @workspace_id, @folder_id,
 '<h1>Project Specifications</h1><p>This document outlines the technical specifications for our new project.</p><h2>Requirements</h2><ul><li>User authentication</li><li>Real-time collaboration</li><li>Document versioning</li></ul>',
 GETUTCDATE(), GETUTCDATE()),

('x9y8z7w6v5u4t3s2', 'Getting Started Guide', 1, @workspace_id, @folder_id,
 '<h1>Getting Started Guide</h1><p>Welcome to our collaborative document platform!</p><h2>Features</h2><ul><li>📝 Rich text editing</li><li>👥 Real-time collaboration</li><li>🤖 AI writing assistant</li><li>📄 Automatic pagination</li><li>🔒 Secure document IDs</li></ul>',
 GETUTCDATE(), GETUTCDATE()),

('p9o8i7u6y5t4r3e2', 'Personal Notes', 1, NULL, NULL,
 '<h1>Personal Notes</h1><p>This is a personal document not shared in any workspace.</p>',
 GETUTCDATE(), GETUTCDATE());

-- Create permissions for documents
INSERT INTO permissions (document_id, user_id, role, created_at) VALUES
-- Team Meeting Minutes permissions
('a1b2c3d4e5f6g7h8', 1, 'owner', GETUTCDATE()),
('a1b2c3d4e5f6g7h8', 2, 'editor', GETUTCDATE()),
('a1b2c3d4e5f6g7h8', 3, 'editor', GETUTCDATE()),

-- Project Specifications permissions  
('h8g7f6e5d4c3b2a1', 2, 'owner', GETUTCDATE()),
('h8g7f6e5d4c3b2a1', 1, 'editor', GETUTCDATE()),
('h8g7f6e5d4c3b2a1', 3, 'editor', GETUTCDATE()),

-- Getting Started Guide permissions
('x9y8z7w6v5u4t3s2', 1, 'owner', GETUTCDATE()),
('x9y8z7w6v5u4t3s2', 2, 'editor', GETUTCDATE()),
('x9y8z7w6v5u4t3s2', 3, 'editor', GETUTCDATE()),

-- Personal Notes (only owner)
('p9o8i7u6y5t4r3e2', 1, 'owner', GETUTCDATE());

-- Insert sample notification settings
INSERT INTO notification_settings (user_id, notification_type, is_enabled, delivery_method, created_at, updated_at) VALUES
(1, 'comment', 1, 'email', GETUTCDATE(), GETUTCDATE()),
(1, 'mention', 1, 'in_app', GETUTCDATE(), GETUTCDATE()),
(1, 'document_shared', 1, 'email', GETUTCDATE(), GETUTCDATE()),
(2, 'comment', 1, 'in_app', GETUTCDATE(), GETUTCDATE()),
(2, 'document_shared', 1, 'email', GETUTCDATE(), GETUTCDATE()),
(3, 'comment', 0, 'in_app', GETUTCDATE(), GETUTCDATE());

-- =============================================
-- Completion Message
-- =============================================