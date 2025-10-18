from datetime import datetime
import secrets
import hashlib
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

# Helper function to format datetime to ISO8601 with UTC timezone
def format_datetime(dt):
    """Convert datetime to ISO8601 format with 'Z' suffix for UTC"""
    return dt.isoformat() + 'Z' if dt else None

# Helper function to generate secure document ID
def generate_document_id():
    """Generate a secure random document ID using hash"""
    random_bytes = secrets.token_bytes(32)
    hash_obj = hashlib.sha256(random_bytes)
    return hash_obj.hexdigest()[:16]  # Use first 16 characters for shorter ID

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    display_name = Column(String(255))
    avatar_url = Column(String(512))
    google_id = Column(String(255), unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    owned_documents = relationship('Document', back_populates='owner', foreign_keys='Document.owner_id')
    permissions = relationship('Permission', back_populates='user', cascade='all, delete-orphan')
    operations = relationship('Operation', back_populates='user')
    comments = relationship('Comment', back_populates='author', foreign_keys='Comment.author_id')
    versions = relationship('Version', back_populates='created_by_user')
    sessions = relationship('UserSession', back_populates='user', cascade='all, delete-orphan')
    preferences = relationship('UserPreference', back_populates='user', cascade='all, delete-orphan')
    owned_folders = relationship('DocumentFolder', back_populates='owner', cascade='all, delete-orphan')
    owned_workspaces = relationship('TeamWorkspace', back_populates='owner', cascade='all, delete-orphan')
    presence = relationship('UserPresence', back_populates='user', cascade='all, delete-orphan')
    notification_settings = relationship('NotificationSetting', back_populates='user', cascade='all, delete-orphan')
    uploaded_files = relationship('FileAttachment', back_populates='uploader')
    activities = relationship('RecentActivity', back_populates='user', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'display_name': self.display_name,
            'avatar_url': self.avatar_url,
            'created_at': format_datetime(self.created_at)
        }

class Document(Base):
    __tablename__ = 'documents'
    
    id = Column(String(16), primary_key=True, default=generate_document_id)
    type = Column(String(16), CheckConstraint("type IN ('doc','code','whiteboard','sheet')"), default='doc')
    title = Column(String(255), nullable=False, default='Untitled Document')
    owner_id = Column(Integer, ForeignKey('users.id', ondelete='NO ACTION'), nullable=False, index=True)
    workspace_id = Column(Integer, ForeignKey('team_workspaces.id', ondelete='CASCADE'), index=True)
    folder_id = Column(Integer, ForeignKey('document_folders.id', ondelete='SET NULL'), index=True)
    share_token = Column(String(64), unique=True, index=True)
    current_version = Column(Integer, default=0)
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_archived = Column(Boolean, default=False)
    
    # Relationships
    owner = relationship('User', back_populates='owned_documents', foreign_keys=[owner_id])
    workspace = relationship('TeamWorkspace')
    folder = relationship('DocumentFolder')
    permissions = relationship('Permission', back_populates='document', cascade='all, delete-orphan')
    operations = relationship('Operation', back_populates='document', cascade='all, delete-orphan')
    versions = relationship('Version', back_populates='document', cascade='all, delete-orphan')
    comments = relationship('Comment', back_populates='document', cascade='all, delete-orphan')
    presence = relationship('UserPresence', back_populates='document', cascade='all, delete-orphan')
    attachments = relationship('FileAttachment', back_populates='document', cascade='all, delete-orphan')
    activities = relationship('RecentActivity', back_populates='document', cascade='all, delete-orphan')
    
    def to_dict(self, include_content=False):
        data = {
            'id': self.id,
            'type': self.type,
            'title': self.title,
            'owner_id': self.owner_id,
            'owner': self.owner.to_dict() if self.owner else None,
            'workspace_id': self.workspace_id,
            'workspace': self.workspace.to_dict() if self.workspace else None,
            'folder_id': self.folder_id,
            'folder': self.folder.to_dict() if self.folder else None,
            'share_token': self.share_token,
            'current_version': self.current_version,
            'created_at': format_datetime(self.created_at),
            'updated_at': format_datetime(self.updated_at),
            'is_archived': self.is_archived
        }
        if include_content:
            data['content'] = self.content
        return data

class Permission(Base):
    __tablename__ = 'permissions'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String(16), ForeignKey('documents.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    role = Column(String(10), CheckConstraint("role IN ('owner','editor','viewer')"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    document = relationship('Document', back_populates='permissions')
    user = relationship('User', back_populates='permissions')
    
    def to_dict(self):
        return {
            'id': self.id,
            'document_id': self.document_id,
            'user_id': self.user_id,
            'user': self.user.to_dict() if self.user else None,
            'role': self.role,
            'created_at': format_datetime(self.created_at)
        }

class Version(Base):
    __tablename__ = 'versions'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String(16), ForeignKey('documents.id', ondelete='CASCADE'), nullable=False, index=True)
    version_no = Column(Integer, nullable=False)
    created_by = Column(Integer, ForeignKey('users.id', ondelete='NO ACTION'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    snapshot_content = Column(Text, nullable=False)
    snapshot_ref = Column(String(512))
    
    # Relationships
    document = relationship('Document', back_populates='versions')
    created_by_user = relationship('User', back_populates='versions')
    
    def to_dict(self):
        return {
            'id': self.id,
            'document_id': self.document_id,
            'version_no': self.version_no,
            'created_by': self.created_by,
            'created_by_user': self.created_by_user.to_dict() if self.created_by_user else None,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None,  # Add 'Z' for UTC
            'snapshot_ref': self.snapshot_ref
        }

class Operation(Base):
    __tablename__ = 'operations'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String(16), ForeignKey('documents.id', ondelete='CASCADE'), nullable=False, index=True)
    version_no = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='NO ACTION'), nullable=False)
    op_type = Column(String(20), nullable=False)
    op_payload = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    document = relationship('Document', back_populates='operations')
    user = relationship('User', back_populates='operations')
    
    def to_dict(self):
        return {
            'id': self.id,
            'document_id': self.document_id,
            'version_no': self.version_no,
            'user_id': self.user_id,
            'op_type': self.op_type,
            'op_payload': self.op_payload,
            'created_at': format_datetime(self.created_at)
        }

