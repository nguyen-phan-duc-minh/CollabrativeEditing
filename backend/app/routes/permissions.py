from flask import Blueprint, request, jsonify
from app.auth import require_auth, get_or_create_user
from app.middleware import require_document_access
from app.models import Permission
from app import get_db
import uuid

bp = Blueprint('permissions', __name__, url_prefix='/documents')

@bp.route('/<string:document_id>/permissions', methods=['GET'])
@require_auth
@require_document_access()
def list_permissions(user, document, permission_role):
    """List all permissions for document"""
    db = get_db()
    
    permissions = db.query(Permission).filter_by(document_id=document.id).all()
    
    return jsonify({
        'permissions': [p.to_dict() for p in permissions]
    }), 200

@bp.route('/<string:document_id>/share', methods=['POST'])
@require_auth
@require_document_access('owner')
def share_document(user, document, permission_role):
    """Share document with user via email"""
    db = get_db()
    data = request.get_json()
    
    email = data.get('email')
    role = data.get('role', 'viewer')
    
    if not email:
        return jsonify({'error': 'Email required'}), 400
    
    if role not in ['editor', 'viewer']:
        return jsonify({'error': 'Invalid role. Must be editor or viewer'}), 400
    
    # Cannot share with yourself
    if email == user.email:
        return jsonify({'error': 'Cannot share with yourself'}), 400
    
    # Get or create user
    target_user = get_or_create_user(email)
    
    # Check if permission already exists
    existing = db.query(Permission).filter_by(
        document_id=document.id,
        user_id=target_user.id
    ).first()
    
    if existing:
        # Update role if different
        if existing.role != role and existing.role != 'owner':
            existing.role = role
            db.commit()
            return jsonify({
                'message': 'Permission updated',
                'permission': existing.to_dict()
            }), 200
        else:
            return jsonify({'error': 'User already has access'}), 400
    
    # Create new permission
    permission = Permission(
        document_id=document.id,
        user_id=target_user.id,
        role=role
    )
    db.add(permission)
    db.commit()
    db.refresh(permission)
    
    return jsonify({
        'message': 'Document shared successfully',
        'permission': permission.to_dict()
    }), 201

@bp.route('/<string:document_id>/share/link', methods=['POST'])
@require_auth
@require_document_access('owner')
def generate_share_link(user, document, permission_role):
    """Generate public share link"""
    db = get_db()
    data = request.get_json()
    
    enabled = data.get('enabled', True)
    
    if enabled:
        # Generate new token if not exists
        if not document.share_token:
            document.share_token = str(uuid.uuid4())
            db.commit()
        
        return jsonify({
            'share_token': document.share_token,
            'share_url': f"{request.host_url}doc/{document.id}?token={document.share_token}"
        }), 200
    else:
        # Disable sharing by removing token
        document.share_token = None
        db.commit()
        
        return jsonify({'message': 'Public sharing disabled'}), 200

@bp.route('/<string:document_id>/share/link', methods=['DELETE'])
@require_auth
@require_document_access('owner')
def revoke_share_link(user, document, permission_role):
    """Revoke public share link"""
    db = get_db()
    
    document.share_token = None
    db.commit()
    
    return jsonify({'message': 'Share link revoked'}), 200

@bp.route('/<string:document_id>/permissions/<int:permission_id>', methods=['DELETE'])
@require_auth
@require_document_access('owner')
def remove_permission(user, document, permission_role, permission_id):
    """Remove user permission"""
    db = get_db()
    
    permission = db.query(Permission).filter_by(
        id=permission_id,
        document_id=document.id
    ).first()
    
    if not permission:
        return jsonify({'error': 'Permission not found'}), 404
    
    # Cannot remove owner permission
    if permission.role == 'owner':
        return jsonify({'error': 'Cannot remove owner permission'}), 400
    
    db.delete(permission)
    db.commit()
    
    return jsonify({'message': 'Permission removed'}), 200

@bp.route('/<string:document_id>/permissions/<int:permission_id>', methods=['PUT'])
@require_auth
@require_document_access('owner')
def update_permission(user, document, permission_role, permission_id):
    """Update user permission role"""
    db = get_db()
    data = request.get_json()
    
    new_role = data.get('role')
    
    if new_role not in ['editor', 'viewer']:
        return jsonify({'error': 'Invalid role'}), 400
    
    permission = db.query(Permission).filter_by(
        id=permission_id,
        document_id=document.id
    ).first()
    
    if not permission:
        return jsonify({'error': 'Permission not found'}), 404
    
    # Cannot change owner role
    if permission.role == 'owner':
        return jsonify({'error': 'Cannot change owner role'}), 400
    
    permission.role = new_role
    db.commit()
    
    return jsonify({
        'message': 'Permission updated',
        'permission': permission.to_dict()
    }), 200
