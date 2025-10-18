"""
Team Workspaces API Routes
"""
from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from app.auth import require_auth
from app.models import TeamWorkspace, DocumentFolder, WorkspaceMember, User, Document, Permission
from app import get_db
import secrets
import string

bp = Blueprint('workspaces', __name__, url_prefix='/api/workspaces')

@bp.route('', methods=['GET'])
@cross_origin()
@require_auth
def get_workspaces(current_user):
    """Get user's workspaces (owned + member of)"""
    try:
        db = get_db()
        
        # Get owned workspaces
        owned_workspaces = db.query(TeamWorkspace).filter(
            TeamWorkspace.owner_id == current_user.id
        ).all()
        
        # Get workspaces user is member of
        member_workspaces = db.query(TeamWorkspace).join(WorkspaceMember).filter(
            WorkspaceMember.user_id == current_user.id
        ).all()
        
        # Combine and deduplicate
        all_workspaces = {ws.id: ws for ws in owned_workspaces + member_workspaces}
        
        return jsonify({
            'workspaces': [workspace.to_dict(include_members=True) for workspace in all_workspaces.values()]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('', methods=['POST'])
@cross_origin()
@require_auth
def create_workspace(current_user):
    """Create new workspace"""
    try:
        data = request.get_json()
        
        # Generate invite code
        invite_code = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
        
        workspace = TeamWorkspace(
            name=data['name'],
            description=data.get('description', ''),
            owner_id=current_user.id,
            invite_code=invite_code,
            is_private=data.get('is_private', True),
            max_members=data.get('max_members', 50)
        )
        
        db = get_db()
        db.add(workspace)
        db.commit()
        
        # Add owner as admin member
        owner_member = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=current_user.id,
            role='admin'
        )
        db.add(owner_member)
        db.commit()
        
        return jsonify({
            'workspace': workspace.to_dict(include_members=True),
            'message': 'Workspace created successfully'
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/<int:workspace_id>/folders', methods=['GET'])
@cross_origin()
@require_auth
def get_workspace_folders(current_user, workspace_id):
    """Get folders in workspace"""
    try:
        db = get_db()
        
        # Check if user has access to workspace
        workspace = db.query(TeamWorkspace).filter_by(id=workspace_id).first()
        if not workspace:
            return jsonify({'error': 'Workspace not found'}), 404
        
        # Check if user is owner or member
        is_member = workspace.owner_id == current_user.id or db.query(WorkspaceMember).filter_by(
            workspace_id=workspace_id, user_id=current_user.id
        ).first()
        
        if not is_member:
            return jsonify({'error': 'Access denied'}), 403
        
        folders = db.query(DocumentFolder).filter(
            DocumentFolder.workspace_id == workspace_id
        ).all()
        
        return jsonify({
            'folders': [folder.to_dict(include_documents=True) for folder in folders]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/<int:workspace_id>', methods=['PUT'])
@cross_origin()
@require_auth
def update_workspace(current_user, workspace_id):
    """Update workspace (owner only)"""
    try:
        db = get_db()
        workspace = db.query(TeamWorkspace).filter_by(id=workspace_id).first()
        
        if not workspace:
            return jsonify({'error': 'Workspace not found'}), 404
        
        if workspace.owner_id != current_user.id:
            return jsonify({'error': 'Only workspace owner can update'}), 403
        
        data = request.get_json()
        
        if 'name' in data:
            workspace.name = data['name']
        if 'description' in data:
            workspace.description = data['description']
        
        db.commit()
        
        return jsonify({
            'workspace': workspace.to_dict(include_members=True),
            'message': 'Workspace updated successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/<int:workspace_id>', methods=['DELETE'])
@cross_origin()
@require_auth
def delete_workspace(current_user, workspace_id):
    """Delete workspace (owner only)"""
    try:
        db = get_db()
        workspace = db.query(TeamWorkspace).filter_by(id=workspace_id).first()
        
        if not workspace:
            return jsonify({'error': 'Workspace not found'}), 404
        
        if workspace.owner_id != current_user.id:
            return jsonify({'error': 'Only workspace owner can delete'}), 403
        
        db.delete(workspace)
        db.commit()
        
        return jsonify({'message': 'Workspace deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/<int:workspace_id>/members', methods=['POST'])
@cross_origin()
@require_auth
def add_workspace_member(current_user, workspace_id):
    """Add member to workspace by email"""
    try:
        db = get_db()
        workspace = db.query(TeamWorkspace).filter_by(id=workspace_id).first()
        
        if not workspace:
            return jsonify({'error': 'Workspace not found'}), 404
        
        if workspace.owner_id != current_user.id:
            return jsonify({'error': 'Only workspace owner can add members'}), 403
        
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        # Find user by email
        user = db.query(User).filter_by(email=email).first()
        if not user:
            return jsonify({'error': 'User with this email not found'}), 404
        
        # Check if already member
        existing_member = db.query(WorkspaceMember).filter_by(
            workspace_id=workspace_id, user_id=user.id
        ).first()
        
        if existing_member:
            return jsonify({'error': 'User is already a member'}), 400
        
        # Add as member
        member = WorkspaceMember(
            workspace_id=workspace_id,
            user_id=user.id,
            role='editor'
        )
        db.add(member)
        
        # Grant permissions to all existing documents in workspace
        existing_documents = db.query(Document).filter_by(workspace_id=workspace_id).all()
        
        for document in existing_documents:
            # Check if permission already exists (should not, but safety check)
            existing_perm = db.query(Permission).filter_by(
                document_id=document.id,
                user_id=user.id
            ).first()
            
            if not existing_perm:
                # Create editor permission for workspace documents
                permission = Permission(
                    document_id=document.id,
                    user_id=user.id,
                    role='editor'
                )
                db.add(permission)
        
        db.commit()

        return jsonify({
            'member': member.to_dict(),
            'message': f'Member added successfully with access to {len(existing_documents)} documents'
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/<int:workspace_id>/members/<int:member_id>', methods=['DELETE'])
@cross_origin()
@require_auth
def remove_workspace_member(current_user, workspace_id, member_id):
    """Remove member from workspace"""
    try:
        db = get_db()
        workspace = db.query(TeamWorkspace).filter_by(id=workspace_id).first()
        
        if not workspace:
            return jsonify({'error': 'Workspace not found'}), 404
        
        if workspace.owner_id != current_user.id:
            return jsonify({'error': 'Only workspace owner can remove members'}), 403
        
        member = db.query(WorkspaceMember).filter_by(
            id=member_id, workspace_id=workspace_id
        ).first()
        
        if not member:
            return jsonify({'error': 'Member not found'}), 404
        
        # Remove member's permissions on workspace documents
        workspace_documents = db.query(Document).filter_by(workspace_id=workspace_id).all()
        permissions_removed = 0
        
        for document in workspace_documents:
            # Only remove non-owner permissions (don't remove if they're the document owner)
            permission = db.query(Permission).filter_by(
                document_id=document.id,
                user_id=member.user_id
            ).first()
            
            if permission and permission.role != 'owner':
                db.delete(permission)
                permissions_removed += 1
        
        # Remove workspace membership
        db.delete(member)
        db.commit()
        
        return jsonify({
            'message': f'Member removed successfully. Removed access to {permissions_removed} documents'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/<int:workspace_id>/folders', methods=['POST'])
@cross_origin()
@require_auth
def create_folder(current_user, workspace_id):
    """Create folder in workspace"""
    try:
        db = get_db()
        
        # Check workspace access
        workspace = db.query(TeamWorkspace).filter_by(id=workspace_id).first()
        if not workspace:
            return jsonify({'error': 'Workspace not found'}), 404
        
        is_member = workspace.owner_id == current_user.id or db.query(WorkspaceMember).filter_by(
            workspace_id=workspace_id, user_id=current_user.id
        ).first()
        
        if not is_member:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        folder = DocumentFolder(
            name=data['name'],
            description=data.get('description', ''),
            owner_id=current_user.id,
            workspace_id=workspace_id,
            color=data.get('color', '#2563eb')
        )
        
        db.add(folder)
        db.commit()
        
        return jsonify({
            'folder': folder.to_dict(),
            'message': 'Folder created successfully'
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/<int:workspace_id>/documents', methods=['POST'])
@cross_origin()
@require_auth
def create_workspace_document(current_user, workspace_id):
    """Create document in workspace"""
    try:
        db = get_db()
        
        # Check workspace access
        workspace = db.query(TeamWorkspace).filter_by(id=workspace_id).first()
        if not workspace:
            return jsonify({'error': 'Workspace not found'}), 404
        
        is_member = workspace.owner_id == current_user.id or db.query(WorkspaceMember).filter_by(
            workspace_id=workspace_id, user_id=current_user.id
        ).first()
        
        if not is_member:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        document = Document(
            title=data.get('title', 'Untitled Document'),
            type=data.get('type', 'doc'),
            owner_id=current_user.id,
            workspace_id=workspace_id,
            folder_id=data.get('folder_id'),
            content=data.get('content', '')
        )
        
        db.add(document)
        db.commit()
        
        # Auto-grant permissions to all workspace members
        members = db.query(WorkspaceMember).filter_by(workspace_id=workspace_id).all()
        for member in members:
            if member.user_id != current_user.id:  # Don't add permission for owner
                permission = Permission(
                    document_id=document.id,
                    user_id=member.user_id,
                    role='editor'
                )
                db.add(permission)
        
        db.commit()
        
        return jsonify({
            'document': document.to_dict(include_content=True),
            'message': 'Document created successfully'
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500