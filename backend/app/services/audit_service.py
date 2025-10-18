"""
Audit service for logging user actions
"""
from app.models import AuditLog
from app import get_db
from flask import request, current_app
import json
from datetime import datetime

class AuditService:
    @staticmethod
    def log_action(user_id, action, entity_type, entity_id=None, document_id=None, 
                   old_values=None, new_values=None):
        """
        Log user action to audit trail
        
        Args:
            user_id: ID of user performing action
            action: Action performed (create, update, delete, view, share, etc.)
            entity_type: Type of entity (document, comment, permission, etc.)
            entity_id: ID of the entity
            document_id: Related document ID if applicable
            old_values: Dict of old values (for updates)
            new_values: Dict of new values (for updates)
        """
        try:
            db = get_db()
            
            # Get request info
            ip_address = None
            user_agent = None
            
            if request:
                ip_address = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR'))
                user_agent = request.headers.get('User-Agent', '')[:500]  # Limit length
            
            # Convert values to JSON strings
            old_values_json = json.dumps(old_values) if old_values else None
            new_values_json = json.dumps(new_values) if new_values else None
            
            log = AuditLog(
                user_id=user_id,
                document_id=document_id,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                old_values=old_values_json,
                new_values=new_values_json,
                ip_address=ip_address,
                user_agent=user_agent
            )
            
            db.add(log)
            db.commit()
            
            return True
        except Exception as e:
            current_app.logger.error(f"Error creating audit log: {e}")
            try:
                db.rollback()
            except:
                pass
            return False
    
    @staticmethod
    def log_document_action(user_id, document_id, action, old_values=None, new_values=None):
        """Helper method for document actions"""
        return AuditService.log_action(
            user_id=user_id,
            action=action,
            entity_type='document',
            entity_id=document_id,
            document_id=document_id,
            old_values=old_values,
            new_values=new_values
        )
    
    @staticmethod
    def log_permission_action(user_id, permission_id, document_id, action, old_values=None, new_values=None):
        """Helper method for permission actions"""
        return AuditService.log_action(
            user_id=user_id,
            action=action,
            entity_type='permission',
            entity_id=permission_id,
            document_id=document_id,
            old_values=old_values,
            new_values=new_values
        )
    
    @staticmethod
    def log_comment_action(user_id, comment_id, document_id, action, old_values=None, new_values=None):
        """Helper method for comment actions"""
        return AuditService.log_action(
            user_id=user_id,
            action=action,
            entity_type='comment',
            entity_id=comment_id,
            document_id=document_id,
            old_values=old_values,
            new_values=new_values
        )