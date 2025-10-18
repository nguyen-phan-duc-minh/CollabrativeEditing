import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export class CollaborationProvider {
  private ydoc: Y.Doc;
  private provider: WebsocketProvider | null = null;
  private callbacks: Map<string, Set<(...args: any[]) => void>> = new Map();

  constructor() {
    this.ydoc = new Y.Doc();
  }

  connect(documentId: string, token: string) {
    if (this.provider) {
      this.disconnect();
    }

    const wsUrl = import.meta.env.VITE_WS_URL?.replace('http', 'ws') || 'ws://localhost:5001';
    
    this.provider = new WebsocketProvider(
      `${wsUrl}/yjs`,
      `doc-${documentId}`,
      this.ydoc,
      {
        params: { token }
      }
    );

    this.provider.on('status', (event: any) => {
      console.log('Y.js provider status:', event.status);
      this.emit('status', event.status);
    });

    this.provider.on('sync', (synced: boolean) => {
      console.log('Y.js synced:', synced);
      this.emit('synced', synced);
    });

    this.provider.awareness.on('change', () => {
      const states = this.provider?.awareness.getStates();
      this.emit('awareness-change', states);
    });
  }

  disconnect() {
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }
  }

  updateAwareness(update: any) {
    if (this.provider) {
      this.provider.awareness.setLocalStateField('user', update);
    }
  }

  getDocument() {
    return this.ydoc;
  }

  getProvider() {
    return this.provider;
  }

  // Event management
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

export default new CollaborationProvider();