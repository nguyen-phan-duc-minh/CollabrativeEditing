import React, { useState, useEffect } from 'react';
import { FaBell, FaUser, FaEdit, FaComment, FaShare, FaTimes } from 'react-icons/fa';

interface Activity {
  id: string;
  type: 'edit' | 'comment' | 'share' | 'join';
  user: string;
  message: string;
  timestamp: string;
  avatar?: string;
}

export default function ActivityFeed() {
  const [isOpen, setIsOpen] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);

  // Fetch real activities from API
  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5001/activities', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setActivities(data.activities || []);
        }
      } catch (error) {
        console.error('Failed to fetch activities:', error);
      }
    };

    fetchActivities();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'edit': return <FaEdit style={{ color: '#10b981' }} />;
      case 'comment': return <FaComment style={{ color: '#3b82f6' }} />;
      case 'share': return <FaShare style={{ color: '#8b5cf6' }} />;
      case 'join': return <FaUser style={{ color: '#f59e0b' }} />;
      default: return <FaBell />;
    }
  };

  return (
    <>
      {/* Activity Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          top: '80px', // Moved down to avoid overlap with header
          right: '16px',
          zIndex: 1001,
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          cursor: 'pointer'
        }}
      >
        <FaBell style={{ color: '#6b7280' }} />
        {activities.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            backgroundColor: '#ef4444',
            color: 'white',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {activities.length}
          </div>
        )}
      </button>

      {/* Activity Feed Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: '130px', // Positioned below the bell button
          right: '16px',
          zIndex: 1002,
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          width: '320px',
          maxHeight: '400px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: '16px', 
              fontWeight: '600',
              color: '#1f2937'
            }}>
              Recent Activity
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: '#6b7280'
              }}
            >
              <FaTimes />
            </button>
          </div>

          {/* Activity List */}
          <div style={{ maxHeight: '300px', overflow: 'auto' }}>
            {activities.map((activity) => (
              <div
                key={activity.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f3f4f6',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  flexShrink: 0
                }}>
                  {activity.avatar ? (
                    <img 
                      src={activity.avatar} 
                      alt={activity.user}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: '#e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <FaUser style={{ color: '#6b7280' }} />
                    </div>
                  )}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '4px'
                  }}>
                    {getIcon(activity.type)}
                    <span style={{
                      fontWeight: '500',
                      fontSize: '14px',
                      color: '#1f2937'
                    }}>
                      {activity.user}
                    </span>
                    <span style={{
                      fontSize: '14px',
                      color: '#6b7280'
                    }}>
                      {activity.message}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#9ca3af'
                  }}>
                    {activity.timestamp}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}