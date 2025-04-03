import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Editor interface for modifying node content.
 * Provides form validation and save/cancel workflow.
 */
const DetailsPanelEditor = ({ node, onSave, onCancel }) => {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Initialize form with node data
    if (node) {
      setFormData({ ...node });
    }
  }, [node]);

  const validateForm = () => {
    const newErrors = {};
    
    // Required fields validation
    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Name is required';
    }
    
    // Type-specific validation
    switch (node.type) {
      case 'component':
        if (!formData.objective || formData.objective.trim() === '') {
          newErrors.objective = 'Objective is required for components';
        }
        break;
      case 'subcomponent':
        if (!formData.approaches || formData.approaches.trim() === '') {
          newErrors.approaches = 'Approaches are required for subcomponents';
        }
        break;
      default:
        // No additional validation for other types
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field if it exists
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      setIsSubmitting(true);
      try {
        await onSave(formData);
      } catch (error) {
        console.error('Error saving node:', error);
        setErrors(prev => ({
          ...prev,
          submit: 'Failed to save changes. Please try again.'
        }));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Generate form fields based on node type
  const renderFormFields = () => {
    const fields = [
      // Common fields for all node types
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
    ];
    
    // Add type-specific fields
    switch (node.type) {
      case 'component_group':
        // No additional fields
        break;
        
      case 'component':
        fields.push(
          { name: 'objective', label: 'Objective', type: 'textarea', required: true },
          { name: 'key_challenges', label: 'Key Challenges', type: 'textarea' }
        );
        break;
        
      case 'subcomponent':
        fields.push(
          { name: 'approaches', label: 'Approaches', type: 'textarea', required: true },
          { name: 'current_implementation', label: 'Current Implementation', type: 'textarea' }
        );
        break;
        
      case 'capability':
        fields.push(
          { name: 'requirements', label: 'Requirements', type: 'textarea' },
          { name: 'metrics', label: 'Metrics', type: 'textarea' }
        );
        break;
        
      case 'function':
      case 'specification':
      case 'integration':
      case 'technique':
      case 'application':
        fields.push(
          { name: 'details', label: 'Details', type: 'textarea' }
        );
        break;
        
      default:
        // For unknown types, add editable fields for all properties
        Object.keys(node)
          .filter(key => !['id', 'type', 'relationships'].includes(key))
          .forEach(key => {
            if (!fields.some(f => f.name === key)) {
              fields.push({
                name: key,
                label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                type: typeof node[key] === 'string' && node[key].length > 100 ? 'textarea' : 'text'
              });
            }
          });
        break;
    }
    
    return fields.map(field => (
      <div key={field.name} className={`form-group ${errors[field.name] ? 'has-error' : ''}`}>
        <label htmlFor={field.name}>
          {field.label}
          {field.required && <span className="required-indicator">*</span>}
        </label>
        
        {field.type === 'textarea' ? (
          <textarea
            id={field.name}
            name={field.name}
            value={formData[field.name] || ''}
            onChange={handleChange}
            rows={5}
            required={field.required}
          />
        ) : (
          <input
            type={field.type}
            id={field.name}
            name={field.name}
            value={formData[field.name] || ''}
            onChange={handleChange}
            required={field.required}
          />
        )}
        
        {errors[field.name] && (
          <div className="error-message">{errors[field.name]}</div>
        )}
      </div>
    ));
  };

  if (!node) {
    return null;
  }

  return (
    <div className="details-panel-editor">
      <h3>Edit {node.type.replace(/_/g, ' ')}</h3>
      
      <form onSubmit={handleSubmit}>
        {renderFormFields()}
        
        {errors.submit && (
          <div className="error-message submit-error">{errors.submit}</div>
        )}
        
        <div className="form-actions">
          <button 
            type="button" 
            className="cancel-button" 
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="save-button" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

DetailsPanelEditor.propTypes = {
  node: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  }),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default DetailsPanelEditor; 