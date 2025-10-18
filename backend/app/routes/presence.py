"""
User Presence API Routes - Real-time collaboration
"""
from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from app.auth import require_auth
from app.models import UserPresence
from app import get_db
from datetime import datetime

bp = Blueprint('presence', __name__, url_prefix='/api/presence')

@bp.route('/document/<string:document_id>', methods=['GET'])
@cross_origin()
@require_auth
def get_document_presence(current_user, document_id):
    """Get all users currently active in document"""
    try:
        db = get_db()
        presences = db.query(UserPresence).filter(
            UserPresence.document_id == document_id,
            UserPresence.status.in_(['online', 'idle'])
        ).all()
        
        return jsonify({
            'presences': [presence.to_dict() for presence in presences]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/document/<string:document_id>', methods=['POST'])
@cross_origin()
@require_auth
def update_presence(current_user, document_id):
    """Update user presence in document"""
    try:
        data = request.get_json()
        db = get_db()
        
        # Find or create presence record
        presence = db.query(UserPresence).filter(
            UserPresence.user_id == current_user.id,
            UserPresence.document_id == document_id
        ).first()
        
        if not presence:
            presence = UserPresence(
                user_id=current_user.id,
                document_id=document_id
            )
            db.add(presence)
        
        # Update presence data
        if 'cursor_position' in data:
            presence.cursor_position = data['cursor_position']
        if 'selection_start' in data:
            presence.selection_start = data['selection_start']
        if 'selection_end' in data:
            presence.selection_end = data['selection_end']
        if 'status' in data:
            presence.status = data['status']
            
        presence.last_seen = datetime.utcnow()
        
        db.commit()
        
        return jsonify({
            'presence': presence.to_dict(),
            'message': 'Presence updated'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/document/<string:document_id>/leave', methods=['POST'])
@cross_origin()
@require_auth
def leave_document(current_user, document_id):
    """Mark user as offline in document"""
    try:
        db = get_db()
        presence = db.query(UserPresence).filter(
            UserPresence.user_id == current_user.id,
            UserPresence.document_id == document_id
        ).first()
        
        if presence:
            presence.status = 'offline'
            presence.last_seen = datetime.utcnow()
            db.commit()
        
        return jsonify({'message': 'Left document'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500