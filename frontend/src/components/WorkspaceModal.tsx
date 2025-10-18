import React, { useState } from 'react';
import { MdClose, MdAdd, MdDelete, MdPeople } from 'react-icons/md';
import './WorkspaceModal.css';

interface Workspace {
  id: number;
  name: string;
  description: string;
  owner_id: number;
  owner: any;
  members: Array<{
    id: number;
    user: {
      id: number;
      email: string;
      display_name: string;
    };
    role: string;
  }>;
}

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace?: Workspace | null;
  onSave: (workspaceData: any) => Promise<void>;
  onDelete?: (workspaceId: number) => Promise<void>;
  onAddMember?: (workspaceId: number, email: string) => Promise<void>;
  onRemoveMember?: (workspaceId: number, memberId: number) => Promise<void>;
}

export default function WorkspaceModal({
  isOpen,
  onClose,
  workspace,
  onSave,
  onDelete,
  onAddMember,
  onRemoveMember
}: WorkspaceModalProps) {
  const [formData, setFormData] = useState({
    name: workspace?.name || '',
    description: workspace?.description || ''
  });
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'members'>('info');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving workspace:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim() || !workspace || !onAddMember) return;

    setLoading(true);
    try {
      await onAddMember(workspace.id, newMemberEmail);
      setNewMemberEmail('');
    } catch (error) {
      console.error('Error adding member:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!workspace || !onRemoveMember) return;

    setLoading(true);
    try {
      await onRemoveMember(workspace.id, memberId);
    } catch (error) {
      console.error('Error removing member:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!workspace || !onDelete) return;
    
    if (confirm('Bạn có chắc muốn xóa workspace này? Tất cả tài liệu trong workspace sẽ bị xóa.')) {
      setLoading(true);
      try {
        await onDelete(workspace.id);
        onClose();
      } catch (error) {
        console.error('Error deleting workspace:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="workspace-modal-overlay">
      <div className="workspace-modal">
        <div className="workspace-modal-header">
          <h2>{workspace ? 'Chỉnh sửa Workspace' : 'Tạo Workspace mới'}</h2>
          <button className="close-btn" onClick={onClose}>
            <MdClose />
          </button>
        </div>

        <div className="workspace-modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Thông tin
          </button>
          {workspace && (
            <button
              className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`}
              onClick={() => setActiveTab('members')}
            >
              <MdPeople />
              Thành viên ({workspace.members?.length || 0})
            </button>
          )}
        </div>

        <div className="workspace-modal-content">
          {activeTab === 'info' && (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Tên Workspace *</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Nhập tên workspace..."
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Mô tả</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Mô tả workspace (tùy chọn)..."
                  rows={3}
                />
              </div>

              <div className="form-actions">
                {workspace && onDelete && (
                  <button
                    type="button"
                    className="delete-btn"
                    onClick={handleDelete}
                    disabled={loading}
                  >
                    <MdDelete />
                    Xóa Workspace
                  </button>
                )}
                <div className="right-actions">
                  <button type="button"className="primary-btn" onClick={onClose} disabled={loading}>
                    Hủy
                  </button>
                  <button type="submit" className="primary-btn" disabled={loading}>
                    {loading ? 'Đang lưu...' : workspace ? 'Cập nhật' : 'Tạo mới'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {activeTab === 'members' && workspace && (
            <div className="members-tab">
              <div className="add-member-section">
                <h3>Thêm thành viên</h3>
                <form onSubmit={handleAddMember} className="add-member-form">
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="Nhập email thành viên..."
                    disabled={loading}
                  />
                  <button type="submit" disabled={loading || !newMemberEmail.trim()}>
                    <MdAdd />
                    Thêm
                  </button>
                </form>
              </div>

              <div className="members-list">
                <h3>Danh sách thành viên</h3>
                {workspace.members && workspace.members.length > 0 ? (
                  <div className="members-grid">
                    {workspace.members.map((member) => (
                      <div key={member.id} className="member-item">
                        <div className="member-info">
                          <div className="member-name">
                            {member.user.display_name || member.user.email}
                          </div>
                          <div className="member-email">{member.user.email}</div>
                          <div className="member-role">{member.role === 'admin' ? 'Quản trị' : 'Thành viên'}</div>
                        </div>
                        {member.user.id !== workspace.owner_id && onRemoveMember && (
                          <button
                            className="remove-member-btn"
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={loading}
                            title="Xóa thành viên"
                          >
                            <MdDelete />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-members">Chưa có thành viên nào.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}