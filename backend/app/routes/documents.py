from flask import Blueprint, request, jsonify
from app.auth import require_auth
from app.middleware import require_document_access
from app.models import Document, Permission, Version, WorkspaceMember
from app import get_db
from datetime import datetime
from sqlalchemy import or_

bp = Blueprint('documents', __name__, url_prefix='/documents')

@bp.route('', methods=['GET'])
@require_auth
def list_documents(user):
    """List all documents user has access to"""
    db = get_db()
    
    # Get all documents where user has permission
    permissions = db.query(Permission).filter_by(user_id=user.id).all()
    document_ids = [p.document_id for p in permissions]
    
    if not document_ids:
        return jsonify({'documents': []}), 200
    
    documents = db.query(Document).filter(
        Document.id.in_(document_ids),
        Document.is_archived == False
    ).order_by(Document.updated_at.desc()).all()
    
    # Add permission info to each document
    result = []
    for doc in documents:
        perm = next((p for p in permissions if p.document_id == doc.id), None)
        doc_dict = doc.to_dict(include_content=False)
        doc_dict['role'] = perm.role if perm else None
        result.append(doc_dict)
    
    return jsonify({'documents': result}), 200

@bp.route('', methods=['POST'])
@require_auth
def create_document(user):
    """Create new document"""
    db = get_db()
    data = request.get_json()
    
    title = data.get('title', 'Untitled Document')
    doc_type = data.get('type', 'doc')
    content = data.get('content', '')  # Empty string instead of default JSON
    
    # Validate type
    if doc_type not in ['doc', 'code', 'whiteboard', 'sheet']:
        return jsonify({'error': 'Invalid document type'}), 400
    
    # Create document
    document = Document(
        title=title,
        type=doc_type,
        owner_id=user.id,
        workspace_id=data.get('workspace_id'),
        folder_id=data.get('folder_id'),
        content=content,
        current_version=0
    )
    db.add(document)
    db.flush()
    
    # Create owner permission
    permission = Permission(
        document_id=document.id,
        user_id=user.id,
        role='owner'
    )
    db.add(permission)
    
    # If document is in workspace, auto-grant permissions to workspace members
    if document.workspace_id:
        members = db.query(WorkspaceMember).filter_by(workspace_id=document.workspace_id).all()
        for member in members:
            if member.user_id != user.id:  # Don't add permission for owner
                member_permission = Permission(
                    document_id=document.id,
                    user_id=member.user_id,
                    role='editor'
                )
                db.add(member_permission)
    
    db.commit()
    db.refresh(document)
    
    return jsonify({
        'document': document.to_dict(include_content=True)
    }), 201

@bp.route('/<string:document_id>', methods=['GET'])
@require_auth
@require_document_access()
def get_document(user, document, permission_role):
    """Get document details"""
    return jsonify({
        'document': document.to_dict(include_content=True),
        'role': permission_role
    }), 200

@bp.route('/<string:document_id>', methods=['PUT'])
@require_auth
@require_document_access('editor')
def update_document(user, document, permission_role):
    """Update document (title, type, content)"""
    db = get_db()
    data = request.get_json()
    
    updated = False
    save_version = data.get('save_version', False)  # Only create version if explicitly requested
    version_name = data.get('version_name', '')  # Custom version name
    
    print(f"\n{'='*60}")
    print(f"UPDATE DOCUMENT #{document.id} - {document.title}")
    print(f"User: {user.email}")
    print(f"save_version parameter: {save_version}")
    print(f"version_name: {version_name}")
    print(f"{'='*60}\n")
    
    if 'title' in data:
        document.title = data['title']
        updated = True
    
    if 'type' in data and data['type'] in ['doc', 'code', 'whiteboard', 'sheet']:
        document.type = data['type']
        updated = True
    
    if 'content' in data:
        document.content = data['content']
        document.current_version += 1
        updated = True
        
        # Only create version snapshot when manually saving
        if save_version:
            print(f"✅ Creating version snapshot for version {document.current_version}")
            snapshot_ref = version_name if version_name else f"Manual save - Version {document.current_version}"
            version = Version(
                document_id=document.id,
                version_no=document.current_version,
                created_by=user.id,
                snapshot_content=document.content,
                snapshot_ref=snapshot_ref
            )
            db.add(version)
            print(f"✅ Version added to database session with name: {snapshot_ref}")
        else:
            print(f"⚪ No version created (save_version=False)")
    
    if updated:
        document.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(document)
    
    return jsonify({'document': document.to_dict(include_content=True)}), 200

