import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import { NodeSelection } from 'prosemirror-state';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Color } from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';

import { Highlight } from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { 
  FaArrowLeft, FaSave, FaUsers, FaDownload, FaUpload,
  FaBold, FaItalic, FaUnderline, FaStrikethrough, 
  FaAlignLeft, FaAlignCenter, FaAlignRight, FaAlignJustify,
  FaListUl, FaListOl, FaLink, FaImage, FaTable, 
  FaUndo, FaRedo, FaCheckCircle,
  FaClock, FaExclamationCircle, FaUserCircle,
  FaSearchPlus, FaSearchMinus, FaSearch, FaComment, FaRobot
} from 'react-icons/fa';
import { Document, Permission, ActiveUser } from '../types';
import api from '../services/api';
import { useAuthStore } from '../store';
import CommentsSidebar from '../components/CommentsSidebar';
import VersionHistoryModal from '../components/VersionHistoryModal';
import ShareDialog from '../components/ShareDialog';
import PresenceIndicator from '../components/PresenceIndicator';
import CursorOverlay from '../components/CursorOverlay';
import ErrorBoundary from '../components/ErrorBoundary';
import KeyboardShortcuts from '../components/KeyboardShortcuts';
import Tooltip from '../components/Tooltip';
import WorkspaceIndicator from '../components/WorkspaceIndicator';
import ActivityFeed from '../components/ActivityFeed';
import ChatBot from '../components/ChatBot';
import { CollaborationProvider } from '../services/collaboration';
import websocketService from '../services/websocket';
import './EditorPage.css';

