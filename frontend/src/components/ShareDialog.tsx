import { useState } from 'react';
import { Modal, Button, Form, ListGroup, Badge, Spinner } from 'react-bootstrap';
import api from '@/services/api';
import { Document, Permission } from '@/types';
import { MdContentCopy } from 'react-icons/md';

interface ShareDialogProps {
  show: boolean;
  onHide: () => void;
  document: Document;
  permissions: Permission[];
  onPermissionsUpdate: () => void;
}

export default function ShareDialog({ show, onHide, document, permissions, onPermissionsUpdate }: ShareDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ensure permissions is always an array
  const safePermissions = Array.isArray(permissions) ? permissions : [];

  const handleShareByEmail = async () => {
    if (!email) {
      setError('Please enter an email address');
      return;
    }

    setIsSharing(true);
    setError(null);

    try {
      await api.shareDocumentByEmail(document.id, email, role);
      setEmail('');
      setRole('viewer');
      onPermissionsUpdate();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to share document');
    } finally {
      setIsSharing(false);
    }
  };

  const handleGenerateLink = async () => {
    setIsGeneratingLink(true);
    setError(null);

    try {
      const { share_url } = await api.generateShareLink(document.id);
      setShareLink(share_url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate link');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      alert('Link copied to clipboard!');
    }
  };

  const handleRemovePermission = async (permissionId: number) => {
    if (!confirm('Remove this user\'s access?')) return;

    try {
      await api.removePermission(document.id, permissionId);
      onPermissionsUpdate();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove permission');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'primary';
      case 'editor': return 'success';
      case 'viewer': return 'secondary';
      default: return 'light';
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {document.role === 'viewer' ? 'Document Access' : `Share "${document.title}"`}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <div className="alert alert-danger alert-dismissible" role="alert">
            {error}
            <button type="button" className="btn-close" onClick={() => setError(null)}></button>
          </div>
        )}

        {/* Only show share options for Editor and Owner */}
        {document.role !== 'viewer' && (
          <>
            {/* Share by Email */}
            <div className="mb-4">
              <h6 className="mb-3">Share with people</h6>
              <div className="d-flex gap-2">
                <Form.Control
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleShareByEmail()}
                />
                <Form.Select 
                  value={role} 
                  onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}
                  style={{ width: '150px' }}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </Form.Select>
                <Button 
                  variant="primary" 
                  onClick={handleShareByEmail}
                  disabled={isSharing}
                  style={{ minWidth: '100px' }}
                >
                  {isSharing ? <Spinner size="sm" animation="border" /> : 'Share'}
                </Button>
              </div>
              <Form.Text className="text-muted d-block mt-2">
                User will be notified by email and can access the document immediately
              </Form.Text>
            </div>

            {/* Share by Link */}
            <div className="mb-4">
              <h6 className="mb-3">Share via link</h6>
              {!shareLink ? (
                <Button 
                  variant="outline-primary" 
                  onClick={handleGenerateLink}
                  disabled={isGeneratingLink}
                >
                  {isGeneratingLink ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-2" />
                      Generating...
                    </>
                  ) : (
                    'Generate Public Link'
                  )}
                </Button>
              ) : (
                <div className="d-flex gap-2">
              <Form.Control value={shareLink} readOnly />
              <Button variant="outline-secondary" onClick={handleCopyLink}>
                <div className="d-flex align-items-center gap-1">
                  <MdContentCopy className="w-4 h-4" />
                  Copy
                </div>
              </Button>
            </div>
          )}
          <Form.Text className="text-muted d-block mt-2">
            Anyone with the link can view this document
          </Form.Text>
        </div>
          </>
        )}

        {/* Viewer sees info message */}
        {document.role === 'viewer' && (
          <div className="alert alert-info" role="alert">
            <strong>ℹ️ View-Only Access</strong>
            <p className="mb-0 small">You can see who has access to this document, but you cannot share it or modify permissions.</p>
          </div>
        )}

        {/* Current Collaborators */}
        <div>
          <h6 className="mb-3">People with access ({safePermissions.length})</h6>
          <ListGroup>
            {safePermissions.map((permission) => (
              <ListGroup.Item 
                key={permission.id}
                className="d-flex justify-content-between align-items-center"
              >
                <div className="d-flex align-items-center">
                  <img
                    src={permission.user?.avatar_url || 'https://via.placeholder.com/40'}
                    alt={permission.user?.display_name}
                    className="rounded-circle me-3"
                    style={{ width: '40px', height: '40px' }}
                  />
                  <div>
                    <div className="fw-bold">{permission.user?.display_name}</div>
                    <small className="text-muted">{permission.user?.email}</small>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <Badge bg={getRoleBadgeColor(permission.role)}>
                    {permission.role}
                  </Badge>
                  {/* Only Owner/Editor can remove collaborators */}
                  {permission.role !== 'owner' && document.role !== 'viewer' && (
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleRemovePermission(permission.id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