@bp.route('/<string:document_id>', methods=['DELETE'])
@require_auth
@require_document_access('owner')
def delete_document(user, document, permission_role):
    """Delete document (soft delete)"""
    db = get_db()
    
    document.is_archived = True
    document.updated_at = datetime.utcnow()
    db.commit()
    
    return jsonify({'message': 'Document deleted'}), 200

@bp.route('/<string:document_id>/restore', methods=['POST'])
@require_auth
@require_document_access('owner')
def restore_archived_document(user, document, permission_role):
    """Restore archived document"""
    db = get_db()
    
    document.is_archived = False
    document.updated_at = datetime.utcnow()
    db.commit()
    
    return jsonify({'message': 'Document restored'}), 200

@bp.route('/<string:document_id>/restore-version', methods=['POST'])
@require_auth
@require_document_access('editor')
def restore_version(user, document, permission_role):
    """Restore document to specific version"""
    db = get_db()
    data = request.get_json()
    
    version_no = data.get('version_no')
    if not version_no:
        return jsonify({'error': 'version_no is required'}), 400
    
    # Get the version to restore
    version = db.query(Version).filter_by(
        document_id=document.id,
        version_no=version_no
    ).first()
    
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    
    if not version.snapshot_content:
        return jsonify({'error': 'Version has no saved content'}), 400
    
    print(f"\n{'='*60}")
    print(f"RESTORE VERSION #{version_no} - {document.title}")
    print(f"User: {user.email}")
    print(f"Original version: {document.current_version}")
    print(f"Restoring to version: {version_no}")
    print(f"{'='*60}\n")
    
    # Update document content and version
    document.content = version.snapshot_content
    document.current_version += 1  # Increment to new version
    document.updated_at = datetime.utcnow()
    
    # Create new version entry for the restore action
    restore_version_entry = Version(
        document_id=document.id,
        version_no=document.current_version,
        created_by=user.id,
        snapshot_content=version.snapshot_content,
        snapshot_ref=f"Restored from version {version_no}"
    )
    
    db.add(restore_version_entry)
    db.commit()
    
    print(f"Document restored to version {version_no}, new version: {document.current_version}")
    
    return jsonify({
        'message': 'Version restored successfully',
        'current_version': document.current_version,
        'restored_from': version_no
    }), 200

@bp.route('/search', methods=['GET'])
@require_auth
def search_documents(user):
    """Search documents"""
    db = get_db()
    query = request.args.get('q', '')
    
    if not query:
        return jsonify({'documents': []}), 200
    
    # Get user's accessible documents
    permissions = db.query(Permission).filter_by(user_id=user.id).all()
    document_ids = [p.document_id for p in permissions]
    
    if not document_ids:
        return jsonify({'documents': []}), 200
    
    # Search by title
    documents = db.query(Document).filter(
        Document.id.in_(document_ids),
        Document.is_archived == False,
        Document.title.ilike(f'%{query}%')
    ).order_by(Document.updated_at.desc()).limit(20).all()
    
    result = [doc.to_dict() for doc in documents]
    return jsonify({'documents': result}), 200

@bp.route('/<string:document_id>/versions/<int:version_no>', methods=['DELETE'])
@require_auth
@require_document_access('editor')
def delete_version(user, document, permission_role):
    """Delete a specific version"""
    db = get_db()
    data = request.get_json() or {}
    version_no = data.get('version_no')
    
    if not version_no:
        return jsonify({'error': 'version_no is required'}), 400
    
    # Don't allow deleting the current version
    if version_no == document.current_version:
        return jsonify({'error': 'Cannot delete current version'}), 400
    
    # Get the version to delete
    version = db.query(Version).filter_by(
        document_id=document.id,
        version_no=version_no
    ).first()
    
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    
    # Only allow version creator or document owner to delete
    if version.created_by != user.id and permission_role != 'owner':
        return jsonify({'error': 'Permission denied'}), 403
    
    print(f"\n{'='*60}")
    print(f"DELETE VERSION #{version_no} - {document.title}")
    print(f"User: {user.email}")
    print(f"Version creator: {version.created_by}")
    print(f"User permission: {permission_role}")
    print(f"{'='*60}\n")
    
    # Delete the version
    db.delete(version)
    db.commit()
    
    print(f"✅ Version {version_no} deleted successfully")
    
    return jsonify({
        'message': 'Version deleted successfully',
        'version_no': version_no
    }), 200
