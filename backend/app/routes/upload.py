from flask import Blueprint, request, jsonify, current_app, url_for
from app.auth import require_auth
import os
import hashlib
import uuid
from werkzeug.utils import secure_filename
from datetime import datetime
from PIL import Image as PILImage
import io

bp = Blueprint('upload', __name__, url_prefix='/api/upload')

# Configure upload settings
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'static', 'uploads', 'images')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_IMAGE_SIZE = (1920, 1080)  # Max resolution

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def compress_image(image_data, max_size=MAX_IMAGE_SIZE, quality=85):
    """Compress and resize image if needed"""
    try:
        image = PILImage.open(io.BytesIO(image_data))
        
        # Convert RGBA to RGB if necessary
        if image.mode in ('RGBA', 'LA', 'P'):
            background = PILImage.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = background
        
        # Resize if image is too large
        if image.size[0] > max_size[0] or image.size[1] > max_size[1]:
            image.thumbnail(max_size, PILImage.Resampling.LANCZOS)
        
        # Save to bytes
        output = io.BytesIO()
        image.save(output, format='JPEG', quality=quality, optimize=True)
        return output.getvalue()
    except Exception as e:
        current_app.logger.error(f"Error compressing image: {e}")
        return image_data

@bp.route('/image', methods=['POST'])
@require_auth
def upload_image(user):
    """Upload image for use in editor"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Allowed: PNG, JPG, JPEG, GIF, WebP, SVG'}), 400
        
        # Read file content
        file_content = file.read()
        
        # Check file size
        if len(file_content) > MAX_FILE_SIZE:
            return jsonify({'error': 'File size too large. Maximum 10MB allowed'}), 400
        
        # Compress image if it's not SVG
        file_ext = file.filename.rsplit('.', 1)[1].lower()
        if file_ext != 'svg':
            file_content = compress_image(file_content)
        
        # Generate unique filename
        file_hash = hashlib.md5(file_content).hexdigest()
        unique_filename = f"{file_hash}_{uuid.uuid4().hex[:8]}.{file_ext if file_ext == 'svg' else 'jpg'}"
        
        # Save file
        file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        # Generate URL
        image_url = f"http://localhost:5001/static/uploads/images/{unique_filename}"
        
        return jsonify({
            'success': True,
            'url': image_url,
            'filename': unique_filename,
            'size': len(file_content)
        })
        
    except Exception as e:
        current_app.logger.error(f"Error uploading image: {e}")
        return jsonify({'error': 'Failed to upload image'}), 500

@bp.route('/image/<filename>', methods=['DELETE'])
@require_auth
def delete_image(user, filename):
    """Delete uploaded image"""
    try:
        # Security check - ensure filename is safe
        secure_name = secure_filename(filename)
        file_path = os.path.join(UPLOAD_FOLDER, secure_name)
        
        # Check if file exists and delete it
        if os.path.exists(file_path):
            os.remove(file_path)
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'File not found'}), 404
            
    except Exception as e:
        current_app.logger.error(f"Error deleting image: {e}")
        return jsonify({'error': 'Failed to delete image'}), 500