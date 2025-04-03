import React, { useState, useEffect } from 'react';
import { Box, Typography, List, ListItem, ListItemText, ListItemIcon, Button, 
  Paper, Divider, Chip, Tooltip, CircularProgress, IconButton, Dialog, 
  DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import LabelIcon from '@mui/icons-material/Label';
import HistoryIcon from '@mui/icons-material/History';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import { formatDistanceToNow } from 'date-fns';

import registry from '../../ModuleRegistry';
import EventBus from '../../utils/EventBus';

/**
 * Component that displays version history for a content item
 * and allows reverting, comparing, and tagging versions
 */
const VersionHistory = ({ 
  contentType,
  contentId,
  onClose,
  onCompare,
  maxHeight = 600
}) => {
  // References to services
  const versionManager = registry.getModule('versioning.VersionManager');
  
  // State
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedVersions, setSelectedVersions] = useState([]);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [selectedVersionForTag, setSelectedVersionForTag] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByTag, setFilterByTag] = useState('');
  const [allTags, setAllTags] = useState([]);
  
  // Load version history
  useEffect(() => {
    const loadVersions = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await versionManager.getVersionHistory(contentType, contentId, {
          page: currentPage,
          limit: 10,
          forceRefresh: true
        });
        
        setVersions(result.versions || []);
        setTotalPages(result.totalPages || 1);
      } catch (err) {
        console.error('Failed to load version history:', err);
        setError('Failed to load version history. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadVersions();
  }, [contentType, contentId, currentPage, versionManager]);
  
  // Load all tags
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await versionManager.getTags();
        setAllTags(tags || []);
      } catch (err) {
        console.error('Failed to load tags:', err);
      }
    };
    
    loadTags();
  }, [versionManager]);
  
  // Filter versions by search query and tag
  const filteredVersions = versions.filter(version => {
    const matchesSearch = !searchQuery || 
      (version.commitMessage && version.commitMessage.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (version.createdBy && version.createdBy.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesTag = !filterByTag || 
      (version.tags && version.tags.includes(filterByTag));
      
    return matchesSearch && matchesTag;
  });
  
  // Handle version selection for comparison
  const handleVersionSelect = (version) => {
    if (selectedVersions.some(v => v.id === version.id)) {
      setSelectedVersions(selectedVersions.filter(v => v.id !== version.id));
    } else if (selectedVersions.length < 2) {
      setSelectedVersions([...selectedVersions, version]);
    }
  };
  
  // Handle revert to version
  const handleRevert = async (version) => {
    if (!window.confirm(`Are you sure you want to revert to version from ${formatDate(version.createdAt)}?`)) {
      return;
    }
    
    setLoading(true);
    
    try {
      await versionManager.revertToVersion(version.id, 'Reverted via version history UI');
      
      // Reload versions
      const result = await versionManager.getVersionHistory(contentType, contentId, {
        page: 1,
        limit: 10,
        forceRefresh: true
      });
      
      setVersions(result.versions || []);
      setCurrentPage(1);
      
      // Notify success
      EventBus.publish('notification:show', {
        type: 'success',
        message: 'Successfully reverted to previous version'
      });
    } catch (err) {
      console.error('Failed to revert:', err);
      
      // Notify error
      EventBus.publish('notification:show', {
        type: 'error',
        message: 'Failed to revert to previous version'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle compare
  const handleCompare = () => {
    if (selectedVersions.length !== 2) return;
    
    if (onCompare) {
      onCompare(selectedVersions[0], selectedVersions[1]);
    }
  };
  
  // Open tag dialog
  const handleTagDialogOpen = (version) => {
    setSelectedVersionForTag(version);
    setTagDialogOpen(true);
  };
  
  // Add tag to version
  const handleAddTag = async () => {
    if (!newTag || !selectedVersionForTag) return;
    
    try {
      await versionManager.tagVersion(selectedVersionForTag.id, newTag);
      
      // Reload versions
      const result = await versionManager.getVersionHistory(contentType, contentId, {
        page: currentPage,
        limit: 10,
        forceRefresh: true
      });
      
      setVersions(result.versions || []);
      
      // Reload tags
      const tags = await versionManager.getTags(true);
      setAllTags(tags || []);
      
      // Notify success
      EventBus.publish('notification:show', {
        type: 'success',
        message: `Added tag "${newTag}" to version`
      });
    } catch (err) {
      console.error('Failed to add tag:', err);
      
      // Notify error
      EventBus.publish('notification:show', {
        type: 'error',
        message: 'Failed to add tag to version'
      });
    } finally {
      setTagDialogOpen(false);
      setNewTag('');
      setSelectedVersionForTag(null);
    }
  };
  
  // Remove tag from version
  const handleRemoveTag = async (version, tag) => {
    try {
      await versionManager.removeVersionTag(version.id, tag);
      
      // Reload versions
      const result = await versionManager.getVersionHistory(contentType, contentId, {
        page: currentPage,
        limit: 10,
        forceRefresh: true
      });
      
      setVersions(result.versions || []);
      
      // Notify success
      EventBus.publish('notification:show', {
        type: 'success',
        message: `Removed tag "${tag}" from version`
      });
    } catch (err) {
      console.error('Failed to remove tag:', err);
      
      // Notify error
      EventBus.publish('notification:show', {
        type: 'error',
        message: 'Failed to remove tag from version'
      });
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  };
  
  return (
    <Paper elevation={3} sx={{ width: '100%', maxWidth: 800, maxHeight }}>
      <Box p={2} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">
          <HistoryIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Version History
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>
      
      <Divider />
      
      <Box p={2} display="flex" justifyContent="space-between" alignItems="center">
        <TextField
          size="small"
          placeholder="Search versions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />
          }}
          sx={{ width: 300 }}
        />
        
        <Box>
          <Tooltip title="Filter by tag">
            <IconButton 
              size="small" 
              color={filterByTag ? "primary" : "default"}
              onClick={() => {
                // Show tag selection
                if (filterByTag) {
                  setFilterByTag('');
                } else {
                  // Simple implementation - in a real app, you might show a dropdown
                  const tag = window.prompt('Enter tag to filter by:', '');
                  if (tag) setFilterByTag(tag);
                }
              }}
            >
              <FilterListIcon />
            </IconButton>
          </Tooltip>
          
          {filterByTag && (
            <Chip 
              label={filterByTag} 
              size="small" 
              onDelete={() => setFilterByTag('')}
              sx={{ ml: 1 }}
            />
          )}
        </Box>
      </Box>
      
      {loading && (
        <Box p={4} display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      )}
      
      {error && (
        <Box p={3}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}
      
      {!loading && !error && filteredVersions.length === 0 && (
        <Box p={3}>
          <Typography color="textSecondary">No versions found.</Typography>
        </Box>
      )}
      
      {!loading && !error && filteredVersions.length > 0 && (
        <>
          <List sx={{ overflow: 'auto', maxHeight: 400 }}>
            {filteredVersions.map((version, index) => (
              <ListItem 
                key={version.id}
                divider={index < filteredVersions.length - 1}
                selected={selectedVersions.some(v => v.id === version.id)}
                onClick={() => handleVersionSelect(version)}
                sx={{ 
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  '&:hover': { bgcolor: 'action.hover' },
                  bgcolor: index === 0 ? 'action.selected' : 'inherit'
                }}
              >
                <ListItemIcon>
                  <Tooltip title={index === 0 ? "Current Version" : "Previous Version"}>
                    <HistoryIcon color={index === 0 ? "primary" : "action"} />
                  </Tooltip>
                </ListItemIcon>
                
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center">
                      <Typography variant="body1" mr={1}>
                        {version.commitMessage || 'No message'}
                      </Typography>
                      {index === 0 && (
                        <Chip size="small" label="Current" color="primary" />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Box display="flex" alignItems="center" mb={0.5}>
                        <PersonIcon fontSize="small" sx={{ mr: 0.5, opacity: 0.6 }} />
                        <Typography variant="body2" color="textSecondary">
                          {version.createdBy || 'Unknown user'}
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ ml: 2 }}>
                          {formatDate(version.createdAt)}
                        </Typography>
                      </Box>
                      
                      {version.tags && version.tags.length > 0 && (
                        <Box display="flex" flexWrap="wrap" gap={0.5}>
                          {version.tags.map(tag => (
                            <Chip
                              key={tag}
                              size="small"
                              label={tag}
                              icon={<LabelIcon />}
                              onDelete={(e) => {
                                e.stopPropagation();
                                handleRemoveTag(version, tag);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                  }
                />
                
                <Box>
                  <Tooltip title="Revert to this version">
                    <IconButton 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRevert(version);
                      }}
                      disabled={index === 0}
                      size="small"
                    >
                      <RestoreIcon />
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title="Add tag">
                    <IconButton 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTagDialogOpen(version);
                      }}
                      size="small"
                    >
                      <AddIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </ListItem>
            ))}
          </List>
          
          <Box p={2} display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <Button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              >
                Next
              </Button>
            </Box>
            
            <Button
              variant="contained"
              color="primary"
              startIcon={<CompareArrowsIcon />}
              disabled={selectedVersions.length !== 2}
              onClick={handleCompare}
            >
              Compare Selected
            </Button>
          </Box>
        </>
      )}
      
      {/* Tag Dialog */}
      <Dialog open={tagDialogOpen} onClose={() => setTagDialogOpen(false)}>
        <DialogTitle>Add Tag</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Tag Name"
            fullWidth
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            helperText="Add a descriptive tag to help identify this version"
          />
          
          {allTags.length > 0 && (
            <Box mt={2}>
              <Typography variant="body2" gutterBottom>Existing tags:</Typography>
              <Box display="flex" flexWrap="wrap" gap={0.5}>
                {allTags.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    onClick={() => setNewTag(tag)}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTagDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddTag} color="primary" disabled={!newTag}>
            Add Tag
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default VersionHistory;