export default function EditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuthStore();
  
  const [documentData, setDocumentData] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  // Additional state variables
  const [doc, setDoc] = useState<Document | null>(null);
  const [permission, setPermission] = useState<Permission | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [isCollaborationReady, setIsCollaborationReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  const [isPaginated, setIsPaginated] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showChatBot, setShowChatBot] = useState(false);

  // Debug activeUsers changes
  useEffect(() => {
    console.log('ActiveUsers updated:', activeUsers.length, activeUsers);
  }, [activeUsers]);

  // Zoom levels available
  const zoomLevels = [50, 75, 100, 125, 150, 175, 200];

  // Initialize collaboration provider
  const collaborationProvider = useMemo(() => 
    new CollaborationProvider(), 
    []
  );

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const isCreatingVersionRef = useRef<boolean>(false);

  // Save document function
  const handleSave = useCallback(async () => {
    if (!id || !editor || !user || permission?.role === 'viewer') return;
    
    setIsSaving(true);
    
    try {
      const content = editor.getHTML();
      await api.updateDocument(id, {
        title,
        content,
      });
      
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      
      // Show save notification
      setShowSaveNotification(true);
      setTimeout(() => setShowSaveNotification(false), 2000);
      
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Failed to save document. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [id, title, user, permission]);

  // Handle title save
  const handleTitleSave = useCallback(async () => {
    if (!id || !title.trim()) return;
    
    try {
      await api.updateDocument(id, { title: title.trim() });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error updating title:', error);
    }
  }, [id, title]);

  // Handle title key events
  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
      (e.target as HTMLInputElement).blur();
    }
  };

  // Handle title blur
  const handleTitleBlur = () => {
    handleTitleSave();
  };

  // Initialize TipTap Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Configure paragraph behavior
        paragraph: {
          HTMLAttributes: {
            class: 'editor-paragraph',
          },
        },
        // Configure history for better undo/redo
        history: {
          depth: 100,
          newGroupDelay: 500,
        },
        // Keep default hardBreak but configure it properly
        hardBreak: {
          keepMarks: false,
          HTMLAttributes: {
            class: 'editor-hard-break',
          },
        },
      }),
      Underline.configure({
        HTMLAttributes: {
          class: 'editor-underline',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      TextStyle,

      Color,
      Highlight.configure({
        multicolor: true
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'editor-image',
          draggable: true,
        },
      }),
      Table.configure({
        resizable: true,
        allowTableNodeSelection: true,
        HTMLAttributes: {
          class: 'editor-table',
          style: 'border-collapse: collapse; width: 100%; table-layout: fixed;',
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: 'Nhập nội dung tại đây... / Start typing your document...',
      }),
      // Collaboration extensions - temporarily disabled
      // TODO: Enable when provider is ready
      // Collaboration.configure({
      //   document: collaborationProvider.getDocument(),
      //   field: 'content', // Yjs field name for document content
      // }),
      // CollaborationCursor.configure({
      //   provider: collaborationProvider.getProvider(),
      //   user: user ? {
      //     name: user.display_name,
      //     color: '#' + Math.floor(Math.random()*16777215).toString(16),
      //     avatar: user.avatar_url,
      //   } : undefined,
      // }),
    ],
    content: '',
    editable: true,
    editorProps: {
      attributes: {
        class: 'prose prose-lg mx-auto focus:outline-none min-h-[500px]',
        style: 'line-height: 1.6; max-width: none;'
      },
      handleDOMEvents: {
        // Handle table column resize
        mousedown: (view, event) => {
          const target = event.target as HTMLElement;
          if (target && target.tagName && ['TD', 'TH'].includes(target.tagName.toUpperCase())) {
            const rect = target.getBoundingClientRect();
            const isResizeArea = event.clientX > rect.right - 10;
            
            if (isResizeArea) {
              event.preventDefault();
              
              let startX = event.clientX;
              let startWidth = target.offsetWidth;
              
              const onMouseMove = (e: MouseEvent) => {
                const deltaX = e.clientX - startX;
                const newWidth = Math.max(50, startWidth + deltaX);
                target.style.width = `${newWidth}px`;
                target.style.minWidth = `${newWidth}px`;
              };
              
              const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
              };
              
              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp);
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
              
              return true;
            }
          }
          return false;
        }
      }
    },
    onUpdate: ({ editor }) => {
      if (permission?.role !== 'viewer') {
        setHasUnsavedChanges(true);
        
        // Broadcast content change for real-time collaboration
        const content = editor.getHTML();
        broadcastContentChange(content);
        
        // Auto-save after 2 seconds of inactivity
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        
        saveTimeoutRef.current = setTimeout(() => {
          // Don't auto-save if currently creating a version
          if (!isCreatingVersionRef.current) {
            handleSave();
          }
        }, 2000);
      }
    },
    onSelectionUpdate: ({ editor }) => {
      // Broadcast cursor position for real-time collaboration
      if (id && user) {
        const selection = editor.state.selection;
        const cursorData = {
          from: selection.from,
          to: selection.to,
          anchor: selection.anchor,
          head: selection.head
        };
        
        // Throttle cursor updates to avoid spam
        if (cursorTimeoutRef.current) {
          clearTimeout(cursorTimeoutRef.current);
        }
        
        cursorTimeoutRef.current = setTimeout(() => {
          websocketService.updateCursor(id, cursorData, user.id);
        }, 100); // 100ms throttle
      }
    },
  });

  // Pagination functions
  const calculatePages = useCallback(() => {
    if (!editor || !isPaginated) return;
    
    const editorElement = document.querySelector('.ProseMirror');
    if (!editorElement) return;
    
    const pageHeight = 297; // A4 height in mm
    const marginHeight = 50.8; // Top + bottom margins in mm
    const contentHeight = pageHeight - marginHeight;
    
    // Calculate approximate content height
    const elementHeight = editorElement.scrollHeight;
    const pixelsPerMM = window.devicePixelRatio * 3.7795275591; // Approximate conversion
    const contentHeightMM = elementHeight / pixelsPerMM;
    
    const pages = Math.max(1, Math.ceil(contentHeightMM / contentHeight));
    setTotalPages(pages);
  }, [editor, isPaginated]);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    
    // Scroll to page
    const pageElement = document.querySelector(`.document-page:nth-child(${page})`);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const togglePagination = () => {
    setIsPaginated(!isPaginated);
  };

  // Recalculate pages when content changes
  useEffect(() => {
    if (editor && isPaginated) {
      const timeoutId = setTimeout(calculatePages, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [editor, isPaginated, calculatePages]);

  // Load permissions
  const loadPermissions = useCallback(async () => {
    if (!id) return;
    
    try {
      const perms = await api.getPermissions(id);
      console.log('Loaded permissions:', perms);
      setPermissions(perms);
    } catch (error) {
      console.error('Error loading permissions:', error);
      setPermissions([]); // Set empty array on error
    }
  }, [id]);

  // Load document
  const loadDocument = useCallback(async () => {
    if (!id || !user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading document:', id);
      const data = await api.getDocument(id);
      console.log('Document loaded:', data);
      console.log('Document content:', data.document?.content);
      
      setDoc(data.document);
      setPermission(data.permission);
      setTitle(data.document.title || '');
      
      // Set content in editor
      if (editor && data.document?.content) {
        console.log('Setting editor content:', data.document.content);
        editor.commands.setContent(data.document.content);
      } else {
        console.log('No content to set or editor not ready:', { 
          editor: !!editor, 
          content: data.document?.content 
        });
      }
      
    } catch (err) {
      console.error('Error loading document:', err);
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  }, [id, user, editor]);

  // Manual save
  const handleManualSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    handleSave();
  };

  // Export document
  const handleExport = async () => {
    if (!id) return;
    
    try {
      const response = await api.exportDocx(id);
      
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = window.URL.createObjectURL(blob);
      const linkElement = window.document.createElement('a');
      linkElement.href = url;
      linkElement.download = `${title || 'document'}.docx`;
      linkElement.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting document:', error);
    }
  };

  // Toolbar handlers
  const handleBold = () => editor?.chain().focus().toggleBold().run();
  const handleItalic = () => editor?.chain().focus().toggleItalic().run();
  const handleUnderline = () => editor?.chain().focus().toggleUnderline().run();
  const handleStrike = () => editor?.chain().focus().toggleStrike().run();
  const handleBulletList = () => editor?.chain().focus().toggleBulletList().run();
  const handleOrderedList = () => editor?.chain().focus().toggleOrderedList().run();
  
  // Font family handler - sử dụng TextStyle với CSS properties đúng cách
  const handleFontFamily = (fontFamily: string) => {
    if (fontFamily && editor) {
      if (fontFamily === '') {
        // Remove font family
        editor.chain().focus().unsetMark('textStyle').run();
      } else {
        editor.chain().focus().setMark('textStyle', { fontFamily: fontFamily }).run();
      }
    }
  };
  
  // Font size handler - sử dụng TextStyle với fontSize 
  const handleFontSize = (size: string) => {
    if (size && editor) {
      editor.chain().focus().setMark('textStyle', { fontSize: size + 'px' }).run();
    }
  };
  
  // Text color handler
  const handleTextColor = (color: string) => {
    editor?.chain().focus().setColor(color).run();
  };

  // Get current font family
  const getCurrentFontFamily = () => {
    if (!editor) return '';
    const attrs = editor.getAttributes('textStyle');
    return attrs.fontFamily || '';
  };

  // Get current font size
  const getCurrentFontSize = () => {
    if (!editor) return '';
    const attrs = editor.getAttributes('textStyle');
    return attrs.fontSize ? attrs.fontSize.replace('px', '') : '';
  };
  
  // Highlight color handler
  const handleHighlight = (color: string) => {
    if (color === 'none' || color === '') {
      editor?.chain().focus().unsetHighlight().run();
    } else {
      editor?.chain().focus().toggleHighlight({ color }).run();
    }
  };
  
  // Text Alignment handlers
  const handleAlign = (alignment: 'left' | 'center' | 'right' | 'justify') => {
    editor?.chain().focus().setTextAlign(alignment).run();
  };
  
  const handleList = (type: 'bullet' | 'ordered') => {
    if (type === 'bullet') {
      editor?.chain().focus().toggleBulletList().run();
    } else {
      editor?.chain().focus().toggleOrderedList().run();
    }
  };

  // Import document handler
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.docx,.doc,.txt,.html';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !id) return;
      
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`http://localhost:5001/documents/${id}/import`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        });
        
        if (response.ok) {
          const data = await response.json();
          editor?.commands.setContent(data.content || '');
          setHasUnsavedChanges(true);
          console.log('✅ Import successful:', data);
          alert('Document imported successfully!');
        } else {
          let errorText = 'Unknown error';
          try {
            const errorData = await response.json();
            errorText = errorData.error || errorData.message || response.statusText;
          } catch (e) {
            try {
              errorText = await response.text() || response.statusText;
            } catch (e2) {
              errorText = `HTTP ${response.status}: ${response.statusText}`;
            }
          }
          console.error('❌ Import failed:', response.status, errorText);
          alert('Failed to import: ' + errorText);
        }
      } catch (error) {
        console.error('💥 Import error:', error);
        alert('Failed to import: ' + error.message);
      }
    };
    input.click();
  };

  // Save version handler
  const handleSaveVersion = async () => {
    if (!id || !editor) return;
    
    // Set flag to prevent auto-save during version creation
    isCreatingVersionRef.current = true;
    
    try {
      const content = editor.getHTML();
      const versionName = prompt('Enter version name:');
      
      // If user cancelled, don't proceed
      if (versionName === null) {
        console.log('Version save cancelled by user');
        return;
      }
      
      // Use default name if empty string
      const finalVersionName = versionName.trim() || `Version ${new Date().toLocaleString()}`;
      
      console.log('🔄 Saving version...');
      console.log('📝 Version name:', finalVersionName);
      
      // Use API service
      const data = await api.updateDocument(id, {
        content,
        save_version: true,
        version_name: finalVersionName
      });
      
      alert('Version saved successfully!');
      console.log('✅ Version saved:', data);
    } catch (error: any) {
      console.error('❌ Save version error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      alert('Failed to save version: ' + errorMessage);
    } finally {
      // Reset flag
      isCreatingVersionRef.current = false;
    }
  };

  // Insert Link
  const handleInsertLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run();
    }
  };
  
  // Upload image to server
  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const response = await fetch('http://localhost:5001/api/upload/image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };
  
  // Insert Image
  const handleInsertImage = () => {
    setShowImageDialog(true);
  };
  
  // Handle image upload or URL input
  const handleImageSubmit = async () => {
    setIsUploading(true);
    try {
      let src = '';
      
      if (imageFile) {
        // Upload file
        src = await uploadImage(imageFile);
      } else if (imageUrl) {
        // Use URL
        src = imageUrl;
      }
      
      if (src) {
        editor?.chain().focus().setImage({ src }).run();
        setShowImageDialog(false);
        setImageFile(null);
        setImageUrl('');
      }
    } catch (error) {
      console.error('Error inserting image:', error);
      alert('Failed to insert image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };
  
  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setImageFile(file);
        setImageUrl(''); // Clear URL if file is selected
      } else {
        alert('Please select an image file.');
      }
    }
  };
  
  // Insert Table
  const handleInsertTable = () => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };
  
  const handleUndo = () => editor?.chain().focus().undo().run();
  const handleRedo = () => editor?.chain().focus().redo().run();

  // Zoom handlers
  const handleZoomChange = (zoom: number) => {
    setZoomLevel(zoom);
  };

  const handleZoomIn = () => {
    const currentIndex = zoomLevels.indexOf(zoomLevel);
    if (currentIndex < zoomLevels.length - 1) {
      setZoomLevel(zoomLevels[currentIndex + 1]);
    }
  };

  const handleZoomOut = () => {
    const currentIndex = zoomLevels.indexOf(zoomLevel);
    if (currentIndex > 0) {
      setZoomLevel(zoomLevels[currentIndex - 1]);
    }
  };

  // ChatBot handlers
  const handleInsertTextFromBot = (text: string) => {
    if (editor && permission?.role !== 'viewer') {
      editor.chain().focus().insertContent(text).run();
      setHasUnsavedChanges(true);
    }
  };

  const handleReplaceTextFromBot = (text: string) => {
    if (editor && permission?.role !== 'viewer') {
      const selection = editor.state.selection;
      if (!selection.empty) {
        // Replace selected text
        editor.chain().focus().deleteSelection().insertContent(text).run();
      } else {
        // Insert at current position
        editor.chain().focus().insertContent(text).run();
      }
      setHasUnsavedChanges(true);
    }
  };

  const getCurrentDocumentContent = () => {
    return editor?.getHTML() || '';
  };

  // Wheel zoom handler
  const handleWheel = useCallback((e: WheelEvent) => {
    // Check if Ctrl (PC) or Cmd (Mac) is pressed
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      
      if (e.deltaY < 0) {
        // Zoom in
        handleZoomIn();
      } else {
        // Zoom out
        handleZoomOut();
      }
    }
  }, [zoomLevel, zoomLevels]);

  // Add wheel event listener for zoom
  useEffect(() => {
    const editorElement = document.querySelector('.ProseMirror');
    if (editorElement) {
      editorElement.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        editorElement.removeEventListener('wheel', handleWheel);
      };
    }
  }, [handleWheel]);

  // Broadcast content change for real-time collaboration
  const broadcastContentChange = useCallback((content: string) => {
    if (id && websocketService.isConnected()) {
      websocketService.sendContentChange(id, content);
    }
  }, [id, user]);

  // WebSocket event handlers
  useEffect(() => {
    if (!id || !user || !token) return;

    const documentId = id;

    // Connect WebSocket if not connected
    if (!websocketService.isConnected()) {
      console.log('Connecting WebSocket for document:', documentId);
      websocketService.connect(token);
    }

    // Listen for WebSocket events
    const handleJoined = (data: any) => {
      console.log('Joined document:', data);
      console.log('Active users from server:', data.active_users);
      setActiveUsers(data.active_users || []);
    };

    const handleContentChange = (data: any) => {
      console.log('📝 Received content update:', data);
      if (data.user_id !== user.id && editor) {
        // Update editor content without triggering onUpdate
        console.log('Updating editor content from other user');
        editor.commands.setContent(data.content, false);
      }
    };

    const handlePresenceJoined = (data: any) => {
      console.log('👋 User joined:', data);
      setActiveUsers(prev => {
        // Check if user already exists
        const exists = prev.some(u => u.user_id === data.user_id);
        if (!exists) {
          console.log('Adding new user to activeUsers:', [...prev, data]);
          return [...prev, data];
        }
        console.log('User already exists in activeUsers');
        return prev;
      });
    };

    const handlePresenceLeft = (data: any) => {
      console.log('👋 User left:', data);
      setActiveUsers(prev => prev.filter(u => u.user_id !== data.user_id));
    };

    const handleCursorUpdate = (data: any) => {
      // Update cursor position for other users
      setActiveUsers(prev => prev.map(user => 
        user.user_id === data.user_id 
          ? { ...user, cursor: data.cursor }
          : user
      ));
    };

    // Subscribe to events (Fix event names to match backend)
    websocketService.on('joined', handleJoined);
    websocketService.on('content.updated', handleContentChange); // Fixed: content.updated instead of content_change
    websocketService.on('presence.joined', handlePresenceJoined);
    websocketService.on('presence.left', handlePresenceLeft);
    websocketService.on('cursor.update', handleCursorUpdate); // Fixed: cursor.update instead of cursor_update

    // Join document room
    websocketService.joinDocument(documentId);

    // Cleanup
    return () => {
      websocketService.off('joined', handleJoined);
      websocketService.off('content.updated', handleContentChange); // Fixed: content.updated instead of content_change
      websocketService.off('presence.joined', handlePresenceJoined);
      websocketService.off('presence.left', handlePresenceLeft);
      websocketService.off('cursor.update', handleCursorUpdate); // Fixed: cursor.update instead of cursor_update
      websocketService.leaveDocument(documentId);
    };
  }, [id, user, editor, token]);

  // Load document when editor is ready
  useEffect(() => {
    if (editor && id && user) {
      loadDocument();
      loadPermissions();
    }
  }, [editor, id, user, loadDocument, loadPermissions]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, []);

  // Handle navigation away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Override Cmd+S (macOS) or Ctrl+S (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (permission?.role !== 'viewer') {
          handleSave();
        }
        return;
      }
      
      // Override Cmd+Z for undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && editor) {
        e.preventDefault();
        editor.chain().focus().undo().run();
        return;
      }
      
      // Override Cmd+Shift+Z for redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey && editor) {
        e.preventDefault();
        editor.chain().focus().redo().run();
        return;
      }
      
      // Delete selected image with Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && editor) {
        const { state } = editor;
        const { selection } = state;
        
        // Check if an image is selected (NodeSelection)
        if (selection instanceof NodeSelection && 
            selection.node.type.name === 'image') {
          e.preventDefault();
          editor.chain().focus().deleteSelection().run();
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editor, permission, handleSave]);

  if (!user) {
    return <div>Please log in to access this document.</div>;
  }

  if (loading) {
    return (
      <div className="editor-loading">
        <div className="loading-spinner"></div>
        <p>Loading document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="editor-error">
        <FaExclamationCircle />
        <h2>Error loading document</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!doc) {
    return <div>Document not found.</div>;
  }

  const isReadOnly = permission?.role === 'viewer';

  return (
    <div className="editor-page">
      {/* Header */}
      <div className="editor-header">
        <div className="header-left">
          <Tooltip content="Back to Dashboard" position="bottom">
            <button 
              className="back-button"
              onClick={() => navigate('/dashboard')}
            >
              <FaArrowLeft />
            </button>
          </Tooltip>
          
          <div className="document-title-container">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              className="document-title"
              placeholder="Untitled Document"
              disabled={isReadOnly}
            />
            {hasUnsavedChanges && <span className="unsaved-indicator">•</span>}
          </div>
        </div>

        <div className="header-center">
          <PresenceIndicator activeUsers={activeUsers} currentUserId={user?.id || 0} />
        </div>

        <div className="header-right">
          <div className="save-status">
            {isSaving ? (
              <span className="saving">
                <div className="saving-spinner"></div>
                Saving...
              </span>
            ) : lastSaved ? (
              <span className="saved">
                <FaCheckCircle />
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            ) : null}
          </div>

          <div className="header-actions">
            <Tooltip content="AI Writing Assistant" position="bottom">
              <button
                className={`action-button ${showChatBot ? 'active' : ''}`}
                onClick={() => setShowChatBot(!showChatBot)}
              >
                <FaRobot />
              </button>
            </Tooltip>
            
            {!isReadOnly && (
              <Tooltip content={isSaving ? "Saving..." : "Save Document (Cmd+S)"} position="bottom">
                <button 
                  className={`action-button ${isSaving ? 'saving' : ''}`}
                  onClick={handleSave}
                  disabled={isSaving || permission?.role === 'viewer'}
                >
                  <FaSave />
                  {isSaving && <span className="saving-text">Saving...</span>}
                </button>
              </Tooltip>
            )}
            
            <Tooltip content="Version History" position="bottom">
              <button 
                className="action-button"
                onClick={() => setShowVersionHistory(true)}
              >
                <FaClock />
              </button>
            </Tooltip>

            <Tooltip content="Share Document" position="bottom">
              <button 
                className="action-button"
                onClick={() => setShowShareDialog(true)}
              >
                <FaUsers />
              </button>
            </Tooltip>
            
            <Tooltip content="Export to DOCX" position="bottom">
              <button 
                className="action-button"
                onClick={handleExport}
              >
                <FaDownload />
              </button>
            </Tooltip>

            {!isReadOnly && (
              <Tooltip content="Import Document" position="bottom">
                <button 
                  className="action-button"
                  onClick={handleImport}
                >
                  <FaUpload />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="editor-toolbar-container">
        {!isReadOnly && (
          <div className="editor-toolbar">
            {/* File Operations */}
            <div className="toolbar-group">
              <Tooltip content="Save Version" position="top">
                <button
                  className="toolbar-button"
                  onClick={handleSaveVersion}
                >
                  Save Version
                </button>
              </Tooltip>
            </div>

            {/* Font Controls */}
            <div className="toolbar-group">
              <select 
                className="toolbar-select font-family-select"
                value={editor?.getAttributes('textStyle')?.fontFamily || 'Arial'}
                onChange={(e) => {
                  editor?.chain().focus().setMark('textStyle', { fontFamily: e.target.value }).run();
                }}
              >
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Georgia">Georgia</option>
                <option value="Verdana">Verdana</option>
                <option value="Courier New">Courier New</option>
                <option value="Comic Sans MS">Comic Sans MS</option>
                <option value="Impact">Impact</option>
              </select>

              <select 
                className="toolbar-select font-size-select"
                value={editor?.getAttributes('textStyle')?.fontSize || '11pt'}
                onChange={(e) => {
                  editor?.chain().focus().setMark('textStyle', { fontSize: e.target.value }).run();
                }}
              >
                <option value="8pt">8</option>
                <option value="9pt">9</option>
                <option value="10pt">10</option>
                <option value="11pt">11</option>
                <option value="12pt">12</option>
                <option value="14pt">14</option>
                <option value="16pt">16</option>
                <option value="18pt">18</option>
                <option value="20pt">20</option>
                <option value="22pt">22</option>
                <option value="24pt">24</option>
                <option value="26pt">26</option>
                <option value="28pt">28</option>
                <option value="36pt">36</option>
                <option value="48pt">48</option>
                <option value="72pt">72</option>
              </select>
            </div>

            {/* Basic Formatting */}
            <div className="toolbar-group">
              <Tooltip content="Bold (Ctrl+B)" position="top">
                <button
                  className={`toolbar-button ${editor?.isActive('bold') ? 'active' : ''}`}
                  onClick={handleBold}
                >
                  <FaBold />
                </button>
              </Tooltip>
              
              <Tooltip content="Italic (Ctrl+I)" position="top">
                <button
                  className={`toolbar-button ${editor?.isActive('italic') ? 'active' : ''}`}
                  onClick={handleItalic}
                >
                  <FaItalic />
                </button>
              </Tooltip>
              
              <Tooltip content="Underline (Ctrl+U)" position="top">
                <button
                  className={`toolbar-button ${editor?.isActive('underline') ? 'active' : ''}`}
                  onClick={handleUnderline}
                >
                  <FaUnderline />
                </button>
              </Tooltip>
              
              <Tooltip content="Strikethrough" position="top">
                <button
                  className={`toolbar-button ${editor?.isActive('strike') ? 'active' : ''}`}
                  onClick={handleStrike}
                >
                  <FaStrikethrough />
                </button>
              </Tooltip>
            </div>

            {/* Text Alignment */}
            <div className="toolbar-group">
              <Tooltip content="Align Left" position="top">
                <button
                  className={`toolbar-button ${editor?.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
                  onClick={() => handleAlign('left')}
                >
                  <FaAlignLeft />
                </button>
              </Tooltip>
              
              <Tooltip content="Align Center" position="top">
                <button
                  className={`toolbar-button ${editor?.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
                  onClick={() => handleAlign('center')}
                >
                  <FaAlignCenter />
                </button>
              </Tooltip>
              
              <Tooltip content="Align Right" position="top">
                <button
                  className={`toolbar-button ${editor?.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
                  onClick={() => handleAlign('right')}
                >
                  <FaAlignRight />
                </button>
              </Tooltip>
              
              <Tooltip content="Justify" position="top">
                <button
                  className={`toolbar-button ${editor?.isActive({ textAlign: 'justify' }) ? 'active' : ''}`}
                  onClick={() => handleAlign('justify')}
                >
                  <FaAlignJustify />
                </button>
              </Tooltip>
            </div>

            {/* Lists */}
            <div className="toolbar-group">
              <Tooltip content="Bullet List" position="top">
                <button
                  className={`toolbar-button ${editor?.isActive('bulletList') ? 'active' : ''}`}
                  onClick={handleBulletList}
                >
                  <FaListUl />
                </button>
              </Tooltip>
              
              <Tooltip content="Numbered List" position="top">
                <button
                  className={`toolbar-button ${editor?.isActive('orderedList') ? 'active' : ''}`}
                  onClick={handleOrderedList}
                >
                  <FaListOl />
                </button>
              </Tooltip>
            </div>

            {/* Insert Elements */}
            <div className="toolbar-group">
              <Tooltip content="Insert Link" position="top">
                <button
                  className="toolbar-button"
                  onClick={handleInsertLink}
                >
                  <FaLink />
                </button>
              </Tooltip>
              
              <Tooltip content="Insert Image" position="top">
                <button
                  className="toolbar-button"
                  onClick={handleInsertImage}
                >
                  <FaImage />
                </button>
              </Tooltip>
              
              <Tooltip content="Insert Table" position="top">
                <button
                  className="toolbar-button"
                  onClick={handleInsertTable}
                >
                  <FaTable />
                </button>
              </Tooltip>
            </div>

            {/* Undo/Redo */}
            <div className="toolbar-group">
              <Tooltip content="Undo (Ctrl+Z)" position="top">
                <button
                  className="toolbar-button"
                  onClick={handleUndo}
                  disabled={!editor?.can().undo()}
                >
                  <FaUndo />
                </button>
              </Tooltip>
              
              <Tooltip content="Redo (Ctrl+Y)" position="top">
                <button
                  className="toolbar-button"
                  onClick={handleRedo}
                  disabled={!editor?.can().redo()}
                >
                  <FaRedo />
                </button>
              </Tooltip>
            </div>

            {/* Zoom Controls */}
            <div className="toolbar-group zoom-controls">
              <Tooltip content="Zoom Out" position="top">
                <button
                  className="toolbar-button"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 50}
                >
                  <FaSearchMinus />
                </button>
              </Tooltip>
              
              <select
                className="zoom-select"
                value={zoomLevel}
                onChange={(e) => handleZoomChange(parseInt(e.target.value))}
              >
                {zoomLevels.map(zoom => (
                  <option key={zoom} value={zoom}>{zoom}%</option>
                ))}
              </select>
              
              <Tooltip content="Zoom In" position="top">
                <button
                  className="toolbar-button"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 200}
                >
                  <FaSearchPlus />
                </button>
              </Tooltip>
              
              {/* <Tooltip content={isPaginated ? "Continuous View" : "Page View"} position="top">
                <button
                  className={`toolbar-button ${isPaginated ? 'active' : ''}`}
                  onClick={togglePagination}
                >
                  📄
                </button>
              </Tooltip> */}
            </div>
            
            {/* Comments */}
            <div className="toolbar-group">
              <Tooltip content="Comments" position="top">
                <button
                  className={`toolbar-button ${isCommentsOpen ? 'active' : ''}`}
                  onClick={() => setIsCommentsOpen(!isCommentsOpen)}
                >
                  <FaComment />
                </button>
              </Tooltip>
            </div>

            {/* AI Writing Assistant */}
            {/* <div className="toolbar-group">
              <Tooltip content="AI Writing Assistant" position="top">
                <button
                  className={`toolbar-button ${showChatBot ? 'active' : ''}`}
                  onClick={() => setShowChatBot(!showChatBot)}
                >
                  <FaRobot />
                </button>
              </Tooltip>
            </div> */}

            {/* Keyboard Shortcuts */}
            <div className="toolbar-group">
              <KeyboardShortcuts />
            </div>
          </div>
        )}
      </div>

      {/* Main Editor Area */}
      <div className="editor-main">
        <div className="editor-content-area">
          <div 
            className={`document-container ${isPaginated ? 'paginated' : ''} ${zoomLevel !== 100 ? 'zoom-applied' : ''}`}
            style={{ 
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'center top'
            }}
          >
            {isPaginated ? (
              <div className="document-pages">
                {Array.from({ length: totalPages }, (_, index) => (
                  <div key={index} className="document-page">
                    <div className="page-content">
                      {index === 0 ? (
                        <div ref={editorRef}>
                          <EditorContent editor={editor} />
                          
                          {/* Cursor Overlay for collaborative editing */}
                          <CursorOverlay 
                            activeUsers={activeUsers.filter(u => u.user_id !== user?.id)}
                            editorElement={editorRef.current?.querySelector('.ProseMirror') as HTMLElement}
                          />
                        </div>
                      ) : (
                        <div style={{ height: '100%', overflow: 'hidden' }}>
                          {/* Additional pages content will flow here */}
                        </div>
                      )}
                    </div>
                    <div className="page-number">Page {index + 1}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="document-page">
                <div className="page-content" ref={editorRef}>
                  <EditorContent editor={editor} />
                  
                  {/* Cursor Overlay for collaborative editing */}
                  <CursorOverlay 
                    activeUsers={activeUsers.filter(u => u.user_id !== user?.id)}
                    editorElement={editorRef.current?.querySelector('.ProseMirror') as HTMLElement}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Comments Sidebar */}
        <CommentsSidebar 
          show={showComments}
          onHide={() => setShowComments(false)}
          documentId={id || ''}
          currentUserId={user?.id || 0}
        />
      </div>

      {/* User Role Badge */}
      <div className={`user-role-badge ${permission?.role || 'viewer'}`}>
        <FaUserCircle />
        {permission?.role === 'owner' ? 'Owner' : 
         permission?.role === 'editor' ? 'Editor' : 'Viewer'}
      </div>

      {/* Modals */}
      <ErrorBoundary>
        <ShareDialog
          show={showShareDialog}
          onHide={() => setShowShareDialog(false)}
          document={doc!}
          permissions={permissions}
          onPermissionsUpdate={loadPermissions}
        />
      </ErrorBoundary>
      
      <VersionHistoryModal
        show={showVersionHistory}
        onHide={() => setShowVersionHistory(false)}
        documentId={id || ''}
        onRestore={async (version) => {
          // Reload document after restore
          await loadDocument();
          console.log('Document reloaded after restore');
        }}
      />

      {/* Image Upload Dialog */}
      {showImageDialog && (
        <div className="modal-overlay" onClick={() => setShowImageDialog(false)}>
          <div className="image-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Insert Image</h3>
              <button 
                className="close-button"
                onClick={() => setShowImageDialog(false)}
              >
                ×
              </button>
            </div>
            
            <div className="dialog-content">
              <div className="upload-option">
                <h4>Upload Image File</h4>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="file-input"
                />
                {imageFile && (
                  <div className="file-preview">
                    <span>Selected: {imageFile.name}</span>
                  </div>
                )}
              </div>
              
              <div className="divider">
                <span>OR</span>
              </div>
              
              <div className="url-option">
                <h4>Enter Image URL</h4>
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="url-input"
                />
              </div>
            </div>
            
            <div className="dialog-actions">
              <button 
                className="btn-cancel"
                onClick={() => setShowImageDialog(false)}
                disabled={isUploading}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={handleImageSubmit}
                disabled={isUploading || (!imageFile && !imageUrl)}
              >
                {isUploading ? 'Uploading...' : 'Insert Image'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Controls */}
      {isPaginated && totalPages > 1 && (
        <div className="page-controls">
          <div className="page-navigation">
            <button
              className="page-nav-btn"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              ←
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="page-nav-btn"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Comments Sidebar */}
      {isCommentsOpen && (
        <CommentsSidebar
          show={isCommentsOpen}
          onHide={() => setIsCommentsOpen(false)}
          documentId={id || ''}
          currentUserId={user?.id || 0}
        />
      )}

      {/* AI Writing Assistant ChatBot */}
      <ChatBot
        show={showChatBot}
        onHide={() => setShowChatBot(false)}
        documentContent={getCurrentDocumentContent()}
        onInsertText={handleInsertTextFromBot}
        onReplaceText={handleReplaceTextFromBot}
      />
    </div>
  );
}