class Comment(Base):
    __tablename__ = 'comments'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String(16), ForeignKey('documents.id', ondelete='CASCADE'), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey('users.id', ondelete='NO ACTION'), nullable=False, index=True)
    anchor = Column(Text)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved = Column(Boolean, default=False)
    resolved_by = Column(Integer, ForeignKey('users.id', ondelete='NO ACTION'))
    resolved_at = Column(DateTime)
    
    # Relationships
    document = relationship('Document', back_populates='comments')
    author = relationship('User', back_populates='comments', foreign_keys=[author_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'document_id': self.document_id,
            'author_id': self.author_id,
            'author': self.author.to_dict() if self.author else None,
            'anchor': self.anchor,
            'content': self.content,
            'created_at': format_datetime(self.created_at),
            'updated_at': format_datetime(self.updated_at),
            'resolved': self.resolved,
            'resolved_by': self.resolved_by,
            'resolved_at': format_datetime(self.resolved_at)
        }


class UserSession(Base):
    __tablename__ = 'user_sessions'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    session_token = Column(String(255), unique=True, nullable=False, index=True)
    device_info = Column(String(255))
    ip_address = Column(String(45))  # IPv6 support
    login_at = Column(DateTime, default=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    user = relationship('User', back_populates='sessions')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'device_info': self.device_info,
            'ip_address': self.ip_address,
            'login_at': format_datetime(self.login_at),
            'last_activity': format_datetime(self.last_activity),
            'is_active': self.is_active
        }


class UserPreference(Base):
    __tablename__ = 'user_preferences'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    preference_key = Column(String(100), nullable=False)
    preference_value = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship('User', back_populates='preferences')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'preference_key': self.preference_key,
            'preference_value': self.preference_value,
            'updated_at': format_datetime(self.updated_at)
        }


class DocumentFolder(Base):
    __tablename__ = 'document_folders'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    owner_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    parent_folder_id = Column(Integer, ForeignKey('document_folders.id', ondelete='CASCADE'), index=True)
    workspace_id = Column(Integer, ForeignKey('team_workspaces.id', ondelete='CASCADE'), index=True)
    color = Column(String(7))  # Hex color code
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    owner = relationship('User', back_populates='owned_folders')
    parent_folder = relationship('DocumentFolder', remote_side=[id])
    workspace = relationship('TeamWorkspace', back_populates='folders')
    documents = relationship('Document', back_populates='folder')
    
    def to_dict(self, include_documents=False):
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'owner_id': self.owner_id,
            'parent_folder_id': self.parent_folder_id,
            'workspace_id': self.workspace_id,
            'color': self.color,
            'is_public': self.is_public,
            'created_at': format_datetime(self.created_at),
            'updated_at': format_datetime(self.updated_at)
        }
        if include_documents:
            data['documents'] = [doc.to_dict() for doc in self.documents]
        return data


class TeamWorkspace(Base):
    __tablename__ = 'team_workspaces'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    owner_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    invite_code = Column(String(50), unique=True, index=True)
    is_private = Column(Boolean, default=True)
    max_members = Column(Integer, default=50)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    owner = relationship('User', back_populates='owned_workspaces')
    folders = relationship('DocumentFolder', back_populates='workspace')
    members = relationship('WorkspaceMember', back_populates='workspace', cascade='all, delete-orphan')
    
    def to_dict(self, include_members=False):
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'owner_id': self.owner_id,
            'owner': self.owner.to_dict() if self.owner else None,
            'invite_code': self.invite_code,
            'is_private': self.is_private,
            'max_members': self.max_members,
            'created_at': format_datetime(self.created_at),
            'updated_at': format_datetime(self.updated_at)
        }
        if include_members:
            data['members'] = [member.to_dict() for member in self.members]
        return data


