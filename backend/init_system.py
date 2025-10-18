#!/usr/bin/env python3
"""
Complete System Initialization Script
Tạo database, tables, sample data và fix permissions trong một lần chạy
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app, get_db
from app.models import User, Document, Permission, TeamWorkspace, WorkspaceMember, DocumentFolder
from datetime import datetime
import secrets
import hashlib

def generate_document_id():
    """Generate secure 16-character document ID"""
    random_bytes = secrets.token_bytes(8)
    hash_obj = hashlib.sha256(random_bytes)
    return hash_obj.hexdigest()[:16]

def create_sample_user(db, email, display_name, google_id=None):
    """Create or get sample user"""
    user = db.query(User).filter_by(email=email).first()
    if not user:
        user = User(
            email=email,
            display_name=display_name,
            google_id=google_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"✅ Created user: {email} (ID: {user.id})")
    else:
        print(f"📋 User exists: {email} (ID: {user.id})")
    return user

def create_sample_workspace(db, owner, name, description=""):
    """Create sample workspace"""
    workspace = TeamWorkspace(
        name=name,
        description=description,
        owner_id=owner.id,
        invite_code=''.join(secrets.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') for _ in range(8)),
        is_private=False,
        max_members=10,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    print(f"✅ Created workspace: {name} (ID: {workspace.id})")
    return workspace

def create_sample_document(db, title, owner, workspace=None, content=""):
    """Create sample document with proper permissions"""
    if not content:
        content = f"<h1>{title}</h1><p>Welcome to the collaborative document editor!</p><p>This is a sample document with secure hash ID system.</p>"
    
    document = Document(
        title=title,
        content=content,
        owner_id=owner.id,
        workspace_id=workspace.id if workspace else None,
        type='doc',
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    
    # Create owner permission
    permission = Permission(
        document_id=document.id,
        user_id=owner.id,
        role='owner',
        created_at=datetime.utcnow()
    )
    db.add(permission)
    
    # If in workspace, create permissions for all workspace members
    if workspace:
        members = db.query(WorkspaceMember).filter_by(workspace_id=workspace.id).all()
        for member in members:
            if member.user_id != owner.id:  # Don't duplicate owner permission
                member_permission = Permission(
                    document_id=document.id,
                    user_id=member.user_id,
                    role='editor',
                    created_at=datetime.utcnow()
                )
                db.add(member_permission)
    
    db.commit()
    print(f"✅ Created document: {title} (ID: {document.id})")
    return document

def add_workspace_member(db, workspace, user, role='editor'):
    """Add user to workspace with proper permissions"""
    # Check if already member
    existing = db.query(WorkspaceMember).filter_by(
        workspace_id=workspace.id, 
        user_id=user.id
    ).first()
    
    if existing:
        print(f"📋 User {user.email} already member of workspace {workspace.name}")
        return existing
    
    # Add member
    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=user.id,
        role=role,
        joined_at=datetime.utcnow()
    )
    db.add(member)
    
    # Grant permissions to existing documents
    documents = db.query(Document).filter_by(workspace_id=workspace.id).all()
    permissions_created = 0
    
    for document in documents:
        # Check if permission exists
        existing_perm = db.query(Permission).filter_by(
            document_id=document.id,
            user_id=user.id
        ).first()
        
        if not existing_perm:
            permission = Permission(
                document_id=document.id,
                user_id=user.id,
                role='editor',
                created_at=datetime.utcnow()
            )
            db.add(permission)
            permissions_created += 1
    
    db.commit()
    print(f"✅ Added {user.email} to workspace {workspace.name} with {permissions_created} document permissions")
    return member

def init_complete_system():
    """Initialize complete system with sample data"""
    print("🚀 Initializing Complete Document Collaboration System")
    print("=" * 60)
    
    app = create_app()
    
    with app.app_context():
        db = get_db()
        
        # Create all tables
        from app.models import Base
        from sqlalchemy import create_engine
        engine = create_engine(app.config['DATABASE_URL'])
        Base.metadata.create_all(engine)
        print("📊 Database tables created")
        
        # Create sample users
        print("\n👥 Creating Sample Users")
        user1 = create_sample_user(
            db, 
            'admin@example.com', 
            'System Administrator'
        )
        
        user2 = create_sample_user(
            db, 
            'editor@example.com', 
            'Content Editor'
        )
        
        user3 = create_sample_user(
            db, 
            'viewer@example.com', 
            'Document Viewer'
        )
        
        # Create sample workspace
        print("\n🏢 Creating Sample Workspace")
        workspace1 = create_sample_workspace(
            db, 
            user1, 
            'Company Projects',
            'Main workspace for company documents and collaboration'
        )
        
        # Add members to workspace
        print("\n👨‍👩‍👧‍👦 Adding Workspace Members")
        add_workspace_member(db, workspace1, user2, 'editor')
        add_workspace_member(db, workspace1, user3, 'editor')
        
        # Create sample documents
        print("\n📄 Creating Sample Documents")
        
        # Personal document (not in workspace)
        doc1 = create_sample_document(
            db,
            'Personal Notes',
            user1,
            content="<h1>Personal Notes</h1><p>This is a personal document not shared in any workspace.</p>"
        )
        
        # Workspace documents
        doc2 = create_sample_document(
            db,
            'Team Meeting Minutes',
            user1,
            workspace1,
            "<h1>Team Meeting Minutes</h1><p><strong>Date:</strong> October 17, 2025</p><h2>Agenda</h2><ul><li>Project updates</li><li>New features discussion</li><li>Next sprint planning</li></ul>"
        )
        
        doc3 = create_sample_document(
            db,
            'Project Specifications',
            user2,
            workspace1,
            "<h1>Project Specifications</h1><p>This document outlines the technical specifications for our new project.</p><h2>Requirements</h2><ul><li>User authentication</li><li>Real-time collaboration</li><li>Document versioning</li></ul>"
        )
        
        doc4 = create_sample_document(
            db,
            'Getting Started Guide',
            user1,
            workspace1,
            "<h1>Getting Started Guide</h1><p>Welcome to our collaborative document platform!</p><h2>Features</h2><ul><li>📝 Rich text editing</li><li>👥 Real-time collaboration</li><li>🤖 AI writing assistant</li><li>📄 Automatic pagination</li><li>🔒 Secure document IDs</li></ul>"
        )
        
        # Create sample folder
        folder = DocumentFolder(
            name='Important Documents',
            description='Critical company documents',
            owner_id=user1.id,
            workspace_id=workspace1.id,
            color='#3B82F6',
            is_public=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(folder)
        db.commit()
        db.refresh(folder)
        print(f"✅ Created folder: {folder.name} (ID: {folder.id})")
        
        # Move one document to folder
        doc4.folder_id = folder.id
        db.commit()
        print(f"📁 Moved document '{doc4.title}' to folder '{folder.name}'")
        
        # Summary
        print("\n" + "=" * 60)
        print("🎉 System Initialization Complete!")
        print("=" * 60)
        
        total_users = db.query(User).count()
        total_workspaces = db.query(TeamWorkspace).count()
        total_documents = db.query(Document).count()
        total_permissions = db.query(Permission).count()
        total_members = db.query(WorkspaceMember).count()
        total_folders = db.query(DocumentFolder).count()
        
        print(f"📊 System Statistics:")
        print(f"   👥 Users: {total_users}")
        print(f"   🏢 Workspaces: {total_workspaces}")
        print(f"   📄 Documents: {total_documents}")
        print(f"   🔐 Permissions: {total_permissions}")
        print(f"   👨‍👩‍👧‍👦 Workspace Members: {total_members}")
        print(f"   📁 Folders: {total_folders}")
        
        print(f"\n🔗 Sample URLs:")
        print(f"   📄 {doc2.title}: http://localhost:5173/editor/{doc2.id}")
        print(f"   📄 {doc3.title}: http://localhost:5173/editor/{doc3.id}")
        print(f"   📄 {doc4.title}: http://localhost:5173/editor/{doc4.id}")
        
        print(f"\n👤 Sample Users:")
        print(f"   🔑 Admin: admin@example.com")
        print(f"   ✏️  Editor: editor@example.com")
        print(f"   👁️  Viewer: viewer@example.com")
        
        print(f"\n🏢 Workspace Code:")
        print(f"   📝 Join Code: {workspace1.invite_code}")
        
        print(f"\n🎯 Next Steps:")
        print(f"   1. Start backend: python3 run.py")
        print(f"   2. Start frontend: npm run dev")
        print(f"   3. Login with Google using any of the sample emails")
        print(f"   4. Test collaboration features")
        print(f"   5. Try the AI Writing Assistant! 🤖")

if __name__ == '__main__':
    init_complete_system()