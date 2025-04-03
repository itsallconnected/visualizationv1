# Authentication System Implementation Documentation

## Overview

This document provides an overview of the authentication system implementation for the AI Alignment Visualization project, focusing on the Authentication Context Provider (Task 2.2) and its integration with GitHub OAuth (Task 2.1).

## Architecture

The authentication system follows a modular, component-based architecture with clear separation of concerns:

1. **Authentication Context** - Provides authentication state and methods throughout the application
2. **Authentication Provider** - Implements the context provider with authentication logic
3. **Authentication Service** - Handles authentication operations like login, logout, etc.
4. **Authentication Storage** - Manages secure storage of authentication state
5. **Authentication Utilities** - Provides helper functions for common operations
6. **Authentication Hooks** - Offers convenient access to authentication features

## Implementation Details

### 1. Auth State Model

We implemented a comprehensive authentication state model with TypeScript interfaces defined in `src/types/auth/AuthTypes.js`:

- `AuthStatus` - Defines possible authentication states (idle, authenticating, authenticated, etc.)
- `AuthEventTypes` - Defines authentication lifecycle events
- `PermissionLevels` - Defines numeric permission levels for different user roles
- Type definitions for user profiles, authentication state, tokens, etc.

### 2. Authentication Context Provider

The provider implementation in `src/auth/AuthProvider.jsx` features:

- State management using React's `useReducer` hook
- Rich authentication state including user data, permission levels, login history, etc.
- Session monitoring with automatic verification and refresh
- Cross-tab synchronization for consistent auth state across browser tabs
- Deep integration with GitHub OAuth system
- Comprehensive permission and role management

### 3. Auth Utilities

The authentication utilities in `src/utils/auth/AuthUtilities.js` provide:

- Token validation and management
- Permission verification based on user roles
- PKCE extension support for OAuth security
- Error normalization for consistent error handling
- User profile normalization from GitHub data

### 4. Secure Storage

The storage implementation in `src/utils/auth/AuthStateStorage.js` features:

- Encrypted storage of sensitive authentication data
- Cross-tab synchronization through browser storage events
- Storage version migration support for data structure changes
- Login history tracking
- Session persistence

### 5. Authentication Hooks

Custom React hooks in `src/auth/useAuth.js` provide:

- Easy access to authentication context in functional components
- Permission checking with `usePermission`, `useAllPermissions`, and `useAnyPermission`
- Separation of auth state and actions with `useAuthState` and `useAuthActions`

### 6. OAuth Callback Handling

The OAuth callback implementation in `public/auth-callback.html` provides:

- Secure handling of OAuth redirects
- Error detection and reporting
- Smooth user experience during authentication flow
- Clean redirection back to the application

## Usage Examples

### Basic Authentication

```jsx
import { useAuth } from 'auth/useAuth';

function LoginButton() {
  const { isAuthenticated, login, logout } = useAuth();
  
  return isAuthenticated
    ? <button onClick={logout}>Sign Out</button>
    : <button onClick={login}>Sign In with GitHub</button>;
}
```

### Permission-Based Rendering

```jsx
import { usePermission } from 'auth/useAuth';

function EditButton({ nodeId }) {
  const canEdit = usePermission('node:edit');
  
  if (!canEdit) return null;
  
  return <button onClick={() => editNode(nodeId)}>Edit</button>;
}
```

### Accessing User Data

```jsx
import { useAuth } from 'auth/useAuth';

function UserProfile() {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <p>Please sign in to view your profile</p>;
  }
  
  return (
    <div>
      <img src={user.avatar} alt={user.name} />
      <h2>{user.name}</h2>
      <p>Username: {user.username}</p>
      <p>Role: {user.roles.join(', ')}</p>
    </div>
  );
}
```

## Security Considerations

The implementation includes several security features:

1. **Encrypted Storage** - Sensitive data is encrypted in local storage
2. **PKCE Extension** - Prevents authorization code interception attacks
3. **Cross-Tab Sync** - Ensures consistent authentication state across tabs
4. **Token Expiration** - Monitors token expiration and handles refreshing
5. **Session Verification** - Regularly verifies session validity
6. **Secure OAuth Flow** - Implements best practices for GitHub OAuth

## Conclusion

The authentication system provides a robust, secure, and user-friendly authentication experience while maintaining a clean, modular architecture that's easy to extend and maintain. It forms the foundation for user management, content protection, and permission-based features throughout the application. 