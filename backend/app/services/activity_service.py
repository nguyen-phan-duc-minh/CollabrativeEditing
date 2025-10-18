"""
Activity tracking service
"""
from app.models import RecentActivity
from app import get_db
from flask import current_app
import json
from datetime import datetime, timedelta

class ActivityService:
    @staticmethod
    def track_activity(user_id, document_id, activity_type, activity_data=None):
        """
        Track user activity
        
        Args:
            user_id: ID of user
            document_id: ID of document
            activity_type: Type of activity (viewed, edited, commented, shared)
            activity_data: Additional data as dict
        """
        try:
            db = get_db()
            
            # Check if similar activity exists recently (within last 5 minutes)
            # to avoid spam
            recent_threshold = datetime.utcnow() - timedelta(minutes=5)
            existing = db.query(RecentActivity).filter(
                RecentActivity.user_id == user_id,
                RecentActivity.document_id == document_id,
                RecentActivity.activity_type == activity_type,
                RecentActivity.created_at > recent_threshold
            ).first()
            
            if existing:
                # Update existing activity timestamp
                existing.created_at = datetime.utcnow()
                if activity_data:
                    existing.activity_data = json.dumps(activity_data)
            else:
                # Create new activity
                activity = RecentActivity(
                    user_id=user_id,
                    document_id=document_id,
                    activity_type=activity_type,
                    activity_data=json.dumps(activity_data) if activity_data else None
                )
                db.add(activity)
            
            db.commit()
            return True
        except Exception as e:
            current_app.logger.error(f"Error tracking activity: {e}")
            try:
                db.rollback()
            except:
                pass
            return False
    
    @staticmethod
    def get_user_recent_activities(user_id, limit=50):
        """Get user's recent activities"""
        try:
            db = get_db()
            
            activities = db.query(RecentActivity).filter_by(
                user_id=user_id
            ).order_by(
                RecentActivity.created_at.desc()
            ).limit(limit).all()
            
            return [activity.to_dict() for activity in activities]
        except Exception as e:
            current_app.logger.error(f"Error getting recent activities: {e}")
            return []
    
    @staticmethod
    def get_document_activities(document_id, limit=50):
        """Get document's activities"""
        try:
            db = get_db()
            
            activities = db.query(RecentActivity).filter_by(
                document_id=document_id
            ).order_by(
                RecentActivity.created_at.desc()
            ).limit(limit).all()
            
            return [activity.to_dict() for activity in activities]
        except Exception as e:
            current_app.logger.error(f"Error getting document activities: {e}")
            return []
    
    @staticmethod
    def cleanup_old_activities(days_old=90):
        """Clean up activities older than specified days"""
        try:
            db = get_db()
            
            threshold = datetime.utcnow() - timedelta(days=days_old)
            
            deleted_count = db.query(RecentActivity).filter(
                RecentActivity.created_at < threshold
            ).delete()
            
            db.commit()
            
            current_app.logger.info(f"Cleaned up {deleted_count} old activities")
            return deleted_count
        except Exception as e:
            current_app.logger.error(f"Error cleaning up activities: {e}")
            try:
                db.rollback()
            except:
                pass
            return 0