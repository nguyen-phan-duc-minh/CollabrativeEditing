from flask import Blueprint, request, jsonify
from app.auth import require_auth
from app.middleware import require_document_access
from app.models import Version, Operation
from app import get_db
from datetime import datetime

bp = Blueprint('versions', __name__, url_prefix='/documents')

@bp.route('/<string:document_id>/history', methods=['GET'])
@require_auth
@require_document_access()
def get_version_history(user, document, permission_role):
    """Get document version history"""
    db = get_db()
    
    # Get all versions
    versions = db.query(Version).filter_by(
        document_id=document.id
    ).order_by(Version.version_no.desc()).all()
    
    return jsonify({
        'versions': [v.to_dict() for v in versions],
        'current_version': document.current_version
    }), 200

@bp.route('/<string:document_id>/versions/<int:version_no>', methods=['GET'])
@require_auth
@require_document_access()
def get_version_details(user, document, permission_role, version_no):
    """Get specific version details"""
    db = get_db()
    
    version = db.query(Version).filter_by(
        document_id=document.id,
        version_no=version_no
    ).first()
    
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    
    version_dict = version.to_dict()
    version_dict['snapshot_content'] = version.snapshot_content
    
    return jsonify({'version': version_dict}), 200

@bp.route('/<string:document_id>/restore', methods=['POST'])
@require_auth
@require_document_access('editor')
def restore_version(user, document, permission_role):
    """Restore document to specific version"""
    db = get_db()
    data = request.get_json()
    
    version_no = data.get('version_no')
    
    if version_no is None:
        return jsonify({'error': 'version_no required'}), 400
    
    # Get the version
    version = db.query(Version).filter_by(
        document_id=document.id,
        version_no=version_no
    ).first()
    
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    
    # Restore content
    document.content = version.snapshot_content
    document.current_version += 1
    document.updated_at = datetime.utcnow()
    
    # Create new snapshot for this restore
    new_version = Version(
        document_id=document.id,
        version_no=document.current_version,
        created_by=user.id,
        snapshot_content=version.snapshot_content,
        snapshot_ref=f"Restored from version {version_no}"
    )
    db.add(new_version)
    
    db.commit()
    db.refresh(document)
    
    return jsonify({
        'message': 'Document restored',
        'document': document.to_dict(include_content=True),
        'new_version': document.current_version
    }), 200

@bp.route('/<string:document_id>/operations', methods=['GET'])
@require_auth
@require_document_access()
def get_operations(user, document, permission_role):
    """Get operations for document (for debugging/history)"""
    db = get_db()
    
    # Optional: filter by version range
    from_version = request.args.get('from_version', type=int)
    to_version = request.args.get('to_version', type=int)
    limit = request.args.get('limit', 100, type=int)
    
    query = db.query(Operation).filter_by(document_id=document.id)
    
    if from_version is not None:
        query = query.filter(Operation.version_no >= from_version)
    
    if to_version is not None:
        query = query.filter(Operation.version_no <= to_version)
    
    operations = query.order_by(Operation.version_no.desc()).limit(limit).all()
    
    return jsonify({
        'operations': [op.to_dict() for op in operations]
    }), 200

@bp.route('/<string:document_id>/versions/<int:version_no>', methods=['DELETE'])
@require_auth
@require_document_access('editor')
def delete_version(user, document, permission_role, version_no):
    """Delete a specific version"""
    db = get_db()
    
    try:
        # Find the version to delete
        version = db.query(Version).filter_by(
            document_id=document.id,
            version_no=version_no
        ).first()
        
        if not version:
            return jsonify({'error': 'Version not found'}), 404
        
        # Prevent deletion of the current version
        if version_no == document.current_version:
            return jsonify({'error': 'Cannot delete the current active version'}), 400
        
        # Delete associated operations first (if any)
        db.query(Operation).filter_by(
            document_id=document.id,
            version_no=version_no
        ).delete()
        
        # Delete the version
        db.delete(version)
        db.commit()
        
        return jsonify({
            'success': True,
            'message': f'Version {version_no} deleted successfully'
        }), 200
        
    except Exception as e:
        db.rollback()
        return jsonify({'error': f'Failed to delete version: {str(e)}'}), 500
