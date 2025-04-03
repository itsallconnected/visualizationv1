import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * BreadcrumbTrail component displays the hierarchical navigation path for the selected node.
 * 
 * This component provides users with context about their current location in the node hierarchy
 * and enables easy navigation to parent/ancestor nodes. Features include:
 * - Dynamic path generation based on selected node
 * - Configurable path truncation for long paths
 * - Visual indicators for node types
 * - Interactive navigation to any node in the path
 * - Accessibility support for keyboard navigation
 * - Full path modal for viewing complete hierarchical paths
 * 
 * @component
 */
const BreadcrumbTrail = ({
  maxItems = 5,
  separator = '/',
  rootLabel = 'Home',
  showIcons = true,
  iconSize = 16,
  ariaLabel = 'Navigation breadcrumbs'
}) => {
  // Component state
  const [path, setPath] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [truncated, setTruncated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Get services from registry
  const dataService = registry.get('data.DataService');
  const errorHandler = registry.get('utils.ErrorHandler');
  
  /**
   * Update the breadcrumb path when a node is selected
   * @param {Object} data - Event data containing nodeId
   */
  const handleNodeSelected = useCallback(async (data) => {
    const { nodeId } = data;
    setSelectedNodeId(nodeId);
    await updatePath(nodeId);
  }, []);
  
  /**
   * Clear path when a node is deselected
   */
  const handleNodeDeselected = useCallback(() => {
    setSelectedNodeId(null);
    setPath([]);
    setError(null);
  }, []);
  
  /**
   * Handle breadcrumb navigation actions
   * @param {Object} data - Event data containing action and nodeId
   */
  const handleBreadcrumbAction = useCallback((data) => {
    const { action, nodeId } = data;
    
    if (action === 'navigate' && nodeId) {
      navigateToNode(nodeId);
    }
  }, []);
  
  // Subscribe to events
  useEffect(() => {
    EventBus.subscribe('node:selected', handleNodeSelected);
    EventBus.subscribe('node:deselected', handleNodeDeselected);
    EventBus.subscribe('breadcrumb:action', handleBreadcrumbAction);
    
    // Cleanup subscriptions on unmount
    return () => {
      EventBus.unsubscribe('node:selected', handleNodeSelected);
      EventBus.unsubscribe('node:deselected', handleNodeDeselected);
      EventBus.unsubscribe('breadcrumb:action', handleBreadcrumbAction);
    };
  }, [handleNodeSelected, handleNodeDeselected, handleBreadcrumbAction]);
  
  /**
   * Update the breadcrumb path for a node
   * @param {string} nodeId - Node ID
   */
  const updatePath = async (nodeId) => {
    if (!nodeId || !dataService) {
      setPath([]);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get the node's hierarchical path
      const nodePath = await dataService.getNodePath(nodeId);
      
      // Add root to the beginning if not present
      if (nodePath.length === 0 || nodePath[0].id !== 'root') {
        nodePath.unshift({
          id: 'root',
          name: rootLabel,
          type: 'root'
        });
      }
      
      // Check if path needs truncation
      if (nodePath.length > maxItems) {
        const truncatedPath = truncatePath(nodePath, maxItems);
        setPath(truncatedPath);
        setTruncated(true);
      } else {
        setPath(nodePath);
        setTruncated(false);
      }
      
      // Notify path update
      EventBus.publish('breadcrumb:updated', { 
        nodeId, 
        path: nodePath,
        truncated: nodePath.length > maxItems
      });
    } catch (error) {
      const errorMessage = 'Failed to load node path';
      setError(errorMessage);
      setPath([]);
      
      // Log error
      console.error('Error loading node path:', error);
      
      // Use error handler if available
      if (errorHandler) {
        errorHandler.handleError(error, {
          context: 'BreadcrumbTrail.updatePath',
          nodeId,
          message: errorMessage
        });
      }
      
      // Notify error
      EventBus.publish('breadcrumb:error', { 
        nodeId,
        error: errorMessage,
        originalError: error
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Truncate the path to fit within maxItems
   * @param {Array} fullPath - Complete path of nodes
   * @param {number} max - Maximum number of items to display
   * @returns {Array} - Truncated path
   */
  const truncatePath = (fullPath, max) => {
    if (fullPath.length <= max) return fullPath;
    
    // Always keep the root and current (last) node
    const truncatedPath = [
      // First item (root)
      fullPath[0],
      
      // Ellipsis item for truncation
      {
        id: 'ellipsis',
        name: '...',
        type: 'ellipsis',
        fullPath
      }
    ];
    
    // Add the last (max - 2) items
    const lastItemsStartIndex = fullPath.length - (max - 2);
    truncatedPath.push(...fullPath.slice(lastItemsStartIndex));
    
    return truncatedPath;
  };
  
  /**
   * Handle click on the ellipsis
   * Shows a modal with the full path
   * @param {Object} ellipsisItem - Ellipsis item with full path
   */
  const handleEllipsisClick = (ellipsisItem) => {
    const modalManager = registry.get('components.ModalManager');
    
    if (modalManager) {
      // Use the ModalManager component to show the full path
      modalManager.show({
        component: FullPathModal,
        props: {
          path: ellipsisItem.fullPath,
          onNodeClick: navigateToNode
        },
        title: 'Full Navigation Path',
        size: 'small',
        position: 'center'
      });
    } else {
      // Fallback if modal manager is not available
      EventBus.publish('modal:show', {
        component: FullPathModal,
        props: {
          path: ellipsisItem.fullPath,
          onNodeClick: navigateToNode
        },
        title: 'Full Navigation Path',
        size: 'small',
        position: 'center'
      });
    }
  };
  
  /**
   * Navigate to a node in the path
   * @param {string} nodeId - Node ID
   */
  const navigateToNode = (nodeId) => {
    if (nodeId === selectedNodeId) return;
    
    // Publish navigation event
    EventBus.publish('node:navigate', { 
      nodeId,
      source: 'breadcrumb'
    });
  };
  
  /**
   * Get icon for a node type
   * @param {string} type - Node type
   * @returns {string} - Icon character
   */
  const getNodeTypeIcon = (type) => {
    switch (type) {
      case 'root':
        return '🏠'; // Home
      case 'component_group':
        return '📦'; // Package
      case 'component':
        return '🧩'; // Puzzle Piece
      case 'subcomponent':
        return '🔧'; // Wrench
      case 'capability':
        return '⚙️'; // Gear
      case 'function':
        return '🔍'; // Magnifying Glass
      case 'specification':
        return '📝'; // Note
      case 'integration':
        return '🔌'; // Plug
      case 'technique':
        return '🛠️'; // Hammer and Wrench
      case 'application':
        return '📱'; // Mobile Phone
      case 'input':
        return '📥'; // Inbox
      case 'output':
        return '📤'; // Outbox
      case 'ellipsis':
        return '•••'; // Text ellipsis
      default:
        return '📄'; // Document
    }
  };
  
  /**
   * Render a breadcrumb item
   * @param {Object} item - Breadcrumb item
   * @param {number} index - Item index
   * @param {number} total - Total number of items
   * @returns {React.Element} - Breadcrumb item element
   */
  const renderBreadcrumbItem = (item, index, total) => {
    const isLast = index === total - 1;
    const isEllipsis = item.id === 'ellipsis';
    const isInteractive = !isLast || isEllipsis;
    
    return (
      <React.Fragment key={item.id}>
        <li 
          className={`breadcrumb__item ${isLast ? 'breadcrumb__item--active' : ''} ${isEllipsis ? 'breadcrumb__item--ellipsis' : ''}`}
          onClick={() => isEllipsis ? handleEllipsisClick(item) : navigateToNode(item.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              isEllipsis ? handleEllipsisClick(item) : navigateToNode(item.id);
            }
          }}
          title={isEllipsis ? 'Show full path' : item.name}
          tabIndex={isInteractive ? 0 : -1}
          role={isInteractive ? 'button' : 'listitem'}
          aria-current={isLast ? 'page' : undefined}
          data-node-id={item.id}
          data-node-type={item.type}
        >
          {showIcons && (
            <span 
              className="breadcrumb__icon" 
              aria-hidden="true" 
              style={{ fontSize: `${iconSize}px` }}
            >
              {getNodeTypeIcon(item.type)}
            </span>
          )}
          <span className="breadcrumb__text">{item.name}</span>
        </li>
        {!isLast && (
          <li 
            className="breadcrumb__separator" 
            aria-hidden="true"
          >
            {separator}
          </li>
        )}
      </React.Fragment>
    );
  };
  
  // Show loading indicator if loading path
  if (isLoading) {
    return (
      <nav className="breadcrumb breadcrumb--loading" aria-label={ariaLabel}>
        <div className="breadcrumb__loading">Loading path...</div>
      </nav>
    );
  }
  
  // Show error if there was a problem loading the path
  if (error) {
    return (
      <nav className="breadcrumb breadcrumb--error" aria-label={ariaLabel}>
        <div className="breadcrumb__error">{error}</div>
      </nav>
    );
  }
  
  // Don't render if path is empty
  if (path.length === 0) {
    return null;
  }
  
  return (
    <nav 
      className={`breadcrumb ${truncated ? 'breadcrumb--truncated' : ''}`} 
      aria-label={ariaLabel}
    >
      <ol className="breadcrumb__list">
        {path.map((item, index) => renderBreadcrumbItem(item, index, path.length))}
      </ol>
    </nav>
  );
};

/**
 * Modal for displaying full path
 * Renders a complete hierarchical path with navigation capabilities
 */
const FullPathModal = ({ path, onNodeClick, closeModal }) => {
  return (
    <div className="breadcrumb-modal">
      <ul className="breadcrumb-modal__list" role="list">
        {path.map((item) => (
          <li 
            key={item.id}
            className="breadcrumb-modal__item"
            onClick={() => {
              onNodeClick(item.id);
              closeModal();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNodeClick(item.id);
                closeModal();
              }
            }}
            tabIndex={0}
            role="button"
            data-node-id={item.id}
            data-node-type={item.type}
          >
            <span className="breadcrumb-modal__icon" aria-hidden="true">
              {item.type === 'ellipsis' ? '•••' : null}
            </span>
            <span className="breadcrumb-modal__text">{item.name}</span>
            <span className="breadcrumb-modal__type">({item.type})</span>
          </li>
        ))}
      </ul>
      <div className="breadcrumb-modal__footer">
        <button 
          className="breadcrumb-modal__close"
          onClick={closeModal}
        >
          Close
        </button>
      </div>
    </div>
  );
};

FullPathModal.propTypes = {
  /** Complete node path */
  path: PropTypes.array.isRequired,
  
  /** Callback for node selection */
  onNodeClick: PropTypes.func.isRequired,
  
  /** Function to close the modal */
  closeModal: PropTypes.func.isRequired
};

BreadcrumbTrail.propTypes = {
  /** Maximum number of items to display before truncating */
  maxItems: PropTypes.number,
  
  /** Separator character or element between breadcrumb items */
  separator: PropTypes.string,
  
  /** Label for the root node */
  rootLabel: PropTypes.string,
  
  /** Whether to show type icons */
  showIcons: PropTypes.bool,
  
  /** Size of icons in pixels */
  iconSize: PropTypes.number,
  
  /** Accessible label for the breadcrumb navigation */
  ariaLabel: PropTypes.string
};

export default registry.register(
  'components.BreadcrumbTrail',
  BreadcrumbTrail,
  [
    'data.DataService',
    'utils.EventBus',
    'utils.ErrorHandler',
    'components.ModalManager'
  ],
  {
    description: 'Displays the hierarchy path and allows navigation through ancestor nodes',
    usage: 'Used in the visualization header to show the current location in the hierarchy',
    examples: [
      {
        name: 'Basic usage',
        code: `<BreadcrumbTrail maxItems={5} rootLabel="Home" />`
      },
      {
        name: 'Custom separator',
        code: `<BreadcrumbTrail separator=">" />`
      },
      {
        name: 'Without icons',
        code: `<BreadcrumbTrail showIcons={false} />`
      }
    ]
  }
); 