import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Main admin dashboard component.
 * Provides navigation and overview metrics.
 */
const AdminPanel = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    pendingModeration: 0,
    totalNodes: 0,
    totalSpheres: 0,
  });
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch dashboard statistics
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        // Replace with actual API call
        // const response = await adminApi.getStats();
        // setStats(response.data);
        
        // Mock data for now
        setTimeout(() => {
          setStats({
            totalUsers: 42,
            activeUsers: 18,
            pendingModeration: 7,
            totalNodes: 1256,
            totalSpheres: 5,
          });
          setIsLoading(false);
        }, 800);
      } catch (error) {
        console.error('Error fetching admin stats:', error);
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const adminSections = [
    { id: 'user-management', label: 'User Management', icon: '👥' },
    { id: 'permission-editor', label: 'Permission Editor', icon: '🔒' },
    { id: 'content-moderation', label: 'Content Moderation', icon: '📝' },
    { id: 'activity-monitor', label: 'Activity Monitor', icon: '📊' },
    { id: 'system-configuration', label: 'System Configuration', icon: '⚙️' },
  ];

  return (
    <div className="admin-panel">
      <h1>Admin Dashboard</h1>
      
      {isLoading ? (
        <div className="loading-indicator">Loading dashboard data...</div>
      ) : (
        <>
          <div className="stat-cards">
            <div className="stat-card">
              <h3>Total Users</h3>
              <div className="stat-value">{stats.totalUsers}</div>
            </div>
            
            <div className="stat-card">
              <h3>Active Users</h3>
              <div className="stat-value">{stats.activeUsers}</div>
            </div>
            
            <div className="stat-card">
              <h3>Pending Moderation</h3>
              <div className="stat-value">{stats.pendingModeration}</div>
              {stats.pendingModeration > 0 && (
                <div className="alert-badge">Action Required</div>
              )}
            </div>
            
            <div className="stat-card">
              <h3>Total Nodes</h3>
              <div className="stat-value">{stats.totalNodes}</div>
            </div>
            
            <div className="stat-card">
              <h3>Visualization Spheres</h3>
              <div className="stat-value">{stats.totalSpheres}</div>
            </div>
          </div>

          <div className="admin-sections">
            <h2>Administration</h2>
            <div className="section-tiles">
              {adminSections.map(section => (
                <button
                  key={section.id}
                  className="section-tile"
                  onClick={() => onNavigate(section.id)}
                >
                  <div className="section-icon">{section.icon}</div>
                  <div className="section-label">{section.label}</div>
                  {section.id === 'content-moderation' && stats.pendingModeration > 0 && (
                    <div className="section-badge">{stats.pendingModeration}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          <div className="recent-activity">
            <h2>Recent Activity</h2>
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>10 min ago</td>
                  <td>john.doe</td>
                  <td>Node Update</td>
                  <td>Modified "Technical Safeguards" description</td>
                </tr>
                <tr>
                  <td>32 min ago</td>
                  <td>alice.smith</td>
                  <td>New Connection</td>
                  <td>Connected "Interpretability Tools" to "Transparency"</td>
                </tr>
                <tr>
                  <td>1 hour ago</td>
                  <td>bob.johnson</td>
                  <td>New Node</td>
                  <td>Created "Continual Learning Framework"</td>
                </tr>
                <tr>
                  <td>2 hours ago</td>
                  <td>system</td>
                  <td>Backup</td>
                  <td>Automatic daily backup completed</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

AdminPanel.propTypes = {
  onNavigate: PropTypes.func.isRequired,
};

export default AdminPanel; 