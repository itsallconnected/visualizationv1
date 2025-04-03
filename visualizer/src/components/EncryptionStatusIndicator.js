// This is a placeholder file created by the migration script
// To be implemented according to the migration plan

import React from 'react';
import PropTypes from 'prop-types';
import registry from '../ModuleRegistry';

/**
 * EncryptionStatusIndicator displays the current encryption state of a node.
 * It shows whether content is encrypted, locked, or decrypted.
 */
const EncryptionStatusIndicator = ({ 
  isEncrypted, 
  isDecrypted, 
  onClick, 
  showLabel = false,
  size = 'medium'
}) => {
  // If not encrypted at all, don't show anything
  if (!isEncrypted) {
    return null;
  }

  // Determine which icon to show based on encryption state
  const getStatusIcon = () => {
    if (isEncrypted && !isDecrypted) {
      return '🔒'; // Locked
    } else if (isEncrypted && isDecrypted) {
      return '🔓'; // Unlocked
    }
    return '🔒'; // Default to locked
  };

  // Get status label
  const getStatusLabel = () => {
    if (isEncrypted && !isDecrypted) {
      return 'Encrypted (Click to unlock)';
    } else if (isEncrypted && isDecrypted) {
      return 'Decrypted content';
    }
    return 'Encrypted content';
  };

  // Determine CSS classes based on props
  const getSizeClass = () => {
    switch (size) {
      case 'small': return 'encryption-indicator-sm';
      case 'large': return 'encryption-indicator-lg';
      default: return 'encryption-indicator-md';
    }
  };

  return (
    <div 
      className={`encryption-status-indicator ${getSizeClass()}`}
      onClick={onClick}
      title={getStatusLabel()}
      role="button"
      tabIndex={0}
      aria-label={getStatusLabel()}
    >
      <span className="encryption-icon">{getStatusIcon()}</span>
      {showLabel && (
        <span className="encryption-label">{getStatusLabel()}</span>
      )}
    </div>
  );
};

EncryptionStatusIndicator.propTypes = {
  /** Whether the content is encrypted */
  isEncrypted: PropTypes.bool.isRequired,
  /** Whether encrypted content has been decrypted */
  isDecrypted: PropTypes.bool,
  /** Function to call when indicator is clicked */
  onClick: PropTypes.func,
  /** Whether to display the text label */
  showLabel: PropTypes.bool,
  /** Size of the indicator: 'small', 'medium', or 'large' */
  size: PropTypes.oneOf(['small', 'medium', 'large']),
};

EncryptionStatusIndicator.defaultProps = {
  isDecrypted: false,
  onClick: () => {},
  showLabel: false,
  size: 'medium',
};

// Register with the module registry
export default registry.register(
  'components.EncryptionStatusIndicator',
  EncryptionStatusIndicator,
  [], // No direct dependencies on other modules
  {
    description: 'Visual indicator for the encryption status of a node',
    usage: 'Use inside node detail panels or node visualizations to indicate encryption status',
    example: `
      <EncryptionStatusIndicator 
        isEncrypted={true} 
        isDecrypted={false} 
        onClick={() => showDecryptionDialog(nodeId)} 
      />
    `
  }
);

