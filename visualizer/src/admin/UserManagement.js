import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import registry from '../ModuleRegistry';

/**
 * User management interface for listing, creating, and editing user accounts.
 * Supports role assignment and account status management.
 */
const UserManagement = ({ onBack }) => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [paginationData, setPaginationData] = useState({
    page: 1,
    totalPages: 1,
    total: 0
  });
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    role: 'viewer',
    status: 'active',
  });
  const [formErrors, setFormErrors] = useState({});
  const [roles, setRoles] = useState([]);
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  
  // Services
  const dataService = registry.getModule('data.DataService');
  const errorHandler = registry.getModule('utils.ErrorHandler');
  const eventBus = registry.getModule('utils.EventBus');
  const gitHubService = registry.getModule('api.GitHubService');

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
    setupRoles();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Load local mock data as there are no APIs
      setTimeout(() => {
        const mockUsers = [
          {
            id: '1',
            username: 'john.doe',
            email: 'john.doe@example.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'admin',
            status: 'active',
            lastLogin: '2023-04-01T10:30:00Z',
            createdAt: '2023-01-15T08:00:00Z',
          },
          {
            id: '2',
            username: 'alice.smith',
            email: 'alice.smith@example.com',
            firstName: 'Alice',
            lastName: 'Smith',
            role: 'editor',
            status: 'active',
            lastLogin: '2023-03-28T14:15:00Z',
            createdAt: '2023-01-20T09:30:00Z',
          },
          {
            id: '3',
            username: 'bob.johnson',
            email: 'bob.johnson@example.com',
            firstName: 'Bob',
            lastName: 'Johnson',
            role: 'viewer',
            status: 'active',
            lastLogin: '2023-03-30T11:45:00Z',
            createdAt: '2023-02-05T10:00:00Z',
          },
          {
            id: '4',
            username: 'emma.wilson',
            email: 'emma.wilson@example.com',
            firstName: 'Emma',
            lastName: 'Wilson',
            role: 'editor',
            status: 'inactive',
            lastLogin: '2023-03-01T09:20:00Z',
            createdAt: '2023-02-10T11:30:00Z',
          },
        ];
        
        // Apply search filter if needed
        let filteredUsers = mockUsers;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filteredUsers = mockUsers.filter(user => 
            user.username.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query) ||
            `${user.firstName} ${user.lastName}`.toLowerCase().includes(query)
          );
        }
        
        setUsers(filteredUsers);
        setPaginationData({
          page: 1,
          totalPages: 1,
          total: filteredUsers.length
        });
        setIsLoading(false);
      }, 800);
    } catch (error) {
      console.error('Error loading users:', error);
      
      if (errorHandler) {
        errorHandler.handleError(error, { 
          type: 'dataLoadingFailure',
          context: 'UserManagement'
        });
      }
      
      if (eventBus) {
        eventBus.publish('notification:show', {
          type: 'error',
          message: 'Failed to load users. Please try again.'
        });
      }
      setIsLoading(false);
    }
  };

  const setupRoles = () => {
    // Set up static roles - no API calls
    setRoles([
      { id: 'admin', name: 'Administrator', description: 'Full system access' },
      { id: 'editor', name: 'Editor', description: 'Can edit content' },
      { id: 'viewer', name: 'Viewer', description: 'Read-only access' }
    ]);
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
    });
    setIsEditing(false);
  };

  const handleCreateNew = () => {
    setSelectedUser(null);
    setFormData({
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      role: 'viewer',
      status: 'active',
    });
    setIsEditing(true);
  };

  const handleEditUser = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (selectedUser) {
      // Reset form to selected user's data
      setFormData({
        username: selectedUser.username,
        email: selectedUser.email,
        firstName: selectedUser.firstName,
        lastName: selectedUser.lastName,
        role: selectedUser.role,
        status: selectedUser.status,
      });
    } else {
      // Reset to empty form
      setFormData({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        role: 'viewer',
        status: 'active',
      });
    }
    setIsEditing(false);
    setFormErrors({});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field if it exists
    if (formErrors[name]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.username) {
      errors.username = 'Username is required';
    } else if (!/^[a-zA-Z0-9._]+$/.test(formData.username)) {
      errors.username = 'Username can only contain letters, numbers, dots, and underscores';
    }
    
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
    }
    
    if (!formData.firstName) {
      errors.firstName = 'First name is required';
    }
    
    if (!formData.lastName) {
      errors.lastName = 'Last name is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsActionInProgress(true);
    
    try {
      if (selectedUser) {
        // Update existing user (locally)
        const updatedUser = {
          ...selectedUser,
          ...formData
        };
        
        // Update local state
        setUsers(users.map(user => 
          user.id === selectedUser.id ? updatedUser : user
        ));
        
        // Update selected user
        setSelectedUser(updatedUser);
        
        if (eventBus) {
          eventBus.publish('notification:show', {
            type: 'success',
            message: 'User updated successfully'
          });
        }
      } else {
        // Create new user (locally)
        const newUser = {
          id: `user-${Date.now()}`, // Generate unique ID
          ...formData,
          lastLogin: null,
          createdAt: new Date().toISOString(),
        };
        
        // Update local state
        setUsers([...users, newUser]);
        
        // Select the new user
        setSelectedUser(newUser);
        
        if (eventBus) {
          eventBus.publish('notification:show', {
            type: 'success',
            message: 'User created successfully'
          });
        }
      }
      
      setIsEditing(false);
      setFormErrors({});
      
      // Note: In a real implementation, this would save to GitHub or local storage
      // using dataService or gitHubService, but we're just updating local state for now
    } catch (error) {
      console.error('Error saving user:', error);
      
      if (errorHandler) {
        errorHandler.handleError(error, { 
          type: 'dataUpdateFailure',
          context: 'UserManagement' 
        });
      }
      
      if (eventBus) {
        eventBus.publish('notification:show', {
          type: 'error',
          message: 'Failed to save user. Please try again.'
        });
      }
      
      setFormErrors(prev => ({
        ...prev,
        submit: 'Failed to save user. Please try again.'
      }));
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    if (window.confirm(`Are you sure you want to delete the user "${selectedUser.username}"?`)) {
      setIsActionInProgress(true);
      
      try {
        // Delete user (just from local state for now)
        setUsers(users.filter(user => user.id !== selectedUser.id));
        
        // Reset selection
        setSelectedUser(null);
        setIsEditing(false);
        
        if (eventBus) {
          eventBus.publish('notification:show', {
            type: 'success',
            message: 'User deleted successfully'
          });
        }
        
        // Note: In a real implementation, this would delete from GitHub or local storage
        // using dataService or gitHubService, but we're just updating local state for now
      } catch (error) {
        console.error('Error deleting user:', error);
        
        if (errorHandler) {
          errorHandler.handleError(error, { 
            type: 'dataUpdateFailure',
            context: 'UserManagement' 
          });
        }
        
        if (eventBus) {
          eventBus.publish('notification:show', {
            type: 'error',
            message: 'Failed to delete user. Please try again.'
          });
        }
      } finally {
        setIsActionInProgress(false);
      }
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    // Re-fetch with search query
    fetchUsers();
  };

  // Helper to render role name from ID
  const getRoleName = (roleId) => {
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : roleId;
  };

  return (
    <div className="user-management">
      <div className="section-header">
        <button className="back-button" onClick={onBack}>
          ← Back to Dashboard
        </button>
        <h1>User Management</h1>
      </div>
      
      <div className="user-management-container">
        <div className="users-list-section">
          <div className="list-header">
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={handleSearch}
                aria-label="Search users"
              />
            </div>
            <button 
              className="create-button primary-button"
              onClick={handleCreateNew}
              disabled={isActionInProgress}
            >
              New User
            </button>
          </div>
          
          {isLoading ? (
            <div className="loading-indicator">Loading users...</div>
          ) : (
            <div className="users-list">
              {users.length === 0 ? (
                <div className="empty-list-message">
                  {searchQuery 
                    ? `No users match "${searchQuery}"` 
                    : 'No users found'}
                </div>
              ) : (
                <>
                  {users.map(user => (
                    <div 
                      key={user.id} 
                      className={`user-list-item ${selectedUser && selectedUser.id === user.id ? 'selected' : ''}`}
                      onClick={() => handleSelectUser(user)}
                    >
                      <div className="user-name">
                        {user.firstName} {user.lastName}
                        <span className="user-username">@{user.username}</span>
                      </div>
                      <div className="user-email">{user.email}</div>
                      <div className="user-meta">
                        <span className={`user-role ${user.role}`}>{getRoleName(user.role)}</span>
                        <span className={`user-status ${user.status}`}>{user.status}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        
        <div className="user-details-section">
          {!selectedUser && !isEditing ? (
            <div className="empty-details">
              <p>Select a user from the list to view details, or click "New User" to create a new account.</p>
            </div>
          ) : (
            <div className="user-details">
              <div className="details-header">
                <h2>{isEditing 
                  ? (selectedUser ? `Edit ${selectedUser.username}` : 'Create New User') 
                  : `${selectedUser.firstName} ${selectedUser.lastName}`
                }</h2>
                
                {!isEditing && selectedUser && (
                  <div className="details-actions">
                    <button 
                      className="edit-button" 
                      onClick={handleEditUser}
                      disabled={isActionInProgress}
                    >
                      Edit
                    </button>
                    <button 
                      className="delete-button" 
                      onClick={handleDeleteUser}
                      disabled={isActionInProgress}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
              
              {isEditing ? (
                <form onSubmit={handleSubmit} className="user-form">
                  <div className={`form-group ${formErrors.username ? 'has-error' : ''}`}>
                    <label htmlFor="username">
                      Username
                      <span className="required-indicator">*</span>
                    </label>
                    <input
                      type="text"
                      id="username"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      required
                      aria-invalid={!!formErrors.username}
                      aria-describedby={formErrors.username ? "username-error" : undefined}
                    />
                    {formErrors.username && (
                      <div className="error-message" id="username-error">{formErrors.username}</div>
                    )}
                  </div>
                  
                  <div className={`form-group ${formErrors.email ? 'has-error' : ''}`}>
                    <label htmlFor="email">
                      Email
                      <span className="required-indicator">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      aria-invalid={!!formErrors.email}
                      aria-describedby={formErrors.email ? "email-error" : undefined}
                    />
                    {formErrors.email && (
                      <div className="error-message" id="email-error">{formErrors.email}</div>
                    )}
                  </div>
                  
                  <div className={`form-group ${formErrors.firstName ? 'has-error' : ''}`}>
                    <label htmlFor="firstName">
                      First Name
                      <span className="required-indicator">*</span>
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      aria-invalid={!!formErrors.firstName}
                      aria-describedby={formErrors.firstName ? "firstname-error" : undefined}
                    />
                    {formErrors.firstName && (
                      <div className="error-message" id="firstname-error">{formErrors.firstName}</div>
                    )}
                  </div>
                  
                  <div className={`form-group ${formErrors.lastName ? 'has-error' : ''}`}>
                    <label htmlFor="lastName">
                      Last Name
                      <span className="required-indicator">*</span>
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      aria-invalid={!!formErrors.lastName}
                      aria-describedby={formErrors.lastName ? "lastname-error" : undefined}
                    />
                    {formErrors.lastName && (
                      <div className="error-message" id="lastname-error">{formErrors.lastName}</div>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="role">Role</label>
                    <select
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                    >
                      {roles.map(role => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="status">Status</label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  
                  {formErrors.submit && (
                    <div className="error-message form-error">{formErrors.submit}</div>
                  )}
                  
                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="cancel-button" 
                      onClick={handleCancelEdit}
                      disabled={isActionInProgress}
                    >
                      Cancel
                    </button>
                    
                    <button 
                      type="submit" 
                      className="save-button primary-button"
                      disabled={isActionInProgress}
                    >
                      {isActionInProgress ? 'Saving...' : 'Save User'}
                    </button>
                  </div>
                </form>
              ) : selectedUser && (
                <div className="user-info">
                  <div className="info-section">
                    <h3>Account Information</h3>
                    
                    <div className="info-item">
                      <div className="info-label">Username</div>
                      <div className="info-value">{selectedUser.username}</div>
                    </div>
                    
                    <div className="info-item">
                      <div className="info-label">Email</div>
                      <div className="info-value">{selectedUser.email}</div>
                    </div>
                    
                    <div className="info-item">
                      <div className="info-label">Full Name</div>
                      <div className="info-value">{selectedUser.firstName} {selectedUser.lastName}</div>
                    </div>
                    
                    <div className="info-item">
                      <div className="info-label">Role</div>
                      <div className="info-value">
                        <span className={`user-role ${selectedUser.role}`}>
                          {getRoleName(selectedUser.role)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="info-item">
                      <div className="info-label">Status</div>
                      <div className="info-value">
                        <span className={`user-status ${selectedUser.status}`}>
                          {selectedUser.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="info-section">
                    <h3>Additional Information</h3>
                    
                    <div className="info-item">
                      <div className="info-label">Created</div>
                      <div className="info-value">
                        {new Date(selectedUser.createdAt).toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="info-item">
                      <div className="info-label">Last Login</div>
                      <div className="info-value">
                        {selectedUser.lastLogin 
                          ? new Date(selectedUser.lastLogin).toLocaleString() 
                          : 'Never'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

UserManagement.propTypes = {
  onBack: PropTypes.func.isRequired,
};

export default registry.register(
  'admin.UserManagement',
  UserManagement,
  ['data.DataService', 'utils.ErrorHandler', 'utils.EventBus', 'api.GitHubService'],
  {
    description: 'User management interface for listing, creating, and editing user accounts',
    usage: 'Used in the admin dashboard to manage system users'
  }
); 