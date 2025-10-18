// User types
export interface User {
  id: number;
  email: string;
  display_name: string;
  avatar_url: string;
  created_at?: string;
}

// Document types
export interface Document {
  id: string;
  type: 'doc' | 'code' | 'whiteboard' | 'sheet';
  title: string;
  owner_id: number;
  owner?: User;
  workspace_id?: number;
  workspace?: Workspace;
  folder_id?: number;
  folder?: DocumentFolder;
  share_token?: string;
  current_version: number;
  content?: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  role?: 'owner' | 'editor' | 'viewer';
}

// Permission types
export interface Permission {
  id: number;
  document_id: string;
  user_id: number;
  user?: User;
  role: 'owner' | 'editor' | 'viewer';
  created_at: string;
}

// Version types
export interface Version {
  id: number;
  document_id: string;
  version_no: number;
  created_by: number;
  created_by_user?: User;
  created_at: string;
  snapshot_ref?: string;
  snapshot_content?: string;
}

// Operation types
export interface Operation {
  type: 'insert' | 'delete' | 'retain';
  position?: number;
  text?: string;
  length?: number;
  [key: string]: any;
}

export interface OperationRecord {
  id: number;
  document_id: string;
  version_no: number;
  user_id: number;
  op_type: string;
  op_payload: string;
  created_at: string;
}

// Comment types
export interface Comment {
  id: number;
  document_id: string;
  author_id: number;
  author?: User;
  anchor?: string;
  content: string;
  created_at: string;
  updated_at: string;
  resolved: boolean;
  resolved_by?: number;
  resolved_at?: string;
}

// WebSocket types
export interface ActiveUser {
  user_id: number;
  user: User;
  color: string;
  cursor?: {
    from: number;
    to: number;
  };
}

export interface SocketOperation {
  document_id: string;
  operation: Operation;
  version: number;
}

export interface SocketOperationCommitted {
  document_id: string;
  operation: Operation;
  version: number;
  user_id: number;
  timestamp: string;
}

export interface PresenceUpdate {
  document_id: string;
  cursor?: {
    from: number;
    to: number;
  };
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface DocumentListResponse {
  documents: Document[];
}

export interface PermissionListResponse {
  permissions: Permission[];
}

export interface VersionHistoryResponse {
  versions: Version[];
  current_version: number;
}

export interface CommentListResponse {
  comments: Comment[];
}

// Share types
export interface ShareLinkResponse {
  share_token: string;
  share_url: string;
}

// New Model Types - 9 additional models

// User Session types
export interface UserSession {
  id: number;
  user_id: number;
  device_info?: string;
  ip_address?: string;
  login_at: string;
  last_activity: string;
  is_active: boolean;
}

// User Preference types
export interface UserPreference {
  id: number;
  user_id: number;
  preference_key: string;
  preference_value?: string;
  updated_at: string;
}

// Document Folder types
export interface DocumentFolder {
  id: number;
  name: string;
  description?: string;
  owner_id: number;
  parent_folder_id?: number;
  workspace_id?: number;
  color?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

// Team Workspace types
export interface TeamWorkspace {
  id: number;
  name: string;
  description?: string;
  owner_id: number;
  invite_code?: string;
  is_private: boolean;
  max_members: number;
  created_at: string;
  updated_at: string;
}

// User Presence types
export interface UserPresence {
  id: number;
  user_id: number;
  user?: User;
  document_id: string;
  cursor_position: number;
  selection_start?: number;
  selection_end?: number;
  status: 'online' | 'idle' | 'offline';
  last_seen: string;
}

// Notification Setting types
export interface NotificationSetting {
  id: number;
  user_id: number;
  notification_type: string;
  is_enabled: boolean;
  delivery_method: 'email' | 'push' | 'in_app';
  updated_at: string;
}

// Audit Log types
export interface AuditLog {
  id: number;
  user_id?: number;
  user?: User;
  document_id?: string;
  action: string;
  entity_type: string;
  entity_id?: number;
  ip_address?: string;
  created_at: string;
}

// File Attachment types
export interface FileAttachment {
  id: number;
  document_id: string;
  uploaded_by: number;
  uploader?: User;
  file_name: string;
  file_size: number;
  file_type?: string;
  is_embedded: boolean;
  upload_date: string;
}

// Recent Activity types
export interface RecentActivity {
  id: number;
  user_id: number;
  user?: User;
  document_id: string;
  document?: Document;
  activity_type: 'viewed' | 'edited' | 'commented' | 'shared';
  activity_data?: string;
  created_at: string;
}

// Workspace types  
export interface Workspace {
  id: number;
  name: string;
  description: string;
  owner_id: number;
  owner?: User;
  invite_code: string;
  is_private: boolean;
  max_members: number;
  created_at: string;
  updated_at: string;
  members?: WorkspaceMember[];
}

export interface WorkspaceMember {
  id: number;
  workspace_id: number;
  user_id: number;
  user?: User;
  role: 'admin' | 'editor';
  joined_at: string;
}

// Extended API Response types for new models
export interface UserPreferencesResponse {
  preferences: UserPreference[];
}

export interface WorkspacesResponse {
  workspaces: TeamWorkspace[];
}

export interface FoldersResponse {
  folders: DocumentFolder[];
}

export interface PresenceResponse {
  presence: UserPresence[];
}

export interface NotificationSettingsResponse {
  settings: NotificationSetting[];
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  page: number;
  per_page: number;
}

export interface AttachmentsResponse {
  attachments: FileAttachment[];
}

export interface ActivitiesResponse {
  activities: RecentActivity[];
}
