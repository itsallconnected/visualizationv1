import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * Manages modal dialogs throughout the application
 * Provides a centralized system for displaying and managing modal content
 */
const ModalManager = ({
  closeOnOutsideClick = true,
  closeOnEscape = true,
  preventBodyScroll = true
}) => {
  // State
  const [modals, setModals] = useState([]);
  const [modalRoot, setModalRoot] = useState(null);
  
  // Handle closing the top-most modal
  const closeTopModal = useCallback(() => {
    if (modals.length === 0) return;
    
    const topModalId = modals[modals.length - 1].id;
    closeModal(topModalId);
  }, [modals]);
  
  // Create modal root element on mount
  useEffect(() => {
    // Check if modal root already exists
    let root = document.getElementById('modal-root');
    
    // Create it if it doesn't exist
    if (!root) {
      root = document.createElement('div');
      root.id = 'modal-root';
      document.body.appendChild(root);
    }
    
    setModalRoot(root);
    
    // Clean up on unmount
    return () => {
      // Only remove the root if we created it and no modals are active
      if (root && modals.length === 0) {
        document.body.removeChild(root);
      }
    };
  }, [modals.length]);
  
  // Handle keyboard events (ESC to close)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (closeOnEscape && e.key === 'Escape') {
        closeTopModal();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeOnEscape, closeTopModal]);
  
  // Handle body scroll
  useEffect(() => {
    if (preventBodyScroll && modals.length > 0) {
      // Save the current overflow style
      const originalStyle = window.getComputedStyle(document.body).overflow;
      
      // Prevent scrolling on body
      document.body.style.overflow = 'hidden';
      
      // Restore original overflow style when unmounting
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [preventBodyScroll, modals.length]);
  
  // Subscribe to modal events
  useEffect(() => {
    const handleShowModal = (data) => {
      openModal(data);
    };
    
    const handleCloseModal = (data) => {
      closeModal(data.id);
    };
    
    const handleCloseAllModals = () => {
      closeAllModals();
    };
    
    EventBus.subscribe('modal:show', handleShowModal);
    EventBus.subscribe('modal:close', handleCloseModal);
    EventBus.subscribe('modal:closeAll', handleCloseAllModals);
    
    return () => {
      EventBus.unsubscribe('modal:show', handleShowModal);
      EventBus.unsubscribe('modal:close', handleCloseModal);
      EventBus.unsubscribe('modal:closeAll', handleCloseAllModals);
    };
  }, []);
  
  /**
   * Open a new modal
   * @param {Object} modalConfig - Modal configuration
   */
  const openModal = (modalConfig) => {
    // Generate unique ID for modal if not provided
    const id = modalConfig.id || `modal-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Create modal object
    const modal = {
      id,
      component: modalConfig.component,
      props: modalConfig.props || {},
      title: modalConfig.title || '',
      size: modalConfig.size || 'medium',
      position: modalConfig.position || 'center',
      showCloseButton: modalConfig.showCloseButton !== false,
      closeOnOutsideClick: modalConfig.closeOnOutsideClick !== undefined 
        ? modalConfig.closeOnOutsideClick 
        : closeOnOutsideClick,
      onClose: modalConfig.onClose,
      onConfirm: modalConfig.onConfirm,
      preventClose: modalConfig.preventClose || false
    };
    
    // Add modal to state
    setModals(prevModals => [...prevModals, modal]);
    
    // Notify that modal has been opened
    EventBus.publish('modal:opened', { id });
    
    return id;
  };
  
  /**
   * Close a modal by ID
   * @param {string} id - Modal ID
   */
  const closeModal = (id) => {
    // Find the modal
    const modalIndex = modals.findIndex(modal => modal.id === id);
    
    if (modalIndex === -1) return;
    
    const modal = modals[modalIndex];
    
    // Check if modal can be closed
    if (modal.preventClose) return;
    
    // Call onClose callback if provided
    if (modal.onClose) {
      modal.onClose();
    }
    
    // Remove modal from state
    setModals(prevModals => prevModals.filter(modal => modal.id !== id));
    
    // Notify that modal has been closed
    EventBus.publish('modal:closed', { id });
  };
  
  /**
   * Close all modals
   */
  const closeAllModals = () => {
    // Call onClose for each modal
    modals.forEach(modal => {
      if (modal.onClose) {
        modal.onClose();
      }
    });
    
    // Clear all modals
    setModals([]);
    
    // Notify that all modals have been closed
    EventBus.publish('modal:allClosed', {});
  };
  
  /**
   * Handle backdrop click
   * @param {Object} modal - Modal object
   * @param {Event} e - Click event
   */
  const handleBackdropClick = (modal, e) => {
    // Only close if click was directly on backdrop (not on modal content)
    if (modal.closeOnOutsideClick && e.target === e.currentTarget) {
      closeModal(modal.id);
    }
  };
  
  /**
   * Confirm a modal
   * @param {string} id - Modal ID
   * @param {*} data - Data to pass to onConfirm callback
   */
  const confirmModal = (id, data) => {
    // Find the modal
    const modal = modals.find(modal => modal.id === id);
    
    if (!modal) return;
    
    // Call onConfirm callback if provided
    if (modal.onConfirm) {
      modal.onConfirm(data);
    }
    
    // Close the modal if not prevented
    if (!modal.preventClose) {
      closeModal(id);
    }
  };
  
  /**
   * Get the CSS class for modal size
   * @param {string} size - Modal size
   * @returns {string} CSS class
   */
  const getModalSizeClass = (size) => {
    switch (size) {
      case 'small':
        return 'modal--small';
      case 'large':
        return 'modal--large';
      case 'fullscreen':
        return 'modal--fullscreen';
      case 'medium':
      default:
        return 'modal--medium';
    }
  };
  
  /**
   * Get the CSS class for modal position
   * @param {string} position - Modal position
   * @returns {string} CSS class
   */
  const getModalPositionClass = (position) => {
    switch (position) {
      case 'top':
        return 'modal--top';
      case 'bottom':
        return 'modal--bottom';
      case 'left':
        return 'modal--left';
      case 'right':
        return 'modal--right';
      case 'center':
      default:
        return 'modal--center';
    }
  };
  
  /**
   * Render a modal
   * @param {Object} modal - Modal object
   * @returns {React.Element} - Modal element
   */
  const renderModal = (modal) => {
    const ModalComponent = modal.component;
    const sizeClass = getModalSizeClass(modal.size);
    const positionClass = getModalPositionClass(modal.position);
    
    return (
      <div
        key={modal.id}
        className="modal__backdrop"
        onClick={(e) => handleBackdropClick(modal, e)}
      >
        <div className={`modal ${sizeClass} ${positionClass}`}>
          {modal.title && (
            <div className="modal__header">
              <h2 className="modal__title">{modal.title}</h2>
              {modal.showCloseButton && !modal.preventClose && (
                <button
                  className="modal__close"
                  onClick={() => closeModal(modal.id)}
                  aria-label="Close"
                >
                  ✕
                </button>
              )}
            </div>
          )}
          <div className="modal__content">
            <ModalComponent
              {...modal.props}
              modalId={modal.id}
              closeModal={() => closeModal(modal.id)}
              confirmModal={(data) => confirmModal(modal.id, data)}
            />
          </div>
        </div>
      </div>
    );
  };
  
  // Don't render anything if modalRoot is not available
  if (!modalRoot) {
    return null;
  }
  
  // Create portal for modals
  return ReactDOM.createPortal(
    <>
      {modals.map(renderModal)}
    </>,
    modalRoot
  );
};

ModalManager.propTypes = {
  closeOnOutsideClick: PropTypes.bool,
  closeOnEscape: PropTypes.bool,
  preventBodyScroll: PropTypes.bool
};

/**
 * Create a modal component with functionality
 * @param {React.Component} WrappedComponent - Component to wrap with modal functionality
 * @returns {React.Component} - Enhanced component
 */
ModalManager.createModalComponent = (WrappedComponent) => {
  const ModalWrapper = (props) => {
    return <WrappedComponent {...props} />;
  };
  
  ModalWrapper.propTypes = {
    modalId: PropTypes.string,
    closeModal: PropTypes.func,
    confirmModal: PropTypes.func
  };
  
  return ModalWrapper;
};

/**
 * Show a modal
 * @param {Object} modalConfig - Modal configuration
 * @returns {string} - Modal ID
 */
ModalManager.show = (modalConfig) => {
  // Publish event to show modal
  EventBus.publish('modal:show', modalConfig);
  
  // Return promise that resolves when modal is confirmed
  return new Promise((resolve) => {
    const id = modalConfig.id || `modal-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Listen for confirmation
    const handleConfirm = (data) => {
      if (data.id === id) {
        EventBus.unsubscribe('modal:confirmed', handleConfirm);
        resolve(data.result);
      }
    };
    
    EventBus.subscribe('modal:confirmed', handleConfirm);
  });
};

