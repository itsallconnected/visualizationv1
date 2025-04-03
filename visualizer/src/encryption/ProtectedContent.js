import React, { useState, useEffect, useContext, createContext } from 'react';
import PropTypes from 'prop-types';
import registry from '../ModuleRegistry';
import { EventBus } from '../utils/EventBus';

// Create a context to share decryption state between components for the same node
const ProtectedContentContext = createContext({});

/**
 * Provider component for sharing decryption state between protected content instances
 */
export const ProtectedContentProvider = ({ children }) => {
  const [decryptedNodes, setDecryptedNodes] = useState(new Set());
  const [decryptionKeys, setDecryptionKeys] = useState(new Map());
  
  // Subscribe to decryption events
  useEffect(() => {
    // Get encryption service to check initially decrypted nodes
    const encryptionService = registry.getModule('encryption.EncryptionService');
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    
    const handleNodeDecrypted = ({ nodeId, keyType }) => {
      setDecryptedNodes(prev => {
        const updated = new Set(prev);
        updated.add(nodeId);
        return updated;
      });
      
      setDecryptionKeys(prev => {
        const updated = new Map(prev);
        updated.set(`${nodeId}:${keyType}`, true);
        return updated;
      });
    };
    
    const handleNodeLocked = ({ nodeId }) => {
      setDecryptedNodes(prev => {
        const updated = new Set(prev);
        updated.delete(nodeId);
        return updated;
      });
      
      setDecryptionKeys(prev => {
        const updated = new Map(prev);
        // Remove all keys for this node
        Array.from(updated.keys()).forEach(key => {
          if (key.startsWith(`${nodeId}:`)) {
            updated.delete(key);
          }
        });
        return updated;
      });
    };
    
    // Subscribe to events
    eventBus.subscribe('node:decrypted', handleNodeDecrypted);
    eventBus.subscribe('node:locked', handleNodeLocked);
    
    // Initialize with already decrypted nodes if encryption service is available
    if (encryptionService) {
      // We can't directly access the internal data structures of the encryption service,
      // so we'll rely on the events to update our state.
    }
    
    return () => {
      eventBus.unsubscribe('node:decrypted', handleNodeDecrypted);
      eventBus.unsubscribe('node:locked', handleNodeLocked);
    };
  }, []);
  
  return (
    <ProtectedContentContext.Provider value={{ 
      decryptedNodes, 
      decryptionKeys,
      isNodeDecrypted: (nodeId, keyType = 'detail') => {
        return decryptionKeys.has(`${nodeId}:${keyType}`);
      }
    }}>
      {children}
    </ProtectedContentContext.Provider>
  );
};

/**
 * Component that wraps encrypted content and manages access control
 * Shows appropriate UI based on content encryption state
 */
