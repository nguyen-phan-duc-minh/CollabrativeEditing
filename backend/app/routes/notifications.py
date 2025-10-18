from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import User, Document, Permission
from app import get_db
from datetime import datetime, timedelta

notifications_bp = Blueprint('notifications', __name__)

@notifications_bp.route('/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    """Get user notifications"""
    try:
        current_user_id = get_jwt_identity()
        db = get_db()
        user = db.query(User).get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        # Get recent document activities and permissions
        notifications = []
        
        # Get documents shared with user (last 7 days)
        recent_permissions = db.query(Permission).join(Document).filter(
            Permission.user_id == current_user_id,
            Permission.created_at > datetime.utcnow() - timedelta(days=7)
        ).order_by(Permission.created_at.desc()).limit(10).all()
        
        for permission in recent_permissions:
            notifications.append({
                'id': f'perm_{permission.id}',
                'type': 'document_shared',
                'title': 'Document Shared',
                'message': f'You have been given {permission.role} access to "{permission.document.title}"',
                'timestamp': permission.created_at.isoformat(),
                'read': False,
                'document_id': permission.document_id
            })
        
        # Get user's own documents (last 3 days)
        recent_documents = db.query(Document).filter(
            Document.owner_id == current_user_id,
            Document.created_at > datetime.utcnow() - timedelta(days=3)
        ).order_by(Document.created_at.desc()).limit(5).all()
        
        for doc in recent_documents:
            notifications.append({
                'id': f'doc_{doc.id}',
                'type': 'document_created',
                'title': 'Document Created',
                'message': f'You created document "{doc.title}"',
                'timestamp': doc.created_at.isoformat(),
                'read': True,
                'document_id': doc.id
            })
        
        # Sort by timestamp (newest first)
        notifications.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return jsonify({
            'success': True,
            'notifications': notifications[:10]  # Limit to 10 most recent
        })
        
    except Exception as e:
        print(f"Error fetching notifications: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@notifications_bp.route('/notifications/<notification_id>/read', methods=['POST'])
@jwt_required()
def mark_notification_read(notification_id):
    """Mark notification as read"""
    try:
        # In a real app, you'd store notification read status in database
        # For now, just return success
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"Error marking notification as read: {e}")
        return jsonify({'error': 'Internal server error'}), 500