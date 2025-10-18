from flask import Blueprint, request, jsonify, send_file
from app.auth import require_auth
from app.middleware import require_document_access
from app.services.export_service import ExportService
from app.services.import_service import ImportService
from app.models import Document, Version
from app import get_db
from datetime import datetime
from io import BytesIO
import os

bp = Blueprint('export_import', __name__, url_prefix='/documents')

# ==================== EXPORT ENDPOINTS ====================

@bp.route('/<string:document_id>/export/docx', methods=['GET'])
@require_auth
@require_document_access()
def export_docx(user, document, permission_role):
    """Export document to DOCX format"""
    try:
        # Generate DOCX
        docx_buffer = ExportService.html_to_docx(
            html_content=document.content or '<p>Empty document</p>',
            title=document.title
        )
        
        # Prepare filename
        filename = f"{document.title}.docx".replace(' ', '_')
        
        return send_file(
            docx_buffer,
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"❌ Export DOCX error: {e}")
        return jsonify({'error': f'Failed to export DOCX: {str(e)}'}), 500

@bp.route('/<string:document_id>/export/pdf', methods=['GET'])
@require_auth
@require_document_access()
def export_pdf(user, document, permission_role):
    """Export document to PDF format"""
    try:
        # Generate PDF
        pdf_buffer = ExportService.html_to_pdf(
            html_content=document.content or '<p>Empty document</p>',
            title=document.title
        )
        
        # Prepare filename
        filename = f"{document.title}.pdf".replace(' ', '_')
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"❌ Export PDF error: {e}")
        return jsonify({'error': f'Failed to export PDF: {str(e)}'}), 500

@bp.route('/<string:document_id>/export/markdown', methods=['GET'])
@require_auth
@require_document_access()
def export_markdown(user, document, permission_role):
    """Export document to Markdown format"""
    try:
        # Generate Markdown
        markdown_content = ExportService.html_to_markdown(
            html_content=document.content or '<p>Empty document</p>'
        )
        
        # Add title
        markdown_content = f"# {document.title}\n\n{markdown_content}"
        
        # Prepare filename
        filename = f"{document.title}.md".replace(' ', '_')
        
        # Create buffer
        buffer = BytesIO(markdown_content.encode('utf-8'))
        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype='text/markdown',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"❌ Export Markdown error: {e}")
        return jsonify({'error': f'Failed to export Markdown: {str(e)}'}), 500

@bp.route('/<string:document_id>/export/txt', methods=['GET'])
@require_auth
@require_document_access()
def export_text(user, document, permission_role):
    """Export document to plain text format"""
    try:
        # Generate plain text
        text_content = ExportService.html_to_text(
            html_content=document.content or '<p>Empty document</p>'
        )
        
        # Add title
        text_content = f"{document.title}\n{'=' * len(document.title)}\n\n{text_content}"
        
        # Prepare filename
        filename = f"{document.title}.txt".replace(' ', '_')
        
        # Create buffer
        buffer = BytesIO(text_content.encode('utf-8'))
        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype='text/plain',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"❌ Export TXT error: {e}")
        return jsonify({'error': f'Failed to export TXT: {str(e)}'}), 500


# ==================== IMPORT ENDPOINTS ====================

@bp.route('/import', methods=['POST'])
@require_auth
def import_document(user):
    """Import document from file (DOCX, Markdown, TXT) - Creates NEW document"""
    db = get_db()
    
    # Check if file is present
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    try:
        # Detect file format
        file_format = ImportService.detect_format(file.filename)
        
        if file_format == 'unknown':
            return jsonify({'error': 'Unsupported file format. Supported: .docx, .md, .txt'}), 400
        
        # Read file content
        file_stream = BytesIO(file.read())
        
        # Convert to HTML based on format
        if file_format == 'docx':
            html_content = ImportService.docx_to_html(file_stream)
        elif file_format == 'md':
            markdown_content = file_stream.read().decode('utf-8')
            html_content = ImportService.markdown_to_html(markdown_content)
        elif file_format == 'txt':
            text_content = file_stream.read().decode('utf-8')
            html_content = ImportService.text_to_html(text_content)
        
        # Extract title from filename (remove extension)
        title = os.path.splitext(file.filename)[0]
        
        # Create new document
        document = Document(
            title=title,
            content=html_content,
            owner_id=user.id,
            type='doc',
            current_version=1
        )
        
        db.add(document)
        db.commit()
        db.refresh(document)
        
        print(f"✅ Imported NEW document: {title} ({file_format.upper()})")
        
        return jsonify({
            'document': document.to_dict(include_content=True),
            'message': f'Successfully imported {file_format.upper()} file as new document'
        }), 201
        
    except Exception as e:
        db.rollback()
        print(f"❌ Import error: {e}")
        return jsonify({'error': f'Failed to import file: {str(e)}'}), 500


@bp.route('/<string:document_id>/import', methods=['POST'])
@require_auth
@require_document_access('editor')
def import_into_document(user, document, permission_role):
    """Import content into EXISTING document (replaces current content)"""
    db = get_db()
    
    # Check if file is present
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    try:
        # Detect file format
        file_format = ImportService.detect_format(file.filename)
        
        if file_format == 'unknown':
            return jsonify({'error': 'Unsupported file format. Supported: .docx, .md, .txt'}), 400
        
        # Read file content
        file_stream = BytesIO(file.read())
        
        # Convert to HTML based on format
        if file_format == 'docx':
            html_content = ImportService.docx_to_html(file_stream)
        elif file_format == 'md':
            markdown_content = file_stream.read().decode('utf-8')
            html_content = ImportService.markdown_to_html(markdown_content)
        elif file_format == 'txt':
            text_content = file_stream.read().decode('utf-8')
            html_content = ImportService.text_to_html(text_content)
        
        # Update document content
        document.content = html_content
        document.current_version += 1
        document.updated_at = datetime.utcnow()
        
        # Create version snapshot
        version = Version(
            document_id=document.id,
            version_no=document.current_version,
            created_by=user.id,
            snapshot_content=html_content,
            snapshot_ref=f"Imported from {file_format.upper()} file: {file.filename}"
        )
        db.add(version)
        
        db.commit()
        db.refresh(document)
        
        print(f"✅ Imported content into document #{document.id}: {file.filename} ({file_format.upper()})")
        
        return jsonify({
            'document': document.to_dict(include_content=True),
            'message': f'Successfully imported {file_format.upper()} content into document'
        }), 200
        
    except Exception as e:
        db.rollback()
        print(f"❌ Import into document error: {e}")
        return jsonify({'error': f'Failed to import file: {str(e)}'}), 500
