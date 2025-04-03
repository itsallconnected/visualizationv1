import React from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * NodeDetailsRenderer component renders detailed information for different node types.
 * 
 * This component is responsible for displaying a selected node's details with specialized
 * rendering logic based on the node type. It supports:
 * - Type-specific field rendering with appropriate layouts
 * - Markdown content rendering for rich text fields
 * - Handling encrypted content display
 * - Interactive literature references and links
 * - Accessibility features for all content
 * - Integration with the encryption system
 * 
 * @component
 */
const NodeDetailsRenderer = ({ 
  node, 
  isEditing = false, 
  encryptionStatus = null,
  onDecryptRequest = null,
  renderOptions = {}
}) => {
  // Get encryption service if available
  const encryptionService = registry.get('encryption.EncryptionService');
  
  if (!node) {
    return <p className="no-node-selected">No node selected</p>;
  }

  /**
   * Check if a specific field is encrypted
   * @param {string} fieldPath - The path to the field (e.g., 'description', 'properties.name')
   * @returns {boolean} - Whether the field is encrypted
   */
  const isFieldEncrypted = (fieldPath) => {
    // Use encryption status if provided
    if (encryptionStatus && encryptionStatus.fields) {
      return encryptionStatus.fields.includes(fieldPath);
    }
    
    // Otherwise check with encryption service
    if (encryptionService) {
      return encryptionService.isFieldEncrypted(node, fieldPath);
    }
    
    return false;
  };
  
  /**
   * Render encrypted content placeholder
   * @param {string} fieldName - Name of the encrypted field
   * @returns {React.Element} - Encrypted content placeholder
   */
  const renderEncryptedContent = (fieldName) => {
    return (
      <div 
        className="encrypted-content"
        onClick={() => handleDecryptRequest(fieldName)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleDecryptRequest(fieldName);
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={`Decrypt ${fieldName}`}
      >
        <span className="encrypted-content__icon" aria-hidden="true">🔒</span>
        <span className="encrypted-content__message">
          This content is encrypted. Click to decrypt.
        </span>
      </div>
    );
  };
  
  /**
   * Handle request to decrypt content
   * @param {string} fieldName - Name of the field to decrypt
   */
  const handleDecryptRequest = (fieldName) => {
    if (onDecryptRequest) {
      onDecryptRequest(fieldName);
    } else {
      // Publish event for decryption request
      EventBus.publish('encryption:decryptRequest', {
        nodeId: node.id,
        field: fieldName
      });
    }
  };

  /**
   * Render common fields available on all node types
   * @returns {React.Element} - Common fields element
   */
  const renderCommonFields = () => (
    <div className="common-fields">
      <h3 className="node-name" id={`node-${node.id}-name`}>
        {node.name}
        {node.isProtected && 
          <span className="protection-indicator" aria-label="Protected node" title="Protected node">🛡️</span>
        }
      </h3>
      
      {node.description && !isFieldEncrypted('description') ? (
        <div className="node-description">
          <ReactMarkdown components={{
            // Define custom rendering for specific markdown elements
            a: ({node, ...props}) => (
              <a {...props} target="_blank" rel="noopener noreferrer" />
            ),
            // Add more custom components as needed
          }}>
            {node.description}
          </ReactMarkdown>
        </div>
      ) : isFieldEncrypted('description') ? (
        <div className="node-description">
          {renderEncryptedContent('description')}
        </div>
      ) : null}
      
      {node.tags && node.tags.length > 0 && (
        <div className="node-tags">
          <h4>Tags</h4>
          <ul className="tags-list">
            {node.tags.map((tag, index) => (
              <li key={index} className="tag-item">{tag}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  /**
   * Render specialized fields based on node type
   * @returns {React.Element} - Type-specific fields element
   */
  const renderTypeSpecificFields = () => {
    switch (node.type) {
      case 'component_group':
        return (
          <div className="type-specific-fields component-group-fields">
            {node.components && (
              <div className="child-nodes">
                <h4>Components</h4>
                <ul>
                  {node.components.map(component => (
                    <li 
                      key={component.id}
                      className="child-node-item"
                      onClick={() => handleNodeClick(component.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleNodeClick(component.id);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                    >
                      {component.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      
      case 'component':
        return (
          <div className="type-specific-fields component-fields">
            {renderField('objective', 'Objective')}
            {renderField('key_challenges', 'Key Challenges')}
            {renderChildNodes('subcomponents', 'Subcomponents')}
          </div>
        );
      
      case 'subcomponent':
        return (
          <div className="type-specific-fields subcomponent-fields">
            {renderField('approaches', 'Approaches')}
            {renderField('current_implementation', 'Current Implementation')}
            {renderChildNodes('capabilities', 'Capabilities')}
            {renderImplementedBy()}
          </div>
        );
      
      case 'capability':
        return (
          <div className="type-specific-fields capability-fields">
            {renderField('requirements', 'Requirements')}
            {renderField('metrics', 'Metrics')}
            {renderChildNodes('functions', 'Functions')}
          </div>
        );
      
      case 'function':
        return (
          <div className="type-specific-fields function-fields">
            {renderField('details', 'Details')}
            {renderLiterature()}
            {renderChildNodes('specifications', 'Specifications')}
          </div>
        );
        
      case 'specification':
        return (
          <div className="type-specific-fields specification-fields">
            {renderField('details', 'Details')}
            {renderLiterature()}
            {renderChildNodes('integrations', 'Integrations')}
          </div>
        );
        
      case 'integration':
        return (
          <div className="type-specific-fields integration-fields">
            {renderField('details', 'Details')}
            {renderLiterature()}
            {renderChildNodes('techniques', 'Techniques')}
          </div>
        );
        
      case 'technique':
        return (
          <div className="type-specific-fields technique-fields">
            {renderField('details', 'Details')}
            {renderLiterature()}
            {renderChildNodes('applications', 'Applications')}
          </div>
        );
        
      case 'application':
        return (
          <div className="type-specific-fields application-fields">
            {renderField('details', 'Details')}
            {renderField('application_details', 'Application Details')}
            {renderLiterature()}
            {renderInputsOutputs()}
          </div>
        );
      
      case 'input':
      case 'output':
        return (
          <div className="type-specific-fields io-fields">
            {renderField('data_format', 'Data Format')}
            {renderField('constraints', 'Constraints')}
          </div>
        );
        
      default:
        return (
          <div className="type-specific-fields default-fields">
            {Object.entries(node)
              .filter(([key]) => !['id', 'name', 'type', 'description', 'relationships', 'tags'].includes(key))
              .map(([key, value]) => {
                const fieldPath = key;
                
                if (isFieldEncrypted(fieldPath)) {
                  return (
                    <div key={key} className="node-field">
                      <h4>{key.replace(/_/g, ' ')}</h4>
                      {renderEncryptedContent(fieldPath)}
                    </div>
                  );
                }
                
                return (
                  <div key={key} className="node-field">
                    <h4>{key.replace(/_/g, ' ')}</h4>
                    {typeof value === 'string' ? (
                      <ReactMarkdown>{value}</ReactMarkdown>
                    ) : (
                      <pre>{JSON.stringify(value, null, 2)}</pre>
                    )}
                  </div>
                );
              })}
          </div>
        );
    }
  };
  
  /**
   * Render a specific markdown field
   * @param {string} fieldName - Name of the field
   * @param {string} displayName - Display name for the field
   * @returns {React.Element|null} - Field element or null if field doesn't exist
   */
  const renderField = (fieldName, displayName) => {
    if (!node[fieldName]) return null;
    
    if (isFieldEncrypted(fieldName)) {
      return (
        <div className={`node-${fieldName}`}>
          <h4>{displayName}</h4>
          {renderEncryptedContent(fieldName)}
        </div>
      );
    }
    
    return (
      <div className={`node-${fieldName}`}>
        <h4>{displayName}</h4>
        <ReactMarkdown>{node[fieldName]}</ReactMarkdown>
      </div>
    );
  };
  
  /**
   * Render child nodes as clickable elements
   * @param {string} childrenKey - Key in node object containing children
   * @param {string} displayName - Display name for the children section
   * @returns {React.Element|null} - Child nodes element or null if no children
   */
  const renderChildNodes = (childrenKey, displayName) => {
    if (!node[childrenKey] || node[childrenKey].length === 0) return null;
    
    return (
      <div className={`node-${childrenKey}`}>
        <h4>{displayName}</h4>
        <ul className="child-nodes-list">
          {node[childrenKey].map(child => (
            <li 
              key={child.id} 
              className="child-node-item"
              onClick={() => handleNodeClick(child.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleNodeClick(child.id);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Navigate to ${child.name}`}
            >
              {child.name}
            </li>
          ))}
        </ul>
      </div>
    );
  };
  
  /**
   * Render components that implement this capability
   * @returns {React.Element|null} - Implemented by element or null if not applicable
   */
  const renderImplementedBy = () => {
    if (node.type !== 'capability' || !node.implemented_by_subcomponents || 
        node.implemented_by_subcomponents.length === 0) {
      return null;
    }
    
    return (
      <div className="implemented-by">
        <h4>Implemented By</h4>
        <ul className="implementors-list">
          {node.implemented_by_subcomponents.map(subcomponent => (
            <li 
              key={subcomponent.id} 
              className="implementor-item"
              onClick={() => handleNodeClick(subcomponent.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleNodeClick(subcomponent.id);
                }
              }}
              tabIndex={0}
              role="button"
            >
              {subcomponent.name}
            </li>
          ))}
        </ul>
      </div>
    );
  };
  
  /**
   * Render literature references
   * @returns {React.Element|null} - Literature element or null if no literature
   */
  const renderLiterature = () => {
    if (!node.literature || node.literature.length === 0) return null;
    
    return (
      <div className="node-literature">
        <h4>Literature</h4>
        <ul className="literature-list">
          {node.literature.map((item, index) => (
            <li key={index} className="literature-item">
              {item.url ? (
                <a 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="literature-link"
                >
                  {item.title}
                </a>
              ) : (
                <span className="literature-title">{item.title}</span>
              )}
              {item.authors && <span className="literature-authors"> - {item.authors}</span>}
              {item.year && <span className="literature-year"> ({item.year})</span>}
              {item.description && (
                <div className="literature-description">
                  <ReactMarkdown>{item.description}</ReactMarkdown>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  };
  
  /**
   * Render inputs and outputs for applications
   * @returns {React.Element|null} - Inputs/outputs element or null if not applicable
   */
  const renderInputsOutputs = () => {
    if (node.type !== 'application') return null;
    
    return (
      <div className="inputs-outputs">
        {node.inputs && node.inputs.length > 0 && (
          <div className="inputs">
            <h4>Inputs</h4>
            <ul className="io-list">
              {node.inputs.map(input => (
                <li 
                  key={input.id} 
                  className="io-item input-item"
                  onClick={() => handleNodeClick(input.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNodeClick(input.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                >
                  {input.name}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {node.outputs && node.outputs.length > 0 && (
          <div className="outputs">
            <h4>Outputs</h4>
            <ul className="io-list">
              {node.outputs.map(output => (
                <li 
                  key={output.id} 
                  className="io-item output-item"
                  onClick={() => handleNodeClick(output.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNodeClick(output.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                >
                  {output.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };
  
  /**
   * Handle node click for navigation
   * @param {string} nodeId - ID of the node to navigate to
   */
  const handleNodeClick = (nodeId) => {
    // Publish navigation event
    EventBus.publish('node:navigate', { 
      nodeId, 
      source: 'nodeDetails'
    });
  };

  return (
    <div 
      className={`node-details-renderer node-type-${node.type} ${isEditing ? 'is-editing' : ''}`}
      data-node-id={node.id}
      data-node-type={node.type}
      aria-labelledby={`node-${node.id}-name`}
    >
      {renderCommonFields()}
      {renderTypeSpecificFields()}
    </div>
  );
};

NodeDetailsRenderer.propTypes = {
  /** Node object containing all details */
  node: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    description: PropTypes.string,
    isProtected: PropTypes.bool,
    tags: PropTypes.arrayOf(PropTypes.string),
  }),
  
  /** Whether the node is in edit mode */
  isEditing: PropTypes.bool,
  
  /** Encryption status information */
  encryptionStatus: PropTypes.shape({
    isEncrypted: PropTypes.bool,
    isDecrypted: PropTypes.bool,
    fields: PropTypes.arrayOf(PropTypes.string)
  }),
  
  /** Callback for handling decryption requests */
  onDecryptRequest: PropTypes.func,
  
  /** Additional rendering options */
  renderOptions: PropTypes.object
};

// Register with the module registry
export default registry.register(
  'components.NodeDetailsRenderer',
  NodeDetailsRenderer,
  [
    'utils.EventBus',
    'encryption.EncryptionService'
  ],
  {
    description: 'Renders node details with type-specific formatting and content',
    usage: 'Used inside DetailsPanel to render node content based on node type',
    examples: [
      {
        name: 'Basic usage',
        code: `<NodeDetailsRenderer node={selectedNode} />`
      },
      {
        name: 'With encryption support',
        code: `
          <NodeDetailsRenderer 
            node={selectedNode} 
            encryptionStatus={{
              isEncrypted: true,
              isDecrypted: false,
              fields: ['description', 'details']
            }}
            onDecryptRequest={handleDecryptRequest}
          />
        `
      }
    ]
  }
); 