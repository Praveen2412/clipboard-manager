import { useState, useEffect, useCallback, useRef } from 'react';
import { copyTextToClipboard } from '../utils/clipboardUtils';

/**
 * Custom hook for managing clipboard data and operations
 * @param {string} initialTab - Initial active tab
 * @param {string} initialQuery - Initial search query
 * @returns {Object} - Clipboard data and operations
 */
const useClipboardData = (initialTab = 'all', initialQuery = '') => {
  // State for clipboard data
  const [clipboardData, setClipboardData] = useState({
    items: [],
    favorites: []
  });
  
  // State for loading status and errors
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for search functionality
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [filteredItems, setFilteredItems] = useState([]);
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // State for multiselect
  const [selectedItems, setSelectedItems] = useState([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  
  // Reference to track if component is mounted
  const isMountedRef = useRef(true);
  
  // Reference for debounce timeout
  const debounceTimeout = useRef(null);
  
  /**
   * Load clipboard data from background script
   */
  const loadData = useCallback(async (showLoading = true) => {
    try {
      // Only set loading state for initial data fetch or when explicitly requested
      if (showLoading && clipboardData.items.length === 0) {
        setLoading(true);
      }
      setError(null);
      
      console.log('Requesting clipboard data from background script...');
      
      // Request data from background script
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getClipboardData' }, (result) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError });
          } else {
            resolve(result);
          }
        });
      });
      
      // Check for errors
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Update state if component is still mounted
      if (isMountedRef.current) {
        // Always update the state to ensure fresh data
        console.log(`Received ${response.items?.length || 0} clipboard items from background`);
        
        // Update state regardless of comparison to ensure reactivity
        setClipboardData(response);
        
        // Update filtered items based on the new data
        filterItems(response.items, activeTab, searchQuery);
        
        if (showLoading) {
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('Error loading clipboard data:', err);
      
      // Update error state if component is still mounted
      if (isMountedRef.current) {
        setError('Failed to load clipboard data');
        setFilteredItems([]); // Ensure we don't show old data on error
        if (showLoading) {
          setLoading(false);
        }
      }
    }
  }, [activeTab, searchQuery, filterItems]);
  
  /**
   * Filter items based on active tab and search query
   * @param {Array} items - Items to filter
   * @param {string} tab - Active tab
   * @param {string} query - Search query
   */
  const filterItems = useCallback((items, tab, query) => {
    if (!items || !Array.isArray(items)) {
      setFilteredItems([]);
      return;
    }
    
    let filtered = [];
    
    // Apply tab filter
    if (tab === 'all') {
      filtered = items;
    } else if (tab === 'favorites') {
      filtered = items.filter(item => item.isFavorite);
    } else if (tab === 'text') {
      filtered = items.filter(item => item.type === 'text');
    } else if (tab === 'url') {
      filtered = items.filter(item => item.type === 'url');
    } else if (tab === 'code') {
      filtered = items.filter(item => item.type === 'code');
    } else if (tab === 'image') {
      filtered = items.filter(item => item.type === 'image');
    } else {
      // Default to all items if invalid tab
      filtered = items;
    }
    
    // Apply search filter if there's a query
    if (query && query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(item => {
        if (item.type === 'image') {
          // For images, we can't text search, so keep them if search is focusing on images
          return lowerQuery.includes('image') || lowerQuery.includes('picture') || 
                 lowerQuery.includes('photo');
        } else {
          // For text-based items, search in content
          return item.content.toLowerCase().includes(lowerQuery);
        }
      });
    }
    
    setFilteredItems(filtered);
  }, []);
  
  // Effect to apply filtering when tab or search query changes
  useEffect(() => {
    if (clipboardData && clipboardData.items) {
      // Important: Set loading to false even when just filtering
      setLoading(false);
      filterItems(clipboardData.items, activeTab, searchQuery);
    }
  }, [activeTab, searchQuery, filterItems, clipboardData]);
  
  /**
   * Copy item to clipboard
   * @param {string} itemId - Item ID to copy
   */
  const copyToClipboard = useCallback(async (itemId) => {
    try {
      const item = clipboardData.items.find((item) => item.id === itemId);
      
      if (!item) {
        throw new Error('Item not found');
      }
      
      // Copy content to clipboard with the appropriate content type
      const success = await copyTextToClipboard(item.content, item.type);
      
      if (success) {
        // Show a notification to the user
        chrome.runtime.sendMessage({ 
          action: 'showNotification',
          notification: {
            type: 'success',
            message: `Copied to clipboard: ${item.type === 'image' ? 'Image' : item.content.substring(0, 30) + (item.content.length > 30 ? '...' : '')}`
          }
        });
        
        // Move this item to the top of the list
        chrome.runtime.sendMessage({ 
          action: 'moveItemToTop', 
          itemId 
        }, () => {
          // Reload data to reflect the change in order
          loadData();
        });
      } else {
        // Show error notification
        chrome.runtime.sendMessage({ 
          action: 'showNotification',
          notification: {
            type: 'error',
            message: 'Failed to copy to clipboard'
          }
        });
      }
      
      return success;
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      
      // Show error notification
      chrome.runtime.sendMessage({ 
        action: 'showNotification',
        notification: {
          type: 'error',
          message: 'Error copying to clipboard'
        }
      });
      
      return false;
    }
  }, [clipboardData.items, loadData]);
  
  /**
   * Toggle favorite status for an item
   * @param {string} itemId - Item ID to toggle
   */
  const toggleFavorite = useCallback(async (itemId) => {
    try {
      // Find the item and get its current favorite status
      const item = clipboardData.items.find(item => item.id === itemId);
      
      if (!item) {
        throw new Error('Item not found');
      }
      
      const newFavoriteStatus = !item.isFavorite;
      
      // Optimistically update UI
      setClipboardData(prevData => {
        const updatedItems = prevData.items.map(item => {
          if (item.id === itemId) {
            return { ...item, isFavorite: newFavoriteStatus };
          }
          return item;
        });
        
        return {
          ...prevData,
          items: updatedItems
        };
      });
      
      // Send toggle request to background script
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'toggleFavorite', itemId }, (result) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError });
          } else {
            resolve(result);
          }
        });
      });
      
      // Check for errors
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Show success notification
      chrome.runtime.sendMessage({ 
        action: 'showNotification',
        notification: {
          type: 'success',
          message: newFavoriteStatus ? 'Added to favorites' : 'Removed from favorites'
        }
      });
      
      // Reload data to ensure we're in sync
      await loadData();
      return true;
    } catch (err) {
      console.error('Error toggling favorite:', err);
      
      // Show error notification
      chrome.runtime.sendMessage({ 
        action: 'showNotification',
        notification: {
          type: 'error',
          message: 'Error updating favorite status'
        }
      });
      
      // Reload data to revert optimistic update
      await loadData();
      return false;
    }
  }, [clipboardData.items, loadData]);
  
  /**
   * Delete an item from clipboard history
   * @param {string} itemId - Item ID to delete
   */
  const deleteItem = useCallback(async (itemId) => {
    try {
      // Find the item to get its info for notification
      const item = clipboardData.items.find(item => item.id === itemId);
      
      if (!item) {
        throw new Error('Item not found');
      }
      
      // Optimistically update UI
      setClipboardData(prevData => {
        const updatedItems = prevData.items.filter(item => item.id !== itemId);
        
        return {
          ...prevData,
          items: updatedItems
        };
      });
      
      // Send delete request to background script
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'deleteItem', itemId }, (result) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError });
          } else {
            resolve(result);
          }
        });
      });
      
      // Check for errors
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Show success notification
      chrome.runtime.sendMessage({ 
        action: 'showNotification',
        notification: {
          type: 'success',
          message: `Deleted ${item.type === 'image' ? 'image' : 'item'}`
        }
      });
      
      // Reload data to ensure we're in sync with server state
      await loadData();
      return true;
    } catch (err) {
      console.error('Error deleting item:', err);
      
      // Show error notification
      chrome.runtime.sendMessage({ 
        action: 'showNotification',
        notification: {
          type: 'error',
          message: 'Error deleting item'
        }
      });
      
      // Reload data to revert optimistic update
      await loadData();
      return false;
    }
  }, [clipboardData.items, loadData]);
  
  /**
   * Add a new item to clipboard history
   * @param {string} content - Item content
   * @param {string} type - Item type
   * @param {boolean} isFavorite - Favorite status
   */
  const addItem = useCallback(async (content, type, isFavorite = false) => {
    try {
      if (!content) {
        throw new Error('Content is required');
      }
      
      // Create item object
      const newItem = {
        id: `temp-${Date.now()}`, // Temporary ID until we get the real one from the background
        content,
        type: type || 'text',
        isFavorite: !!isFavorite,
        timestamp: Date.now(),
        charCount: content.length
      };
      
      // Optimistically update UI
      setClipboardData(prevData => {
        return {
          ...prevData,
          items: [newItem, ...prevData.items]
        };
      });
      
      // Send add request to background script
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
          action: 'addNewItem', 
          item: {
            content,
            type: type || 'text',
            isFavorite: !!isFavorite
          }
        }, (result) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError });
          } else {
            resolve(result);
          }
        });
      });
      
      // Check for errors
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Show success notification
      chrome.runtime.sendMessage({ 
        action: 'showNotification',
        notification: {
          type: 'success',
          message: 'Item added successfully'
        }
      });
      
      // Reload data to get the properly saved item
      await loadData();
      return true;
    } catch (err) {
      console.error('Error adding item:', err);
      
      // Show error notification
      chrome.runtime.sendMessage({ 
        action: 'showNotification',
        notification: {
          type: 'error',
          message: 'Error adding item'
        }
      });
      
      // Reload data to revert optimistic update
      await loadData();
      return false;
    }
  }, [loadData]);
  
  /**
   * Clear all clipboard history
   */
  const clearAll = useCallback(async () => {
    try {
      // Confirm before clearing
      if (!window.confirm('Are you sure you want to clear all clipboard history?')) {
        return false;
      }
      
      // Send clear request to background script
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'clearAll' }, (result) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError });
          } else {
            resolve(result);
          }
        });
      });
      
      // Check for errors
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Reload data to get updated state
      await loadData();
      return true;
    } catch (err) {
      console.error('Error clearing clipboard history:', err);
      return false;
    }
  }, [loadData]);
  
  /**
   * Handle tab change
   * @param {string} tab - New active tab
   */
  const handleTabChange = useCallback((tab) => {
    // Don't set loading state when changing tabs
    setActiveTab(tab);
    if (clipboardData && clipboardData.items) {
      // Explicitly ensure loading is false
      setLoading(false);
      filterItems(clipboardData.items, tab, searchQuery);
    }
  }, [clipboardData, filterItems, searchQuery]);
  
  /**
   * Handle search query change
   * @param {string} query - New search query
   */
  const handleSearchQueryChange = useCallback((query) => {
    // Don't set loading state when searching
    setSearchQuery(query);
    if (clipboardData && clipboardData.items) {
      // Explicitly ensure loading is false
      setLoading(false);
      filterItems(clipboardData.items, activeTab, query);
    }
  }, [clipboardData, filterItems, activeTab]);
  
  /**
   * Toggle selection of an item
   * @param {string} itemId - Item ID to toggle selection
   */
  const toggleItemSelection = useCallback((itemId) => {
    setSelectedItems(current => {
      if (current.includes(itemId)) {
        return current.filter(id => id !== itemId);
      } else {
        return [...current, itemId];
      }
    });
  }, []);
  
  /**
   * Select all visible items
   */
  const selectAllItems = useCallback(() => {
    setSelectedItems(filteredItems.map(item => item.id));
  }, [filteredItems]);
  
  /**
   * Clear all selections
   */
  const clearSelection = useCallback(() => {
    setSelectedItems([]);
  }, []);
  
  /**
   * Toggle multiselect mode
   */
  const toggleMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(current => {
      if (!current) {
        return true;
      } else {
        // Clear selections when exiting multiselect mode
        setSelectedItems([]);
        return false;
      }
    });
  }, []);
  
  /**
   * Delete selected items
   */
  const deleteSelectedItems = useCallback(async () => {
    try {
      if (selectedItems.length === 0) {
        return false;
      }
      
      // Optimistically update UI
      const updatedItems = clipboardData.items.filter(
        item => !selectedItems.includes(item.id)
      );
      
      setClipboardData(prev => ({
        ...prev,
        items: updatedItems
      }));
      
      // Clear selection
      setSelectedItems([]);
      
      // Send delete request to background script
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
          action: 'deleteMultipleItems', 
          itemIds: selectedItems 
        }, (result) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError });
          } else {
            resolve(result);
          }
        });
      });
      
      // Check for errors
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Reload data to ensure we're in sync
      await loadData();
      
      // Show success notification
      chrome.runtime.sendMessage({ 
        action: 'showNotification',
        notification: {
          type: 'success',
          message: `Deleted ${selectedItems.length} items`
        }
      });
      
      return true;
    } catch (err) {
      console.error('Error deleting selected items:', err);
      
      // Show error notification
      chrome.runtime.sendMessage({ 
        action: 'showNotification',
        notification: {
          type: 'error',
          message: 'Error deleting selected items'
        }
      });
      
      // Reload data to revert optimistic update
      await loadData();
      return false;
    }
  }, [selectedItems, clipboardData.items, loadData]);
  
  // Load data on initial mount
  useEffect(() => {
    loadData();
    
    // Set up message listener for clipboard data updates
    const messageListener = (message) => {
      if (message.action === 'clipboardDataUpdated') {
        loadData();
      }
    };
    
    chrome.runtime.onMessage.addListener(messageListener);
    
    // Set up polling for floating and PiP windows for smoother updates
    let pollInterval = null;
    
    // Check if we're in a floating or PiP window
    const isFloatingOrPip = document.body.classList.contains('floating-window') || 
                            document.body.classList.contains('pip-window');
    
    if (isFloatingOrPip) {
      // Poll more frequently in floating/PiP windows for responsive updates
      pollInterval = setInterval(() => {
        loadData();
      }, 1000); // Poll every second for floating/PiP windows
    }
    
    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      chrome.runtime.onMessage.removeListener(messageListener);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [loadData]);
  
  // Auto-refresh effect - update clipboard data every 3 seconds
  useEffect(() => {
    console.log('Setting up clipboard auto-refresh and message listeners');
    let refreshCount = 0;
    
    // Load data initially
    loadData();
    
    // Set up automatic refresh interval - checking more frequently now
    const refreshInterval = setInterval(() => {
      refreshCount++;
      // Use silent refresh (don't show loading indicators)
      loadData(false);
      
      // Log every 5 refreshes to reduce console noise but still show activity
      if (refreshCount % 5 === 0) {
        console.log(`Auto-refresh cycle #${refreshCount} completed`);
      }
    }, 2000); // Reduced to 2 seconds for more responsive updates
    
    // Listen for clipboard update messages from background script
    const handleMessage = (message, sender, sendResponse) => {
      // Log all incoming messages for debugging
      if (message && message.action) {
        console.log(`Message received in hook: ${message.action}`, { timestamp: new Date().toISOString() });
      }
      
      // Handle all clipboard update message types
      if (message && (
          message.action === 'clipboardUpdated' || 
          message.action === 'clipboardDataUpdated' || 
          message.action === 'refreshClipboardData' || 
          message.action === 'forceRefreshData')) {
        
        console.log(`Clipboard update message received: ${message.action}`, { timestamp: new Date().toISOString() });
        
        // Respond immediately so the sender knows we're here
        if (sendResponse) {
          sendResponse({ 
            received: true, 
            action: message.action, 
            timestamp: Date.now() 
          });
        }
        
        // Refresh data silently
        console.log('Triggering data refresh from message');
        loadData(false);
        return true; // Keep the message channel open for async response
      }
      
      // Handle full clipboard data message (more efficient direct data update)
      if (message && message.action === 'fullClipboardData' && message.data) {
        console.log('Received full clipboard data message with actual data');
        
        // Update state with the data included in the message
        setClipboardData(message.data);
        filterItems(message.data.items, activeTab, searchQuery);
        
        // Acknowledge receipt
        if (sendResponse) {
          sendResponse({ 
            received: true, 
            action: 'fullClipboardData',
            itemCount: message.data.items.length,
            timestamp: Date.now() 
          });
        }
        
        return true;
      }
      
      // Handle diagnostic message
      if (message && message.action === 'clipboardManagerDiagnostic') {
        console.log('Received diagnostic message from background script');
        if (sendResponse) {
          sendResponse({ 
            received: true, 
            component: 'useClipboardData hook',
            itemCount: clipboardData.items.length,
            activeTab: activeTab,
            hasFilters: searchQuery.length > 0
          });
        }
        return true;
      }
      
      return false; // We didn't handle this message
    };
    
    // Add the message listener
    chrome.runtime.onMessage.addListener(handleMessage);
    console.log('Message listener registered for clipboard updates');
    
    // Clean up the interval and message listener on unmount
    return () => {
      console.log('Cleaning up clipboard auto-refresh and message listeners');
      clearInterval(refreshInterval);
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [loadData]);
  
  // Return hook data and functions
  return {
    // Data
    clipboardItems: filteredItems,
    allItems: clipboardData.items,
    isLoading: loading,
    error,
    filteredItems,
    // Actions
    copyToClipboard,
    copyItem: copyToClipboard,
    toggleFavorite,
    deleteItem,
    addItem,
    clearAll,
    loadData,
    handleSearchQueryChange,
    handleTabChange,
    // Multiselect functionality
    selectedItems,
    isMultiSelectMode,
    toggleItemSelection,
    selectAllItems,
    clearSelection,
    toggleMultiSelectMode,
    deleteSelectedItems
  };
};

export default useClipboardData; 