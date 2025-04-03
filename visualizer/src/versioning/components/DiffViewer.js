import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Tabs, Tab, Divider, CircularProgress, 
  Button, Tooltip, IconButton, Menu, MenuItem } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoIcon from '@mui/icons-material/Info';

import registry from '../../ModuleRegistry';
import EventBus from '../../utils/EventBus';

/**
 * Component for displaying differences between content versions
 */
const DiffViewer = ({
  versionA,
  versionB,
  onClose,
  maxHeight = 700,
  maxWidth = 1200
}) => {
  // References to services
  const diffService = registry.getModule('versioning.DiffService');
  const versionManager = registry.getModule('versioning.VersionManager');
  
  // State
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [optionsMenu, setOptionsMenu] = useState(null);
  const [diffOptions, setDiffOptions] = useState({
    format: 'json',
    ignoreWhitespace: true,
    contextLines: 3
  });
  
  // Tabs
  const tabs = [
    { label: 'Changes', id: 'changes' },
    { label: 'Side by Side', id: 'side-by-side' },
    { label: 'Version Info', id: 'info' }
  ];
  
  // Load comparison data
  useEffect(() => {
    const loadComparison = async () => {
      if (!diffService || !versionA?.id || !versionB?.id) {
        setError('Missing version information or diff service');
        setLoading(false);
        return;
      }
      
      setLoading(true);
      
      try {
        const result = await diffService.compareVersions(versionA.id, versionB.id, {
          ...diffOptions,
          forceRefresh: true
        });
        
        setComparison(result);
      } catch (err) {
        console.error('Failed to compare versions:', err);
        setError('Failed to load comparison. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadComparison();
  }, [versionA, versionB, diffService, diffOptions]);
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  // Handle copy to clipboard
  const handleCopyToClipboard = () => {
    if (!comparison) return;
    
    let textToCopy = '';
    
    if (activeTab === 0) {
      // Copy changes summary
      textToCopy = generateChangesSummary();
    } else if (activeTab === 1) {
      // Copy raw diff
      textToCopy = JSON.stringify(comparison.diff, null, 2);
    } else {
      // Copy version info
      textToCopy = generateVersionInfo();
    }
    
    navigator.clipboard.writeText(textToCopy).then(
      () => {
        EventBus.publish('notification:show', {
          type: 'success',
          message: 'Copied to clipboard'
        });
      },
      (err) => {
        console.error('Failed to copy:', err);
        EventBus.publish('notification:show', {
          type: 'error',
          message: 'Failed to copy to clipboard'
        });
      }
    );
  };
  
  // Generate changes summary text
  const generateChangesSummary = () => {
    if (!comparison) return '';
    
    const { versionA, versionB, diff, summary } = comparison;
    
    return `Comparing versions:
From: ${versionA.commitMessage || 'No message'} (${new Date(versionA.createdAt).toLocaleString()})
To:   ${versionB.commitMessage || 'No message'} (${new Date(versionB.createdAt).toLocaleString()})

Changes Summary:
- Added: ${summary.addedCount}
- Removed: ${summary.removedCount}
- Modified: ${summary.modifiedCount}
- Total changes: ${summary.totalChanges}
`;
  };
  
  // Generate version info text
  const generateVersionInfo = () => {
    if (!comparison) return '';
    
    const { versionA, versionB } = comparison;
    
    return `Version A:
- ID: ${versionA.id}
- Created: ${new Date(versionA.createdAt).toLocaleString()}
- Created By: ${versionA.createdBy || 'Unknown'}
- Message: ${versionA.commitMessage || 'No message'}

Version B:
- ID: ${versionB.id}
- Created: ${new Date(versionB.createdAt).toLocaleString()}
- Created By: ${versionB.createdBy || 'Unknown'}
- Message: ${versionB.commitMessage || 'No message'}
`;
  };
  
  // Handle options menu open
  const handleOptionsMenuOpen = (event) => {
    setOptionsMenu(event.currentTarget);
  };
  
  // Handle options menu close
  const handleOptionsMenuClose = () => {
    setOptionsMenu(null);
  };
  
  // Handle option change
  const handleOptionChange = (option, value) => {
    setDiffOptions(prev => ({
      ...prev,
      [option]: value
    }));
    handleOptionsMenuClose();
  };
  
  // Render changes panel
  const renderChangesPanel = () => {
    if (!comparison || !comparison.diff) {
      return (
        <Box p={3} textAlign="center">
          <Typography color="textSecondary">No changes to display</Typography>
        </Box>
      );
    }
    
    const { diff } = comparison;
    
    if (diff.type === 'json') {
      return renderJsonDiff(diff);
    } else if (diff.type === 'text') {
      return renderTextDiff(diff);
    } else if (diff.type === 'html' && diff.markedHtml) {
      return (
        <Box p={2} sx={{ maxHeight: maxHeight - 150, overflow: 'auto' }}>
          <div dangerouslySetInnerHTML={{ __html: diff.markedHtml }} />
        </Box>
      );
    }
    
    return (
      <Box p={3} textAlign="center">
        <Typography color="textSecondary">Unsupported diff format</Typography>
      </Box>
    );
  };
  
  // Render JSON diff
  const renderJsonDiff = (diff) => {
    const { added, removed, modified } = diff;
    const hasChanges = added.length > 0 || removed.length > 0 || modified.length > 0;
    
    if (!hasChanges) {
      return (
        <Box p={3} textAlign="center">
          <Typography color="textSecondary">No changes detected</Typography>
        </Box>
      );
    }
    
    return (
      <Box p={2} sx={{ maxHeight: maxHeight - 150, overflow: 'auto' }}>
        {added.length > 0 && (
          <Box mb={3}>
            <Typography variant="h6" color="success.main" gutterBottom>
              Added ({added.length})
            </Typography>
            {added.map((item, index) => (
              <Box key={index} mb={1} p={1} border={1} borderColor="success.light" borderRadius={1}>
                <Typography variant="body2" fontWeight="bold">
                  {item.path}
                </Typography>
                <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(item.value, null, 2)}
                </pre>
              </Box>
            ))}
          </Box>
        )}
        
        {removed.length > 0 && (
          <Box mb={3}>
            <Typography variant="h6" color="error.main" gutterBottom>
              Removed ({removed.length})
            </Typography>
            {removed.map((item, index) => (
              <Box key={index} mb={1} p={1} border={1} borderColor="error.light" borderRadius={1}>
                <Typography variant="body2" fontWeight="bold">
                  {item.path}
                </Typography>
                <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(item.value, null, 2)}
                </pre>
              </Box>
            ))}
          </Box>
        )}
        
        {modified.length > 0 && (
          <Box>
            <Typography variant="h6" color="warning.main" gutterBottom>
              Modified ({modified.length})
            </Typography>
            {modified.map((item, index) => (
              <Box key={index} mb={1} p={1} border={1} borderColor="warning.light" borderRadius={1}>
                <Typography variant="body2" fontWeight="bold">
                  {item.path}
                </Typography>
                <Box display="flex" flexDirection="row" mt={1}>
                  <Box flexBasis="50%" pr={1}>
                    <Typography variant="caption" color="textSecondary">Old value:</Typography>
                    <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(item.oldValue, null, 2)}
                    </pre>
                  </Box>
                  <Divider orientation="vertical" flexItem />
                  <Box flexBasis="50%" pl={1}>
                    <Typography variant="caption" color="textSecondary">New value:</Typography>
                    <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(item.newValue, null, 2)}
                    </pre>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}
        
        {diff.truncated && (
          <Box mt={2} p={1} bgcolor="action.hover" borderRadius={1}>
            <Typography variant="body2" color="textSecondary">
              <InfoIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
              Showing {added.length + removed.length + modified.length} of {diff.totalChanges} changes.
            </Typography>
          </Box>
        )}
      </Box>
    );
  };
  
  // Render text diff
  const renderTextDiff = (diff) => {
    if (!diff.hunks || diff.hunks.length === 0) {
      return (
        <Box p={3} textAlign="center">
          <Typography color="textSecondary">No changes detected</Typography>
        </Box>
      );
    }
    
    return (
      <Box p={2} sx={{ maxHeight: maxHeight - 150, overflow: 'auto' }}>
        <pre style={{ 
          fontFamily: 'monospace', 
          fontSize: '0.9rem',
          lineHeight: 1.5,
          margin: 0
        }}>
          {diff.hunks.map((hunk, hunkIndex) => (
            <React.Fragment key={hunkIndex}>
              <div className="diff-hunk-header" style={{ 
                color: '#5D6975',
                backgroundColor: '#F0F4F8',
                padding: '4px 8px',
                borderRadius: '4px',
                marginBottom: '8px'
              }}>
                @@ -{hunk.startLineA},{hunk.endLineA - hunk.startLineA + 1} +{hunk.startLineB},{hunk.endLineB - hunk.startLineB + 1} @@
              </div>
              
              {hunk.changes.map((change, changeIndex) => {
                let style = {};
                let prefix = ' ';
                
                if (change.type === 'added') {
                  style = { backgroundColor: '#e6ffed', color: '#22863a' };
                  prefix = '+';
                } else if (change.type === 'removed') {
                  style = { backgroundColor: '#ffeef0', color: '#cb2431' };
                  prefix = '-';
                } else {
                  style = { color: '#24292e' };
                }
                
                const content = change.type === 'added' 
                  ? change.contentB 
                  : change.type === 'removed' 
                    ? change.contentA 
                    : change.content;
                
                return (
                  <div 
                    key={changeIndex} 
                    style={{ 
                      ...style,
                      padding: '0 8px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all'
                    }}
                  >
                    {prefix} {content || ''}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </pre>
        
        {diff.truncated && (
          <Box mt={2} p={1} bgcolor="action.hover" borderRadius={1}>
            <Typography variant="body2" color="textSecondary">
              <InfoIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
              Showing partial diff. Some changes are omitted.
            </Typography>
          </Box>
        )}
      </Box>
    );
  };
  
  // Render side by side panel
  const renderSideBySidePanel = () => {
    if (!comparison) {
      return (
        <Box p={3} textAlign="center">
          <Typography color="textSecondary">No content to display</Typography>
        </Box>
      );
    }
    
    return (
      <Box p={2} display="flex" sx={{ maxHeight: maxHeight - 150, overflow: 'hidden' }}>
        <Box flex={1} mr={1} overflow="auto" border={1} borderColor="divider" borderRadius={1} p={1}>
          <Typography variant="subtitle2" gutterBottom>
            {comparison.versionA.commitMessage || 'No message'} 
            <Typography component="span" variant="caption" color="textSecondary" sx={{ ml: 1 }}>
              ({new Date(comparison.versionA.createdAt).toLocaleString()})
            </Typography>
          </Typography>
          <pre style={{ 
            margin: 0, 
            fontSize: '0.9rem', 
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            overflow: 'auto'
          }}>
            {JSON.stringify(comparison.versionA.content, null, 2)}
          </pre>
        </Box>
        
        <Box flex={1} ml={1} overflow="auto" border={1} borderColor="divider" borderRadius={1} p={1}>
          <Typography variant="subtitle2" gutterBottom>
            {comparison.versionB.commitMessage || 'No message'} 
            <Typography component="span" variant="caption" color="textSecondary" sx={{ ml: 1 }}>
              ({new Date(comparison.versionB.createdAt).toLocaleString()})
            </Typography>
          </Typography>
          <pre style={{ 
            margin: 0, 
            fontSize: '0.9rem', 
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            overflow: 'auto'
          }}>
            {JSON.stringify(comparison.versionB.content, null, 2)}
          </pre>
        </Box>
      </Box>
    );
  };
  
  // Render version info panel
  const renderVersionInfoPanel = () => {
    if (!comparison) {
      return (
        <Box p={3} textAlign="center">
          <Typography color="textSecondary">No version information available</Typography>
        </Box>
      );
    }
    
    const { versionA, versionB, summary } = comparison;
    
    return (
      <Box p={2} sx={{ maxHeight: maxHeight - 150, overflow: 'auto' }}>
        <Box display="flex" mb={3}>
          <Box flex={1} mr={1} p={2} border={1} borderColor="divider" borderRadius={1}>
            <Typography variant="h6" gutterBottom>Version A</Typography>
            <Typography variant="body2"><strong>ID:</strong> {versionA.id}</Typography>
            <Typography variant="body2"><strong>Created:</strong> {new Date(versionA.createdAt).toLocaleString()}</Typography>
            <Typography variant="body2"><strong>By:</strong> {versionA.createdBy || 'Unknown'}</Typography>
            <Typography variant="body2"><strong>Message:</strong> {versionA.commitMessage || 'No message'}</Typography>
          </Box>
          
          <Box flex={1} ml={1} p={2} border={1} borderColor="divider" borderRadius={1}>
            <Typography variant="h6" gutterBottom>Version B</Typography>
            <Typography variant="body2"><strong>ID:</strong> {versionB.id}</Typography>
            <Typography variant="body2"><strong>Created:</strong> {new Date(versionB.createdAt).toLocaleString()}</Typography>
            <Typography variant="body2"><strong>By:</strong> {versionB.createdBy || 'Unknown'}</Typography>
            <Typography variant="body2"><strong>Message:</strong> {versionB.commitMessage || 'No message'}</Typography>
          </Box>
        </Box>
        
        <Box p={2} border={1} borderColor="divider" borderRadius={1}>
          <Typography variant="h6" gutterBottom>Changes Summary</Typography>
          <Box display="flex" alignItems="center" flexWrap="wrap">
            <Box px={2} py={1} mr={2} mb={1} bgcolor="success.light" borderRadius={1}>
              <Typography variant="h6">{summary.addedCount}</Typography>
              <Typography variant="body2">Added</Typography>
            </Box>
            <Box px={2} py={1} mr={2} mb={1} bgcolor="error.light" borderRadius={1}>
              <Typography variant="h6">{summary.removedCount}</Typography>
              <Typography variant="body2">Removed</Typography>
            </Box>
            <Box px={2} py={1} mr={2} mb={1} bgcolor="warning.light" borderRadius={1}>
              <Typography variant="h6">{summary.modifiedCount}</Typography>
              <Typography variant="body2">Modified</Typography>
            </Box>
            <Box px={2} py={1} mb={1} bgcolor="info.light" borderRadius={1}>
              <Typography variant="h6">{summary.totalChanges}</Typography>
              <Typography variant="body2">Total Changes</Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  };
  
  // Render active tab content
  const renderTabContent = () => {
    if (activeTab === 0) {
      return renderChangesPanel();
    } else if (activeTab === 1) {
      return renderSideBySidePanel();
    } else {
      return renderVersionInfoPanel();
    }
  };
  
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        width: '100%', 
        maxWidth, 
        maxHeight, 
        display: 'flex', 
        flexDirection: 'column'
      }}
    >
      <Box p={2} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">
          Version Comparison
        </Typography>
        <Box>
          <Tooltip title="Copy to clipboard">
            <IconButton onClick={handleCopyToClipboard} size="small">
              <ContentCopyIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download">
            <IconButton 
              size="small"
              onClick={() => {
                // Simple download implementation
                const element = document.createElement('a');
                const text = activeTab === 0 
                  ? JSON.stringify(comparison?.diff || {}, null, 2)
                  : activeTab === 1
                    ? JSON.stringify({
                        versionA: comparison?.versionA?.content,
                        versionB: comparison?.versionB?.content
                      }, null, 2)
                    : generateVersionInfo();
                
                element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
                element.setAttribute('download', `version-diff-${new Date().toISOString()}.txt`);
                element.style.display = 'none';
                document.body.appendChild(element);
                element.click();
                document.body.removeChild(element);
              }}
            >
              <FileDownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton 
              size="small"
              onClick={handleOptionsMenuOpen}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>
      
      <Menu
        anchorEl={optionsMenu}
        open={Boolean(optionsMenu)}
        onClose={handleOptionsMenuClose}
      >
        <MenuItem disabled>
          <Typography variant="body2" fontWeight="bold">Diff Format</Typography>
        </MenuItem>
        <MenuItem 
          onClick={() => handleOptionChange('format', 'json')}
          selected={diffOptions.format === 'json'}
        >
          JSON
        </MenuItem>
        <MenuItem 
          onClick={() => handleOptionChange('format', 'text')}
          selected={diffOptions.format === 'text'}
        >
          Text
        </MenuItem>
        <MenuItem 
          onClick={() => handleOptionChange('format', 'html')}
          selected={diffOptions.format === 'html'}
        >
          HTML
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => handleOptionChange('ignoreWhitespace', !diffOptions.ignoreWhitespace)}
        >
          <Box display="flex" alignItems="center">
            <Box 
              mr={1} 
              width={18} 
              height={18} 
              border={1}
              borderColor="primary.main"
              borderRadius={0.5}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              {diffOptions.ignoreWhitespace && (
                <Box 
                  width={14} 
                  height={14} 
                  bgcolor="primary.main" 
                  borderRadius={0.25} 
                />
              )}
            </Box>
            Ignore Whitespace
          </Box>
        </MenuItem>
        <MenuItem disabled>
          <Typography variant="body2" fontWeight="bold">Context Lines</Typography>
        </MenuItem>
        {[1, 3, 5, 10].map(value => (
          <MenuItem 
            key={value}
            onClick={() => handleOptionChange('contextLines', value)}
            selected={diffOptions.contextLines === value}
          >
            {value} {value === 1 ? 'line' : 'lines'}
          </MenuItem>
        ))}
      </Menu>
      
      <Divider />
      
      <Box>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="diff viewer tabs">
          {tabs.map(tab => (
            <Tab key={tab.id} label={tab.label} id={`tab-${tab.id}`} />
          ))}
        </Tabs>
      </Box>
      
      <Divider />
      
      {loading ? (
        <Box p={4} display="flex" justifyContent="center" alignItems="center" flexGrow={1}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box p={3} display="flex" justifyContent="center" alignItems="center" flexGrow={1}>
          <Typography color="error">{error}</Typography>
        </Box>
      ) : (
        <Box flexGrow={1} display="flex" flexDirection="column">
          {renderTabContent()}
        </Box>
      )}
    </Paper>
  );
};

export default DiffViewer;

