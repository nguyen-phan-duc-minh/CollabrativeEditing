import { io, Socket } from 'socket.io-client';
import type { Operation, ActiveUser, SocketOperationCommitted } from '@/types';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5001';

export class WebSocketService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private callbacks: Map<string, Set<(...args: any[]) => void>> = new Map();

  connect(token: string) {
    this.token = token;
    
    console.log('Connecting to WebSocket:', WS_URL);
    
    this.socket = io(WS_URL, {
      transports: ['polling', 'websocket'], // Try polling first
      auth: {
        token
      },
      query: {
        token
      },
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected successfully');
      this.emit('connected', true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.emit('disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.emit('error', error);
    });

    this.socket.on('error', (error: any) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    });

    // Register server event listeners
    this.socket.on('joined', (data: any) => {
      console.log('🔌 WebSocket received joined:', data);
      this.emit('joined', data);
    });

    this.socket.on('op.committed', (data: SocketOperationCommitted) => {
      this.emit('op.committed', data);
    });

    this.socket.on('op.acknowledged', (data: any) => {
      this.emit('op.acknowledged', data);
    });

    this.socket.on('op.rejected', (data: any) => {
      this.emit('op.rejected', data);
    });

    this.socket.on('presence.joined', (data: ActiveUser) => {
      console.log('🔌 WebSocket received presence.joined:', data);
      this.emit('presence.joined', data);
    });

    this.socket.on('presence.left', (data: { user_id: number; document_id: number }) => {
      this.emit('presence.left', data);
    });

    this.socket.on('presence.updated', (data: { user_id: number; cursor: any; document_id: number }) => {
      this.emit('presence.updated', data);
    });

    // Real-time content synchronization
    this.socket.on('content.updated', (data: { document_id: number; content: string; user_id: number; timestamp: string }) => {
      console.log('WebSocket received content.updated:', data);
      this.emit('content.updated', data);
    });

    // Cursor updates
    this.socket.on('cursor.update', (data: { document_id: number; user_id: number; cursor: any; timestamp: string }) => {
      console.log('WebSocket received cursor.update:', data);
      this.emit('cursor.update', data);
    });

    // Video call events
    this.socket.on('video_call.started', (data: any) => {
      console.log('WebSocket received video_call.started:', data);
      this.emit('video_call.started', data);
    });

    this.socket.on('video_call.joined', (data: any) => {
      console.log('WebSocket received video_call.joined:', data);
      this.emit('video_call.joined', data);
    });

    this.socket.on('video_call.ended', (data: any) => {
      console.log('WebSocket received video_call.ended:', data);
      this.emit('video_call.ended', data);
    });

    this.socket.on('video_call.status', (data: any) => {
      console.log('WebSocket received video_call.status:', data);
      this.emit('video_call.status', data);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.callbacks.clear();
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Document room operations
  joinDocument(documentId: string, shareToken?: string) {
    if (!this.socket) {
      console.warn('Socket not connected, cannot join document');
      return;
    }

    if (!this.socket.connected) {
      console.warn('Socket not yet connected, waiting...');
      this.socket.once('connect', () => {
        if (this.socket) {
          this.socket.emit('join', {
            document_id: documentId,
            share_token: shareToken
          });
        }
      });
      return;
    }

    this.socket.emit('join', {
      document_id: documentId,
      share_token: shareToken
    });
  }

  leaveDocument(documentId: string) {
    if (!this.socket) {
      return;
    }

    this.socket.emit('leave', {
      document_id: documentId
    });
  }

  // Operations
  applyOperation(documentId: string, operation: Operation, version: number) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('op.apply', {
      document_id: documentId,
      operation,
      version
    });
  }

  // Presence
  updatePresence(documentId: string, cursor?: { from: number; to: number }) {
    if (!this.socket) {
      return;
    }

    this.socket.emit('presence.update', {
      document_id: documentId,
      cursor
    });
  }

  // Real-time content change (for collaborative editing)
  sendContentChange(documentId: string, content: string) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('content.change', {
      document_id: documentId,
      content
    });
  }

  // Cursor position updates
  updateCursor(documentId: string, cursor: any, userId: number) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('cursor.update', {
      document_id: documentId,
      cursor,
      user_id: userId
    });
  }

  // Video call methods
  emitVideoCallEvent(event: string, data: any) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    this.socket.emit(event, data);
  }

  // Event listener management
  on(event: string, callback: (...args: any[]) => void) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, new Set());
    }
    this.callbacks.get(event)!.add(callback);
  }

  off(event: string, callback: (...args: any[]) => void) {
    const callbacks = this.callbacks.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.callbacks.delete(event);
      }
    }
  }

  private emit(event: string, ...args: any[]) {
    const callbacks = this.callbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(...args));
    }
  }
}

export default new WebSocketService();
