import React, { useState, useEffect } from 'react';
import { FaFolder, FaUsers, FaFileAlt } from 'react-icons/fa';

interface WorkspaceData {
  name: string;
  documentCount: number;
  memberCount: number;
}

interface WorkspaceIndicatorProps {
  workspaceId?: string;
}

export default function WorkspaceIndicator({ 
  workspaceId 
}: WorkspaceIndicatorProps) {
  const [workspaceData, setWorkspaceData] = useState<WorkspaceData>({
    name: 'MMT Workspace',
    documentCount: 0,
    memberCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkspaceData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

        // Fetch workspace info
        const workspaceResponse = await fetch(`http://localhost:5001/workspaces${workspaceId ? `/${workspaceId}` : '/current'}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // Fetch documents count
        const documentsResponse = await fetch('http://localhost:5001/documents', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // Fetch workspace members
        const membersResponse = await fetch(`http://localhost:5001/workspaces${workspaceId ? `/${workspaceId}` : '/current'}/members`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (workspaceResponse.ok && documentsResponse.ok && membersResponse.ok) {
          const workspace = await workspaceResponse.json();
          const documents = await documentsResponse.json();
          const members = await membersResponse.json();

          setWorkspaceData({
            name: workspace.name || 'MMT Workspace',
            documentCount: documents.documents?.length || 0,
            memberCount: members.members?.length || 0
          });
        }
      } catch (error) {
        console.error('Failed to fetch workspace data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaceData();
  }, [workspaceId]);

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        zIndex: 1000,
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        minWidth: '200px'
      }}>
        <div style={{ color: '#6b7280', fontSize: '12px' }}>Loading...</div>
      </div>
    );
  }
  return (
    <div style={{
      position: 'fixed',
      bottom: '16px',
      left: '16px',
      zIndex: 1000,
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '12px 16px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      minWidth: '200px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px'
      }}>
        <FaFolder style={{ color: '#3b82f6' }} />
        <span style={{ 
          fontWeight: '600',
          fontSize: '14px',
          color: '#1f2937'
        }}>
          {workspaceData.name}
        </span>
      </div>
      
      <div style={{
        display: 'flex',
        gap: '16px',
        fontSize: '12px',
        color: '#6b7280'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <FaFileAlt />
          {workspaceData.documentCount} docs
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <FaUsers />
          {workspaceData.memberCount} members
        </div>
      </div>
    </div>
  );
}