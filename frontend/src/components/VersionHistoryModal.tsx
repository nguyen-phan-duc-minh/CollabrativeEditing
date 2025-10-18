import { useState, useEffect } from 'react';
import { Modal, Button, ListGroup, Badge, Spinner } from 'react-bootstrap';
import api from '@/services/api';
import { Version } from '@/types';
import { MdPerson } from 'react-icons/md';

interface VersionHistoryModalProps {
  show: boolean;
  onHide: () => void;
  documentId: string;
  onRestore?: (version: Version) => void;
}

export default function VersionHistoryModal({ 
  show, 
  onHide, 
  documentId, 
  onRestore 
}: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');

  const loadVersions = async () => {
    setIsLoading(true);
    try {
      const { versions: loadedVersions, current_version } = await api.getVersionHistory(documentId);
      setVersions(loadedVersions);
      setCurrentVersion(current_version);
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (show && documentId) {
      loadVersions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, documentId]);

  const handlePreview = (version: Version) => {
    setSelectedVersion(version);
    setPreviewContent(version.snapshot_content || 'No content available');
  };

  const handleRestore = async () => {
    if (!selectedVersion) return;

    if (!confirm(`Restore document to version ${selectedVersion.version_no}?`)) return;

    try {
      await api.restoreVersion(documentId, selectedVersion.version_no);
      alert('Version restored successfully!');
      onRestore?.(selectedVersion);
      onHide();
    } catch (error) {
      console.error('Failed to restore version:', error);
      alert('Failed to restore version');
    }
  };

  const handleDelete = async (version: Version) => {
    if (!confirm(`Delete version ${version.version_no}? This action cannot be undone.`)) return;

    setIsDeleting(true);
    try {
      await api.deleteVersion(documentId, version.version_no);
      alert('Version deleted successfully!');
      setSelectedVersion(null); // Clear selection
      loadVersions(); // Reload versions list
    } catch (error: any) {
      console.error('Failed to delete version:', error);
      
      // Show specific error message if available
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to delete version';
      alert(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeDiff = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return formatDate(dateString);
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Version History</Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {isLoading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 text-muted">Loading version history...</p>
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-5">
            <p className="text-muted mb-0">No version history available</p>
            <small className="text-muted">Versions are created automatically as you edit</small>
          </div>
        ) : (
          <div className="row">
            {/* Versions List */}
            <div className="col-md-5 border-end">
              <ListGroup variant="flush">
                {versions.map((version) => (
                  <ListGroup.Item
                    key={version.id}
                    action
                    active={selectedVersion?.id === version.id}
                    onClick={() => handlePreview(version)}
                    className="d-flex justify-content-between align-items-start"
                  >
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center mb-1">
                        <strong className="me-2">Version {version.version_no}</strong>
                        {version.version_no === currentVersion && (
                          <Badge bg="success" pill>Current</Badge>
                        )}
                      </div>
                      <div className="small text-muted">
                        <div className="d-flex align-items-center gap-2">
                          {/* <MdPerson className="w-4 h-4" /> */}
                          {version.created_by_user?.display_name || 'Unknown'}
                        </div>
                        <div>{getTimeDiff(version.created_at)}</div>
                      </div>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </div>

            {/* Preview Panel */}
            <div className="col-md-7">
              {selectedVersion ? (
                <div>
                  <div className="mb-3">
                    <h6 className="fw-bold">Version {selectedVersion.version_no}</h6>
                    <small className="text-muted">
                      Created by {selectedVersion.created_by_user?.display_name || 'Unknown'}<br />
                      {formatDate(selectedVersion.created_at)}
                    </small>
                  </div>

                  {selectedVersion.snapshot_content ? (
                    <div 
                      className="border rounded p-3 bg-light" 
                      style={{ 
                        maxHeight: '300px', 
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word'
                      }}
                    >
                      <div dangerouslySetInnerHTML={{ __html: selectedVersion.snapshot_content }} />
                    </div>
                  ) : (
                    <div className="text-center text-muted py-5">
                      <p>No preview available</p>
                      <small>This version doesn't have saved content</small>
                    </div>
                  )}

                  {selectedVersion.version_no !== currentVersion && (
                    <div className="mt-3 d-flex gap-2">
                      <Button 
                        variant="primary" 
                        size="sm"
                        onClick={handleRestore}
                      >
                        Restore This Version
                      </Button>
                      <Button 
                        variant="outline-danger" 
                        size="sm"
                        onClick={() => handleDelete(selectedVersion)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Deleting...
                          </>
                        ) : (
                          'Delete Version'
                        )}
                      </Button>
                      {/* <div className="small text-muted mt-2">
                        <p className="mb-0">Restore will replace the current document with this version</p>
                        <p className="mb-0">Delete will permanently remove this version</p>
                      </div> */}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted py-5">
                  <p className="mb-0">Select a version to preview</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