/**
 * Close a modal
 * @param {string} id - Modal ID
 */
ModalManager.close = (id) => {
  EventBus.publish('modal:close', { id });
};

/**
 * Close all modals
 */
ModalManager.closeAll = () => {
  EventBus.publish('modal:closeAll', {});
};

/**
 * Confirm a modal with data
 * @param {string} id - Modal ID
 * @param {*} result - Result data
 */
ModalManager.confirm = (id, result) => {
  EventBus.publish('modal:confirmed', { id, result });
};

/**
 * Show an alert modal
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @param {Object} options - Additional options
 * @returns {Promise} - Promise that resolves when alert is closed
 */
ModalManager.alert = (title, message, options = {}) => {
  const AlertModal = ({ closeModal }) => (
    <div className="modal__alert">
      <p className="modal__alert-message">{message}</p>
      <div className="modal__alert-buttons">
        <button
          className="button button--primary"
          onClick={closeModal}
        >
          {options.okText || 'OK'}
        </button>
      </div>
    </div>
  );
  
  return ModalManager.show({
    component: AlertModal,
    title,
    size: options.size || 'small',
    ...options
  });
};

/**
 * Show a confirmation modal
 * @param {string} title - Confirmation title
 * @param {string} message - Confirmation message
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} - Promise that resolves with true if confirmed, false if canceled
 */
