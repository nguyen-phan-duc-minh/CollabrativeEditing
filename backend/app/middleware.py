from functools import wraps
from flask import jsonify
from app.models import Permission, Document
from app import get_db

def require_document_access(required_role=None):
    """
    Decorator to check if user has access to document
    required_role: 'owner', 'editor', or 'viewer' (None means any access)
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(user, document_id, *args, **kwargs):
            db = get_db()
            
            print(f"\n{'='*50}")
            print(f"DOCUMENT ACCESS CHECK")
            print(f"User ID: {user.id}")
            print(f"User Email: {user.email}")
            print(f"Document ID: {document_id}")
            print(f"Required Role: {required_role}")
            print(f"{'='*50}")
            
            # Get document
            document = db.query(Document).filter_by(id=document_id).first()
            if not document:
                print(f"❌ Document {document_id} not found")
                return jsonify({'error': 'Document not found'}), 404
            
            print(f"✅ Document found: {document.title}")
            
            # Check if document is archived
            if document.is_archived:
                print(f"❌ Document {document_id} is archived")
                return jsonify({'error': 'Document is archived'}), 403
            
            # Check permission
            permission = db.query(Permission).filter_by(
                document_id=document_id,
                user_id=user.id
            ).first()
            
            if not permission:
                print(f"❌ No permission found for user {user.id} on document {document_id}")
                # Check if accessing via share token
                share_token = kwargs.get('share_token')
                if share_token and document.share_token == share_token:
                    # Public link access - viewer role
                    permission_role = 'viewer'
                    print(f"✅ Share token access granted - viewer role")
                else:
                    print(f"❌ Access denied - no permission and no valid share token")
                    return jsonify({'error': 'Access denied'}), 403
            else:
                permission_role = permission.role
                print(f"✅ Permission found: {permission_role}")
            
            # Check role hierarchy: owner > editor > viewer
            role_hierarchy = {'owner': 3, 'editor': 2, 'viewer': 1}
            
            if required_role:
                required_level = role_hierarchy.get(required_role, 0)
                user_level = role_hierarchy.get(permission_role, 0)
                
                print(f"🔍 Role check: user={permission_role}({user_level}) vs required={required_role}({required_level})")
                
                if user_level < required_level:
                    print(f"❌ Insufficient permissions: {permission_role} < {required_role}")
                    return jsonify({'error': 'Insufficient permissions'}), 403
                else:
                    print(f"✅ Permission granted: {permission_role} >= {required_role}")
            
            print(f"✅ Access granted - calling route function")
            print(f"{'='*50}\n")
            
            # Pass document and permission to the route
            return f(user, document, permission_role, *args, **kwargs)
        
        return decorated_function
    return decorator

def can_edit_document(user_id, document_id):
    """Check if user can edit document"""
    db = get_db()
    permission = db.query(Permission).filter_by(
        document_id=document_id,
        user_id=user_id
    ).first()
    
    if not permission:
        return False
    
    return permission.role in ['owner', 'editor']

def can_manage_permissions(user_id, document_id):
    """Check if user can manage document permissions"""
    db = get_db()
    permission = db.query(Permission).filter_by(
        document_id=document_id,
        user_id=user_id
    ).first()
    
    if not permission:
        return False
    
    return permission.role == 'owner'

def get_user_role(user_id, document_id):
    """Get user's role for document"""
    db = get_db()
    permission = db.query(Permission).filter_by(
        document_id=document_id,
        user_id=user_id
    ).first()
    
    return permission.role if permission else None
