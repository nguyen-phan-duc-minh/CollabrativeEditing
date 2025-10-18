"""
Recent Activities API Routes
"""
from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from app.auth import require_auth
from app.models import RecentActivity
from app import get_db
from datetime import datetime, timedelta

bp = Blueprint('activities', __name__, url_prefix='/api/activities')

@bp.route('', methods=['GET'])
@cross_origin()
@require_auth
def get_activities(current_user):
    """Get user's recent activities"""
    try:
        db = get_db()
        
        # Get activities from last 30 days
        since = datetime.utcnow() - timedelta(days=30)
        
        activities = db.query(RecentActivity).filter(
            RecentActivity.user_id == current_user.id,
            RecentActivity.created_at >= since
        ).order_by(RecentActivity.created_at.desc()).limit(50).all()
        
        return jsonify({ 'activities': [activity.to_dict() for activity in activities] }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('', methods=['POST'])
@cross_origin()
@require_auth
def log_activity(current_user):
    """Log new activity"""
    try:
        data = request.get_json()
        
        activity = RecentActivity(
            user_id=current_user.id,
            document_id=data['document_id'],
            activity_type=data['activity_type'],
            activity_data=data.get('activity_data', '')
        )
        
        db = get_db()
        db.add(activity)
        db.commit()
        
        return jsonify({ 'activity': activity.to_dict(), 'message': 'Activity logged' }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/document/<int:document_id>', methods=['GET'])
@cross_origin()
@require_auth
def get_document_activities(current_user, document_id):
    """Get activities for specific document"""
    try:
        db = get_db()
        
        activities = db.query(RecentActivity).filter(
            RecentActivity.document_id == document_id
        ).order_by(RecentActivity.created_at.desc()).limit(20).all()

        return jsonify({ 'activities': [activity.to_dict() for activity in activities] }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500