ModalManager.confirm = (title, message, options = {}) => {
  const ConfirmModal = ({ closeModal, confirmModal }) => (
    <div className="modal__confirm">
      <p className="modal__confirm-message">{message}</p>
      <div className="modal__confirm-buttons">
        <button
          className="button button--secondary"
          onClick={() => {
            closeModal();
            confirmModal(false);
          }}
        >
          {options.cancelText || 'Cancel'}
        </button>
        <button
          className="button button--primary"
          onClick={() => {
            closeModal();
            confirmModal(true);
          }}
        >
          {options.confirmText || 'Confirm'}
        </button>
      </div>
    </div>
  );
  
  return ModalManager.show({
    component: ConfirmModal,
    title,
    size: options.size || 'small',
    ...options
  });
};

/**
 * Show a prompt modal
 * @param {string} title - Prompt title
 * @param {string} message - Prompt message
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - Promise that resolves with input value if confirmed, null if canceled
 */
ModalManager.prompt = (title, message, options = {}) => {
  const PromptModal = ({ closeModal, confirmModal }) => {
    const [value, setValue] = useState(options.defaultValue || '');
    
    return (
      <div className="modal__prompt">
        <p className="modal__prompt-message">{message}</p>
        <input
          type="text"
          className="modal__prompt-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={options.placeholder || ''}
          autoFocus
        />
        <div className="modal__prompt-buttons">
          <button
            className="button button--secondary"
            onClick={() => {
              closeModal();
              confirmModal(null);
            }}
          >
            {options.cancelText || 'Cancel'}
          </button>
          <button
            className="button button--primary"
            onClick={() => {
              closeModal();
              confirmModal(value);
            }}
          >
            {options.confirmText || 'OK'}
          </button>
        </div>
      </div>
    );
  };
  
  return ModalManager.show({
    component: PromptModal,
    title,
    size: options.size || 'small',
    ...options
  });
};

export default registry.register(
  'components.ModalManager',
  ModalManager,
  [
    'utils.EventBus'
  ],
  {
    description: 'Manages modal dialogs throughout the application',
    usage: 'Used for displaying dialogs, alerts, confirmations, and prompts'
  }
); 