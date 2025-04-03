// This is a placeholder file created by the migration script
// To be implemented according to the migration plan

import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * Provides an interface for content moderation and approval workflows
 * Allows moderators to review, approve, reject, and manage content
 */
const ContentModeration = ({
  initialFilter = 'pending'
}) => {
  // State
  const [contentItems, setContentItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filter, setFilter] = useState(initialFilter);
  const [isLoading, setIsLoading] = useState(true);
  const [approvalData, setApprovalData] = useState({
    notes: '',
    decision: null
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('submittedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // References to services
  const dataService = registry.get('data.DataService');
  const authService = registry.get('auth.AuthService');
  
  // Content status options
  const statusOptions = [
    { id: 'pending', label: 'Pending Review', color: '#FFA500' },
    { id: 'approved', label: 'Approved', color: '#00C853' },
    { id: 'rejected', label: 'Rejected', color: '#F44336' },
    { id: 'flagged', label: 'Flagged', color: '#FF5722' },
    { id: 'all', label: 'All Content', color: '#2196F3' }
  ];
  
  /**
   * Load content items for moderation
   */
  const loadContentItems = useCallback(async () => {
    setIsLoading(true);
    
    try {
      let items = [];
      
      // In a real app, this would use dataService to load content
      if (dataService) {
        // Assuming the dataService has a method for fetching content needing moderation
        items = await dataService.getContentForModeration();
      } else {
        // Generate mock data for development
        items = generateMockContentItems(30);
      }
      
      setContentItems(items);
      applyFilters(items, filter, searchQuery);
    } catch (error) {
      console.error('Error loading content for moderation:', error);
      EventBus.publish('notification:show', {
        type: 'error',
        message: 'Failed to load content items'
      });
    } finally {
      setIsLoading(false);
    }
  }, [filter, searchQuery, dataService]);
  
  /**
   * Generate mock content items for development
   * @param {number} count - Number of items to generate
   * @returns {Array} - Array of mock content items
   */
  const generateMockContentItems = (count) => {
    const items = [];
    const users = ['user1', 'user2', 'user3', 'contributor1', 'contributor2'];
    const types = ['node:create', 'node:update', 'node:delete', 'relationship:create', 'relationship:delete'];
    const statuses = ['pending', 'approved', 'rejected', 'flagged'];
    const now = Date.now();
    
    for (let i = 0; i < count; i++) {
      const userId = users[Math.floor(Math.random() * users.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const submittedAt = now - Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000); // Random time in the last 2 weeks
      
      const reviewedAt = status !== 'pending' 
        ? submittedAt + Math.floor(Math.random() * 2 * 24 * 60 * 60 * 1000) // 0-2 days after submission
        : null;
      
      const reviewerId = status !== 'pending' 
        ? ['moderator1', 'moderator2', 'admin'][Math.floor(Math.random() * 3)]
        : null;
      
      items.push({
        id: `content-${i + 1}`,
        title: `${type.split(':')[0].charAt(0).toUpperCase() + type.split(':')[0].slice(1)} ${type.split(':')[1]}`,
        description: `Sample ${type} content item ${i + 1}`,
        type,
        submittedBy: userId,
        submittedAt,
        status,
        reviewedBy: reviewerId,
        reviewedAt,
        notes: status !== 'pending' ? `Sample review notes for item ${i + 1}` : '',
        content: {
          before: type.includes('update') ? { name: 'Old Name', description: 'Old description text' } : null,
          after: { name: 'New Name', description: 'New description text with some changes that need approval' }
        },
        changes: type.includes('update') ? [
          { field: 'name', from: 'Old Name', to: 'New Name' },
          { field: 'description', from: 'Old description text', to: 'New description text with some changes that need approval' }
        ] : []
      });
    }
    
    return items;
  };
  
  /**
   * Apply filters to content items
   * @param {Array} items - Items to filter
   * @param {string} statusFilter - Status filter
   * @param {string} query - Search query
   */
  const applyFilters = (items, statusFilter, query) => {
    let filtered = items;
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }
    
    // Apply search query
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(lowerQuery) ||
        item.description.toLowerCase().includes(lowerQuery) ||
        item.submittedBy.toLowerCase().includes(lowerQuery) ||
        (item.reviewedBy && item.reviewedBy.toLowerCase().includes(lowerQuery))
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
    
    setFilteredItems(filtered);
    
    // Reset selection if the current selection is no longer in the filtered list
    if (selectedItemId && !filtered.some(item => item.id === selectedItemId)) {
      setSelectedItemId(null);
      setSelectedItem(null);
    }
    
    // Reset to first page when filters change
    setCurrentPage(1);
  };
  
  // Initialize component
  useEffect(() => {
    loadContentItems();
    
    // Listen for content update events
    const handleContentUpdate = () => {
      loadContentItems();
    };
    
    EventBus.subscribe('content:updated', handleContentUpdate);
    
    return () => {
      EventBus.unsubscribe('content:updated', handleContentUpdate);
    };
  }, [loadContentItems]);
  
  /**
   * Load item details
   * @param {string} itemId - Item ID
   */
  const loadItemDetails = (itemId) => {
    if (!itemId) {
      setSelectedItem(null);
      setSelectedItemId(null);
      setApprovalData({ notes: '', decision: null });
      return;
    }
    
    const item = contentItems.find(item => item.id === itemId);
    
    if (item) {
      setSelectedItem(item);
      setSelectedItemId(itemId);
      setApprovalData({
        notes: item.notes || '',
        decision: item.status !== 'pending' ? item.status : null
      });
    } else {
      EventBus.publish('notification:show', {
        type: 'error',
        message: 'Content item not found'
      });
    }
  };
  
  /**
   * Handle filter change
   * @param {string} newFilter - New filter value
   */
  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    applyFilters(contentItems, newFilter, searchQuery);
  };
  
  /**
   * Handle search query change
   * @param {Event} e - Input change event
   */
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    applyFilters(contentItems, filter, query);
  };
  
  /**
   * Handle approval notes change
   * @param {Event} e - Input change event
   */
  const handleNotesChange = (e) => {
    setApprovalData(prev => ({
      ...prev,
      notes: e.target.value
    }));
  };
  
  /**
   * Handle decision change
   * @param {string} decision - Decision value (approved/rejected)
   */
  const handleDecisionChange = (decision) => {
    setApprovalData(prev => ({
      ...prev,
      decision
    }));
  };
  
  /**
   * Submit moderation decision
   */
  const handleSubmitDecision = async () => {
    if (!selectedItem || !approvalData.decision) {
      EventBus.publish('notification:show', {
        type: 'warning',
        message: 'Please select a decision before submitting'
      });
      return;
    }
    
    try {
      // Get current user ID for reviewer
      const reviewerId = authService ? await authService.getCurrentUserId() : 'moderator1';
      
      // Update content item status
      const updatedItem = {
        ...selectedItem,
        status: approvalData.decision,
        notes: approvalData.notes,
        reviewedBy: reviewerId,
        reviewedAt: Date.now()
      };
      
      // In a real app, this would call an API to update the item
      if (dataService) {
        await dataService.updateContentStatus(selectedItem.id, {
          status: approvalData.decision,
          notes: approvalData.notes,
          reviewedBy: reviewerId
        });
      }
      
      // Update local state
      setContentItems(prev => 
        prev.map(item => item.id === selectedItem.id ? updatedItem : item)
      );
      
      // Update filtered items
      applyFilters(
        contentItems.map(item => item.id === selectedItem.id ? updatedItem : item),
        filter,
        searchQuery
      );
      
      // Update selected item
      setSelectedItem(updatedItem);
      
      // Log the activity
      EventBus.publish('activity:log', {
        type: `content:${approvalData.decision}`,
        userId: reviewerId,
        details: `Content item "${selectedItem.title}" was ${approvalData.decision}`
      });
      
      // Show notification
      EventBus.publish('notification:show', {
        type: 'success',
        message: `The content has been ${approvalData.decision}`
      });
    } catch (error) {
      console.error('Error submitting moderation decision:', error);
      EventBus.publish('notification:show', {
        type: 'error',
        message: 'Failed to submit moderation decision'
      });
    }
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
      const sorted = [...filteredItems].sort((a, b) => {
        const aValue = a[field];
        const bValue = b[field];
        
        if (newDirection === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
      
      setFilteredItems(sorted);
    } else {
      // New field, default to descending
      setSortField(field);
      setSortDirection('desc');
      
      // Re-sort with new field
      const sorted = [...filteredItems].sort((a, b) => {
        const aValue = a[field];
        const bValue = b[field];
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      });
      
      setFilteredItems(sorted);
    }
  };
  
  /**
   * Format timestamp to readable format
   * @param {number} timestamp - Unix timestamp
   * @returns {string} - Formatted date
   */
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  /**
   * Get status color
   * @param {string} status - Status value
   * @returns {string} - Color code
   */
  const getStatusColor = (status) => {
    const statusOption = statusOptions.find(opt => opt.id === status);
    return statusOption ? statusOption.color : '#757575';
  };
  
  /**
   * Get status label
   * @param {string} status - Status value
   * @returns {string} - Status label
   */
  const getStatusLabel = (status) => {
    const statusOption = statusOptions.find(opt => opt.id === status);
    return statusOption ? statusOption.label : status;
  };
  
  /**
   * Generate pagination information
   * @returns {Object} - Pagination data
   */
  const getPaginationData = () => {
    const totalItems = filteredItems.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const visibleItems = filteredItems.slice(startIndex, endIndex);
    
    return {
      totalItems,
      totalPages,
      currentPage,
      startIndex,
      endIndex,
      visibleItems
    };
  };
  
  /**
   * Render status filters
   * @returns {React.Element} - Status filters
   */
  const renderStatusFilters = () => {
    return (
      <div className="content-moderation__filters">
        <div className="content-moderation__filter-buttons">
          {statusOptions.map(status => (
            <button
              key={status.id}
              className={`content-moderation__filter-button ${filter === status.id ? 'content-moderation__filter-button--active' : ''}`}
              onClick={() => handleFilterChange(status.id)}
              style={{ 
                borderColor: status.color,
                backgroundColor: filter === status.id ? status.color : 'transparent',
                color: filter === status.id ? '#fff' : status.color
              }}
            >
              {status.label}
              <span className="content-moderation__filter-count">
                {contentItems.filter(item => status.id === 'all' || item.status === status.id).length}
              </span>
            </button>
          ))}
        </div>
        
        <div className="content-moderation__search">
          <input
            type="text"
            placeholder="Search content..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="content-moderation__search-input"
          />
        </div>
      </div>
    );
  };
  
  /**
   * Render content item list
   * @returns {React.Element} - Content item list
   */
  const renderContentList = () => {
    const { visibleItems, totalItems } = getPaginationData();
    
    if (isLoading && totalItems === 0) {
      return (
        <div className="content-moderation__loading">
          Loading content items...
        </div>
      );
    }
    
    if (totalItems === 0) {
      return (
        <div className="content-moderation__empty">
          <p>No content items found matching the current filters.</p>
        </div>
      );
    }
    
    return (
      <div className="content-moderation__list-container">
        <table className="content-moderation__list">
          <thead>
            <tr>
              <th onClick={() => handleSortChange('title')} className="content-moderation__sortable">
                Title
                {sortField === 'title' && (
                  <span className="content-moderation__sort-indicator">
                    {sortDirection === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSortChange('type')} className="content-moderation__sortable">
                Type
                {sortField === 'type' && (
                  <span className="content-moderation__sort-indicator">
                    {sortDirection === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSortChange('submittedBy')} className="content-moderation__sortable">
                Submitted By
                {sortField === 'submittedBy' && (
                  <span className="content-moderation__sort-indicator">
                    {sortDirection === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSortChange('submittedAt')} className="content-moderation__sortable">
                Date
                {sortField === 'submittedAt' && (
                  <span className="content-moderation__sort-indicator">
                    {sortDirection === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSortChange('status')} className="content-moderation__sortable">
                Status
                {sortField === 'status' && (
                  <span className="content-moderation__sort-indicator">
                    {sortDirection === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map(item => (
              <tr 
                key={item.id} 
                className={`content-moderation__item ${selectedItemId === item.id ? 'content-moderation__item--selected' : ''}`}
                onClick={() => loadItemDetails(item.id)}
              >
                <td className="content-moderation__item-title">{item.title}</td>
                <td className="content-moderation__item-type">{item.type}</td>
                <td className="content-moderation__item-user">{item.submittedBy}</td>
                <td className="content-moderation__item-date">{formatTimestamp(item.submittedAt)}</td>
                <td className="content-moderation__item-status">
                  <span 
                    className="content-moderation__status-badge"
                    style={{ backgroundColor: getStatusColor(item.status) }}
                  >
                    {getStatusLabel(item.status)}
                  </span>
                </td>
              </tr>
            ))}
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
      <div className="content-moderation__pagination">
        <div className="content-moderation__pagination-info">
          Showing {startIndex + 1}-{endIndex} of {totalItems} items
        </div>
        <div className="content-moderation__pagination-controls">
          <button
            className="content-moderation__pagination-button"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            &laquo; First
          </button>
          <button
            className="content-moderation__pagination-button"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            &lsaquo; Prev
          </button>
          <span className="content-moderation__pagination-page">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="content-moderation__pagination-button"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Next &rsaquo;
          </button>
          <button
            className="content-moderation__pagination-button"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last &raquo;
          </button>
        </div>
        <div className="content-moderation__pagination-size">
          <label>Items per page:</label>
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="content-moderation__select"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
    );
  };
  
  /**
   * Render content changes
   * @param {Array} changes - Array of changes
   * @returns {React.Element} - Changes display
   */
  const renderContentChanges = (changes) => {
    if (!changes || changes.length === 0) return null;
    
    return (
      <div className="content-moderation__changes">
        <h4 className="content-moderation__changes-title">Changes</h4>
        <table className="content-moderation__changes-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Previous Value</th>
              <th>New Value</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change, index) => (
              <tr key={index}>
                <td>{change.field}</td>
                <td className="content-moderation__previous-value">{change.from}</td>
                <td className="content-moderation__new-value">{change.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  /**
   * Render content details
   * @returns {React.Element} - Content details
   */
  const renderContentDetails = () => {
    if (!selectedItem) {
      return (
        <div className="content-moderation__no-selection">
          <p>Select an item to review</p>
        </div>
      );
    }
    
    const isPending = selectedItem.status === 'pending';
    
    return (
      <div className="content-moderation__details">
        <div className="content-moderation__details-header">
          <h3 className="content-moderation__details-title">{selectedItem.title}</h3>
          <div className="content-moderation__details-meta">
            <div className="content-moderation__details-type">{selectedItem.type}</div>
            <div className="content-moderation__details-status">
              <span 
                className="content-moderation__status-badge content-moderation__status-badge--large"
                style={{ backgroundColor: getStatusColor(selectedItem.status) }}
              >
                {getStatusLabel(selectedItem.status)}
              </span>
            </div>
          </div>
        </div>
        
        <div className="content-moderation__details-info">
          <div className="content-moderation__details-row">
            <div className="content-moderation__details-label">Submitted By:</div>
            <div className="content-moderation__details-value">{selectedItem.submittedBy}</div>
          </div>
          <div className="content-moderation__details-row">
            <div className="content-moderation__details-label">Submitted:</div>
            <div className="content-moderation__details-value">{formatTimestamp(selectedItem.submittedAt)}</div>
          </div>
          {selectedItem.reviewedBy && (
            <>
              <div className="content-moderation__details-row">
                <div className="content-moderation__details-label">Reviewed By:</div>
                <div className="content-moderation__details-value">{selectedItem.reviewedBy}</div>
              </div>
              <div className="content-moderation__details-row">
                <div className="content-moderation__details-label">Reviewed:</div>
                <div className="content-moderation__details-value">{formatTimestamp(selectedItem.reviewedAt)}</div>
              </div>
            </>
          )}
        </div>
        
        <div className="content-moderation__details-description">
          <p>{selectedItem.description}</p>
        </div>
        
        {renderContentChanges(selectedItem.changes)}
        
        <div className="content-moderation__approval-section">
          <h4 className="content-moderation__approval-title">
            {isPending ? 'Moderation Decision' : 'Review Notes'}
          </h4>
          
          <textarea
            className="content-moderation__notes"
            placeholder="Add notes about your decision..."
            value={approvalData.notes}
            onChange={handleNotesChange}
            disabled={!isPending}
          />
          
          {isPending ? (
            <div className="content-moderation__decision-buttons">
              <button
                className={`content-moderation__decision-button content-moderation__decision-button--reject ${approvalData.decision === 'rejected' ? 'content-moderation__decision-button--active' : ''}`}
                onClick={() => handleDecisionChange('rejected')}
              >
                Reject
              </button>
              <button
                className={`content-moderation__decision-button content-moderation__decision-button--approve ${approvalData.decision === 'approved' ? 'content-moderation__decision-button--active' : ''}`}
                onClick={() => handleDecisionChange('approved')}
              >
                Approve
              </button>
              <button
                className="content-moderation__submit-button"
                onClick={handleSubmitDecision}
                disabled={!approvalData.decision}
              >
                Submit Decision
              </button>
            </div>
          ) : (
            <div className="content-moderation__previous-decision">
              <div className="content-moderation__decision-label">Decision:</div>
              <div className="content-moderation__decision-value">
                <span 
                  className="content-moderation__status-badge"
                  style={{ backgroundColor: getStatusColor(selectedItem.status) }}
                >
                  {getStatusLabel(selectedItem.status)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="content-moderation">
      <div className="content-moderation__header">
        <h2 className="content-moderation__title">Content Moderation</h2>
        <button 
          className="content-moderation__refresh"
          onClick={loadContentItems}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      
      {renderStatusFilters()}
      
      <div className="content-moderation__container">
        <div className="content-moderation__list-view">
          {renderContentList()}
          {renderPagination()}
        </div>
        <div className="content-moderation__detail-view">
          {renderContentDetails()}
        </div>
      </div>
    </div>
  );
};

ContentModeration.propTypes = {
  initialFilter: PropTypes.string
};

export default registry.register(
  'admin.ContentModeration',
  ContentModeration,
  [
    'data.DataService',
    'auth.AuthService',
    'utils.EventBus'
  ],
  {
    description: 'Provides an interface for content moderation and approval workflows',
    usage: 'Used in the Admin Panel to review, approve, and manage content submissions'
  }
);

