import React, { useState, useEffect } from 'react';
import { 
  FaFolder, FaFolderOpen, FaPlus, FaUsers, FaCog, 
  FaChevronDown, FaChevronRight, FaEllipsisV 
} from 'react-icons/fa';
import api from '../services/api';
import { TeamWorkspace, DocumentFolder } from '../types';
import './WorkspaceSidebar.css';

interface WorkspaceSidebarProps {
  selectedWorkspaceId: number | null;
  selectedFolderId: number | null;
  onWorkspaceSelect: (workspaceId: number | null) => void;
  onFolderSelect: (folderId: number | null) => void;
  onCreateFolder: (workspaceId: number | null, parentId?: number) => void;
}

export default function WorkspaceSidebar({
  selectedWorkspaceId,
  selectedFolderId,
  onWorkspaceSelect,
  onFolderSelect,
  onCreateFolder
}: WorkspaceSidebarProps) {
  const [workspaces, setWorkspaces] = useState<TeamWorkspace[]>([]);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<number>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [showCreateWorkspaceForm, setShowCreateWorkspaceForm] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspaceId) {
      loadFolders(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId]);

  const loadWorkspaces = async () => {
    try {
      const data = await api.getWorkspaces();
      setWorkspaces(data.workspaces || []);
    } catch (error) {
      console.error('Error loading workspaces:', error);
    }
  };

  const loadFolders = async (workspaceId: number) => {
    try {
      const data = await api.getFolders(workspaceId);
      setFolders(data.folders || []);
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;

    try {
      await api.createWorkspace({
        name: newWorkspaceName,
        description: '',
        is_private: false
      });
      setNewWorkspaceName('');
      setShowCreateWorkspaceForm(false);
      loadWorkspaces();
    } catch (error) {
      console.error('Error creating workspace:', error);
    }
  };

  const toggleWorkspace = (workspaceId: number) => {
    const newExpanded = new Set(expandedWorkspaces);
    if (newExpanded.has(workspaceId)) {
      newExpanded.delete(workspaceId);
    } else {
      newExpanded.add(workspaceId);
    }
    setExpandedWorkspaces(newExpanded);
  };

  const toggleFolder = (folderId: number) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFolder = (folder: DocumentFolder, level: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const hasChildren = folders.some(f => f.parent_folder_id === folder.id);
    const isSelected = selectedFolderId === folder.id;

    return (
      <div key={folder.id} className="folder-item">
        <div 
          className={`folder-header ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${20 + level * 16}px` }}
          onClick={() => onFolderSelect(folder.id)}
        >
          <div className="folder-info">
            {hasChildren && (
              <button
                className="expand-button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolder(folder.id);
                }}
              >
                {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
              </button>
            )}
            
            {isExpanded ? <FaFolderOpen /> : <FaFolder />}
            <span className="folder-name">{folder.name}</span>
          </div>
          
          <button 
            className="folder-menu-button"
            onClick={(e) => {
              e.stopPropagation();
              onCreateFolder(selectedWorkspaceId, folder.id);
            }}
            title="Add subfolder"
          >
            <FaPlus />
          </button>
        </div>

        {isExpanded && hasChildren && (
          <div className="folder-children">
            {folders
              .filter(f => f.parent_folder_id === folder.id)
              .map(childFolder => renderFolder(childFolder, level + 1))
            }
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="workspace-sidebar">
      <div className="sidebar-header">
        <h3>Workspaces</h3>
        <button 
          className="create-workspace-button"
          onClick={() => setShowCreateWorkspaceForm(true)}
          title="Create workspace"
        >
          <FaPlus />
        </button>
      </div>

      {showCreateWorkspaceForm && (
        <div className="create-workspace-form">
          <input
            type="text"
            placeholder="Workspace name"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateWorkspace()}
            autoFocus
          />
          <div className="form-buttons">
            <button onClick={handleCreateWorkspace}>Create</button>
            <button onClick={() => {
              setShowCreateWorkspaceForm(false);
              setNewWorkspaceName('');
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* All Documents */}
      <div 
        className={`workspace-item ${selectedWorkspaceId === null ? 'selected' : ''}`}
        onClick={() => {
          onWorkspaceSelect(null);
          onFolderSelect(null);
        }}
      >
        <div className="workspace-info">
          <FaFolder />
          <span>All Documents</span>
        </div>
      </div>

      {/* Workspaces */}
      {workspaces.map(workspace => {
        const isExpanded = expandedWorkspaces.has(workspace.id);
        const isSelected = selectedWorkspaceId === workspace.id;
        const workspaceFolders = folders.filter(f => !f.parent_folder_id);

        return (
          <div key={workspace.id} className="workspace-item">
            <div 
              className={`workspace-header ${isSelected ? 'selected' : ''}`}
              onClick={() => {
                onWorkspaceSelect(workspace.id);
                onFolderSelect(null);
                toggleWorkspace(workspace.id);
              }}
            >
              <div className="workspace-info">
                <button
                  className="expand-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleWorkspace(workspace.id);
                  }}
                >
                  {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                </button>
                
                <FaUsers />
                <span className="workspace-name">{workspace.name}</span>
              </div>
              
              <div className="workspace-actions">
                <button 
                  className="workspace-action-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateFolder(workspace.id);
                  }}
                  title="Create folder"
                >
                  <FaPlus />
                </button>
                
                <button 
                  className="workspace-action-button"
                  title="Workspace settings"
                >
                  <FaCog />
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="workspace-folders">
                {workspaceFolders.map(folder => renderFolder(folder))}
                
                {workspaceFolders.length === 0 && (
                  <div className="empty-folders">
                    <button 
                      className="create-first-folder"
                      onClick={() => onCreateFolder(workspace.id)}
                    >
                      <FaPlus /> Create your first folder
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}