import React, { useEffect, useState } from 'react';
import { ActiveUser } from '../types';

interface CursorOverlayProps {
  activeUsers: ActiveUser[];
  editorElement: HTMLElement | null;
}

interface CursorPosition {
  x: number;
  y: number;
  user: ActiveUser;
}

export default function CursorOverlay({ activeUsers, editorElement }: CursorOverlayProps) {
  const [cursorPositions, setCursorPositions] = useState<CursorPosition[]>([]);

  useEffect(() => {
    if (!editorElement) return;

    const updateCursorPositions = () => {
      const positions: CursorPosition[] = [];

      activeUsers.forEach(user => {
        if (user.cursor && user.cursor.from !== undefined) {
          try {
            // Get the ProseMirror editor view
            const editorView = (editorElement as any).__prosemirror_view;
            if (editorView) {
              // Get DOM coordinates for the cursor position
              const coords = editorView.coordsAtPos(user.cursor.from);
              const editorRect = editorElement.getBoundingClientRect();
              
              positions.push({
                x: coords.left - editorRect.left,
                y: coords.top - editorRect.top,
                user
              });
            }
          } catch (error) {
            console.warn('Error calculating cursor position:', error);
          }
        }
      });

      setCursorPositions(positions);
    };

    // Update cursor positions when active users change
    updateCursorPositions();

    // Update on scroll or resize
    const handleUpdate = () => updateCursorPositions();
    window.addEventListener('scroll', handleUpdate);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [activeUsers, editorElement]);

  return (
    <div className="cursor-overlay" style={{ position: 'relative', pointerEvents: 'none' }}>
      {cursorPositions.map((position, index) => (
        <div
          key={`${position.user.user_id}-${index}`}
          className="collaborative-cursor"
          style={{
            position: 'absolute',
            left: position.x,
            top: position.y,
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        >
          {/* Cursor line */}
          <div
            style={{
              width: '2px',
              height: '20px',
              backgroundColor: position.user.color,
              borderRadius: '1px'
            }}
          />
          
          {/* User label */}
          <div
            style={{
              position: 'absolute',
              top: '-30px',
              left: '0',
              backgroundColor: position.user.color,
              color: 'white',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            {position.user.user?.display_name || 'Unknown User'}
          </div>
        </div>
      ))}
    </div>
  );
}