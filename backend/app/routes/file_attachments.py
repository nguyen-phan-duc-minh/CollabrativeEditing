from flask import Blueprint, request, jsonify, current_app, send_file
from app.models import FileAttachment, Document, Permission
from app import get_db
from app.auth import require_auth
import os
import hashlib
from werkzeug.utils import secure_filename
from datetime import datetime

bp = Blueprint('file_attachments', __name__, url_prefix='/api/attachments')

# Configure upload settings
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'}
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_hash(file_content):
    return hashlib.sha256(file_content).hexdigest()

@bp.route('/document/<string:document_id>', methods=['GET'])
@require_auth
def get_document_attachments(document_id):
    """Get all attachments for a document"""
    try:
        user_id = request.current_user['id']
        db = get_db()
        
        # Check document access
        document = db.query(Document).filter_by(id=document_id).first()
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Check permission
        if document.owner_id != user_id:
            permission = db.query(Permission).filter_by(
                document_id=document_id,
                user_id=user_id
            ).first()
            if not permission:
                return jsonify({'error': 'Access denied'}), 403
        
        attachments = db.query(FileAttachment).filter_by(document_id=document_id).all()
        
        return jsonify({
            'success': True,
            'attachments': [attachment.to_dict() for attachment in attachments]
        })
    except Exception as e:
        current_app.logger.error(f"Error getting attachments: {e}")
        return jsonify({'error': 'Failed to get attachments'}), 500

@bp.route('/document/<string:document_id>/upload', methods=['POST'])
@require_auth
def upload_attachment(document_id):
    """Upload file attachment to document"""
    try:
        user_id = request.current_user['id']
        db = get_db()
        
        # Check document access
        document = db.query(Document).filter_by(id=document_id).first()
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Check edit permission
        if document.owner_id != user_id:
            permission = db.query(Permission).filter_by(
                document_id=document_id,
                user_id=user_id
            ).first()
            if not permission or permission.role == 'viewer':
                return jsonify({'error': 'Edit access required'}), 403
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed'}), 400
        
        # Read file content
        file_content = file.read()
        file_size = len(file_content)
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({'error': 'File too large'}), 400
        
        # Generate file hash
        file_hash = get_file_hash(file_content)
        
        # Check for duplicate
        existing = db.query(FileAttachment).filter_by(
            document_id=document_id,
            file_hash=file_hash
        ).first()
        
        if existing:
            return jsonify({
                'success': True,
                'attachment': existing.to_dict(),
                'message': 'File already exists'
            })
        
        # Create upload directory if not exists
        upload_path = os.path.join(current_app.root_path, UPLOAD_FOLDER, str(document_id))
        os.makedirs(upload_path, exist_ok=True)
        
        # Save file
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
        unique_filename = timestamp + filename
        file_path = os.path.join(upload_path, unique_filename)
        
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        # Create attachment record
        attachment = FileAttachment(
            document_id=document_id,
            uploaded_by=user_id,
            file_name=filename,
            file_size=file_size,
            file_type=file.content_type,
            file_path=file_path,
            file_hash=file_hash,
            is_embedded=request.form.get('is_embedded', 'false').lower() == 'true'
        )
        
        db.add(attachment)
        db.commit()
        
        return jsonify({
            'success': True,
            'attachment': attachment.to_dict()
        })
    except Exception as e:
        current_app.logger.error(f"Error uploading attachment: {e}")
        db.rollback()
        return jsonify({'error': 'Failed to upload file'}), 500

@bp.route('/<int:attachment_id>/download', methods=['GET'])
@require_auth
def download_attachment(attachment_id):
    """Download file attachment"""
    try:
        user_id = request.current_user['id']
        db = get_db()
        
        attachment = db.query(FileAttachment).filter_by(id=attachment_id).first()
        if not attachment:
            return jsonify({'error': 'Attachment not found'}), 404
        
        # Check document access
        document = attachment.document
        if document.owner_id != user_id:
            permission = db.query(Permission).filter_by(
                document_id=document.id,
                user_id=user_id
            ).first()
            if not permission:
                return jsonify({'error': 'Access denied'}), 403
        
        if not os.path.exists(attachment.file_path):
            return jsonify({'error': 'File not found on disk'}), 404
        
        return send_file(
            attachment.file_path,
            as_attachment=True,
            download_name=attachment.file_name
        )
    except Exception as e:
        current_app.logger.error(f"Error downloading attachment: {e}")
        return jsonify({'error': 'Failed to download file'}), 500

@bp.route('/<int:attachment_id>', methods=['DELETE'])
@require_auth
def delete_attachment(attachment_id):
    """Delete file attachment"""
    try:
        user_id = request.current_user['id']
        db = get_db()
        
        attachment = db.query(FileAttachment).filter_by(id=attachment_id).first()
        if not attachment:
            return jsonify({'error': 'Attachment not found'}), 404
        
        # Check document access
        document = attachment.document
        if document.owner_id != user_id:
            permission = db.query(Permission).filter_by(
                document_id=document.id,
                user_id=user_id
            ).first()
            if not permission or permission.role == 'viewer':
                return jsonify({'error': 'Edit access required'}), 403
        
        # Delete file from disk
        if os.path.exists(attachment.file_path):
            os.remove(attachment.file_path)
        
        # Delete database record
        db.delete(attachment)
        db.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        current_app.logger.error(f"Error deleting attachment: {e}")
        db.rollback()
        return jsonify({'error': 'Failed to delete attachment'}), 500