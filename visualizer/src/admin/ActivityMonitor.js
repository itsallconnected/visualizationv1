// This is a placeholder file created by the migration script
// To be implemented according to the migration plan

import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * Tracks user activity and provides audit logs for administrators
 * Monitors system events, user actions, and security-related activities
 */
const ActivityMonitor = ({
  maxEntries = 1000,
  refreshInterval = 30000,
  initialFilter = 'all'
}) => {
  // State
  const [activityLogs, setActivityLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilter);
  const [timeRange, setTimeRange] = useState('24h'); // 1h, 24h, 7d, 30d, all
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [sortField, setSortField] = useState('timestamp');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [uniqueUsers, setUniqueUsers] = useState([]);
  const [uniqueActions, setUniqueActions] = useState([]);
  
  // References to services
  const authService = registry.get('auth.AuthService');
  const storageManager = registry.get('utils.StorageManager');
  
  // Event types configuration
  const eventTypes = {
    // User-related events
    'user:login': { label: 'User Login', category: 'auth', icon: '🔑', severity: 'info' },
    'user:logout': { label: 'User Logout', category: 'auth', icon: '🚪', severity: 'info' },
    'user:register': { label: 'User Registration', category: 'auth', icon: '📝', severity: 'info' },
    'user:password:change': { label: 'Password Change', category: 'auth', icon: '🔒', severity: 'info' },
    'user:password:reset': { label: 'Password Reset', category: 'auth', icon: '🔓', severity: 'warning' },
    'user:profile:update': { label: 'Profile Update', category: 'user', icon: '👤', severity: 'info' },
    'user:permission:change': { label: 'Permission Change', category: 'admin', icon: '🛡️', severity: 'warning' },
    
    // Data-related events
    'node:create': { label: 'Node Created', category: 'data', icon: '➕', severity: 'info' },
    'node:update': { label: 'Node Updated', category: 'data', icon: '✏️', severity: 'info' },
    'node:delete': { label: 'Node Deleted', category: 'data', icon: '🗑️', severity: 'warning' },
    'node:decrypt': { label: 'Node Decrypted', category: 'security', icon: '🔓', severity: 'warning' },
    'node:encrypt': { label: 'Node Encrypted', category: 'security', icon: '🔒', severity: 'info' },
    'relationship:create': { label: 'Relationship Created', category: 'data', icon: '🔗', severity: 'info' },
    'relationship:delete': { label: 'Relationship Deleted', category: 'data', icon: '✂️', severity: 'info' },
    
    // Admin-related events
    'admin:setting:change': { label: 'Setting Changed', category: 'admin', icon: '⚙️', severity: 'warning' },
    'admin:user:create': { label: 'User Created', category: 'admin', icon: '👥', severity: 'warning' },
    'admin:user:delete': { label: 'User Deleted', category: 'admin', icon: '❌', severity: 'alert' },
    'admin:user:suspend': { label: 'User Suspended', category: 'admin', icon: '⛔', severity: 'warning' },
    'admin:user:restore': { label: 'User Restored', category: 'admin', icon: '✅', severity: 'info' },
    
    // Security-related events
    'security:login:failed': { label: 'Login Failed', category: 'security', icon: '🚫', severity: 'warning' },
    'security:access:denied': { label: 'Access Denied', category: 'security', icon: '🛑', severity: 'alert' },
    'security:suspicious': { label: 'Suspicious Activity', category: 'security', icon: '⚠️', severity: 'alert' },
    
    // System events
    'system:error': { label: 'System Error', category: 'system', icon: '💥', severity: 'alert' },
    'system:warning': { label: 'System Warning', category: 'system', icon: '⚠️', severity: 'warning' },
    'system:info': { label: 'System Info', category: 'system', icon: 'ℹ️', severity: 'info' },
    'system:startup': { label: 'System Startup', category: 'system', icon: '🚀', severity: 'info' },
    'system:shutdown': { label: 'System Shutdown', category: 'system', icon: '🛑', severity: 'info' }
  };
  
  /**
   * Load activity logs from the storage manager or API
   */
  const loadActivityLogs = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // In a real app, this would likely be an API call
      // For now, we'll use the storage manager as a stand-in
      let logs = [];
      
      if (storageManager) {
        logs = await storageManager.getItem('activityLogs') || [];
      } else {
        // Fallback to mock data if storage manager is not available
        logs = generateMockLogs(50);
      }
      
      // Sort logs by timestamp (newest first)
      logs.sort((a, b) => b.timestamp - a.timestamp);
      
      // Limit to maxEntries
      if (logs.length > maxEntries) {
        logs = logs.slice(0, maxEntries);
      }
      
      setActivityLogs(logs);
      
      // Extract unique users and actions for filters
      const users = [...new Set(logs.map(log => log.userId))].filter(Boolean);
      const actions = [...new Set(logs.map(log => log.type))];
      
      setUniqueUsers(users);
      setUniqueActions(actions);
      
      // Apply filters
      applyFilters(logs, filter, timeRange, userFilter, actionFilter);
    } catch (error) {
      console.error('Error loading activity logs:', error);
      EventBus.publish('notification:show', {
        type: 'error',
        message: 'Failed to load activity logs'
      });
    } finally {
      setIsLoading(false);
    }
  }, [filter, timeRange, userFilter, actionFilter, maxEntries, storageManager]);
  
  /**
   * Generate mock logs for development
   * @param {number} count - Number of logs to generate
   * @returns {Array} - Array of mock logs
   */
  const generateMockLogs = (count) => {
    const logs = [];
    const users = ['admin', 'moderator', 'contributor', 'viewer'];
    const eventKeys = Object.keys(eventTypes);
    const now = Date.now();
    
    for (let i = 0; i < count; i++) {
      const userId = users[Math.floor(Math.random() * users.length)];
      const type = eventKeys[Math.floor(Math.random() * eventKeys.length)];
      const timestamp = now - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000); // Random time in the last week
      
      logs.push({
        id: `log-${i}`,
        timestamp,
        userId,
        type,
        details: `Sample ${eventTypes[type].label} event`,
        ipAddress: '192.168.1.' + Math.floor(Math.random() * 255),
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });
    }
    
    return logs;
  };
  
  /**
   * Apply filters to logs
   * @param {Array} logs - Logs to filter
   * @param {string} categoryFilter - Category filter
   * @param {string} timeRangeFilter - Time range filter
   * @param {string} userIdFilter - User ID filter
   * @param {string} actionTypeFilter - Action type filter
   */
  const applyFilters = (logs, categoryFilter, timeRangeFilter, userIdFilter, actionTypeFilter) => {
    // Apply category filter
    let filtered = logs;
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(log => 
        eventTypes[log.type] && eventTypes[log.type].category === categoryFilter
      );
    }
    
    // Apply time range filter
    const now = Date.now();
    if (timeRangeFilter !== 'all') {
      let timeLimit;
      
      switch (timeRangeFilter) {
        case '1h':
          timeLimit = now - 60 * 60 * 1000;
          break;
        case '24h':
          timeLimit = now - 24 * 60 * 60 * 1000;
          break;
        case '7d':
          timeLimit = now - 7 * 24 * 60 * 60 * 1000;
          break;
        case '30d':
          timeLimit = now - 30 * 24 * 60 * 60 * 1000;
          break;
        default:
          timeLimit = 0;
      }
      
      filtered = filtered.filter(log => log.timestamp >= timeLimit);
    }
    
    // Apply user filter
    if (userIdFilter) {
      filtered = filtered.filter(log => 
        log.userId && log.userId.toLowerCase().includes(userIdFilter.toLowerCase())
      );
    }
    
    // Apply action filter
    if (actionTypeFilter) {
      filtered = filtered.filter(log => 
        log.type && log.type.includes(actionTypeFilter)
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    
    setFilteredLogs(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };
  
  // Initialize and set up event listeners
  useEffect(() => {
    // Load initial logs
    loadActivityLogs();
    
    // Set up refresh interval
    const refreshTimer = setInterval(loadActivityLogs, refreshInterval);
    
    // Track activity events
    const handleActivityEvent = (data) => {
      // Skip if not properly formed
      if (!data || !data.type) return;
      
      const newLog = {
        id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: Date.now(),
        userId: data.userId || (authService ? authService.getCurrentUserId() : 'unknown'),
        type: data.type,
        details: data.details || '',
        ipAddress: data.ipAddress || '127.0.0.1',
        userAgent: data.userAgent || navigator.userAgent
      };
      
      // Add to state
      setActivityLogs(prevLogs => {
        const updatedLogs = [newLog, ...prevLogs];
        
        // Limit size
        if (updatedLogs.length > maxEntries) {
          updatedLogs.length = maxEntries;
        }
        
        // If we have storage manager, persist logs
        if (storageManager) {
          storageManager.setItem('activityLogs', updatedLogs);
        }
        
        return updatedLogs;
      });
      
      // Apply filters to update filtered logs
      setFilteredLogs(prevFiltered => {
        // Check if new log passes current filters
        const passesFilter = (filter === 'all' || 
          (eventTypes[newLog.type] && eventTypes[newLog.type].category === filter));
        
        if (passesFilter) {
          return [newLog, ...prevFiltered];
        }
        
        return prevFiltered;
      });
    };
    
    EventBus.subscribe('activity:log', handleActivityEvent);
    
    // Cleanup on unmount
    return () => {
      clearInterval(refreshTimer);
      EventBus.unsubscribe('activity:log', handleActivityEvent);
    };
  }, [loadActivityLogs, refreshInterval, maxEntries, storageManager, authService, filter]);
  
  /**
   * Handle filter change
   * @param {string} newFilter - New filter value
   */
  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    applyFilters(activityLogs, newFilter, timeRange, userFilter, actionFilter);
  };
  
  /**
   * Handle time range change
   * @param {string} newTimeRange - New time range value
   */
  const handleTimeRangeChange = (newTimeRange) => {
    setTimeRange(newTimeRange);
    applyFilters(activityLogs, filter, newTimeRange, userFilter, actionFilter);
  };
  
  /**
   * Handle user filter change
   * @param {Event} e - Input change event
   */
  const handleUserFilterChange = (e) => {
    const newUserFilter = e.target.value;
    setUserFilter(newUserFilter);
    applyFilters(activityLogs, filter, timeRange, newUserFilter, actionFilter);
  };
  
  /**
   * Handle action filter change
   * @param {string} newActionFilter - New action filter value
   */
  const handleActionFilterChange = (newActionFilter) => {
    setActionFilter(newActionFilter);
    applyFilters(activityLogs, filter, timeRange, userFilter, newActionFilter);
  };
  
  /**
   * Handle sort change
   * @param {string} field - Field to sort by
   */
  const handleSortChange = (field) => {
    // If already sorting by this field, toggle direction
    if (sortField === field) {
      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(newDirection);
      
      // Re-sort with new direction
      const sorted = [...filteredLogs].sort((a, b) => {
        const aValue = a[field];
        const bValue = b[field];
        
        if (newDirection === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
      
      setFilteredLogs(sorted);
    } else {
      // New field, default to descending
      setSortField(field);
      setSortDirection('desc');
      
      // Re-sort with new field
      const sorted = [...filteredLogs].sort((a, b) => {
        const aValue = a[field];
        const bValue = b[field];
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      });
      
      setFilteredLogs(sorted);
    }
  };
  
  /**
   * Clear all logs (with confirmation)
   */
  const handleClearLogs = () => {
    // Show confirmation dialog
    EventBus.publish('modal:show', {
      title: 'Clear Activity Logs',
      component: ({ closeModal, confirmModal }) => (
        <div>
          <p>Are you sure you want to clear all activity logs? This action cannot be undone.</p>
          <div className="modal__buttons">
            <button className="button button--secondary" onClick={closeModal}>Cancel</button>
            <button 
              className="button button--danger" 
              onClick={() => {
                clearLogs();
                confirmModal();
              }}
            >
              Clear Logs
            </button>
          </div>
        </div>
      )
    });
  };
  
  /**
   * Clear logs after confirmation
   */
  const clearLogs = () => {
    setActivityLogs([]);
    setFilteredLogs([]);
    
    // Clear from storage
    if (storageManager) {
      storageManager.setItem('activityLogs', []);
    }
    
    // Log this action
    const clearEvent = {
      type: 'admin:logs:clear',
      details: 'Activity logs cleared by administrator'
    };
    
    EventBus.publish('activity:log', clearEvent);
    
    // Show notification
    EventBus.publish('notification:show', {
      type: 'success',
      message: 'Activity logs cleared successfully'
    });
  };
  
  /**
   * Export logs to JSON file
   */
  const handleExportLogs = () => {
    // Prepare data
    const exportData = JSON.stringify(filteredLogs, null, 2);
    
    // Create blob and download link
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Set download attributes
    link.href = url;
    link.download = `activity-logs-${new Date().toISOString().split('T')[0]}.json`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Log this action
    const exportEvent = {
      type: 'admin:logs:export',
      details: 'Activity logs exported by administrator'
    };
    
    EventBus.publish('activity:log', exportEvent);
    
    // Show notification
    EventBus.publish('notification:show', {
      type: 'success',
      message: 'Activity logs exported successfully'
    });
  };
  
  /**
   * Generate pagination information
   * @returns {Object} - Pagination data
   */
  const getPaginationData = () => {
    const totalItems = filteredLogs.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const visibleLogs = filteredLogs.slice(startIndex, endIndex);
    
    return {
      totalItems,
      totalPages,
      currentPage,
      startIndex,
      endIndex,
      visibleLogs
    };
  };
  
  /**
   * Format timestamp to readable format
   * @param {number} timestamp - Unix timestamp
   * @returns {string} - Formatted date
   */
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  /**
   * Get event type details
   * @param {string} type - Event type
   * @returns {Object} - Event type details
   */
  const getEventDetails = (type) => {
    return eventTypes[type] || { 
      label: type, 
      category: 'unknown', 
      icon: '❓', 
      severity: 'info' 
    };
  };
  
  /**
   * Render category filter
   * @returns {React.Element} - Category filter
   */
  const renderCategoryFilter = () => {
    const categories = [
      { id: 'all', label: 'All Categories' },
      { id: 'auth', label: 'Authentication' },
      { id: 'data', label: 'Data Operations' },
      { id: 'user', label: 'User Activity' },
      { id: 'admin', label: 'Admin Actions' },
      { id: 'security', label: 'Security Events' },
      { id: 'system', label: 'System Events' }
    ];
    
    return (
      <div className="activity-monitor__filter activity-monitor__filter--category">
        <label>Category:</label>
        <div className="activity-monitor__button-group">
          {categories.map(category => (
            <button
              key={category.id}
              className={`activity-monitor__filter-button ${filter === category.id ? 'activity-monitor__filter-button--active' : ''}`}
              onClick={() => handleFilterChange(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>
    );
  };
  
  /**
   * Render time range filter
   * @returns {React.Element} - Time range filter
   */
  const renderTimeRangeFilter = () => {
    const ranges = [
      { id: '1h', label: 'Last Hour' },
      { id: '24h', label: 'Last 24 Hours' },
      { id: '7d', label: 'Last 7 Days' },
      { id: '30d', label: 'Last 30 Days' },
      { id: 'all', label: 'All Time' }
    ];
    
    return (
      <div className="activity-monitor__filter activity-monitor__filter--time-range">
        <label>Time Range:</label>
        <select 
          value={timeRange} 
          onChange={(e) => handleTimeRangeChange(e.target.value)}
          className="activity-monitor__select"
        >
          {ranges.map(range => (
            <option key={range.id} value={range.id}>
              {range.label}
            </option>
          ))}
        </select>
      </div>
    );
  };
  
  /**
   * Render user filter
   * @returns {React.Element} - User filter
   */
  const renderUserFilter = () => {
    return (
      <div className="activity-monitor__filter activity-monitor__filter--user">
        <label>User:</label>
        <input
          type="text"
          value={userFilter}
          onChange={handleUserFilterChange}
          placeholder="Filter by user"
          className="activity-monitor__input"
        />
      </div>
    );
  };
  
  /**
   * Render action filter
   * @returns {React.Element} - Action filter
   */
  const renderActionFilter = () => {
    return (
      <div className="activity-monitor__filter activity-monitor__filter--action">
        <label>Action:</label>
        <select 
          value={actionFilter} 
          onChange={(e) => handleActionFilterChange(e.target.value)}
          className="activity-monitor__select"
        >
          <option value="">All Actions</option>
          {uniqueActions.map(action => (
            <option key={action} value={action}>
              {getEventDetails(action).label}
            </option>
          ))}
        </select>
      </div>
    );
  };
  
  /**
   * Render filters section
   * @returns {React.Element} - Filters section
   */
  const renderFilters = () => {
    return (
      <div className="activity-monitor__filters">
        <div className="activity-monitor__filters-row">
          {renderCategoryFilter()}
          {renderTimeRangeFilter()}
        </div>
        <div className="activity-monitor__filters-row">
          {renderUserFilter()}
          {renderActionFilter()}
        </div>
      </div>
    );
  };
  
  /**
   * Render action buttons
   * @returns {React.Element} - Action buttons
   */
  const renderActionButtons = () => {
    return (
      <div className="activity-monitor__actions">
        <button 
          className="activity-monitor__action-button activity-monitor__action-button--export"
          onClick={handleExportLogs}
          disabled={filteredLogs.length === 0}
        >
          Export Logs
        </button>
        <button 
          className="activity-monitor__action-button activity-monitor__action-button--clear"
          onClick={handleClearLogs}
          disabled={filteredLogs.length === 0}
        >
          Clear Logs
        </button>
        <button 
          className="activity-monitor__action-button activity-monitor__action-button--refresh"
          onClick={loadActivityLogs}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
    );
  };
  
  /**
   * Render log severity indicator
   * @param {string} severity - Severity level
   * @returns {React.Element} - Severity indicator
   */
  const renderSeverityIndicator = (severity) => {
    const severityClasses = {
      'info': 'activity-monitor__severity--info',
      'warning': 'activity-monitor__severity--warning',
      'alert': 'activity-monitor__severity--alert'
    };
    
    return (
      <span className={`activity-monitor__severity ${severityClasses[severity] || severityClasses.info}`}>
        {severity}
      </span>
    );
  };
  
  /**
   * Render logs table
   * @returns {React.Element} - Logs table
   */
  const renderLogsTable = () => {
    const { visibleLogs, totalItems } = getPaginationData();
    
    if (isLoading && totalItems === 0) {
      return (
        <div className="activity-monitor__loading">
          Loading activity logs...
        </div>
      );
    }
    
    if (totalItems === 0) {
      return (
        <div className="activity-monitor__empty">
          <p>No activity logs found matching the current filters.</p>
        </div>
      );
    }
    
    return (
      <div className="activity-monitor__table-container">
        <table className="activity-monitor__table">
          <thead>
            <tr>
              <th onClick={() => handleSortChange('timestamp')} className="activity-monitor__sortable">
                Timestamp
                {sortField === 'timestamp' && (
                  <span className="activity-monitor__sort-indicator">
                    {sortDirection === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSortChange('userId')} className="activity-monitor__sortable">
                User
                {sortField === 'userId' && (
                  <span className="activity-monitor__sort-indicator">
                    {sortDirection === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSortChange('type')} className="activity-monitor__sortable">
                Action
                {sortField === 'type' && (
                  <span className="activity-monitor__sort-indicator">
                    {sortDirection === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </th>
              <th>Details</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {visibleLogs.map(log => {
              const eventDetails = getEventDetails(log.type);
              
              return (
                <tr key={log.id} className={`activity-monitor__row activity-monitor__row--${eventDetails.severity}`}>
                  <td className="activity-monitor__cell activity-monitor__cell--timestamp">
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td className="activity-monitor__cell activity-monitor__cell--user">
                    {log.userId || 'Anonymous'}
                  </td>
                  <td className="activity-monitor__cell activity-monitor__cell--action">
                    <span className="activity-monitor__action-icon">{eventDetails.icon}</span>
                    {eventDetails.label}
                    {renderSeverityIndicator(eventDetails.severity)}
                  </td>
                  <td className="activity-monitor__cell activity-monitor__cell--details">
                    {log.details}
                  </td>
                  <td className="activity-monitor__cell activity-monitor__cell--ip">
                    {log.ipAddress}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };
  
  /**
   * Render pagination controls
   * @returns {React.Element} - Pagination controls
   */
  const renderPagination = () => {
    const { totalItems, totalPages, currentPage, startIndex, endIndex } = getPaginationData();
    
    if (totalItems === 0) return null;
    
    return (
      <div className="activity-monitor__pagination">
        <div className="activity-monitor__pagination-info">
          Showing {startIndex + 1}-{endIndex} of {totalItems} logs
        </div>
        <div className="activity-monitor__pagination-controls">
          <button
            className="activity-monitor__pagination-button"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            &laquo; First
          </button>
          <button
            className="activity-monitor__pagination-button"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            &lsaquo; Prev
          </button>
          <span className="activity-monitor__pagination-page">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="activity-monitor__pagination-button"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next &rsaquo;
          </button>
          <button
            className="activity-monitor__pagination-button"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last &raquo;
          </button>
        </div>
        <div className="activity-monitor__pagination-size">
          <label>Items per page:</label>
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="activity-monitor__select"
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>
    );
  };
  
  return (
    <div className="activity-monitor">
      <div className="activity-monitor__header">
        <h2 className="activity-monitor__title">Activity Monitor</h2>
        {renderActionButtons()}
      </div>
      
      {renderFilters()}
      {renderLogsTable()}
      {renderPagination()}
    </div>
  );
};

ActivityMonitor.propTypes = {
  maxEntries: PropTypes.number,
  refreshInterval: PropTypes.number,
  initialFilter: PropTypes.string
};

export default registry.register(
  'admin.ActivityMonitor',
  ActivityMonitor,
  [
    'auth.AuthService',
    'utils.StorageManager',
    'utils.EventBus'
  ],
  {
    description: 'Tracks user activity and provides audit logs for administrators',
    usage: 'Used in the Admin Panel to monitor system events, user actions, and security activities'
  }
);

