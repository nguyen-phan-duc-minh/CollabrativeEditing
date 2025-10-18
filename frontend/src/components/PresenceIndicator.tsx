import React from 'react';
import { ActiveUser } from '@/types';
import { FaUserCircle, FaCircle } from 'react-icons/fa';

interface PresenceIndicatorProps {
  activeUsers: ActiveUser[];
  currentUserId: number;
}

export default function PresenceIndicator({ activeUsers, currentUserId }: PresenceIndicatorProps) {
  // Filter out current user and ensure valid user data
  const otherUsers = activeUsers.filter(u => u.user_id !== currentUserId && u.user_id);

  if (otherUsers.length === 0) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      transform: 'translateY(-50%)',
      right: '16px',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '24px',
      padding: '8px 16px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      <span style={{ 
        color: '#6b7280', 
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        Online:
      </span>
      
      {otherUsers.slice(0, 5).map((activeUser) => {
        const user = activeUser.user || {} as any;
        const displayName = user.display_name || 'Unknown User';
        const avatarUrl = user.avatar_url;
        
        return (
          <div
            key={activeUser.user_id}
            style={{ position: 'relative' }}
            title={displayName}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: `2px solid ${activeUser.color || '#6b7280'}`,
                  objectFit: 'cover'
                }}
              />
            ) : (
              <FaUserCircle 
                style={{
                  width: '32px',
                  height: '32px',
                  color: activeUser.color || '#6b7280'
                }}
              />
            )}
            
            <FaCircle
              style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                width: '10px',
                height: '10px',
                color: '#10b981',
                backgroundColor: 'white',
                borderRadius: '50%',
                border: '2px solid white'
              }}
            />
          </div>
        );
      })}
      
      {otherUsers.length > 5 && (
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: '#6b7280',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          +{otherUsers.length - 5}
        </div>
      )}
    </div>
  );
}
