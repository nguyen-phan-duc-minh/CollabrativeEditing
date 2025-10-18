import React, { useState, useEffect } from 'react';
import { Document } from '../types';
import api from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/index';
import NotificationCenter from '../components/NotificationCenter';
import WorkspaceModal from '../components/WorkspaceModal';
import { MdAdd, MdDescription, MdMoreVert, MdSearch, MdViewModule, MdViewList, MdPerson,
  MdAccessTime, MdApps, MdAccountCircle, MdMenu, MdLogout, MdEdit, MdDelete, MdShare,
  MdContentCopy, MdCheck, MdClose, MdGroup, MdFolder, MdBusiness } from 'react-icons/md';
import './DashboardPage.css'; // Import custom CSS

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'modified' | 'created' | 'name'>('modified');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showDocumentMenu, setShowDocumentMenu] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] = useState<string | null>(null);
  const [newDocumentTitle, setNewDocumentTitle] = useState('');
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'personal' | 'workspace'>('personal');
  const [selectedWorkspace, setSelectedWorkspace] = useState<any>(null);

  useEffect(() => {
    loadDocuments();
    loadWorkspaces();
    // Load user if not already loaded
    if (!user && localStorage.getItem('token')) {
      // Try to get user from auth store
      console.log('Loading user from auth store');
    }
  }, [user]);

  useEffect(() => {
    // Close user menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (showUserMenu) {
        setShowUserMenu(false);
      }
      if (showDocumentMenu) {
        setShowDocumentMenu(null);
      }
    };

    if (showUserMenu || showDocumentMenu) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showUserMenu, showDocumentMenu]);

  const loadDocuments = async () => {
    try {
      const response = await api.getDocuments();
      setDocuments(response.documents || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspaces = async () => {
    try {
      const response = await api.getWorkspaces();
      setWorkspaces(response.workspaces || []);
    } catch (error) {
      console.error('Error loading workspaces:', error);
    }
  };

  const handleCreateDocument = async () => {
    console.log('Create document clicked!');
    try {
      setLoading(true);
      const createData = {
        title: 'Untitled Document',
        type: 'doc',
        ...(selectedWorkspace && { workspace_id: selectedWorkspace.id })
      };
      
      const response = await api.createDocument(createData);
      console.log('Document created:', response);
      if (response.document) {
        navigate(`/editor/${response.document.id}`);
      }
    } catch (error) {
      console.error('Error creating document:', error);
      alert('Lỗi tạo tài liệu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = () => {
    setEditingWorkspace(null);
    setShowWorkspaceModal(true);
  };

  const handleEditWorkspace = (workspace: any) => {
    setEditingWorkspace(workspace);
    setShowWorkspaceModal(true);
  };

  const handleSaveWorkspace = async (workspaceData: any) => {
    try {
      if (editingWorkspace) {
        await api.updateWorkspace(editingWorkspace.id, workspaceData);
      } else {
        await api.createWorkspace(workspaceData);
      }
      loadWorkspaces();
    } catch (error) {
      console.error('Error saving workspace:', error);
      throw error;
    }
  };

  const handleDeleteWorkspace = async (workspaceId: number) => {
    try {
      await api.deleteWorkspace(workspaceId);
      loadWorkspaces();
      if (selectedWorkspace?.id === workspaceId) {
        setSelectedWorkspace(null);
        setCurrentView('personal');
      }
    } catch (error) {
      console.error('Error deleting workspace:', error);
      throw error;
    }
  };

  const handleAddWorkspaceMember = async (workspaceId: number, email: string) => {
    try {
      await api.addWorkspaceMember(workspaceId, email);
      loadWorkspaces();
    } catch (error) {
      console.error('Error adding member:', error);
      throw error;
    }
  };

  const handleRemoveWorkspaceMember = async (workspaceId: number, memberId: number) => {
    try {
      await api.removeWorkspaceMember(workspaceId, memberId);
      loadWorkspaces();
    } catch (error) {
      console.error('Error removing member:', error);
      throw error;
    }
  };

  const handleLogout = () => {
    console.log('Logout clicked!');
    logout();
    navigate('/');
  };

  const handleMenuClick = () => {
    console.log('Menu clicked!');
    // Implement menu functionality
  };

  const handleAppsClick = () => {
    console.log('Apps clicked!');
    // Implement apps menu
  };

  const handleDocumentMenuClick = (docId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Document menu clicked for doc:', docId);
    setShowDocumentMenu(showDocumentMenu === docId ? null : docId);
  };

  const handleRenameDocument = async (docId: string, currentTitle: string) => {
    setEditingDocument(docId);
    setNewDocumentTitle(currentTitle);
    setShowDocumentMenu(null);
  };

  const handleSaveRename = async (docId: string) => {
    try {
      await api.updateDocument(docId, { title: newDocumentTitle });
      setDocuments(prev => prev.map(doc => 
        doc.id === docId ? { ...doc, title: newDocumentTitle } : doc
      ));
      setEditingDocument(null);
      setNewDocumentTitle('');
    } catch (error) {
      console.error('Error renaming document:', error);
      alert('Lỗi đổi tên tài liệu');
    }
  };

  const handleCancelRename = () => {
    setEditingDocument(null);
    setNewDocumentTitle('');
  };

  const handleDeleteDocument = async (docId: string) => {
    if (confirm('Bạn có chắc muốn xóa tài liệu này?')) {
      try {
        await api.deleteDocument(docId);
        setDocuments(prev => prev.filter(doc => doc.id !== docId));
        setShowDocumentMenu(null);
      } catch (error) {
        console.error('Error deleting document:', error);
        alert('Lỗi xóa tài liệu');
      }
    }
  };

  const handleShareDocument = (docId: string) => {
    console.log('Share document:', docId);
    setShowDocumentMenu(null);
    // Implement share functionality
    alert('Tính năng chia sẻ sẽ được implement sau');
  };

  const handleDuplicateDocument = async (docId: string) => {
    try {
      const docToDuplicate = documents.find(doc => doc.id === docId);
      if (docToDuplicate) {
        const response = await api.createDocument({
          title: `${docToDuplicate.title} - Copy`,
          type: docToDuplicate.type,
          content: docToDuplicate.content
        });
        if (response.document) {
          setDocuments(prev => [response.document, ...prev]);
        }
      }
      setShowDocumentMenu(null);
    } catch (error) {
      console.error('Error duplicating document:', error);
      alert('Lỗi sao chép tài liệu');
    }
  };

  const filteredDocuments = documents
    .filter(doc => {
      // Filter by search query
      if (!doc.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Filter by current view
      if (currentView === 'personal') {
        // Personal view: only documents NOT in any workspace
        return !doc.workspace_id;
      } else if (currentView === 'workspace' && selectedWorkspace) {
        // Workspace view: only documents in selected workspace
        return doc.workspace_id === selectedWorkspace.id;
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.title.localeCompare(b.title);
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString('vi-VN', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    }
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          {/* Left section */}
                    {/* Left section */}
          <div className="header-left">
            {/* <button className="menu-btn" onClick={handleMenuClick}>
              <MdMenu className="icon-md" />
            </button> */}
            <div className="logo-section">
             <div className="docs-icon">
                <MdDescription className="icon-lg" />
              </div>
              <span className="app-title">Tài liệu</span>
            </div>
          </div>
          
          {/* Center section - Search */}
          {/* <div className="header-center">
            <div className="search-container">
              <div className="search-icon">
                <MdSearch className="icon-sm" />
              </div>
              <input
                type="text"
                placeholder="Tìm kiếm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div> */}
          
          {/* Right section */}
          <div className="header-right">
            <div className="search-container">
              <div className="search-icon">
                <MdSearch className="icon-sm" />
              </div>
              <input
                type="text"
                placeholder="Tìm kiếm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            {/* <button className="icon-btn" onClick={handleAppsClick}>
              <MdApps className="icon-md" />
            </button> */}
            
            {/* Notifications */}
            <NotificationCenter />
            
            <div className="user-menu-container">
              <button 
                className="avatar-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUserMenu(!showUserMenu);
                }}
              >
                {user?.avatar_url ? (
                  <img 
                    src={user.avatar_url} 
                    alt={user.display_name || 'User'} 
                    className="user-avatar-img"
                  />
                ) : (
                  <MdAccountCircle className="user-avatar-icon" />
                )}
              </button>
              
              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="user-info">
                    <div className="user-name">{user?.display_name || 'User'}</div>
                    <div className="user-email">{user?.email || ''}</div>
                  </div>
                  <hr className="dropdown-divider" />
                  <button className="dropdown-item dropdown-logout" onClick={handleLogout}>
                    <MdLogout className="icon-sm icon-logout"/>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <nav className="sidebar-nav">
          <button
            className={`nav-item ${currentView === 'personal' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('personal');
              setSelectedWorkspace(null);
            }}
          >
            <MdPerson className="nav-icon" />
            <span>Tài liệu cá nhân</span>
          </button>
          
          <div className="nav-section">
            <div className="nav-section-header">
              <span>Workspace</span>
              <button
                className="create-workspace-btn"
                onClick={handleCreateWorkspace}
                title="Tạo workspace mới"
              >
                <MdAdd />
              </button>
            </div>
            
            {workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className={`nav-item workspace-item ${
                  selectedWorkspace?.id === workspace.id ? 'active' : ''
                }`}
              >
                <button
                  className="workspace-content"
                  onClick={() => {
                    setCurrentView('workspace');
                    setSelectedWorkspace(workspace);
                  }}
                >
                  <MdBusiness className="nav-icon" />
                  <span className="workspace-name">{workspace.name}</span>
                </button>
                <button
                  className="workspace-menu-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditWorkspace(workspace);
                  }}
                >
                  <MdMoreVert />
                </button>
              </div>
            ))}
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Workspace header if in workspace view */}
        {currentView === 'workspace' && selectedWorkspace && (
          <div className="workspace-header">
            <h1 className="workspace-title">{selectedWorkspace.name}</h1>
            <p className="workspace-description">{selectedWorkspace.description}</p>
            <div className="workspace-stats">
              <span><MdGroup /> {selectedWorkspace.members?.length || 0} thành viên</span>
            </div>
          </div>
        )}

        {/* Start a new document section */}
        <section className="new-document-section">
          <h2 className="section-title">
            {currentView === 'workspace' ? 'Tạo tài liệu trong workspace' : 'Bắt đầu một tài liệu mới'}
          </h2>
          <div className="templates-container">
            {/* Create Document */}
            <div className="template-item">
              <button
                onClick={handleCreateDocument}
                className="template-btn"
              >
                <div className="template-preview">
                  <MdAdd className="add-icon" />
                  <div className="template-header"></div>
                </div>
              </button>
              <span className="template-label">Tài liệu trống</span>
            </div>
            
            {/* Create Workspace (only in personal view) */}
            {currentView === 'personal' && (
              <div className="template-item">
                <button
                  onClick={handleCreateWorkspace}
                  className="template-btn workspace-template"
                >
                  <div className="template-preview">
                    <MdBusiness className="add-icon" />
                    <div className="template-header"></div>
                  </div>
                </button>
                <span className="template-label">Tạo Workspace</span>
              </div>
            )}
          </div>
        </section>

        {/* Recent documents section */}
        <section className="recent-section">
          <div className="section-header">
            <h2 className="section-title">Tài liệu gần đây</h2>
            <div className="controls">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="sort-select"
              >
                <option value="modified">Đã mở gần đây nhất</option>
                <option value="name">Tên</option>
                <option value="created">Đã tạo</option>
              </select>
              
              <div className="view-controls">
                <button
                  onClick={() => setViewMode('list')}
                  className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                >
                  <MdViewList className="icon-sm" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                >
                  <MdViewModule className="icon-sm" />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <MdDescription />
              </div>
              <p className="empty-text">
                {searchQuery ? 'Không tìm thấy tài liệu nào' : 'Chưa có tài liệu nào'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="documents-grid">
              {filteredDocuments.map((doc) => (
                <div key={doc.id} className="document-card-container">
                  <Link
                    to={`/editor/${doc.id}`}
                    className="document-card"
                  >
                    <div className="card-preview">
                      <div className="doc-header"></div>
                      <div className="doc-content">
                        <div className="doc-lines">
                          <div className="doc-line full"></div>
                          <div className="doc-line medium"></div>
                          <div className="doc-line short"></div>
                          <div className="doc-line medium"></div>
                        </div>
                        {/* <div className="doc-icon-container">
                          <MdDescription className="doc-icon" />
                        </div> */}
                      </div>
                    </div>
                    <div className="card-footer">
                      {editingDocument === doc.id ? (
                        <div className="edit-title-container">
                          <input
                            type="text"
                            value={newDocumentTitle}
                            onChange={(e) => setNewDocumentTitle(e.target.value)}
                            className="edit-title-input"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(doc.id);
                              if (e.key === 'Escape') handleCancelRename();
                            }}
                          />
                          <div className="edit-title-actions">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleSaveRename(doc.id);
                              }}
                              className="save-btn"
                            >
                              <MdCheck className="icon-sm" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleCancelRename();
                              }}
                              className="cancel-btn"
                            >
                              <MdClose className="icon-sm" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h3 className="doc-title">{doc.title}</h3>
                          <div className="card-meta">
                            <div className="doc-time">
                              <MdAccessTime className="time-icon" />
                              <span>{formatDate(doc.updated_at)}</span>
                            </div>
                            <div className="more-menu-container">
                              <button 
                                className="more-btn"
                                onClick={(e) => handleDocumentMenuClick(doc.id, e)}
                              >
                                <MdMoreVert className="icon-sm" />
                              </button>
                              
                              {showDocumentMenu === doc.id && (
                                <div className="document-dropdown">
                                  <button
                                    className="dropdown-item"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleRenameDocument(doc.id, doc.title);
                                    }}
                                  >
                                    <MdEdit className="icon-sm" />
                                    Đổi tên
                                  </button>
                                  <button
                                    className="dropdown-item"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleDuplicateDocument(doc.id);
                                    }}
                                  >
                                    <MdContentCopy className="icon-sm" />
                                    Nhân bản
                                  </button>
                                  <button
                                    className="dropdown-item"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleShareDocument(doc.id);
                                    }}
                                  >
                                    <MdShare className="icon-sm" />
                                    Chia sẻ
                                  </button>
                                  <hr className="dropdown-divider" />
                                  <button
                                    className="dropdown-item danger"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleDeleteDocument(doc.id);
                                    }}
                                  >
                                    <MdDelete className="icon-sm" />
                                    Xóa
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="documents-list">
              {filteredDocuments.map((doc) => (
                <div key={doc.id} className="list-item-container">
                  <Link
                    to={`/editor/${doc.id}`}
                    className="list-item"
                  >
                    <div className="list-icon">
                      <div className="mini-doc">
                        <MdDescription className="mini-doc-icon" />
                      </div>
                    </div>
                    <div className="list-content">
                      {editingDocument === doc.id ? (
                        <div className="edit-title-container">
                          <input
                            type="text"
                            value={newDocumentTitle}
                            onChange={(e) => setNewDocumentTitle(e.target.value)}
                            className="edit-title-input"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(doc.id);
                              if (e.key === 'Escape') handleCancelRename();
                            }}
                          />
                          <div className="edit-title-actions">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleSaveRename(doc.id);
                              }}
                              className="save-btn"
                            >
                              <MdCheck className="icon-sm" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleCancelRename();
                              }}
                              className="cancel-btn"
                            >
                              <MdClose className="icon-sm" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <h3 className="list-title">{doc.title}</h3>
                      )}
                    </div>
                    <div className="list-meta">
                      <div className="meta-item">
                        <MdPerson className="meta-icon" />
                        <span>{doc.owner?.display_name || 'Tôi'}</span>
                      </div>
                      <div className="meta-item">
                        <MdAccessTime className="meta-icon" />
                        <span>{formatDate(doc.updated_at)}</span>
                      </div>
                    </div>
                    <div className="list-actions">
                      <div className="more-menu-container">
                        <button 
                          className="action-btn"
                          onClick={(e) => handleDocumentMenuClick(doc.id, e)}
                        >
                          <MdMoreVert className="icon-sm" />
                        </button>
                        
                        {showDocumentMenu === doc.id && (
                          <div className="document-dropdown">
                            <button
                              className="dropdown-item"
                              onClick={(e) => {
                                e.preventDefault();
                                handleRenameDocument(doc.id, doc.title);
                              }}
                            >
                              <MdEdit className="icon-sm" />
                              Đổi tên
                            </button>
                            <button
                              className="dropdown-item"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDuplicateDocument(doc.id);
                              }}
                            >
                              <MdContentCopy className="icon-sm" />
                              Sao chép
                            </button>
                            <button
                              className="dropdown-item"
                              onClick={(e) => {
                                e.preventDefault();
                                handleShareDocument(doc.id);
                              }}
                            >
                              <MdShare className="icon-sm" />
                              Chia sẻ
                            </button>
                            <hr className="dropdown-divider" />
                            <button
                              className="dropdown-item danger"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDeleteDocument(doc.id);
                              }}
                            >
                              <MdDelete className="icon-sm" />
                              Xóa
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className='blank-page'></section>
      </main>

      {/* Workspace Modal */}
      <WorkspaceModal
        isOpen={showWorkspaceModal}
        onClose={() => {
          setShowWorkspaceModal(false);
          setEditingWorkspace(null);
        }}
        workspace={editingWorkspace}
        onSave={handleSaveWorkspace}
        onDelete={handleDeleteWorkspace}
        onAddMember={handleAddWorkspaceMember}
        onRemoveMember={handleRemoveWorkspaceMember}
      />
    </div>
  );
}