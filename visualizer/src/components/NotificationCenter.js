import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * Provides a system for displaying notifications to the user
 * Handles toast messages, alerts, and status updates
 */
const NotificationCenter = ({
  position = 'top-right',
  autoClose = 5000,
  maxNotifications = 5,
  closeOnClick = true,
  pauseOnHover = true
}) => {
  // State
  const [notifications, setNotifications] = useState([]);
  const [notificationRoot, setNotificationRoot] = useState(null);
  
  // Refs
  const hoverRef = useRef(false);
  const timerIdsRef = useRef(new Map());
  const notificationsRef = useRef(notifications);
  
  // Update ref when notifications change
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);
  
  // Valid positions
  const validPositions = [
    'top-right', 'top-center', 'top-left',
    'bottom-right', 'bottom-center', 'bottom-left'
  ];
  
  // Validate position
  const validPosition = validPositions.includes(position) ? position : 'top-right';
  
  // Create notification root element on mount
  useEffect(() => {
    // Check if notification root already exists
    let root = document.getElementById('notification-root');
    
    // Create it if it doesn't exist
    if (!root) {
      root = document.createElement('div');
      root.id = 'notification-root';
      document.body.appendChild(root);
    }
    
    setNotificationRoot(root);
    
    // Clean up on unmount
    return () => {
      // Clear all timers
      timerIdsRef.current.forEach(timerId => {
        clearTimeout(timerId);
      });
      timerIdsRef.current.clear();
      
      // Only remove the root if we created it and no notifications are active
      if (root && notificationsRef.current.length === 0) {
        try {
          document.body.removeChild(root);
        } catch (error) {
          console.error('Error removing notification root:', error);
        }
      }
    };
  }, []);
  
  // Subscribe to notification events
  useEffect(() => {
    // Create notification
    const handleShowNotification = (data) => {
      addNotification(data);
    };
    
    // Clear all notifications
    const handleClearNotifications = () => {
      clearAllNotifications();
    };
    
    EventBus.subscribe('notification:show', handleShowNotification);
    EventBus.subscribe('notification:clear', handleClearNotifications);
    
    return () => {
      EventBus.unsubscribe('notification:show', handleShowNotification);
      EventBus.unsubscribe('notification:clear', handleClearNotifications);
    };
  }, []); // Empty dependency array to ensure event handlers are set up once
  
  /**
   * Add a new notification
   * @param {Object} data - Notification data
   */
  const addNotification = (data) => {
    // Generate unique ID for notification
    const id = `notification-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Default notification object
    const defaultNotification = {
      id,
      type: 'info',
      title: '',
      message: '',
      duration: autoClose,
      showProgress: true,
      dismissible: true,
      timestamp: Date.now()
    };
    
    // Create notification object
    const notification = { ...defaultNotification, ...data };
    
    // Check for duplicates based on message content (within last 3 seconds)
    const isDuplicate = notificationsRef.current.some(
      existing => existing.message === notification.message && 
                 Date.now() - existing.timestamp < 3000
    );
    
    if (isDuplicate) {
      return; // Skip duplicate notifications
    }
    
    // Update notifications state
    setNotifications(prevNotifications => {
      // If we have too many notifications, remove the oldest
      const updatedNotifications = [...prevNotifications];
      if (updatedNotifications.length >= maxNotifications) {
        const oldestNotification = updatedNotifications.reduce((oldest, current) => 
          current.timestamp < oldest.timestamp ? current : oldest, updatedNotifications[0]);
        
        // Cancel timer for the oldest notification
        cancelAutoClose(oldestNotification.id);
        
        // Remove the oldest notification
        const filteredNotifications = updatedNotifications.filter(n => n.id !== oldestNotification.id);
        updatedNotifications.splice(0, updatedNotifications.length, ...filteredNotifications);
      }
      
      return [...updatedNotifications, notification];
    });
    
    // Set up auto-close timer
    if (notification.duration && notification.duration > 0) {
      setupAutoClose(notification.id, notification.duration);
    }
    
    // Return ID for potential manual closing
    return id;
  };
  
  /**
   * Set up auto-close timer for a notification
   * @param {string} id - Notification ID
   * @param {number} duration - Duration in milliseconds
   */
  const setupAutoClose = (id, duration) => {
    // Clear any existing timer for this ID first
    cancelAutoClose(id);
    
    const timerId = setTimeout(() => {
      closeNotification(id);
    }, duration);
    
    timerIdsRef.current.set(id, timerId);
  };
  
  /**
   * Cancel auto-close timer for a notification
   * @param {string} id - Notification ID
   */
  const cancelAutoClose = (id) => {
    if (timerIdsRef.current.has(id)) {
      clearTimeout(timerIdsRef.current.get(id));
      timerIdsRef.current.delete(id);
    }
  };
  
  /**
   * Reset auto-close timer for a notification
   * @param {string} id - Notification ID
   * @param {number} duration - Duration in milliseconds
   */
  const resetAutoClose = (id, duration) => {
    cancelAutoClose(id);
    if (duration && duration > 0) {
      setupAutoClose(id, duration);
    }
  };
  
  /**
   * Close a notification
   * @param {string} id - Notification ID
   */
  const closeNotification = (id) => {
    // Cancel auto-close timer
    cancelAutoClose(id);
    
    // Update notifications state
    setNotifications(prevNotifications => 
      prevNotifications.filter(notification => notification.id !== id)
    );
  };
  
  /**
   * Clear all notifications
   */
  const clearAllNotifications = () => {
    // Cancel all timers
    notificationsRef.current.forEach(notification => {
      cancelAutoClose(notification.id);
    });
    
    // Clear notifications
    setNotifications([]);
  };
  
  /**
   * Handle mouse enter (pause auto-close)
   */
  const handleMouseEnter = (id) => {
    if (!pauseOnHover) return;
    
    hoverRef.current = true;
    cancelAutoClose(id);
  };
  
  /**
   * Handle mouse leave (resume auto-close)
   * @param {Object} notification - Notification object
   */
  const handleMouseLeave = (notification) => {
    if (!pauseOnHover) return;
    
    hoverRef.current = false;
    
    if (notification.duration && notification.duration > 0) {
      resetAutoClose(notification.id, notification.duration);
    }
  };
  
  /**
   * Get notification type CSS class
   * @param {string} type - Notification type
   * @returns {string} CSS class
   */
  const getNotificationTypeClass = (type) => {
    switch (type) {
      case 'success':
        return 'notification--success';
      case 'error':
        return 'notification--error';
      case 'warning':
        return 'notification--warning';
      case 'info':
      default:
        return 'notification--info';
    }
  };
  
  /**
   * Get notification type icon
   * @param {string} type - Notification type
   * @returns {string} Icon
   */
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };
  
  /**
   * Render progress bar
   * @param {Object} notification - Notification object
   * @returns {React.Element} Progress bar element
   */
  const renderProgressBar = (notification) => {
    if (!notification.showProgress || !notification.duration || notification.duration <= 0) {
      return null;
    }
    
    return (
      <div className="notification__progress-container">
        <div 
          className="notification__progress-bar"
          style={{
            animationDuration: `${notification.duration}ms`,
            animationPlayState: hoverRef.current ? 'paused' : 'running'
          }}
        />
      </div>
    );
  };
  
  /**
   * Render notification
   * @param {Object} notification - Notification object
   * @returns {React.Element} Notification element
   */
  const renderNotification = (notification) => {
    const typeClass = getNotificationTypeClass(notification.type);
    const icon = getNotificationIcon(notification.type);
    
    return (
      <div 
        key={notification.id}
        className={`notification ${typeClass}`}
        onClick={closeOnClick ? () => closeNotification(notification.id) : undefined}
        onMouseEnter={() => handleMouseEnter(notification.id)}
        onMouseLeave={() => handleMouseLeave(notification)}
        data-testid="notification"
      >
        <div className="notification__content">
          <div className="notification__icon">
            {icon}
          </div>
          <div className="notification__text">
            {notification.title && (
              <div className="notification__title">{notification.title}</div>
            )}
            <div className="notification__message">{notification.message}</div>
          </div>
          {notification.dismissible && (
            <button 
              className="notification__close"
              onClick={(e) => {
                e.stopPropagation();
                closeNotification(notification.id);
              }}
              aria-label="Close notification"
            >
              ✕
            </button>
          )}
        </div>
        {renderProgressBar(notification)}
      </div>
    );
  };
  
  // Don't render anything if notificationRoot is not available
  if (!notificationRoot) {
    return null;
  }
  
  // Create portal for notifications container
  return ReactDOM.createPortal(
    <div 
      className={`notification-container notification-container--${validPosition}`}
      data-testid="notification-center"
    >
      {notifications.map(renderNotification)}
    </div>,
    notificationRoot
  );
};

NotificationCenter.propTypes = {
  position: PropTypes.oneOf([
    'top-right', 'top-center', 'top-left', 
    'bottom-right', 'bottom-center', 'bottom-left'
  ]),
  autoClose: PropTypes.number,
  maxNotifications: PropTypes.number,
  closeOnClick: PropTypes.bool,
  pauseOnHover: PropTypes.bool
};

/**
 * Static methods for notification management
 */
// Show a notification
NotificationCenter.show = (options = {}) => {
  EventBus.publish('notification:show', options);
};

// Show a success notification
NotificationCenter.success = (message, options = {}) => {
  EventBus.publish('notification:show', {
    type: 'success',
    message,
    ...options
  });
};

// Show an error notification
NotificationCenter.error = (message, options = {}) => {
  EventBus.publish('notification:show', {
    type: 'error',
    message,
    ...options
  });
};

// Show a warning notification
NotificationCenter.warning = (message, options = {}) => {
  EventBus.publish('notification:show', {
    type: 'warning',
    message,
    ...options
  });
};

// Show an info notification
NotificationCenter.info = (message, options = {}) => {
  EventBus.publish('notification:show', {
    type: 'info',
    message,
    ...options
  });
};

// Clear all notifications
NotificationCenter.clear = () => {
  EventBus.publish('notification:clear', {});
};

export default registry.register(
  'components.NotificationCenter',
  NotificationCenter,
  [
    'utils.EventBus'
  ],
  {
    description: 'Provides a system for displaying notifications to the user',
    usage: 'Used throughout the application to show toast messages, alerts, and status updates'
  }
); 