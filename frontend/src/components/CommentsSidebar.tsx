import { useState, useEffect } from 'react';
import { Offcanvas, Button, Form, ListGroup, Badge, Toast } from 'react-bootstrap';
import api from '@/services/api';
import { Comment } from '@/types';
import { MdChat } from 'react-icons/md';
import { FaVideo, FaPhoneSquare, FaPhoneSlash } from 'react-icons/fa';
import websocketService from '@/services/websocket';
import VideoCall from './VideoCall';
import { useAuthStore } from '@/store';
import './CommentsSidebar.css';

interface CommentsSidebarProps {
  show: boolean;
  onHide: () => void;
  documentId: string;
  currentUserId: number;
}

export default function CommentsSidebar({ show, onHide, documentId, currentUserId }: CommentsSidebarProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [newCommentIds, setNewCommentIds] = useState<Set<number>>(new Set());
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [callNotification, setCallNotification] = useState<string>('');
  const [showCallNotification, setShowCallNotification] = useState(false);
  const [activeCallUsers, setActiveCallUsers] = useState<string[]>([]);
  
  const { user } = useAuthStore();

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjaJ0O/KeSsFJG7B7+aYPAgXXLLk64tIEw5Kmtjss3QbCDup3/LAbSkGLXfE8+OKNwgZYbTp66JNEwxCn+HtrGQbCD2Z1/LCaygFLHfH8N2QNwgZYLPl67JQEw5Knqz++Q==');
      audio.volume = 0.3;
      audio.play().catch(e => console.log('Could not play notification sound:', e));
    } catch (e) {
      console.log('Could not create notification sound:', e);
    }
  };

  const loadComments = async () => {
    setIsLoading(true);
    try {
      const { comments: loadedComments } = await api.getComments(documentId);
      setComments(loadedComments);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (show && documentId) {
      loadComments();
      
      // Listen for real-time comment events
      const handleNewComment = (data: any) => {
        if (data.document_id === documentId) {
          setComments(prev => [data.comment, ...prev]);
          
          // Show notification if not from current user
          if (data.user_id !== currentUserId) {
            // Mark as new comment for visual highlight
            setNewCommentIds(prev => new Set(prev.add(data.comment.id)));
            
            // Remove highlight after 5 seconds
            setTimeout(() => {
              setNewCommentIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(data.comment.id);
                return newSet;
              });
            }, 5000);
            
            console.log('📝 New comment from:', data.comment.author?.display_name);
          }
        }
      };

      const handleUpdatedComment = (data: any) => {
        if (data.document_id === documentId) {
          setComments(prev => prev.map(comment => 
            comment.id === data.comment.id ? data.comment : comment
          ));
        }
      };

      const handleDeletedComment = (data: any) => {
        if (data.document_id === documentId) {
          setComments(prev => prev.filter(comment => comment.id !== data.comment_id));
        }
      };

      // Video call event handlers
      const handleVideoCallStarted = (data: any) => {
        if (data.document_id === documentId && data.user_id !== currentUserId) {
          setCallNotification(`${data.user_name} started a video call`);
          setShowCallNotification(true);
          setActiveCallUsers(prev => [...prev.filter(u => u !== data.user_name), data.user_name]);
          
          // Play notification sound
          playNotificationSound();
          
          // Auto hide after 5 seconds
          setTimeout(() => setShowCallNotification(false), 5000);
        }
      };

      const handleVideoCallJoined = (data: any) => {
        if (data.document_id === documentId && data.user_id !== currentUserId) {
          setCallNotification(`${data.user_name} joined the video call`);
          setShowCallNotification(true);
          setActiveCallUsers(prev => [...prev.filter(u => u !== data.user_name), data.user_name]);
          
          setTimeout(() => setShowCallNotification(false), 3000);
        }
      };

      const handleVideoCallEnded = (data: any) => {
        if (data.document_id === documentId) {
          const userName = activeCallUsers.find((_, index) => index === data.user_id) || 'Someone';
          setCallNotification(`${userName} left the video call`);
          setShowCallNotification(true);
          setActiveCallUsers(prev => prev.filter((_, index) => index !== data.user_id));
          
          setTimeout(() => setShowCallNotification(false), 3000);
        }
      };

      websocketService.on('comment.new', handleNewComment);
      websocketService.on('comment.updated', handleUpdatedComment);
      websocketService.on('comment.deleted', handleDeletedComment);
      websocketService.on('video_call.started', handleVideoCallStarted);
      websocketService.on('video_call.joined', handleVideoCallJoined);
      websocketService.on('video_call.ended', handleVideoCallEnded);

      return () => {
        websocketService.off('comment.new', handleNewComment);
        websocketService.off('comment.updated', handleUpdatedComment);
        websocketService.off('comment.deleted', handleDeletedComment);
        websocketService.off('video_call.started', handleVideoCallStarted);
        websocketService.off('video_call.joined', handleVideoCallJoined);
        websocketService.off('video_call.ended', handleVideoCallEnded);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, documentId, currentUserId]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await api.createComment(documentId, {
        content: newComment,
        anchor: null // For now, no text selection
      });
      setNewComment('');
      await loadComments();
    } catch (error) {
      console.error('Failed to add comment:', error);
      alert('Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async (commentId: number) => {
    try {
      await api.resolveComment(commentId);
      await loadComments();
    } catch (error) {
      console.error('Failed to resolve comment:', error);
    }
  };

  const handleUnresolve = async (commentId: number) => {
    try {
      await api.unresolveComment(commentId);
      await loadComments();
    } catch (error) {
      console.error('Failed to unresolve comment:', error);
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm('Delete this comment?')) return;

    try {
      await api.deleteComment(commentId);
      await loadComments();
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const unresolvedComments = comments.filter(c => !c.resolved);
  const resolvedComments = comments.filter(c => c.resolved);

  return (
    <div>
      <Offcanvas show={show} onHide={onHide} placement="end" style={{ width: '400px' }}>
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>
            <div className="d-flex align-items-center justify-content-between w-100">
              <div className="d-flex align-items-center gap-2">
                <MdChat className="w-5 h-5" />
                Comments ({comments.length})
                {activeCallUsers.length > 0 && (
                  <Badge bg="success" className="ms-2 d-flex align-items-center">
                    <FaPhoneSquare className="me-1" size={12} />
                    {activeCallUsers.length} in call
                  </Badge>
                )}
              </div>
              {/* <div className="d-flex gap-1">
                <Button
                  variant={activeCallUsers.length > 0 ? "success" : "outline-primary"}
                  size="sm"
                  onClick={() => setShowVideoCall(true)}
                  className="me-3 video-call-btn"
                >
                  <FaVideo className="me-1" />
                  {activeCallUsers.length > 0 ? "Join Call" : "Video Call"}
                </Button>
              </div> */}
            </div>
          </Offcanvas.Title>
        </Offcanvas.Header>

      <Offcanvas.Body>
        {/* Add New Comment */}
        <div className="mb-4">
          <Form.Group>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={isSubmitting}
            />
          </Form.Group>
          <div className="d-flex justify-content-end mt-3">
            <Button
                variant="outline-primary"
                size="sm"
                onClick={() => setShowVideoCall(true)}
                className="me-3"
              >
                <FaVideo className="video-icon" />
                Video Call
              </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddComment}
              disabled={isSubmitting || !newComment.trim()}
            >
              {isSubmitting ? 'Adding...' : 'Add Comment'}
            </Button>
          </div>
        </div>

        <hr />

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        )}

        {/* No Comments */}
        {!isLoading && comments.length === 0 && (
          <div className="text-center text-muted py-5">
            <p className="mb-0">No comments yet</p>
            <small>Be the first to add a comment!</small>
          </div>
        )}

        {/* Unresolved Comments */}
        {!isLoading && unresolvedComments.length > 0 && (
          <div className="mb-4">
            <h6 className="text-muted mb-3">
              Active ({unresolvedComments.length})
            </h6>
            <ListGroup>
              {unresolvedComments.map((comment) => (
                <ListGroup.Item 
                  key={comment.id} 
                  className={`border-0 px-0 ${newCommentIds.has(comment.id) ? 'new-comment-highlight' : ''}`}
                >
                  <div className="d-flex align-items-start mb-2">
                    <img
                      src={comment.author?.avatar_url || 'https://via.placeholder.com/32'}
                      alt={comment.author?.display_name}
                      className="rounded-circle me-2"
                      style={{ width: '32px', height: '32px' }}
                    />
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <strong className="comment-author d-block">{comment.author?.display_name}</strong>
                          <small className="comment-timestamp">{formatDate(comment.created_at)}</small>
                        </div>
                        {comment.author_id === currentUserId && (
                          <Button
                            variant="link"
                            size="sm"
                            className="text-danger p-0"
                            onClick={() => handleDelete(comment.id)}
                          >
                            Thu hồi
                          </Button>
                        )}
                      </div>
                      <p className="comment-content mb-2 mt-2">{comment.content}</p>
                      <div className="comment-actions d-flex">
                        <Button
                          variant="outline-success"
                          size="sm"
                          onClick={() => handleResolve(comment.id)}
                        >
                          ✓ Resolve
                        </Button>
                      </div>
                    </div>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>
        )}

        {/* Resolved Comments */}
        {!isLoading && resolvedComments.length > 0 && (
          <div>
            <h6 className="text-muted mb-3">
              Resolved ({resolvedComments.length})
            </h6>
            <ListGroup>
              {resolvedComments.map((comment) => (
                <ListGroup.Item 
                  key={comment.id} 
                  className={`border-0 px-0 opacity-75 comment-resolved ${newCommentIds.has(comment.id) ? 'new-comment-highlight' : ''}`}
                >
                  <div className="d-flex align-items-start mb-2">
                    <img
                      src={comment.author?.avatar_url || 'https://via.placeholder.com/32'}
                      alt={comment.author?.display_name}
                      className="rounded-circle me-2"
                      style={{ width: '32px', height: '32px' }}
                    />
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <strong className="comment-author d-block">{comment.author?.display_name}</strong>
                          <small className="comment-timestamp">{formatDate(comment.created_at)}</small>
                        </div>
                        <Badge bg="success">Resolved</Badge>
                      </div>
                      <p className="comment-content mb-2 mt-2">{comment.content}</p>
                      <div className="comment-actions d-flex">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => handleUnresolve(comment.id)}
                        >
                          Reopen
                        </Button>
                        {comment.author_id === currentUserId && (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleDelete(comment.id)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>
        )}
        </Offcanvas.Body>
      </Offcanvas>

      {/* Video Call Modal */}
      <VideoCall
        show={showVideoCall}
        onHide={() => setShowVideoCall(false)}
        documentId={documentId}
        currentUserId={currentUserId}
        userName={user?.display_name || user?.email || 'Unknown User'}
      />

      {/* Video Call Notifications */}
      <div className="position-fixed" style={{ top: '20px', right: '20px', zIndex: 9999 }}>
        <Toast 
          show={showCallNotification} 
          onClose={() => setShowCallNotification(false)}
          className="video-call-notification"
          autohide={false}
        >
          <Toast.Header className="bg-primary text-white">
            <FaVideo className="me-2" />
            <strong className="me-auto">Video Call</strong>
          </Toast.Header>
          <Toast.Body className="d-flex align-items-center">
            <div className="flex-grow-1">
              {callNotification}
            </div>
            {callNotification.includes('started') && (
              <Button 
                size="sm" 
                variant="success" 
                onClick={() => {
                  setShowVideoCall(true);
                  setShowCallNotification(false);
                }}
                className="ms-2"
              >
                Join
              </Button>
            )}
          </Toast.Body>
        </Toast>
      </div>
    </div>
  );
}