class WorkspaceMember(Base):
    __tablename__ = 'workspace_members'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    workspace_id = Column(Integer, ForeignKey('team_workspaces.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    role = Column(String(10), CheckConstraint("role IN ('admin','editor')"), default='editor')
    joined_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    workspace = relationship('TeamWorkspace', back_populates='members')
    user = relationship('User')
    
    def to_dict(self):
        return {
            'id': self.id,
            'workspace_id': self.workspace_id,
            'user_id': self.user_id,
            'user': self.user.to_dict() if self.user else None,
            'role': self.role,
            'joined_at': format_datetime(self.joined_at)
        }


class UserPresence(Base):
    __tablename__ = 'user_presence'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    document_id = Column(String(16), ForeignKey('documents.id', ondelete='CASCADE'), nullable=False, index=True)
    cursor_position = Column(Integer, default=0)
    selection_start = Column(Integer)
    selection_end = Column(Integer)
    status = Column(String(20), CheckConstraint("status IN ('online','idle','offline')"), default='online')
    last_seen = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship('User', back_populates='presence')
    document = relationship('Document', back_populates='presence')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user': self.user.to_dict() if self.user else None,
            'document_id': self.document_id,
            'cursor_position': self.cursor_position,
            'selection_start': self.selection_start,
            'selection_end': self.selection_end,
            'status': self.status,
            'last_seen': format_datetime(self.last_seen)
        }


class NotificationSetting(Base):
    __tablename__ = 'notification_settings'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    notification_type = Column(String(50), nullable=False)  # 'comment', 'mention', 'document_shared', etc.
    is_enabled = Column(Boolean, default=True)
    delivery_method = Column(String(20), CheckConstraint("delivery_method IN ('email','push','in_app')"), default='in_app')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship('User', back_populates='notification_settings')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'notification_type': self.notification_type,
            'is_enabled': self.is_enabled,
            'delivery_method': self.delivery_method,
            'updated_at': format_datetime(self.updated_at)
        }


class AuditLog(Base):
    __tablename__ = 'audit_logs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), index=True)
    document_id = Column(String(16), ForeignKey('documents.id', ondelete='CASCADE'), index=True)
    action = Column(String(100), nullable=False)  # 'create', 'edit', 'delete', 'share', etc.
    entity_type = Column(String(50), nullable=False)  # 'document', 'comment', 'permission', etc.
    entity_id = Column(Integer)
    old_values = Column(Text)  # JSON string of old values
    new_values = Column(Text)  # JSON string of new values
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship('User')
    document = relationship('Document')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user': self.user.to_dict() if self.user else None,
            'document_id': self.document_id,
            'action': self.action,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'ip_address': self.ip_address,
            'created_at': format_datetime(self.created_at)
        }


class FileAttachment(Base):
    __tablename__ = 'file_attachments'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String(16), ForeignKey('documents.id', ondelete='CASCADE'), nullable=False, index=True)
    uploaded_by = Column(Integer, ForeignKey('users.id', ondelete='NO ACTION'), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)  # in bytes
    file_type = Column(String(100))  # MIME type
    file_path = Column(String(500), nullable=False)  # Storage path
    file_hash = Column(String(64))  # SHA-256 for deduplication
    is_embedded = Column(Boolean, default=False)  # Whether file is embedded in document
    upload_date = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    document = relationship('Document', back_populates='attachments')
    uploader = relationship('User', back_populates='uploaded_files')
    
    def to_dict(self):
        return {
            'id': self.id,
            'document_id': self.document_id,
            'uploaded_by': self.uploaded_by,
            'uploader': self.uploader.to_dict() if self.uploader else None,
            'file_name': self.file_name,
            'file_size': self.file_size,
            'file_type': self.file_type,
            'is_embedded': self.is_embedded,
            'upload_date': format_datetime(self.upload_date)
        }


class RecentActivity(Base):
    __tablename__ = 'recent_activities'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    document_id = Column(String(16), ForeignKey('documents.id', ondelete='CASCADE'), nullable=False, index=True)
    activity_type = Column(String(50), nullable=False)  # 'viewed', 'edited', 'commented', 'shared'
    activity_data = Column(Text)  # JSON string with additional activity data
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship('User', back_populates='activities')
    document = relationship('Document', back_populates='activities')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user': self.user.to_dict() if self.user else None,
            'document_id': self.document_id,
            'document': self.document.to_dict() if self.document else None,
            'activity_type': self.activity_type,
            'activity_data': self.activity_data,
            'created_at': format_datetime(self.created_at)
        }