const ProtectedContent = ({
  nodeId,
  encryptedContent,
  keyType = 'detail',
  fallbackContent = null,
  showLockIcon = true,
  allowDecryption = true,
  placeholderContent = null,
  children
}) => {
  // State
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [decryptedContent, setDecryptedContent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Get encryption service and event bus
  const [encryptionService, setEncryptionService] = useState(null);
  const [eventBus, setEventBus] = useState(null);
  
  // Get shared decryption state from context
  const { decryptedNodes, isNodeDecrypted } = useContext(ProtectedContentContext);
  
  // Initialize services
  useEffect(() => {
    const service = registry.getModule('encryption.EncryptionService');
    const bus = registry.getModule('utils.EventBus') || EventBus;
    
    if (service) {
      setEncryptionService(service);
    } else {
      console.error('Encryption service not available for ProtectedContent');
      setError('Encryption service not available');
    }
    
    setEventBus(bus);
  }, []);
  
  // Check encryption and decryption status when dependencies change
  useEffect(() => {
    if (!nodeId || !encryptedContent || !encryptionService) return;
    
    // Determine if content is encrypted
    const encrypted = typeof encryptedContent === 'object' && 
                     (encryptedContent.encrypted === true || 
                      !!encryptedContent.salt && 
                      !!encryptedContent.iv && 
                      !!encryptedContent.data);
    
    setIsEncrypted(encrypted);
    
    // Check if already decrypted - from context or service
    if (encrypted) {
      // Check if this node has been decrypted with the appropriate key type
      const decrypted = isNodeDecrypted(nodeId, keyType) || 
                       encryptionService.isNodeDecrypted(nodeId, keyType);
      
      setIsDecrypted(decrypted);
      
      if (decrypted) {
        // Try to decrypt with stored key
        tryDecrypt();
      }
    }
    
    // If not encrypted, treat as already decrypted
    if (!encrypted) {
      setIsDecrypted(true);
      setDecryptedContent(encryptedContent);
    }
  }, [nodeId, encryptedContent, encryptionService, decryptedNodes, isNodeDecrypted, keyType]);
  
  /**
   * Try to decrypt content with stored key
   */
  const tryDecrypt = () => {
    if (!encryptionService || !nodeId || !isEncrypted) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Get decryption key
      const key = encryptionService.getDecryptionKey(nodeId, keyType);
      
      if (!key) {
        setIsDecrypted(false);
        setIsLoading(false);
        return;
      }
      
      // Decrypt the content
      const decrypted = encryptionService.decryptContent(encryptedContent, key);
      
      setDecryptedContent(decrypted);
      setIsDecrypted(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error decrypting content:', error);
      setDecryptedContent(null);
      setIsDecrypted(false);
      setError(`Decryption error: ${error.message}`);
      setIsLoading(false);
    }
  };
  
  /**
   * Handle decrypt button click
   */
  const handleDecrypt = () => {
    if (!encryptionService || !nodeId || !eventBus) return;
    
    // Request decryption via event
    eventBus.publish('node:decryption:requested', {
      nodeId,
      keyType,
      onSuccess: () => {
        // Try decrypting again after password is entered
        tryDecrypt();
      },
      onFailure: (error) => {
        setError(`Decryption request failed: ${error.message}`);
      }
    });
  };
  
  /**
   * Handle lock button click
   */
  const handleLock = () => {
    if (!encryptionService || !nodeId) return;
    
    // Clear decryption key
    encryptionService.clearDecryptionKey(nodeId, keyType);
    setDecryptedContent(null);
    setIsDecrypted(false);
  };
  
  /**
   * Render loading state
   */
  const renderLoading = () => (
    <div className="protected-content__loading">
      <div className="protected-content__spinner"></div>
      <p>Decrypting content...</p>
    </div>
  );
  
  /**
   * Render error state
   */
  const renderError = () => (
    <div className="protected-content__error">
      <div className="protected-content__error-icon">⚠️</div>
      <p>{error}</p>
      {allowDecryption && (
        <button 
          className="protected-content__retry-button"
          onClick={handleDecrypt}
        >
          Try Again
        </button>
      )}
    </div>
  );
  
  /**
   * Render encrypted content (locked state)
   */
  const renderEncrypted = () => (
    <div className="protected-content__encrypted">
      {showLockIcon && (
        <div className="protected-content__lock-icon">🔒</div>
      )}
      
      <div className="protected-content__message">
        {fallbackContent || placeholderContent || (
          <p>This content is encrypted and requires a password to view.</p>
        )}
      </div>
      
      {allowDecryption && (
        <button 
          className="protected-content__decrypt-button"
          onClick={handleDecrypt}
        >
          Decrypt Content
        </button>
      )}
    </div>
  );
  
  /**
   * Render decrypted content with optional lock button
   */
  const renderDecrypted = () => {
    // Get children or use decrypted content
    const content = children 
      ? React.Children.map(children, child => {
          // If child is a function, call it with decrypted content
          if (typeof child === 'function') {
            return child(decryptedContent);
          }
          return child;
        })
      : (
        <div className="protected-content__decrypted-content">
          {typeof decryptedContent === 'string' 
            ? decryptedContent 
            : JSON.stringify(decryptedContent, null, 2)
          }
        </div>
      );
    
    return (
      <div className="protected-content__decrypted">
        {showLockIcon && (
          <button 
            className="protected-content__lock-button"
            onClick={handleLock}
            title="Lock Content"
          >
            🔓
          </button>
        )}
        
        {content}
      </div>
    );
  };
  
  // If not encrypted at all, just render children or content directly
  if (!isEncrypted) {
    return children || (
      <div className="protected-content__unencrypted">
        {typeof encryptedContent === 'string' 
          ? encryptedContent 
          : JSON.stringify(encryptedContent, null, 2)
        }
      </div>
    );
  }
  
  // Otherwise, render based on state
  return (
    <div className="protected-content">
      {isLoading 
        ? renderLoading()
        : error
          ? renderError()
          : isDecrypted
            ? renderDecrypted()
            : renderEncrypted()
      }
    </div>
  );
};

ProtectedContent.propTypes = {
  nodeId: PropTypes.string.isRequired,
  encryptedContent: PropTypes.any,
  keyType: PropTypes.oneOf(['basic', 'detail', 'full']),
  fallbackContent: PropTypes.node,
  showLockIcon: PropTypes.bool,
  allowDecryption: PropTypes.bool,
  placeholderContent: PropTypes.node,
  children: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.func
  ])
};

// Export the Provider too
ProtectedContent.Provider = ProtectedContentProvider;

export default registry.register(
  'encryption.ProtectedContent',
  ProtectedContent,
  [
    'encryption.EncryptionService',
    'utils.EventBus'
  ],
  {
    description: 'Component for displaying encrypted content with proper user interface',
    usage: 'Used to show encrypted content with appropriate UI for locked/unlocked states'
  }
); 