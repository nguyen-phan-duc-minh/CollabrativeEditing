"""
User Preferences API Routes
"""
from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from app.auth import require_auth
from app.models import UserPreference
from app import get_db

bp = Blueprint('preferences', __name__, url_prefix='/api/preferences')

@bp.route('', methods=['GET'])
@cross_origin()
@require_auth
def get_preferences(current_user):
    """Get user preferences"""
    try:
        db = get_db()
        preferences = db.query(UserPreference).filter(
            UserPreference.user_id == current_user.id
        ).all()
        
        # Convert to dict format
        prefs_dict = {}
        for pref in preferences:
            prefs_dict[pref.preference_key] = pref.preference_value
            
        return jsonify({'preferences': prefs_dict}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('', methods=['POST'])
@cross_origin()
@require_auth
def update_preferences(current_user):
    """Update user preferences"""
    try:
        data = request.get_json()
        db = get_db()
        
        for key, value in data.items():
            # Find existing preference or create new
            pref = db.query(UserPreference).filter(
                UserPreference.user_id == current_user.id,
                UserPreference.preference_key == key
            ).first()
            
            if pref:
                pref.preference_value = str(value)
            else:
                pref = UserPreference(
                    user_id=current_user.id,
                    preference_key=key,
                    preference_value=str(value)
                )
                db.add(pref)
        
        db.commit()
        return jsonify({'message': 'Preferences updated successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/<preference_key>', methods=['GET'])
@cross_origin()
@require_auth
def get_preference(current_user, preference_key):
    """Get specific preference"""
    try:
        db = get_db()
        pref = db.query(UserPreference).filter(
            UserPreference.user_id == current_user.id,
            UserPreference.preference_key == preference_key
        ).first()
        
        if not pref:
            return jsonify({'error': 'Preference not found'}), 404
            
        return jsonify({
            'key': pref.preference_key,
            'value': pref.preference_value
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500