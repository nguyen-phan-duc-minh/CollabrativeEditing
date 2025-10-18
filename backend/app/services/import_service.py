"""
Import Service - Convert various formats to HTML for TipTap editor
"""
from docx import Document as DocxDocument
import markdown2
from bs4 import BeautifulSoup
from io import BytesIO
import re


class ImportService:
    """Service for importing documents from various formats"""
    
    @staticmethod
    def docx_to_html(file_stream: BytesIO) -> str:
        """
        Convert DOCX file to HTML format compatible with TipTap
        
        Args:
            file_stream: BytesIO object containing DOCX file
            
        Returns:
            HTML string compatible with TipTap editor
        """
        doc = DocxDocument(file_stream)
        html_parts = []
        
        for para in doc.paragraphs:
            if para.style.name.startswith('Heading'):
                # Extract heading level
                level = para.style.name.replace('Heading ', '')
                if level.isdigit():
                    html_parts.append(f'<h{level}>{ImportService._process_runs(para.runs)}</h{level}>')
                else:
                    html_parts.append(f'<h1>{ImportService._process_runs(para.runs)}</h1>')
                    
            elif para.style.name == 'List Bullet':
                html_parts.append(f'<ul><li>{ImportService._process_runs(para.runs)}</li></ul>')
                
            elif para.style.name == 'List Number':
                html_parts.append(f'<ol><li>{ImportService._process_runs(para.runs)}</li></ol>')
                
            elif para.style.name in ['Quote', 'Intense Quote']:
                html_parts.append(f'<blockquote><p>{ImportService._process_runs(para.runs)}</p></blockquote>')
                
            elif para.text.strip():  # Normal paragraph
                html_parts.append(f'<p>{ImportService._process_runs(para.runs)}</p>')
        
        # Combine consecutive list items
        html = '\n'.join(html_parts)
        html = ImportService._merge_lists(html)
        
        return html
    
    @staticmethod
    def _process_runs(runs):
        """Process text runs with formatting (bold, italic, underline, etc.)"""
        result = []
        
        for run in runs:
            text = run.text
            if not text:
                continue
                
            # Apply formatting
            if run.bold:
                text = f'<strong>{text}</strong>'
            if run.italic:
                text = f'<em>{text}</em>'
            if run.underline:
                text = f'<u>{text}</u>'
            if run.font.highlight_color:
                text = f'<mark>{text}</mark>'
            if run.font.name == 'Courier New' or run.style and 'code' in run.style.name.lower():
                text = f'<code>{text}</code>'
                
            result.append(text)
        
        return ''.join(result)
    
    @staticmethod
    def _merge_lists(html: str) -> str:
        """Merge consecutive list items into single lists"""
        # Merge <ul> tags
        html = re.sub(r'</ul>\s*<ul>', '\n', html)
        # Merge <ol> tags
        html = re.sub(r'</ol>\s*<ol>', '\n', html)
        return html
    
    @staticmethod
    def markdown_to_html(markdown_content: str) -> str:
        """
        Convert Markdown to HTML format compatible with TipTap
        
        Args:
            markdown_content: Markdown string
            
        Returns:
            HTML string compatible with TipTap editor
        """
        # Convert markdown to HTML
        html = markdown2.markdown(
            markdown_content,
            extras=[
                'fenced-code-blocks',
                'tables',
                'strike',
                'task_list',
                'code-friendly'
            ]
        )
        
        # Clean up HTML for TipTap
        soup = BeautifulSoup(html, 'html.parser')
        
        # Ensure all text is in paragraphs
        for text_node in soup.find_all(text=True, recursive=False):
            if text_node.strip():
                p = soup.new_tag('p')
                p.string = text_node
                text_node.replace_with(p)
        
        return str(soup)
    
    @staticmethod
    def text_to_html(text_content: str) -> str:
        """
        Convert plain text to HTML format compatible with TipTap
        
        Args:
            text_content: Plain text string
            
        Returns:
            HTML string compatible with TipTap editor
        """
        # Split by paragraphs (double newline)
        paragraphs = text_content.split('\n\n')
        
        html_parts = []
        for para in paragraphs:
            # Handle single line breaks within paragraph
            para = para.replace('\n', '<br>')
            if para.strip():
                html_parts.append(f'<p>{para.strip()}</p>')
        
        return '\n'.join(html_parts)
    
    @staticmethod
    def detect_format(filename: str) -> str:
        """
        Detect file format from filename
        
        Args:
            filename: Name of the file
            
        Returns:
            Format string: 'docx', 'md', 'txt', or 'unknown'
        """
        filename = filename.lower()
        
        if filename.endswith('.docx'):
            return 'docx'
        elif filename.endswith('.md') or filename.endswith('.markdown'):
            return 'md'
        elif filename.endswith('.txt'):
            return 'txt'
        else:
            return 'unknown'
