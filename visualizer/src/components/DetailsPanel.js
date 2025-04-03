import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * Panel for displaying detailed information about a selected node
 * Shows node properties, relationships, and content sections
 */
const DetailsPanel = ({ 
  isVisible = true,
  position = 'right',
  width = 350,
  initialNode = null
}) => {
  // State
  const [selectedNode, setSelectedNode] = useState(initialNode);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [isOpen, setIsOpen] = useState(true);
  
  // References to services
  const dataService = registry.get('data.DataService');
  const encryptionService = registry.get('encryption.EncryptionService');
  
  // Handle node selection
  useEffect(() => {
    const handleNodeSelected = (data) => {
      const { nodeId } = data;
      loadNodeDetails(nodeId);
    };
    
    const handleNodeDeselected = () => {
      setSelectedNode(null);
    };
    
    const handleDetailsAction = (data) => {
      const { action, nodeId } = data;
      
      if (action === 'show' && nodeId) {
        loadNodeDetails(nodeId);
      } else if (action === 'hide') {
        setSelectedNode(null);
      } else if (action === 'toggle') {
        setIsOpen(prev => !prev);
      }
    };
    
    // Subscribe to events
    EventBus.subscribe('node:selected', handleNodeSelected);
    EventBus.subscribe('node:deselected', handleNodeDeselected);
    EventBus.subscribe('details:action', handleDetailsAction);
    
    // Cleanup subscriptions
    return () => {
      EventBus.unsubscribe('node:selected', handleNodeSelected);
      EventBus.unsubscribe('node:deselected', handleNodeDeselected);
      EventBus.unsubscribe('details:action', handleDetailsAction);
    };
  }, []);
  
  /**
   * Load node details by ID
   * @param {string} nodeId - Node ID
   */
  const loadNodeDetails = async (nodeId) => {
    if (!nodeId || !dataService) return;
    
    setLoading(true);
    try {
      const nodeData = await dataService.getNodeById(nodeId);
      setSelectedNode(nodeData);
      
      // Publish event that details were loaded
      EventBus.publish('details:loaded', { nodeId, nodeData });
    } catch (error) {
      console.error('Error loading node details:', error);
      EventBus.publish('notification:show', {
        type: 'error',
        message: `Failed to load details for node: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Toggle a section's expanded state
   * @param {string} sectionId - Section identifier
   */
  const toggleSection = (sectionId) => {
    setExpanded(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };
  
  /**
   * Handle edit request
   */
  const handleEdit = () => {
    if (!selectedNode) return;
    
    EventBus.publish('node:edit', {
      nodeId: selectedNode.id,
      node: selectedNode
    });
  };
  
  /**
   * Check if content is encrypted
   * @param {Object} node - Node data
   * @returns {boolean} - True if content is encrypted
   */
  const isContentEncrypted = (node) => {
    if (!node || !encryptionService) return false;
    return encryptionService.isContentEncrypted(node);
  };
  
  /**
   * Render node metadata
   * @param {Object} node - Node data
   * @returns {React.Element} - Metadata element
   */
  const renderMetadata = (node) => {
    if (!node) return null;
    
    return (
      <div className="details-panel__metadata">
        <div className="details-panel__metadata-item">
          <span className="details-panel__metadata-label">ID:</span>
          <span className="details-panel__metadata-value">{node.id}</span>
        </div>
        <div className="details-panel__metadata-item">
          <span className="details-panel__metadata-label">Type:</span>
          <span className="details-panel__metadata-value">{node.type}</span>
        </div>
        {node.created && (
          <div className="details-panel__metadata-item">
            <span className="details-panel__metadata-label">Created:</span>
            <span className="details-panel__metadata-value">
              {new Date(node.created).toLocaleString()}
            </span>
          </div>
        )}
        {node.modified && (
          <div className="details-panel__metadata-item">
            <span className="details-panel__metadata-label">Modified:</span>
            <span className="details-panel__metadata-value">
              {new Date(node.modified).toLocaleString()}
            </span>
          </div>
        )}
      </div>
    );
  };
  
  /**
   * Render node description
   * @param {Object} node - Node data
   * @returns {React.Element} - Description element
   */
  const renderDescription = (node) => {
    if (!node || !node.description) return null;
    
    const isEncrypted = encryptionService && 
      encryptionService.isFieldEncrypted(node, 'description');
    
    if (isEncrypted) {
      return (
        <div className="details-panel__section">
          <h3 className="details-panel__section-title" 
            onClick={() => toggleSection('description')}>
            Description
            <span className="details-panel__section-icon">
              {expanded.description ? '▼' : '▶'}
            </span>
          </h3>
          {expanded.description && (
            <div className="details-panel__section-content">
              <div className="details-panel__encrypted-content">
                This content is encrypted. Click to decrypt.
              </div>
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div className="details-panel__section">
        <h3 className="details-panel__section-title" 
          onClick={() => toggleSection('description')}>
          Description
          <span className="details-panel__section-icon">
            {expanded.description ? '▼' : '▶'}
          </span>
        </h3>
        {expanded.description && (
          <div className="details-panel__section-content">
            <p className="details-panel__description">{node.description}</p>
          </div>
        )}
      </div>
    );
  };
  
  /**
   * Render node properties
   * @param {Object} node - Node data
   * @returns {React.Element} - Properties element
   */
  const renderProperties = (node) => {
    if (!node || !node.properties || Object.keys(node.properties).length === 0) {
      return null;
    }
    
    return (
      <div className="details-panel__section">
        <h3 className="details-panel__section-title" 
          onClick={() => toggleSection('properties')}>
          Properties
          <span className="details-panel__section-icon">
            {expanded.properties ? '▼' : '▶'}
          </span>
        </h3>
        {expanded.properties && (
          <div className="details-panel__section-content">
            <table className="details-panel__properties-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(node.properties).map(([key, value]) => {
                  const isEncrypted = encryptionService && 
                    encryptionService.isFieldEncrypted(node, `properties.${key}`);
                  
                  return (
                    <tr key={key}>
                      <td>{key}</td>
                      <td>
                        {isEncrypted ? (
                          <div className="details-panel__encrypted-content">
                            Encrypted
                          </div>
                        ) : (
                          typeof value === 'object' 
                            ? JSON.stringify(value) 
                            : String(value)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };
  
  /**
   * Render node relationships
   * @param {Object} node - Node data
   * @returns {React.Element} - Relationships element
   */
  const renderRelationships = (node) => {
    if (!node || !node.relationships || node.relationships.length === 0) {
      return null;
    }
    
    return (
      <div className="details-panel__section">
        <h3 className="details-panel__section-title" 
          onClick={() => toggleSection('relationships')}>
          Relationships
          <span className="details-panel__section-icon">
            {expanded.relationships ? '▼' : '▶'}
          </span>
        </h3>
        {expanded.relationships && (
          <div className="details-panel__section-content">
            <ul className="details-panel__relationships-list">
              {node.relationships.map((relationship, index) => (
                <li key={index} className="details-panel__relationship-item">
                  <div className="details-panel__relationship-type">
                    {relationship.type}
                  </div>
                  <div className="details-panel__relationship-target"
                    onClick={() => loadNodeDetails(relationship.targetId)}>
                    {relationship.targetName || relationship.targetId}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };
  
  /**
   * Render node content
   * @param {Object} node - Node data
   * @returns {React.Element} - Content element
   */
  const renderContent = (node) => {
    if (!node || !node.content) return null;
    
    const isEncrypted = encryptionService && 
      encryptionService.isFieldEncrypted(node, 'content');
    
    return (
      <div className="details-panel__section">
        <h3 className="details-panel__section-title" 
          onClick={() => toggleSection('content')}>
          Content
          <span className="details-panel__section-icon">
            {expanded.content ? '▼' : '▶'}
          </span>
        </h3>
        {expanded.content && (
          <div className="details-panel__section-content">
            {isEncrypted ? (
              <div className="details-panel__encrypted-content">
                This content is encrypted. Click to decrypt.
              </div>
            ) : (
              <div className="details-panel__content">
                {node.contentType === 'html' ? (
                  <div dangerouslySetInnerHTML={{ __html: node.content }} />
                ) : node.contentType === 'markdown' ? (
                  <div className="details-panel__markdown">
                    {/* Markdown content would be rendered here */}
                    {node.content}
                  </div>
                ) : (
                  <pre className="details-panel__text-content">{node.content}</pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };
  
  /**
   * Render node references
   * @param {Object} node - Node data
   * @returns {React.Element} - References element
   */
  const renderReferences = (node) => {
    if (!node || !node.references || node.references.length === 0) {
      return null;
    }
    
    return (
      <div className="details-panel__section">
        <h3 className="details-panel__section-title" 
          onClick={() => toggleSection('references')}>
          References
          <span className="details-panel__section-icon">
            {expanded.references ? '▼' : '▶'}
          </span>
        </h3>
        {expanded.references && (
          <div className="details-panel__section-content">
            <ul className="details-panel__references-list">
              {node.references.map((reference, index) => (
                <li key={index} className="details-panel__reference-item">
                  <div className="details-panel__reference-title">
                    {reference.title}
                  </div>
                  {reference.url && (
                    <a 
                      href={reference.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="details-panel__reference-link"
                    >
                      {reference.url}
                    </a>
                  )}
                  {reference.description && (
                    <div className="details-panel__reference-description">
                      {reference.description}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };
  
  /**
   * Render the panel content
   * @returns {React.Element} - Panel content
   */
  const renderPanelContent = () => {
    if (loading) {
      return (
        <div className="details-panel__loading">
          Loading node details...
        </div>
      );
    }
    
    if (!selectedNode) {
      return (
        <div className="details-panel__empty">
          <p>No node selected</p>
          <p>Click on a node in the visualization to view its details</p>
        </div>
      );
    }
    
    return (
      <>
        <div className="details-panel__header">
          <h2 className="details-panel__title">
            {isContentEncrypted(selectedNode) && (
              <span className="details-panel__lock-icon">🔒</span>
            )}
            {selectedNode.name || selectedNode.id}
          </h2>
          <div className="details-panel__actions">
            <button 
              className="details-panel__action-button" 
              onClick={handleEdit}
              title="Edit node"
            >
              ✏️
            </button>
            <button 
              className="details-panel__action-button" 
              onClick={() => setSelectedNode(null)}
              title="Close details"
            >
              ✕
            </button>
          </div>
        </div>
        
        <div className="details-panel__content-container">
          {renderMetadata(selectedNode)}
          {renderDescription(selectedNode)}
          {renderProperties(selectedNode)}
          {renderRelationships(selectedNode)}
          {renderContent(selectedNode)}
          {renderReferences(selectedNode)}
        </div>
      </>
    );
  };
  
  // Set panel position styles
  const getPanelStyles = () => {
    const styles = {
      width: `${width}px`
    };
    
    // Position the panel
    switch (position) {
      case 'left':
        styles.left = 0;
        break;
      case 'right':
      default:
        styles.right = 0;
        break;
    }
    
    return styles;
  };
  
  // Don't render if not visible
  if (!isVisible) {
    return null;
  }
  
  return (
    <div 
      className={`details-panel details-panel--${position} ${isOpen ? 'details-panel--open' : 'details-panel--closed'}`}
      style={getPanelStyles()}
    >
      {!isOpen ? (
        <div 
          className="details-panel__toggle"
          onClick={() => setIsOpen(true)}
          title="Open details panel"
        >
          {position === 'left' ? '▶' : '◀'}
        </div>
      ) : (
        <div 
          className="details-panel__toggle"
          onClick={() => setIsOpen(false)}
          title="Close details panel"
        >
          {position === 'left' ? '◀' : '▶'}
        </div>
      )}
      
      {isOpen && (
        <div className="details-panel__container">
          {renderPanelContent()}
        </div>
      )}
    </div>
  );
};

DetailsPanel.propTypes = {
  isVisible: PropTypes.bool,
  position: PropTypes.oneOf(['left', 'right']),
  width: PropTypes.number,
  initialNode: PropTypes.object
};

export default registry.register(
  'components.DetailsPanel',
  DetailsPanel,
  [
    'data.DataService',
    'encryption.EncryptionService',
    'utils.EventBus'
  ],
  {
    description: 'Panel for displaying detailed information about a selected node',
    usage: 'Used in the main visualization view to show node details when selected'
  }
); 