from flask import Blueprint, request, jsonify, current_app
from app.models import AuditLog
from app import get_db
from app.auth import require_auth
from datetime import datetime, timedelta

bp = Blueprint('audit_logs', __name__, url_prefix='/api/audit-logs')

@bp.route('', methods=['GET'])
@require_auth
def get_audit_logs():
    """Get audit logs (admin only or user's own logs)"""
    try:
        user_id = request.current_user['id']
        db = get_db()
        
        # For now, users can only see their own logs
        # In production, add admin role check
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        document_id = request.args.get('document_id', type=int)
        action = request.args.get('action')
        
        query = db.query(AuditLog).filter_by(user_id=user_id)
        
        if document_id:
            query = query.filter_by(document_id=document_id)
        
        if action:
            query = query.filter_by(action=action)
        
        query = query.order_by(AuditLog.created_at.desc())
        
        # Simple pagination
        offset = (page - 1) * per_page
        logs = query.offset(offset).limit(per_page).all()
        
        return jsonify({
            'success': True,
            'logs': [log.to_dict() for log in logs],
            'page': page,
            'per_page': per_page
        })
    except Exception as e:
        current_app.logger.error(f"Error getting audit logs: {e}")
        return jsonify({'error': 'Failed to get audit logs'}), 500

@bp.route('/document/<string:document_id>', methods=['GET'])
@require_auth
def get_document_audit_logs(document_id):
    """Get audit logs for a specific document"""
    try:
        user_id = request.current_user['id']
        db = get_db()
        
        # Check if user has access to this document
        from app.models import Document, Permission
        
        document = db.query(Document).filter_by(id=document_id).first()
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Check permission
        if document.owner_id != user_id:
            permission = db.query(Permission).filter_by(
                document_id=document_id,
                user_id=user_id
            ).first()
            if not permission:
                return jsonify({'error': 'Access denied'}), 403
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        query = db.query(AuditLog).filter_by(document_id=document_id)
        query = query.order_by(AuditLog.created_at.desc())
        
        offset = (page - 1) * per_page
        logs = query.offset(offset).limit(per_page).all()
        
        return jsonify({
            'success': True,
            'logs': [log.to_dict() for log in logs],
            'document_id': document_id,
            'page': page,
            'per_page': per_page
        })
    except Exception as e:
        current_app.logger.error(f"Error getting document audit logs: {e}")
        return jsonify({'error': 'Failed to get document audit logs'}), 500

def log_action(user_id, action, entity_type, entity_id=None, document_id=None, 
               old_values=None, new_values=None, ip_address=None, user_agent=None):
    """Helper function to create audit log entries"""
    try:
        db = get_db()
        
        log = AuditLog(
            user_id=user_id,
            document_id=document_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        db.add(log)
        db.commit()
        
        return True
    except Exception as e:
        current_app.logger.error(f"Error creating audit log: {e}")
        return False