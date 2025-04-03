import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import registry from '../../ModuleRegistry';

/**
 * Provides a password entry dialog for decrypting protected content
 * Used by the EncryptionService to prompt for passwords
 */
const DecryptionDialog = ({
  nodeId,
  keyType = 'detail',
  onDecrypt = () => {},
  onCancel = () => {},
  showRemainingAttempts = true,
  title = null,
  message = null
}) => {
  // State
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimeout, setLockTimeout] = useState(null);
  const [nodeInfo, setNodeInfo] = useState(null);
  
  // Refs
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  
  // Get required services
  const encryptionService = registry.getModule('encryption.EncryptionService');
  const nodeRepository = registry.getModule('data.NodeRepository');
  
  // Set dialog title based on key type if not provided
  const dialogTitle = title || {
    'basic': 'Decrypt Basic Information',
    'detail': 'Decrypt Content Details',
    'full': 'Decrypt Full Content'
  }[keyType] || 'Decrypt Content';
  
  // Set dialog message based on key type if not provided
  const dialogMessage = message || {
    'basic': 'Enter the password to view basic information about this node.',
    'detail': 'This content contains additional details that require a password to view.',
    'full': 'Full access to this node\'s content requires a password.'
  }[keyType] || 'This content is encrypted. Please enter the password to view it.';
  
  // Load node information and check lock status on mount
  useEffect(() => {
    const fetchNodeInfo = async () => {
      if (nodeRepository && nodeId) {
        try {
          const node = await nodeRepository.getNode(nodeId);
          setNodeInfo(node);
        } catch (err) {
          console.error('Error fetching node info:', err);
        }
      }
    };
    
    fetchNodeInfo();
    checkLockStatus();
    
    // Focus input field on mount
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    return () => {
      // Clear any timers
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [nodeId, nodeRepository]);
  
  /**
   * Check if decryption is locked due to too many failed attempts
   */
  const checkLockStatus = () => {
    if (!encryptionService || !nodeId) return;
    
    const lockInfo = encryptionService.getFailedAttemptsLock(nodeId);
    
    if (lockInfo && lockInfo.locked) {
      setIsLocked(true);
      setLockTimeout(lockInfo.remainingTime);
      
      // Start countdown timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      timerRef.current = setInterval(() => {
        setLockTimeout(prevTimeout => {
          if (prevTimeout <= 1) {
            clearInterval(timerRef.current);
            setIsLocked(false);
            return 0;
          }
          return prevTimeout - 1;
        });
      }, 1000);
    } else if (lockInfo) {
      // Not locked yet, but show remaining attempts
      setRemainingAttempts(lockInfo.remaining || 0);
    }
  };
  
  /**
   * Format lock timeout for display
   * @returns {string} Formatted time string
   */
  const formatLockTimeout = () => {
    if (!lockTimeout) return '';
    
    const minutes = Math.floor(lockTimeout / 60);
    const seconds = lockTimeout % 60;
    
    return `${minutes}m ${seconds}s`;
  };
  
  /**
   * Handle decrypt button click
   */
  const handleDecrypt = async () => {
    if (!password) {
      setError('Please enter a password');
      return;
    }
    
    if (!encryptionService || !nodeId) {
      setError('Encryption service not available');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Try to decrypt content
      if (keyType === 'detail' && nodeInfo && nodeInfo.content && nodeInfo.content.encrypted) {
        // Try to decrypt the content to validate password
        encryptionService.decryptContent(nodeInfo.content, password);
      } else if (keyType === 'full' && nodeInfo && nodeInfo.full_encrypted) {
        // Try to decrypt the full content to validate password
        encryptionService.decryptContent(nodeInfo.full_encrypted, password);
      } else if (keyType === 'basic' && nodeInfo && nodeInfo.encrypted_basic_info) {
        // Try to decrypt the basic info to validate password
        encryptionService.decryptContent(nodeInfo.encrypted_basic_info, password);
      } else {
        // If we can't directly validate, just trust the password
        // This is not ideal but allows for password setting on new content
      }
      
      // If we got here, decryption was successful or no validation was performed
      onDecrypt(password);
      setIsLoading(false);
      
    } catch (error) {
      // Record failed attempt
      encryptionService.recordFailedAttempt(nodeId);
      
      // Check if we're now locked out
      checkLockStatus();
      
      setError(`Decryption failed: ${error.message}`);
      setIsLoading(false);
    }
  };
  
  /**
   * Handle input key down (Enter to submit)
   * @param {KeyboardEvent} event - Keyboard event
   */
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !isLoading && !isLocked) {
      handleDecrypt();
    }
  };
  
  /**
   * Render locked state
   */
  const renderLocked = () => (
    <div className="decryption-dialog__locked">
      <div className="decryption-dialog__lock-icon">🔒</div>
      <h4>Decryption Locked</h4>
      <p>
        Too many failed attempts. Please try again in {formatLockTimeout()}.
      </p>
    </div>
  );
  
  /**
   * Render password entry form
   */
  const renderPasswordForm = () => (
    <>
      <div className="decryption-dialog__lock-icon">🔒</div>
      <p className="decryption-dialog__message">{dialogMessage}</p>
      
      {nodeInfo && nodeInfo.name && (
        <div className="decryption-dialog__node-info">
          <span className="decryption-dialog__node-name">{nodeInfo.name}</span>
          {nodeInfo.type && (
            <span className="decryption-dialog__node-type">{nodeInfo.type}</span>
          )}
        </div>
      )}
      
      <div className="decryption-dialog__input-group">
        <input
          ref={inputRef}
          type="password"
          className="decryption-dialog__password-input"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading || isLocked}
          autoFocus
        />
        
        {showRemainingAttempts && remainingAttempts !== null && (
          <div className="decryption-dialog__attempts">
            Attempts remaining: {remainingAttempts}
          </div>
        )}
      </div>
      
      {error && (
        <div className="decryption-dialog__error">
          {error}
        </div>
      )}
    </>
  );
  
  return (
    <div className="decryption-dialog">
      <div className="decryption-dialog__header">
        <h3 className="decryption-dialog__title">{dialogTitle}</h3>
        <button 
          className="decryption-dialog__close-button"
          onClick={onCancel}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      
      <div className="decryption-dialog__body">
        {isLocked ? renderLocked() : renderPasswordForm()}
      </div>
      
      <div className="decryption-dialog__footer">
        <button 
          className="decryption-dialog__cancel-button"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button 
          className="decryption-dialog__decrypt-button"
          onClick={handleDecrypt}
          disabled={isLoading || isLocked || !password}
        >
          {isLoading ? 'Decrypting...' : 'Decrypt'}
        </button>
      </div>
    </div>
  );
};

DecryptionDialog.propTypes = {
  nodeId: PropTypes.string.isRequired,
  keyType: PropTypes.oneOf(['basic', 'detail', 'full']),
  onDecrypt: PropTypes.func,
  onCancel: PropTypes.func,
  showRemainingAttempts: PropTypes.bool,
  title: PropTypes.string,
  message: PropTypes.string
};

export default registry.register(
  'encryption.components.DecryptionDialog',
  DecryptionDialog,
  [
    'encryption.EncryptionService',
    'data.NodeRepository'
  ],
  {
    description: 'Provides a password entry dialog for decrypting protected content',
    usage: 'Used by the EncryptionService to prompt for passwords'
  }
); 