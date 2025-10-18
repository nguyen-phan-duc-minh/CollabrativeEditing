from flask import Blueprint, request, jsonify, current_app
from app.models import NotificationSetting
from app import get_db
from app.auth import require_auth
import json

bp = Blueprint('notification_settings', __name__, url_prefix='/api/notification-settings')

@bp.route('', methods=['GET'])
@require_auth
def get_user_notification_settings():
    """Get user's notification settings"""
    try:
        user_id = request.current_user['id']
        db = get_db()
        
        settings = db.query(NotificationSetting).filter_by(user_id=user_id).all()
        
        return jsonify({
            'success': True,
            'settings': [setting.to_dict() for setting in settings]
        })
    except Exception as e:
        current_app.logger.error(f"Error getting notification settings: {e}")
        return jsonify({'error': 'Failed to get notification settings'}), 500

@bp.route('', methods=['POST'])
@require_auth
def create_notification_setting():
    """Create or update notification setting"""
    try:
        user_id = request.current_user['id']
        data = request.get_json()
        db = get_db()
        
        # Check if setting already exists
        existing = db.query(NotificationSetting).filter_by(
            user_id=user_id,
            notification_type=data['notification_type']
        ).first()
        
        if existing:
            existing.is_enabled = data.get('is_enabled', existing.is_enabled)
            existing.delivery_method = data.get('delivery_method', existing.delivery_method)
            db.commit()
            setting = existing
        else:
            setting = NotificationSetting(
                user_id=user_id,
                notification_type=data['notification_type'],
                is_enabled=data.get('is_enabled', True),
                delivery_method=data.get('delivery_method', 'in_app')
            )
            db.add(setting)
            db.commit()
        
        return jsonify({
            'success': True,
            'setting': setting.to_dict()
        })
    except Exception as e:
        current_app.logger.error(f"Error creating notification setting: {e}")
        db.rollback()
        return jsonify({'error': 'Failed to create notification setting'}), 500

@bp.route('/<int:setting_id>', methods=['PUT'])
@require_auth
def update_notification_setting(setting_id):
    """Update notification setting"""
    try:
        user_id = request.current_user['id']
        data = request.get_json()
        db = get_db()
        
        setting = db.query(NotificationSetting).filter_by(
            id=setting_id,
            user_id=user_id
        ).first()
        
        if not setting:
            return jsonify({'error': 'Setting not found'}), 404
        
        setting.is_enabled = data.get('is_enabled', setting.is_enabled)
        setting.delivery_method = data.get('delivery_method', setting.delivery_method)
        
        db.commit()
        
        return jsonify({
            'success': True,
            'setting': setting.to_dict()
        })
    except Exception as e:
        current_app.logger.error(f"Error updating notification setting: {e}")
        db.rollback()
        return jsonify({'error': 'Failed to update notification setting'}), 500

@bp.route('/<int:setting_id>', methods=['DELETE'])
@require_auth
def delete_notification_setting(setting_id):
    """Delete notification setting"""
    try:
        user_id = request.current_user['id']
        db = get_db()
        
        setting = db.query(NotificationSetting).filter_by(
            id=setting_id,
            user_id=user_id
        ).first()
        
        if not setting:
            return jsonify({'error': 'Setting not found'}), 404
        
        db.delete(setting)
        db.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        current_app.logger.error(f"Error deleting notification setting: {e}")
        db.rollback()
        return jsonify({'error': 'Failed to delete notification setting'}), 500