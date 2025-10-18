import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async googleAuth(token: string) {
    const response = await this.api.post('/auth/google', { token });
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.api.get('/auth/me');
    return response.data;
  }

  async refreshToken() {
    const response = await this.api.post('/auth/refresh');
    return response.data;
  }

  // Document endpoints
  async getDocuments() {
    const response = await this.api.get('/documents');
    return response.data;
  }

  async getDocument(id: string, token?: string) {
    const url = token ? `/documents/${id}?token=${token}` : `/documents/${id}`;
    const response = await this.api.get(url);
    return response.data;
  }

  async createDocument(data: { title?: string; type?: string; content?: string }) {
    const response = await this.api.post('/documents', data);
    return response.data;
  }

  async updateDocument(id: string, data: { title?: string; type?: string; content?: string; save_version?: boolean; version_name?: string }) {
    console.log('📤 API updateDocument called with:', { id, save_version: data.save_version });
    const response = await this.api.put(`/documents/${id}`, data);
    return response.data;
  }

  async deleteDocument(id: string) {
    const response = await this.api.delete(`/documents/${id}`);
    return response.data;
  }

  async restoreDocument(id: string) {
    const response = await this.api.post(`/documents/${id}/restore`);
    return response.data;
  }

  async searchDocuments(query: string) {
    const response = await this.api.get(`/documents/search?q=${encodeURIComponent(query)}`);
    return response.data;
  }

  // Permission endpoints
  async getPermissions(documentId: string) {
    const response = await this.api.get(`/documents/${documentId}/permissions`);
    return response.data.permissions || [];
  }

  async shareDocumentByEmail(documentId: string, email: string, role: 'editor' | 'viewer') {
    const response = await this.api.post(`/documents/${documentId}/share`, { email, role });
    return response.data;
  }

  async generateShareLink(documentId: string, enabled: boolean = true) {
    const response = await this.api.post(`/documents/${documentId}/share/link`, { enabled });
    return response.data;
  }

  async revokeShareLink(documentId: string) {
    const response = await this.api.delete(`/documents/${documentId}/share/link`);
    return response.data;
  }

  async removePermission(documentId: string, permissionId: number) {
    const response = await this.api.delete(`/documents/${documentId}/permissions/${permissionId}`);
    return response.data;
  }

  async updatePermission(documentId: string, permissionId: number, role: 'editor' | 'viewer') {
    const response = await this.api.put(`/documents/${documentId}/permissions/${permissionId}`, { role });
    return response.data;
  }

  // Version endpoints
  async getVersionHistory(documentId: string) {
    const response = await this.api.get(`/documents/${documentId}/history`);
    return response.data;
  }

  async getVersion(documentId: string, versionNo: number) {
    const response = await this.api.get(`/documents/${documentId}/versions/${versionNo}`);
    return response.data;
  }

  async restoreVersion(documentId: string, versionNo: number) {
    const response = await this.api.post(`/documents/${documentId}/restore-version`, { version_no: versionNo });
    return response.data;
  }

  async deleteVersion(documentId: string, versionNo: number) {
    const response = await this.api.delete(`/documents/${documentId}/versions/${versionNo}`, {
      data: { version_no: versionNo }
    });
    return response.data;
  }

  async getOperations(documentId: string, params?: { from_version?: number; to_version?: number; limit?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.from_version !== undefined) queryParams.append('from_version', params.from_version.toString());
    if (params?.to_version !== undefined) queryParams.append('to_version', params.to_version.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
    
    const url = `/documents/${documentId}/operations${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await this.api.get(url);
    return response.data;
  }

  // Comment endpoints
  async getComments(documentId: string, resolved?: boolean) {
    const url = resolved !== undefined 
      ? `/documents/${documentId}/comments?resolved=${resolved}`
      : `/documents/${documentId}/comments`;
    const response = await this.api.get(url);
    return response.data;
  }

  async createComment(documentId: string, data: { content: string; anchor?: string | null }) {
    const response = await this.api.post(`/documents/${documentId}/comments`, data);
    return response.data;
  }

  async getComment(commentId: number) {
    const response = await this.api.get(`/comments/${commentId}`);
    return response.data;
  }

  async updateComment(commentId: number, content: string) {
    const response = await this.api.put(`/comments/${commentId}`, { content });
    return response.data;
  }

  async deleteComment(commentId: number) {
    const response = await this.api.delete(`/comments/${commentId}`);
    return response.data;
  }

  async resolveComment(commentId: number) {
    const response = await this.api.post(`/comments/${commentId}/resolve`);
    return response.data;
  }

  async unresolveComment(commentId: number) {
    const response = await this.api.post(`/comments/${commentId}/unresolve`);
    return response.data;
  }

  // Export/Import endpoints
  async exportDocx(documentId: string) {
    const response = await this.api.get(`/documents/${documentId}/export/docx`, {
      responseType: 'blob'
    });
    return response.data;
  }

  async exportPdf(documentId: string) {
    const response = await this.api.get(`/documents/${documentId}/export/pdf`, {
      responseType: 'blob'
    });
    return response.data;
  }

  async exportMarkdown(documentId: string) {
    const response = await this.api.get(`/documents/${documentId}/export/markdown`, {
      responseType: 'blob'
    });
    return response.data;
  }

  async exportTxt(documentId: string) {
    const response = await this.api.get(`/documents/${documentId}/export/txt`, {
      responseType: 'blob'
    });
    return response.data;
  }

  async importDocument(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.api.post('/documents/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }

  async importIntoDocument(documentId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.api.post(`/documents/${documentId}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }

  // User Preferences endpoints
  async getUserPreferences() {
    const response = await this.api.get('/user-preferences');
    return response.data;
  }

  async updateUserPreference(key: string, value: string) {
    const response = await this.api.post('/user-preferences', { preference_key: key, preference_value: value });
    return response.data;
  }

  async deleteUserPreference(preferenceId: number) {
    const response = await this.api.delete(`/user-preferences/${preferenceId}`);
    return response.data;
  }

  // Team Workspaces endpoints
  async getWorkspaces() {
    const response = await this.api.get('/api/workspaces');
    return response.data;
  }

  async createWorkspace(data: { name: string; description?: string }) {
    const response = await this.api.post('/api/workspaces', data);
    return response.data;
  }

  async updateWorkspace(workspaceId: number, data: { name?: string; description?: string }) {
    const response = await this.api.put(`/api/workspaces/${workspaceId}`, data);
    return response.data;
  }

  async deleteWorkspace(workspaceId: number) {
    const response = await this.api.delete(`/api/workspaces/${workspaceId}`);
    return response.data;
  }

  async addWorkspaceMember(workspaceId: number, email: string) {
    const response = await this.api.post(`/api/workspaces/${workspaceId}/members`, { email });
    return response.data;
  }

  async removeWorkspaceMember(workspaceId: number, memberId: number) {
    const response = await this.api.delete(`/api/workspaces/${workspaceId}/members/${memberId}`);
    return response.data;
  }

  async getWorkspaceFolders(workspaceId: number) {
    const response = await this.api.get(`/api/workspaces/${workspaceId}/folders`);
    return response.data;
  }

  async createWorkspaceFolder(workspaceId: number, data: { name: string; description?: string; color?: string }) {
    const response = await this.api.post(`/api/workspaces/${workspaceId}/folders`, data);
    return response.data;
  }

  async createWorkspaceDocument(workspaceId: number, data: { title?: string; type?: string; folder_id?: number }) {
    const response = await this.api.post(`/api/workspaces/${workspaceId}/documents`, data);
    return response.data;
  }

  // Document Folders endpoints
  async getFolders(workspaceId?: number) {
    const url = workspaceId ? `/folders?workspace_id=${workspaceId}` : '/folders';
    const response = await this.api.get(url);
    return response.data;
  }

  async createFolder(data: { name: string; description?: string; parent_folder_id?: number; workspace_id?: number; color?: string }) {
    const response = await this.api.post('/folders', data);
    return response.data;
  }

  async updateFolder(folderId: number, data: { name?: string; description?: string; color?: string }) {
    const response = await this.api.put(`/folders/${folderId}`, data);
    return response.data;
  }

  async deleteFolder(folderId: number) {
    const response = await this.api.delete(`/folders/${folderId}`);
    return response.data;
  }

  // User Presence endpoints
  async getDocumentPresence(documentId: string) {
    const response = await this.api.get(`/presence/document/${documentId}`);
    return response.data;
  }

  async updatePresence(documentId: string, data: { cursor_position?: number; selection_start?: number; selection_end?: number; status?: string }) {
    const response = await this.api.post(`/presence/document/${documentId}`, data);
    return response.data;
  }

  // Recent Activities endpoints
  async getRecentActivities(limit?: number) {
    const url = limit ? `/activities?limit=${limit}` : '/activities';
    const response = await this.api.get(url);
    return response.data;
  }

  async getDocumentActivities(documentId: string, limit?: number) {
    const url = limit ? `/activities/document/${documentId}?limit=${limit}` : `/activities/document/${documentId}`;
    const response = await this.api.get(url);
    return response.data;
  }

  // Notification Settings endpoints
  async getNotificationSettings() {
    const response = await this.api.get('/notification-settings');
    return response.data;
  }

  async updateNotificationSetting(data: { notification_type: string; is_enabled?: boolean; delivery_method?: string }) {
    const response = await this.api.post('/notification-settings', data);
    return response.data;
  }

  async deleteNotificationSetting(settingId: number) {
    const response = await this.api.delete(`/notification-settings/${settingId}`);
    return response.data;
  }

  // Audit Logs endpoints
  async getAuditLogs(params?: { page?: number; per_page?: number; document_id?: number; action?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.per_page) queryParams.append('per_page', params.per_page.toString());
    if (params?.document_id) queryParams.append('document_id', params.document_id.toString());
    if (params?.action) queryParams.append('action', params.action);
    
    const url = `/audit-logs${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await this.api.get(url);
    return response.data;
  }

  async getDocumentAuditLogs(documentId: string, params?: { page?: number; per_page?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.per_page) queryParams.append('per_page', params.per_page.toString());
    
    const url = `/audit-logs/document/${documentId}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await this.api.get(url);
    return response.data;
  }

  // File Attachments endpoints
  async getDocumentAttachments(documentId: string) {
    const response = await this.api.get(`/attachments/document/${documentId}`);
    return response.data;
  }

  async uploadAttachment(documentId: string, file: File, isEmbedded?: boolean) {
    const formData = new FormData();
    formData.append('file', file);
    if (isEmbedded !== undefined) {
      formData.append('is_embedded', isEmbedded.toString());
    }
    const response = await this.api.post(`/attachments/document/${documentId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }

  async downloadAttachment(attachmentId: number) {
    const response = await this.api.get(`/attachments/${attachmentId}/download`, {
      responseType: 'blob'
    });
    return response;
  }

  async deleteAttachment(attachmentId: number) {
    const response = await this.api.delete(`/attachments/${attachmentId}`);
    return response.data;
  }
}

export default new ApiService();
