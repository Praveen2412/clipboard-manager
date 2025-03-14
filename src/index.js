import React, { useState, useEffect, useContext, useCallback } from 'react';
import ReactDOM from 'react-dom';
import TabBar from './components/TabBar';
import ClipboardList from './components/ClipboardList';
import AddItemModal from './components/AddItemModal';
import Settings from './components/Settings';
import useClipboardData from './hooks/useClipboardData';
import SettingsProvider, { SettingsContext } from './contexts/SettingsContext';

/**
 * Notification component for displaying messages
 * @param {Object} props - Component props
 * @param {Object} props.notification - Notification object
 * @param {Function} props.onClose - Close handler
 * @returns {JSX.Element} Notification component
 */
const NotificationToast = ({ notification, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onClose) {
        onClose();
      }
    }, 3000);
    
    return () => {
      clearTimeout(timer);
    };
  }, [onClose]);
  
  if (!notification) return null;
  
  return (
    <div className={`notification ${notification.type || 'info'}`}>
      {notification.message}
    </div>
  );
};

/**
 * Determine the type of content (text, url, code, image)
 * @param {string} content - Content to analyze
 * @returns {string} - Content type
 */
const determineContentType = (content) => {
  // Check if it's an image
  if (content.startsWith('data:image/')) {
    return 'image';
  }
  
  // Check if it's a URL
  if (content.match(/^(https?:\/\/|www\.)[^\s]+$/i)) {
    return 'url';
  }
  
  // Check if it looks like code (contains common programming patterns)
  if (content.match(/function\s*\(/i) || 
      content.match(/class\s+\w+/i) || 
      content.match(/if\s*\(/i) || 
      content.match(/for\s*\(/i) || 
      content.match(/<\/[a-z0-9]+>/i) || 
      content.match(/console\.log/i) || 
      content.match(/import\s+.*from/i) || 
      content.match(/^\s*{\s*[\"\'][a-z0-9]+[\"\']:/im)) {
    return 'code';
  }
  
  // Default to text
  return 'text';
};

/**
 * Main App component for popup
 * @returns {JSX.Element} App component
 */
const App = () => {
  // State
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  
  // Get settings from context
  const { settings } = useContext(SettingsContext);
  
  // Use custom hook for clipboard data management
  const {
    clipboardItems,
    isLoading,
    copyItem,
    deleteItem,
    toggleFavorite,
    addItem,
    filteredItems,
    handleTabChange: updateTab,
    handleSearchQueryChange: updateSearch,
    loadData,
    // Multiselect functionality
    selectedItems,
    isMultiSelectMode,
    toggleItemSelection,
    selectAllItems,
    clearSelection,
    toggleMultiSelectMode,
    deleteSelectedItems
  } = useClipboardData(activeTab, searchQuery);

  // Event handlers
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    updateTab(tabId);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    updateSearch(query);
  };

  const handleOpenFloatingWindow = () => {
    console.log('Opening floating window...');
    try {
      // Send message to open a new floating window
      chrome.runtime.sendMessage({ action: 'openFloatingWindow' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error opening floating window:', chrome.runtime.lastError);
          setNotification({
            type: 'error',
            message: 'Failed to open floating window'
          });
        } else if (response && response.error) {
          console.error('Error opening floating window:', response.error);
          setNotification({
            type: 'error',
            message: 'Failed to open floating window'
          });
        } else {
          console.log('Floating window opened successfully');
        }
      });
    } catch (error) {
      console.error('Exception opening floating window:', error);
    }
  };

  const handleCloseWindow = () => {
    window.close();
  };

  // Check if we're in floating window mode
  const isFloatingWindow = document.body.classList.contains('floating-window');

  const handleAddItem = useCallback((content, type = null) => {
    if (!content) return;

    // Determine content type if not provided
    const contentType = type || determineContentType(content);
    
    chrome.runtime.sendMessage({ 
      action: 'addClipboardItem', 
      content,
      type: contentType
    }, () => {
      loadData();
      setNotification({
        type: 'success',
        message: 'Item added to clipboard history'
      });
    });
  }, [loadData]);
  
  const handleCloseNotification = () => {
    setNotification(null);
  };
  
  // Listen for notification messages from background script
  useEffect(() => {
    const handleMessage = (message) => {
      if (message.action === 'showNotification' && message.notification) {
        setNotification(message.notification);
      }
    };
    
    chrome.runtime.onMessage.addListener(handleMessage);
    
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  return (
    <div className="app-container">
      <div className="toolbar-and-tabs">
        <div className="app-header">
          <h1>PasteKeeper</h1>
          
          <div className="header-controls">
            <button 
              className="btn"
              title="Add new item"
              onClick={() => setIsAddModalOpen(true)}
            >
              <i className="fas fa-plus"></i>
            </button>
            
            {!isFloatingWindow ? (
              <button 
                className="btn"
                title="Open in floating window"
                onClick={handleOpenFloatingWindow}
              >
                <i className="fas fa-external-link-alt"></i>
              </button>
            ) : (
              <button 
                className="btn"
                title="Close window"
                onClick={handleCloseWindow}
              >
                <i className="fas fa-times"></i>
              </button>
            )}
            
            <button 
              className="btn"
              title="Settings"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            >
              <i className="fas fa-cog"></i>
            </button>
          </div>
        </div>
        
        <div className="tools-container">
          {/* Search and tools section */}
          <div className="search-and-tools">
            <div className={`search-container ${isMultiSelectMode ? '' : 'expanded'}`}>
              <input
                type="text"
                placeholder="Search clipboard items..."
                value={searchQuery || ''}
                onChange={(e) => handleSearch(e.target.value)}
                className="search-input"
                onFocus={() => setIsSearchExpanded(true)}
                onBlur={() => !searchQuery && setIsSearchExpanded(false)}
              />
              {searchQuery && (
                <button 
                  className="toolbar-btn" 
                  onClick={() => handleSearch('')}
                  title="Clear search"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
            
            <div className="action-tools">
              {!isLoading && filteredItems.length > 0 && (
                <>
                  <button 
                    className="btn"
                    title={isMultiSelectMode ? "Exit select mode" : "Select multiple items"}
                    onClick={toggleMultiSelectMode}
                  >
                    <i className="fas fa-check-square"></i>
                    {isMultiSelectMode && selectedItems.length > 0 && (
                      <span className="selected-count">{selectedItems.length}</span>
                    )}
                  </button>
                  
                  {selectedItems.length > 0 ? (
                    <>
                      <button 
                        className="btn favorite" 
                        title="Favorite selected items"
                        onClick={() => {
                          selectedItems.forEach(itemId => toggleFavorite(itemId));
                        }}
                      >
                        <i className="fas fa-star"></i>
                      </button>
                      
                      {selectedItems.length > 1 && (
                        <button 
                          className="btn merge" 
                          title="Merge selected items"
                          onClick={() => {
                            const selectedContent = filteredItems
                              .filter(item => selectedItems.includes(item.id))
                              .map(item => item.content)
                              .join('\n\n');
                            
              navigator.clipboard.writeText(selectedContent)
                .then(() => {
                                // Show success notification
                  setNotification({
                    type: 'success',
                                  message: 'Merged items copied to clipboard'
                  });
                })
                .catch(err => {
                                console.error('Failed to merge items:', err);
                                // Show error notification
                  setNotification({
                    type: 'error',
                                  message: 'Failed to merge items'
                  });
                });
                          }}
                        >
                          <i className="fas fa-object-group"></i>
                        </button>
                      )}
                      
                      <button 
                        className="btn" 
                        title="Copy selected items"
                        onClick={() => {
                          const selectedContent = filteredItems
                            .filter(item => selectedItems.includes(item.id))
                            .map(item => item.content)
                            .join('\n\n');
                          
                          navigator.clipboard.writeText(selectedContent)
                            .catch(err => console.error('Failed to copy selected items:', err));
                        }}
                      >
                        <i className="fas fa-copy"></i>
                      </button>
                      
                      <button 
                        className="btn export" 
                        title="Export selected items"
                        onClick={() => {
                          const dataToExport = filteredItems.filter(item => selectedItems.includes(item.id));
                          const exportData = JSON.stringify(dataToExport, null, 2);
                          const blob = new Blob([exportData], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `clipboard-data-${new Date().toISOString().slice(0, 10)}.json`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <i className="fas fa-file-export"></i>
                      </button>
                      
                      <button 
                        className="btn danger" 
                        title="Delete selected items"
                        onClick={deleteSelectedItems}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </>
                  ) : (
                    !isMultiSelectMode && (
                      <span className="items-count">{filteredItems.length} items</span>
                    )
                  )}
                </>
              )}
            </div>
          </div>
          
          <TabBar 
            activeTab={activeTab} 
            onTabChange={handleTabChange} 
          />
        </div>
      </div>
      
      <ClipboardList 
        items={filteredItems}
        onCopyItem={copyItem}
        onDeleteItem={deleteItem}
        onToggleFavorite={toggleFavorite}
        isMultiSelectMode={isMultiSelectMode}
        selectedItems={selectedItems}
        onToggleSelect={toggleItemSelection}
        onSelectAll={selectAllItems}
        onClearSelection={clearSelection}
        onDeleteSelected={deleteSelectedItems}
        activeTab={activeTab}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onSearch={handleSearch}
      />
      
      <AddItemModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddItem={handleAddItem}
      />
      
      <Settings 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      
      {notification && (
        <NotificationToast 
          notification={notification}
          onClose={handleCloseNotification}
        />
      )}
    </div>
  );
};

// Render the app in the popup
const rootElement = document.getElementById('root');
if (rootElement) {
  // Check if we're in a floating window by examining the body class
  const isFloating = document.body.classList.contains('floating-window');
  
  ReactDOM.render(
    <SettingsProvider>
      <App />
    </SettingsProvider>,
    rootElement
  );
} 