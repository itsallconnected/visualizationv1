import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * Provides an interface for creating connections between nodes
 * Manages the node connection workflow
 */
const NodeConnectionTool = ({
  isActive = false,
  onConnectionComplete = () => {},
  onCancel = () => {}
}) => {
  // State
  const [sourceNode, setSourceNode] = useState(null);
  const [targetNode, setTargetNode] = useState(null);
  const [connectionType, setConnectionType] = useState('default');
  const [step, setStep] = useState('select_source');
  const [availableConnectionTypes, setAvailableConnectionTypes] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  
  // Get required services
  const nodeConnectionManager = registry.get('visualization.NodeConnectionManager');
  const visualizationManager = registry.get('visualization.VisualizationManager');
  const modalManager = registry.get('components.ModalManager');
  
  // Initialize connection types
  useEffect(() => {
    if (nodeConnectionManager) {
      // Get available connection types from the connection manager
      const types = nodeConnectionManager.getConnectionTypes() || [];
      setAvailableConnectionTypes(types);
      
      // Set default connection type if available
      if (types.length > 0) {
        setConnectionType(types[0].id);
      }
    }
  }, []);
  
  // Handle activation/deactivation
  useEffect(() => {
    setIsVisible(isActive);
    
    if (isActive) {
      // Reset the workflow when activated
      resetConnectionWorkflow();
      
      // Subscribe to relevant events
      addEventListener();
    } else {
      // Clean up when deactivated
      removeEventListener();
    }
    
    return () => {
      // Clean up on unmount
      removeEventListener();
    };
  }, [isActive]);
  
  // Add event listeners for node selection
  const addEventListener = () => {
    EventBus.subscribe('node:selected', handleNodeSelection);
  };
  
  // Remove event listeners
  const removeEventListener = () => {
    EventBus.unsubscribe('node:selected', handleNodeSelection);
  };
  
  /**
   * Handle node selection events
   * @param {Object} data - Event data with nodeId and node
   */
  const handleNodeSelection = (data) => {
    const { nodeId, node } = data;
    
    if (!node) return;
    
    // Handle node selection based on current step
    switch (step) {
      case 'select_source':
        // Set as source node
        setSourceNode(node);
        setStep('select_target');
        
        // Highlight source node
        if (nodeConnectionManager) {
          nodeConnectionManager.highlightSourceNode(nodeId);
        }
        break;
        
      case 'select_target':
        // Don't allow selecting the same node as source and target
        if (sourceNode && sourceNode.id === nodeId) {
          showError('Cannot connect a node to itself. Please select a different target node.');
          return;
        }
        
        // Set as target node
        setTargetNode(node);
        setStep('select_type');
        
        // Highlight target node
        if (nodeConnectionManager) {
          nodeConnectionManager.highlightTargetNode(nodeId);
        }
        
        // Show connection type selection if there are multiple types
        if (availableConnectionTypes.length > 1) {
          showConnectionTypeDialog();
        } else {
          // Otherwise, proceed with the default type
          createConnection();
        }
        break;
        
      default:
        break;
    }
  };
  
  /**
   * Show connection type selection dialog
   */
  const showConnectionTypeDialog = () => {
    if (!modalManager) return;
    
    const ConnectionTypeDialog = ({ onClose }) => (
      <div className="connection-type-dialog">
        <div className="connection-type-dialog__header">
          <h3>Select Connection Type</h3>
          <button 
            className="connection-type-dialog__close"
            onClick={() => {
              resetConnectionWorkflow();
              onClose();
            }}
          >
            ✕
          </button>
        </div>
        <div className="connection-type-dialog__body">
          <ul className="connection-type-dialog__list">
            {availableConnectionTypes.map(type => (
              <li 
                key={type.id}
                className={`connection-type-dialog__item ${connectionType === type.id ? 'selected' : ''}`}
                onClick={() => setConnectionType(type.id)}
              >
                <div className="connection-type-dialog__type-name">
                  {type.name}
                </div>
                <div className="connection-type-dialog__type-description">
                  {type.description}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="connection-type-dialog__footer">
          <button 
            className="connection-type-dialog__cancel-button"
            onClick={() => {
              resetConnectionWorkflow();
              onClose();
            }}
          >
            Cancel
          </button>
          <button 
            className="connection-type-dialog__confirm-button"
            onClick={() => {
              createConnection();
              onClose();
            }}
          >
            Create Connection
          </button>
        </div>
      </div>
    );
    
    modalManager.show('connection-type-selection', ConnectionTypeDialog, {}, {
      closeOnEsc: true,
      closeOnOutsideClick: false,
      onClose: () => {
        // Reset workflow if modal is closed without selection
        resetConnectionWorkflow();
      }
    });
  };
  
  /**
   * Create a connection between selected nodes
   */
  const createConnection = () => {
    if (!sourceNode || !targetNode) {
      showError('Source and target nodes must be selected');
      return;
    }
    
    try {
      // Create the connection
      if (nodeConnectionManager) {
        const connectionData = {
          sourceId: sourceNode.id,
          targetId: targetNode.id,
          type: connectionType,
          properties: {
            created_at: new Date().toISOString()
          }
        };
        
        const newConnection = nodeConnectionManager.createConnection(connectionData);
        
        // Notify user of success
        showSuccess('Connection created successfully');
        
        // Call completion handler
        if (onConnectionComplete) {
          onConnectionComplete(newConnection);
        }
      }
    } catch (error) {
      showError(`Failed to create connection: ${error.message}`);
    } finally {
      // Reset the workflow
      resetConnectionWorkflow();
    }
  };
  
  /**
   * Reset the connection workflow to initial state
   */
  const resetConnectionWorkflow = () => {
    setSourceNode(null);
    setTargetNode(null);
    setStep('select_source');
    
    // Clear highlights
    if (nodeConnectionManager) {
      nodeConnectionManager.clearHighlights();
    }
  };
  
  /**
   * Handle cancel button click
   */
  const handleCancel = () => {
    resetConnectionWorkflow();
    
    if (onCancel) {
      onCancel();
    }
  };
  
  /**
   * Show error message
   * @param {string} message - Error message
   */
  const showError = (message) => {
    if (modalManager) {
      modalManager.alert({
        title: 'Error',
        message: message,
        buttonText: 'OK'
      });
    } else {
      alert(message);
    }
  };
  
  /**
   * Show success message
   * @param {string} message - Success message
   */
  const showSuccess = (message) => {
    // Use notification or toast if available
    EventBus.publish('notification:show', {
      type: 'success',
      message: message,
      duration: 3000
    });
  };
  
  /**
   * Get instruction text based on current step
   * @returns {string} Instruction text
   */
  const getInstructionText = () => {
    switch (step) {
      case 'select_source':
        return 'Select the source node';
      case 'select_target':
        return 'Select the target node';
      case 'select_type':
        return 'Select connection type';
      default:
        return '';
    }
  };
  
  // Don't render if not visible
  if (!isVisible) {
    return null;
  }
  
  return (
    <div className="node-connection-tool">
      <div className="node-connection-tool__header">
        <h3 className="node-connection-tool__title">Create Connection</h3>
        <button 
          className="node-connection-tool__close-button"
          onClick={handleCancel}
          title="Cancel"
        >
          ✕
        </button>
      </div>
      
      <div className="node-connection-tool__content">
        <div className="node-connection-tool__instruction">
          {getInstructionText()}
        </div>
        
        <div className="node-connection-tool__status">
          <div className="node-connection-tool__step">
            <div className={`node-connection-tool__step-indicator ${step === 'select_source' ? 'active' : (sourceNode ? 'completed' : '')}`}>
              1
            </div>
            <div className="node-connection-tool__step-label">
              Source Node
            </div>
            <div className="node-connection-tool__step-value">
              {sourceNode ? sourceNode.name : '-'}
            </div>
          </div>
          
          <div className="node-connection-tool__connector">→</div>
          
          <div className="node-connection-tool__step">
            <div className={`node-connection-tool__step-indicator ${step === 'select_target' ? 'active' : (targetNode ? 'completed' : '')}`}>
              2
            </div>
            <div className="node-connection-tool__step-label">
              Target Node
            </div>
            <div className="node-connection-tool__step-value">
              {targetNode ? targetNode.name : '-'}
            </div>
          </div>
          
          <div className="node-connection-tool__connector">→</div>
          
          <div className="node-connection-tool__step">
            <div className={`node-connection-tool__step-indicator ${step === 'select_type' ? 'active' : ''}`}>
              3
            </div>
            <div className="node-connection-tool__step-label">
              Connection Type
            </div>
            <div className="node-connection-tool__step-value">
              {connectionType ? (availableConnectionTypes.find(t => t.id === connectionType)?.name || connectionType) : '-'}
            </div>
          </div>
        </div>
      </div>
      
      <div className="node-connection-tool__footer">
        <button 
          className="node-connection-tool__cancel-button"
          onClick={handleCancel}
        >
          Cancel
        </button>
        {step === 'select_type' && (
          <button 
            className="node-connection-tool__create-button"
            onClick={createConnection}
          >
            Create Connection
          </button>
        )}
      </div>
    </div>
  );
};

NodeConnectionTool.propTypes = {
  isActive: PropTypes.bool,
  onConnectionComplete: PropTypes.func,
  onCancel: PropTypes.func
};

export default registry.register(
  'components.NodeConnectionTool',
  NodeConnectionTool,
  [
    'visualization.NodeConnectionManager',
    'visualization.VisualizationManager',
    'components.ModalManager',
    'utils.EventBus'
  ],
  {
    description: 'Provides a tool for creating connections between nodes',
    usage: 'Used in the visualization UI to allow users to create connections between nodes'
  }
); 