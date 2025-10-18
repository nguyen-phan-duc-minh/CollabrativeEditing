from flask import Blueprint, request, jsonify
from flask_socketio import emit
from app.auth import require_auth
from app.middleware import require_document_access
from app.models import Comment
from app import get_db, socketio
from datetime import datetime

bp = Blueprint('comments', __name__, url_prefix='/documents')

@bp.route('/<string:document_id>/comments', methods=['GET'])
@require_auth
@require_document_access()
def get_comments(user, document, permission_role):
    """Get all comments for document"""
    db = get_db()
    
    # Optional: filter by resolved status
    resolved = request.args.get('resolved', type=lambda x: x.lower() == 'true')
    
    query = db.query(Comment).filter_by(document_id=document.id)
    
    if resolved is not None:
        query = query.filter_by(resolved=resolved)
    
    comments = query.order_by(Comment.created_at.desc()).all()
    
    return jsonify({ 'comments': [c.to_dict() for c in comments] }), 200

@bp.route('/<string:document_id>/comments', methods=['POST'])
@require_auth
@require_document_access('viewer')
def create_comment(user, document, permission_role):
    """Create new comment"""
    db = get_db()
    data = request.get_json()
    
    content = data.get('content')
    anchor = data.get('anchor')  # JSON string with position info
    
    if not content:
        return jsonify({'error': 'Content required'}), 400
    
    comment = Comment(
        document_id=document.id, author_id=user.id, content=content, anchor=anchor
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    
    # Emit socket event for real-time notification
    socketio.emit('comment.new', {
        'document_id': document.id,
        'comment': comment.to_dict(),
        'user_id': user.id,
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }, room=f'doc_{document.id}')
    
    return jsonify({ 'comment': comment.to_dict() }), 201

@bp.route('/comments/<int:comment_id>', methods=['GET'])
@require_auth
def get_comment(user, comment_id):
    """Get specific comment"""
    db = get_db()
    
    comment = db.query(Comment).filter_by(id=comment_id).first()
    
    if not comment:
        return jsonify({'error': 'Comment not found'}), 404
    
    # Check if user has access to the document
    from app.models import Permission
    permission = db.query(Permission).filter_by(
        document_id=comment.document_id,
        user_id=user.id
    ).first()
    
    if not permission:
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify({'comment': comment.to_dict()}), 200

@bp.route('/comments/<int:comment_id>', methods=['PUT'])
@require_auth
def update_comment(user, comment_id):
    """Update comment (only author can update)"""
    db = get_db()
    data = request.get_json()
    
    comment = db.query(Comment).filter_by(id=comment_id).first()
    
    if not comment:
        return jsonify({'error': 'Comment not found'}), 404
    
    # Only author can update
    if comment.author_id != user.id:
        return jsonify({'error': 'Only author can update comment'}), 403
    
    if 'content' in data:
        comment.content = data['content']
        comment.updated_at = datetime.utcnow()
    
    db.commit()
    
    # Emit socket event for real-time notification
    socketio.emit('comment.updated', {
        'document_id': comment.document_id,
        'comment': comment.to_dict(),
        'user_id': user.id,
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }, room=f'doc_{comment.document_id}')
    
    return jsonify({'comment': comment.to_dict()}), 200

@bp.route('/comments/<int:comment_id>', methods=['DELETE'])
@require_auth
def delete_comment(user, comment_id):
    """Delete comment (only author or document owner can delete)"""
    db = get_db()
    
    comment = db.query(Comment).filter_by(id=comment_id).first()
    
    if not comment:
        return jsonify({'error': 'Comment not found'}), 404
    
    # Check if user is author
    if comment.author_id != user.id:
        # Check if user is document owner
        from app.models import Permission
        permission = db.query(Permission).filter_by(
            document_id=comment.document_id,
            user_id=user.id,
            role='owner'
        ).first()
        
        if not permission:
            return jsonify({'error': 'Only author or document owner can delete comment'}), 403
    
    comment_id_to_delete = comment.id
    document_id = comment.document_id
    
    db.delete(comment)
    db.commit()
    
    # Emit socket event for real-time notification
    socketio.emit('comment.deleted', {
        'document_id': document_id,
        'comment_id': comment_id_to_delete,
        'user_id': user.id,
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }, room=f'doc_{document_id}')
    
    return jsonify({'message': 'Comment deleted'}), 200

@bp.route('/comments/<int:comment_id>/resolve', methods=['POST'])
@require_auth
def resolve_comment(user, comment_id):
    """Mark comment as resolved"""
    db = get_db()
    
    comment = db.query(Comment).filter_by(id=comment_id).first()
    
    if not comment:
        return jsonify({'error': 'Comment not found'}), 404
    
    # Check if user has access
    from app.models import Permission
    permission = db.query(Permission).filter_by(
        document_id=comment.document_id,
        user_id=user.id
    ).first()
    
    if not permission:
        return jsonify({'error': 'Access denied'}), 403
    
    # Only editor or owner can resolve
    if permission.role not in ['owner', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    comment.resolved = True
    comment.resolved_by = user.id
    comment.resolved_at = datetime.utcnow()
    db.commit()
    
    return jsonify({
        'message': 'Comment resolved',
        'comment': comment.to_dict()
    }), 200

@bp.route('/comments/<int:comment_id>/unresolve', methods=['POST'])
@require_auth
def unresolve_comment(user, comment_id):
    """Mark comment as unresolved"""
    db = get_db()
    
    comment = db.query(Comment).filter_by(id=comment_id).first()
    
    if not comment:
        return jsonify({'error': 'Comment not found'}), 404
    
    # Check if user has access
    from app.models import Permission
    permission = db.query(Permission).filter_by(
        document_id=comment.document_id,
        user_id=user.id
    ).first()
    
    if not permission:
        return jsonify({'error': 'Access denied'}), 403
    
    # Only editor or owner can unresolve
    if permission.role not in ['owner', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    comment.resolved = False
    comment.resolved_by = None
    comment.resolved_at = None
    db.commit()
    
    return jsonify({
        'message': 'Comment unresolved',
        'comment': comment.to_dict()
    }), 200
