import React, { useState, useEffect } from 'react';
import { 
  FaBell, FaTimes, FaCheck, FaExclamationCircle, 
  FaInfo, FaCheckCircle, FaExclamationTriangle 
} from 'react-icons/fa';
import { useAuthStore } from '../store';
import websocketService from '../services/websocket';
import './NotificationCenter.css';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionText?: string;
}

export default function NotificationCenter() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      // Listen for real-time notifications via websocket
      const handleNotification = (data: any) => {
        const newNotification: Notification = {
          id: Date.now().toString(),
          type: data.type || 'info',
          title: data.title,
          message: data.message,
          timestamp: new Date(),
          read: false,
          actionUrl: data.actionUrl,
          actionText: data.actionText
        };

        setNotifications(prev => [newNotification, ...prev]);
        setUnreadCount(prev => prev + 1);

        // Show browser notification if permission granted
        if (Notification.permission === 'granted') {
          new Notification(data.title, {
            body: data.message,
            icon: '/favicon.ico'
          });
        }
      };

      websocketService.on('notification', handleNotification);

      // Request notification permission
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }

      return () => {
        websocketService.off('notification', handleNotification);
      };
    }
  }, [user]);

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const removeNotification = (notificationId: string) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === notificationId);
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      return prev.filter(n => n.id !== notificationId);
    });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <FaCheckCircle className="icon-success" />;
      case 'warning': return <FaExclamationTriangle className="icon-warning" />;
      case 'error': return <FaExclamationCircle className="icon-error" />;
      default: return <FaInfo className="icon-info" />;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return timestamp.toLocaleDateString();
  };

  // Fetch real notifications from API
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token || !user) {
          // No token or user, use empty state
          setNotifications([]);
          setUnreadCount(0);
          return;
        }
        
        const response = await fetch('http://localhost:5001/notifications', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.notifications) {
            setNotifications(data.notifications);
            setUnreadCount(data.notifications.filter((n: Notification) => !n.read).length);
          } else {
            setNotifications([]);
            setUnreadCount(0);
          }
        } else if (response.status === 422) {
          console.log('Notifications endpoint returned 422 - using empty state');
          setNotifications([]);
          setUnreadCount(0);
        } else {
          // Other API errors, use empty state
          console.log('Notifications API error:', response.status);
          setNotifications([]);
          setUnreadCount(0);
        }
      } catch (error) {
        // Network error or server not running - silently use empty state
        console.log('Notifications fetch error (server may not be running):', error);
        setNotifications([]);
        setUnreadCount(0);
      }
    };

    // Only fetch if we have both token and user
    if (user && localStorage.getItem('token')) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user]); // Depend on user instead of just running once

  return (
    <div className="notification-center">
      <button 
        className="notification-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
      >
        <FaBell />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            <div className="header-actions">
              {unreadCount > 0 && (
                <button 
                  className="mark-all-read"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                >
                  <FaCheck />
                </button>
              )}
              <button 
                className="close-notifications"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                <FaTimes />
              </button>
            </div>
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="empty-notifications">
                <FaBell className="empty-icon" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div 
                  key={notification.id}
                  className={`notification-item ${notification.read ? 'read' : 'unread'} ${notification.type}`}
                >
                  <div className="notification-content">
                    <div className="notification-header-item">
                      {getNotificationIcon(notification.type)}
                      <span className="notification-title">{notification.title}</span>
                      <span className="notification-time">
                        {formatTimestamp(notification.timestamp)}
                      </span>
                    </div>
                    
                    <p className="notification-message">{notification.message}</p>
                    
                    {notification.actionUrl && notification.actionText && (
                      <button 
                        className="notification-action"
                        onClick={() => {
                          // Handle action click
                          window.location.href = notification.actionUrl!;
                          markAsRead(notification.id);
                        }}
                      >
                        {notification.actionText}
                      </button>
                    )}
                  </div>

                  <div className="notification-actions">
                    {!notification.read && (
                      <button
                        className="mark-read-button"
                        onClick={() => markAsRead(notification.id)}
                        title="Mark as read"
                      >
                        <FaCheck />
                      </button>
                    )}
                    
                    <button
                      className="remove-notification"
                      onClick={() => removeNotification(notification.id)}
                      title="Remove"
                    >
                      <FaTimes />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}