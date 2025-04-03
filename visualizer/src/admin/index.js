/**
 * Admin Module Index
 * 
 * This file exports all the administration components needed for the application's
 * admin panels and functionality. These components handle user management, content
 * moderation, system configuration, and other administrative tasks.
 */

import AdminPanel from './AdminPanel';
import UserManagement from './UserManagement';
import ContentModeration from './ContentModeration';
import SystemConfiguration from './SystemConfiguration';
import PermissionEditor from './PermissionEditor';
import ActivityMonitor from './ActivityMonitor';
import SettingsEditor from './SettingsEditor';

// Register all components with ModuleRegistry
// (The components should already register themselves using the registry.register pattern)

// Export components for direct imports
export {
  AdminPanel,
  UserManagement,
  ContentModeration,
  SystemConfiguration,
  PermissionEditor,
  ActivityMonitor,
  SettingsEditor
};

// Default export for the entire admin module
export default {
  AdminPanel,
  UserManagement,
  ContentModeration,
  SystemConfiguration,
  PermissionEditor,
  ActivityMonitor,
  SettingsEditor
}; 