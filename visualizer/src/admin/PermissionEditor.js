// This is a placeholder file created by the migration script
// To be implemented according to the migration plan

import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * Manages user permissions and role assignments
 * Allows administrators to configure access control for the application
 */
const PermissionEditor = ({
  initialUserId = null,
  readOnly = false
}) => {
  // State
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(initialUserId);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userRoles, setUserRoles] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [expandedSections, setExpandedSections] = useState({
    roles: true,
    permissions: true
  });
  
  // References to services
  const authService = registry.get('auth.AuthService');
  const permissionManager = registry.get('auth.PermissionManager');
  
  // Default roles configuration
  const defaultRoles = [
    {
      id: 'admin',
      name: 'Administrator',
      description: 'Full system access and control',
      level: 100,
      autoGranted: false
    },
    {
      id: 'moderator',
      name: 'Moderator',
      description: 'Manages content and approves submissions',
      level: 75,
      autoGranted: false
    },
    {
      id: 'contributor',
      name: 'Contributor',
      description: 'Creates and edits content',
      level: 50,
      autoGranted: false
    },
    {
      id: 'viewer',
      name: 'Viewer',
      description: 'Read-only access to content',
      level: 25,
      autoGranted: true
    }
  ];
  
  // Default permissions configuration
  const defaultPermissions = [
    // User management permissions
    {
      id: 'user:create',
      name: 'Create Users',
      description: 'Can create new user accounts',
      category: 'user',
      roles: ['admin']
    },
    {
      id: 'user:view',
      name: 'View Users',
      description: 'Can view user details',
      category: 'user',
      roles: ['admin', 'moderator']
    },
    {
      id: 'user:edit',
      name: 'Edit Users',
      description: 'Can modify user accounts',
      category: 'user',
      roles: ['admin']
    },
    {
      id: 'user:delete',
      name: 'Delete Users',
      description: 'Can delete user accounts',
      category: 'user',
      roles: ['admin']
    },
    
    // Content management permissions
    {
      id: 'content:create',
      name: 'Create Content',
      description: 'Can create new content',
      category: 'content',
      roles: ['admin', 'moderator', 'contributor']
    },
    {
      id: 'content:view',
      name: 'View Content',
      description: 'Can view content',
      category: 'content',
      roles: ['admin', 'moderator', 'contributor', 'viewer']
    },
    {
      id: 'content:edit',
      name: 'Edit Content',
      description: 'Can modify existing content',
      category: 'content',
      roles: ['admin', 'moderator', 'contributor']
    },
    {
      id: 'content:delete',
      name: 'Delete Content',
      description: 'Can delete content',
      category: 'content',
      roles: ['admin', 'moderator']
    },
    {
      id: 'content:approve',
      name: 'Approve Content',
      description: 'Can approve or reject content changes',
      category: 'content',
      roles: ['admin', 'moderator']
    },
    
    // Visualization permissions
    {
      id: 'visualization:create',
      name: 'Create Visualizations',
      description: 'Can create new visualizations',
      category: 'visualization',
      roles: ['admin', 'moderator', 'contributor']
    },
    {
      id: 'visualization:view',
      name: 'View Visualizations',
      description: 'Can view visualizations',
      category: 'visualization',
      roles: ['admin', 'moderator', 'contributor', 'viewer']
    },
    {
      id: 'visualization:edit',
      name: 'Edit Visualizations',
      description: 'Can modify existing visualizations',
      category: 'visualization',
      roles: ['admin', 'moderator', 'contributor']
    },
    {
      id: 'visualization:delete',
      name: 'Delete Visualizations',
      description: 'Can delete visualizations',
      category: 'visualization',
      roles: ['admin', 'moderator']
    },
    
    // Security permissions
    {
      id: 'security:decrypt',
      name: 'Decrypt Content',
      description: 'Can decrypt encrypted content',
      category: 'security',
      roles: ['admin', 'moderator', 'contributor']
    },
    {
      id: 'security:encrypt',
      name: 'Encrypt Content',
      description: 'Can encrypt content',
      category: 'security',
      roles: ['admin', 'moderator']
    },
    {
      id: 'security:manage_keys',
      name: 'Manage Keys',
      description: 'Can manage encryption keys',
      category: 'security',
      roles: ['admin']
    },
    
    // System permissions
    {
      id: 'system:settings',
      name: 'Manage Settings',
      description: 'Can modify system settings',
      category: 'system',
      roles: ['admin']
    },
    {
      id: 'system:logs',
      name: 'View Logs',
      description: 'Can view system logs',
      category: 'system',
      roles: ['admin', 'moderator']
    },
    {
      id: 'system:backup',
      name: 'Manage Backups',
      description: 'Can create and restore backups',
      category: 'system',
      roles: ['admin']
    }
  ];
  
  /**
   * Initialize data
   */
  const initializeData = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Load roles
      let roleData = [];
      if (permissionManager) {
        roleData = await permissionManager.getRoles();
      } else {
        roleData = defaultRoles;
      }
      setRoles(roleData);
      
      // Load permissions
      let permissionData = [];
      if (permissionManager) {
        permissionData = await permissionManager.getPermissions();
      } else {
        permissionData = defaultPermissions;
      }
      setPermissions(permissionData);
      
      // Load users
      let userData = [];
      if (authService) {
        userData = await authService.getUsers();
      } else {
        // Mock data for development
        userData = generateMockUsers(20);
      }
      setUsers(userData);
      setFilteredUsers(userData);
      
      // Load selected user if provided
      if (selectedUserId) {
        await loadUserDetails(selectedUserId);
      }
    } catch (error) {
      console.error('Error initializing PermissionEditor:', error);
      EventBus.publish('notification:show', {
        type: 'error',
        message: 'Failed to load permission data'
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedUserId, authService, permissionManager]);
  
  /**
   * Generate mock users for development
   * @param {number} count - Number of users to generate
   * @returns {Array} - Array of mock users
   */
  const generateMockUsers = (count) => {
    const users = [];
    const roleIds = defaultRoles.map(role => role.id);
    
    for (let i = 0; i < count; i++) {
      const userRoles = [roleIds[Math.floor(Math.random() * roleIds.length)]];
      
      // Some users have multiple roles
      if (Math.random() > 0.7) {
        const secondRole = roleIds[Math.floor(Math.random() * roleIds.length)];
        if (!userRoles.includes(secondRole)) {
          userRoles.push(secondRole);
        }
      }
      
      users.push({
        id: `user-${i + 1}`,
        username: `user${i + 1}`,
        email: `user${i + 1}@example.com`,
        fullName: `User ${i + 1}`,
        roles: userRoles,
        createdAt: Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000), // Random date in last 90 days
        active: Math.random() > 0.1 // 10% chance of inactive
      });
    }
    
    // Add admin user
    users.push({
      id: 'admin',
      username: 'admin',
      email: 'admin@example.com',
      fullName: 'Administrator',
      roles: ['admin'],
      createdAt: Date.now() - 180 * 24 * 60 * 60 * 1000, // 180 days ago
      active: true
    });
    
    return users;
  };
  
  // Initialize on component mount
  useEffect(() => {
    initializeData();
    
    // Listen for user update events
    const handleUserUpdated = (data) => {
      if (data.userId === selectedUserId) {
        loadUserDetails(selectedUserId);
      }
    };
    
    EventBus.subscribe('user:updated', handleUserUpdated);
    
    return () => {
      EventBus.unsubscribe('user:updated', handleUserUpdated);
    };
  }, [initializeData, selectedUserId]);
  
  /**
   * Handle search input change
   * @param {Event} e - Input change event
   */
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Filter users based on search query
    if (query.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => 
        user.username.toLowerCase().includes(query.toLowerCase()) ||
        user.email.toLowerCase().includes(query.toLowerCase()) ||
        (user.fullName && user.fullName.toLowerCase().includes(query.toLowerCase()))
      );
      setFilteredUsers(filtered);
    }
  };
  
  /**
   * Load user details
   * @param {string} userId - User ID
   */
  const loadUserDetails = async (userId) => {
    if (!userId) return;
    
    setIsLoading(true);
    
    try {
      // Find user in the list
      const user = users.find(u => u.id === userId);
      
      if (user) {
        setSelectedUser(user);
        
        // Get user roles
        let userRoles = user.roles || [];
        
        // Get user permissions
        let userPermissions = [];
        if (permissionManager) {
          userPermissions = await permissionManager.getUserPermissions(userId);
        } else {
          // Generate from roles for mock data
          userRoles.forEach(role => {
            defaultPermissions.forEach(permission => {
              if (permission.roles.includes(role) && !userPermissions.includes(permission.id)) {
                userPermissions.push(permission.id);
              }
            });
          });
        }
        
        setUserRoles(userRoles);
        setUserPermissions(userPermissions);
      } else {
        // User not found
        setSelectedUser(null);
        setUserRoles([]);
        setUserPermissions([]);
        
        EventBus.publish('notification:show', {
          type: 'error',
          message: 'User not found'
        });
      }
    } catch (error) {
      console.error('Error loading user details:', error);
      EventBus.publish('notification:show', {
        type: 'error',
        message: 'Failed to load user details'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Handle user selection
   * @param {string} userId - User ID
   */
  const handleUserSelect = (userId) => {
    if (userId === selectedUserId) return;
    
    setSelectedUserId(userId);
    loadUserDetails(userId);
  };
  
  /**
   * Handle role toggle
   * @param {string} roleId - Role ID
   * @param {boolean} checked - Whether role is checked
   */
  const handleRoleToggle = (roleId, checked) => {
    if (readOnly) return;
    
    setUserRoles(prevRoles => {
      if (checked) {
        // Add role
        if (!prevRoles.includes(roleId)) {
          return [...prevRoles, roleId];
        }
      } else {
        // Remove role
        return prevRoles.filter(id => id !== roleId);
      }
      return prevRoles;
    });
  };
  
  /**
   * Handle permission toggle
   * @param {string} permissionId - Permission ID
   * @param {boolean} checked - Whether permission is checked
   */
  const handlePermissionToggle = (permissionId, checked) => {
    if (readOnly) return;
    
    setUserPermissions(prevPermissions => {
      if (checked) {
        // Add permission
        if (!prevPermissions.includes(permissionId)) {
          return [...prevPermissions, permissionId];
        }
      } else {
        // Remove permission
        return prevPermissions.filter(id => id !== permissionId);
      }
      return prevPermissions;
    });
  };
  
  /**
   * Save user permissions
   */
  const handleSave = async () => {
    if (readOnly || !selectedUser) return;
    
    setIsSaving(true);
    
    try {
      if (permissionManager) {
        // Update user roles
        await permissionManager.setUserRoles(selectedUser.id, userRoles);
        
        // Update user permissions
        await permissionManager.setUserPermissions(selectedUser.id, userPermissions);
      }
      
      // Update local user data
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === selectedUser.id 
            ? { ...user, roles: [...userRoles] } 
            : user
        )
      );
      
      // Log activity
      EventBus.publish('activity:log', {
        type: 'user:permission:change',
        userId: selectedUser.id,
        details: `Permissions updated for user: ${selectedUser.username}`
      });
      
      // Show notification
      EventBus.publish('notification:show', {
        type: 'success',
        message: `Permissions updated for ${selectedUser.username}`
      });
    } catch (error) {
      console.error('Error saving permissions:', error);
      EventBus.publish('notification:show', {
        type: 'error',
        message: 'Failed to save permissions'
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  /**
   * Reset user permissions
   */
  const handleReset = () => {
    if (readOnly || !selectedUser) return;
    
    // Show confirmation dialog
    EventBus.publish('modal:show', {
      title: 'Reset Permissions',
      component: ({ closeModal, confirmModal }) => (
        <div>
          <p>Are you sure you want to reset permissions for {selectedUser.username}?</p>
          <p>This will restore the default permissions based on their roles.</p>
          <div className="modal__buttons">
            <button className="button button--secondary" onClick={closeModal}>Cancel</button>
            <button 
              className="button button--warning" 
              onClick={() => {
                resetPermissions();
                confirmModal();
              }}
            >
              Reset Permissions
            </button>
          </div>
        </div>
      )
    });
  };
  
  /**
   * Reset permissions after confirmation
   */
  const resetPermissions = async () => {
    if (!selectedUser) return;
    
    try {
      // Get permissions from roles
      const defaultPermissionsForUser = [];
      userRoles.forEach(role => {
        permissions.forEach(permission => {
          if (permission.roles.includes(role) && !defaultPermissionsForUser.includes(permission.id)) {
            defaultPermissionsForUser.push(permission.id);
          }
        });
      });
      
      setUserPermissions(defaultPermissionsForUser);
      
      // Log activity
      EventBus.publish('activity:log', {
        type: 'user:permission:reset',
        userId: selectedUser.id,
        details: `Permissions reset for user: ${selectedUser.username}`
      });
      
      // Show notification
      EventBus.publish('notification:show', {
        type: 'success',
        message: `Permissions reset for ${selectedUser.username}`
      });
    } catch (error) {
      console.error('Error resetting permissions:', error);
      EventBus.publish('notification:show', {
        type: 'error',
        message: 'Failed to reset permissions'
      });
    }
  };
  
  /**
   * Handle section toggle
   * @param {string} section - Section name
   */
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  /**
   * Render user list
   * @returns {React.Element} - User list
   */
  const renderUserList = () => {
    if (isLoading && users.length === 0) {
      return (
        <div className="permission-editor__loading">
          Loading users...
        </div>
      );
    }
    
    return (
      <div className="permission-editor__user-list">
        <div className="permission-editor__search">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="permission-editor__search-input"
          />
        </div>
        
        <div className="permission-editor__users-container">
          {filteredUsers.length === 0 ? (
            <div className="permission-editor__no-users">
              No users found matching "{searchQuery}"
            </div>
          ) : (
            filteredUsers.map(user => (
              <div 
                key={user.id}
                className={`permission-editor__user-item ${selectedUserId === user.id ? 'permission-editor__user-item--selected' : ''} ${!user.active ? 'permission-editor__user-item--inactive' : ''}`}
                onClick={() => handleUserSelect(user.id)}
              >
                <div className="permission-editor__user-name">
                  {user.fullName || user.username}
                  {!user.active && <span className="permission-editor__user-inactive">(Inactive)</span>}
                </div>
                <div className="permission-editor__user-email">{user.email}</div>
                <div className="permission-editor__user-roles">
                  {user.roles && user.roles.map(role => {
                    const roleObj = roles.find(r => r.id === role);
                    return (
                      <span key={role} className="permission-editor__user-role">
                        {roleObj ? roleObj.name : role}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };
  
  /**
   * Render roles section
   * @returns {React.Element} - Roles section
   */
  const renderRolesSection = () => {
    if (!selectedUser) return null;
    
    return (
      <div className="permission-editor__section">
        <div 
          className="permission-editor__section-header"
          onClick={() => toggleSection('roles')}
        >
          <h3 className="permission-editor__section-title">Roles</h3>
          <span className="permission-editor__section-toggle">
            {expandedSections.roles ? '▼' : '▶'}
          </span>
        </div>
        
        {expandedSections.roles && (
          <div className="permission-editor__section-content">
            <div className="permission-editor__roles">
              {roles.map(role => (
                <div key={role.id} className="permission-editor__role">
                  <label className="permission-editor__role-label">
                    <input
                      type="checkbox"
                      checked={userRoles.includes(role.id)}
                      onChange={(e) => handleRoleToggle(role.id, e.target.checked)}
                      disabled={readOnly}
                      className="permission-editor__role-checkbox"
                    />
                    <span className="permission-editor__role-name">{role.name}</span>
                  </label>
                  <span className="permission-editor__role-description">{role.description}</span>
                  <span className="permission-editor__role-level">Level: {role.level}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  /**
   * Render permissions section
   * @returns {React.Element} - Permissions section
   */
  const renderPermissionsSection = () => {
    if (!selectedUser) return null;
    
    // Group permissions by category
    const permissionsByCategory = permissions.reduce((acc, permission) => {
      const category = permission.category || 'other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(permission);
      return acc;
    }, {});
    
    return (
      <div className="permission-editor__section">
        <div 
          className="permission-editor__section-header"
          onClick={() => toggleSection('permissions')}
        >
          <h3 className="permission-editor__section-title">Permissions</h3>
          <span className="permission-editor__section-toggle">
            {expandedSections.permissions ? '▼' : '▶'}
          </span>
        </div>
        
        {expandedSections.permissions && (
          <div className="permission-editor__section-content">
            {Object.entries(permissionsByCategory).map(([category, categoryPermissions]) => (
              <div key={category} className="permission-editor__category">
                <h4 className="permission-editor__category-title">
                  {category.charAt(0).toUpperCase() + category.slice(1)} Permissions
                </h4>
                <div className="permission-editor__permissions">
                  {categoryPermissions.map(permission => {
                    // Check if permission comes from a role
                    const isFromRole = userRoles.some(roleId => 
                      permission.roles.includes(roleId)
                    );
                    
                    return (
                      <div 
                        key={permission.id} 
                        className={`permission-editor__permission ${isFromRole ? 'permission-editor__permission--from-role' : ''}`}
                      >
                        <label className="permission-editor__permission-label">
                          <input
                            type="checkbox"
                            checked={userPermissions.includes(permission.id)}
                            onChange={(e) => handlePermissionToggle(permission.id, e.target.checked)}
                            disabled={readOnly || isFromRole}
                            className="permission-editor__permission-checkbox"
                          />
                          <span className="permission-editor__permission-name">{permission.name}</span>
                        </label>
                        <span className="permission-editor__permission-description">{permission.description}</span>
                        {isFromRole && (
                          <span className="permission-editor__permission-source">
                            Granted by role
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  
  /**
   * Render user details
   * @returns {React.Element} - User details
   */
  const renderUserDetails = () => {
    if (isLoading && selectedUserId) {
      return (
        <div className="permission-editor__loading">
          Loading user details...
        </div>
      );
    }
    
    if (!selectedUser) {
      return (
        <div className="permission-editor__no-selection">
          <p>Select a user to manage their permissions</p>
        </div>
      );
    }
    
    return (
      <div className="permission-editor__user-details">
        <div className="permission-editor__user-header">
          <h2 className="permission-editor__user-title">
            {selectedUser.fullName || selectedUser.username}
            {!selectedUser.active && <span className="permission-editor__user-inactive"> (Inactive)</span>}
          </h2>
          <div className="permission-editor__user-subtitle">{selectedUser.email}</div>
        </div>
        
        {renderRolesSection()}
        {renderPermissionsSection()}
        
        {!readOnly && (
          <div className="permission-editor__actions">
            <button 
              className="permission-editor__action permission-editor__action--reset"
              onClick={handleReset}
              disabled={isSaving}
            >
              Reset to Defaults
            </button>
            <button 
              className="permission-editor__action permission-editor__action--save"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="permission-editor">
      <div className="permission-editor__container">
        <div className="permission-editor__sidebar">
          {renderUserList()}
        </div>
        <div className="permission-editor__content">
          {renderUserDetails()}
        </div>
      </div>
    </div>
  );
};

PermissionEditor.propTypes = {
  initialUserId: PropTypes.string,
  readOnly: PropTypes.bool
};

export default registry.register(
  'admin.PermissionEditor',
  PermissionEditor,
  [
    'auth.AuthService',
    'auth.PermissionManager',
    'utils.EventBus'
  ],
  {
    description: 'Manages user permissions and role assignments',
    usage: 'Used in the Admin Panel to configure access control for the application'
  }
);

