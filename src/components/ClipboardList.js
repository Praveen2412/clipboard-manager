import React, { useState, useRef } from 'react';
import ClipboardItem from './ClipboardItem';

/**
 * ClipboardList component for displaying list of clipboard items
 * @param {Object} props - Component props
 * @param {Array} props.items - Clipboard items to display
 * @param {Function} props.onCopyItem - Copy item handler
 * @param {Function} props.onDeleteItem - Delete item handler
 * @param {Function} props.onToggleFavorite - Favorite toggle handler
 * @param {boolean} props.isMultiSelectMode - Whether multiselect mode is active
 * @param {Array} props.selectedItems - Array of selected item IDs
 * @param {Function} props.onToggleSelect - Toggle selection handler
 * @param {Function} props.onSelectAll - Select all handler
 * @param {Function} props.onClearSelection - Clear selection handler
 * @param {Function} props.onDeleteSelected - Delete selected handler
 * @param {string} props.activeTab - Current active tab
 * @param {boolean} props.compact - Whether to show compact view
 * @param {string} props.searchQuery - Current search query
 * @param {Function} props.onSearch - Search handler
 * @returns {JSX.Element} ClipboardList component
 */
const ClipboardList = ({ 
  items, 
  onCopyItem, 
  onDeleteItem, 
  onToggleFavorite,
  isMultiSelectMode = false,
  selectedItems = [],
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onDeleteSelected,
  activeTab,
  isLoading = false,
  compact = false,
  searchQuery = '',
  onSearch
}) => {
  // Use ref for the clipboard items container
  const listRef = useRef(null);
  
  const [isAllSelected, setIsAllSelected] = useState(false);
  
  const allSelected = items.length > 0 && selectedItems.length === items.length;
  
  const handleSelectAllChange = (e) => {
    setIsAllSelected(e.target.checked);
    
    if (onSelectAll) {
      onSelectAll(e.target.checked);
    }
  };
  
  const handleDeleteSelected = () => {
    if (onDeleteSelected) {
      onDeleteSelected();
    }
  };
  
  const handleToggleSelect = (itemId) => {
    if (onToggleSelect) {
      onToggleSelect(itemId);
    }
  };
  
  const handleCopySelected = () => {
    // Copy all selected items to clipboard
    if (selectedItems.length > 0) {
      const selectedContent = items
        .filter(item => selectedItems.includes(item.id))
        .map(item => item.content)
        .join('\n\n');
      
      navigator.clipboard.writeText(selectedContent)
        .catch(err => console.error('Failed to copy selected items:', err));
    }
  };
  
  // Button click handlers for the toolbar actions
  const handleFavoriteClick = () => {
    // Toggle favorite for selected items
    if (selectedItems.length > 0 && onToggleFavorite) {
      selectedItems.forEach(itemId => {
        onToggleFavorite(itemId);
      });
    }
  };
  
  const handleMergeClick = () => {
    // Merge selected items
    if (selectedItems.length > 1) {
      const selectedContent = items
        .filter(item => selectedItems.includes(item.id))
        .map(item => item.content)
        .join('\n\n');
      
      // Create a temporary merged item for immediate UI feedback
      const tempMergedItem = {
        id: `temp-merged-${Date.now()}`,
        content: selectedContent,
        type: 'text',
        timestamp: Date.now(),
        isFavorite: false,
        charCount: selectedContent.length
      };
      
      // Add the item to the items array for immediate feedback
      if (onCopyItem) {
        // This will visually add the item immediately for this window
        onCopyItem(tempMergedItem);
      }
      
      // Copy merged content to clipboard and add as new item
      navigator.clipboard.writeText(selectedContent)
        .then(() => {
          // Add the merged content as a new item
          chrome.runtime.sendMessage({ 
            action: 'addNewItem', 
            item: {
              content: selectedContent,
              type: 'text',
              isFavorite: false
            }
          }, (response) => {
            if (chrome.runtime.lastError || response?.error) {
              console.error('Failed to add merged content as new item:', chrome.runtime.lastError || response.error);
              // Show error notification
              chrome.runtime.sendMessage({ 
                action: 'showNotification',
                notification: {
                  type: 'error',
                  message: 'Failed to merge selected items'
                }
              });
            } else {
              // Show success notification
              chrome.runtime.sendMessage({ 
                action: 'showNotification',
                notification: {
                  type: 'success',
                  message: 'Items merged and copied to clipboard'
                }
              });
              
              // Broadcast to all UI instances that data has been updated
              chrome.runtime.sendMessage({ action: 'clipboardDataUpdated' });
            }
          });
        })
        .catch(err => {
          console.error('Failed to copy merged content:', err);
          // Show error notification
          chrome.runtime.sendMessage({ 
            action: 'showNotification',
            notification: {
              type: 'error',
              message: 'Failed to merge selected items'
            }
          });
        });
    }
  };
  
  const handleCopyAllClick = () => {
    // Copy all items to clipboard
    if (items.length > 0) {
      const allContent = items
        .map(item => item.content)
        .join('\n\n');
      
      navigator.clipboard.writeText(allContent)
        .catch(err => console.error('Failed to copy all items:', err));
    }
  };
  
  const handleExportClick = () => {
    // Export selected items or all items if none selected
    const dataToExport = selectedItems.length > 0
      ? items.filter(item => selectedItems.includes(item.id))
      : items;
    
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
  };
  
  const handleDeleteClick = () => {
    // Delete selected items or prompt to select items if none selected
    if (selectedItems.length > 0 && onDeleteSelected) {
      onDeleteSelected();
    }
  };
  
  /**
   * Render empty state based on active tab
   * @returns {JSX.Element} Empty state message
   */
  const renderEmptyState = () => {
    let message = "No clipboard items found";
    let submessage = "Copy some text or add items manually";
    
    switch (activeTab) {
      case 'text':
        message = "No text items found";
        submessage = "Copy some text to see it here";
        break;
      case 'url':
        message = "No URLs found";
        submessage = "Copy a URL to see it here";
        break;
      case 'code':
        message = "No code snippets found";
        submessage = "Copy code to see it here";
        break;
      case 'image':
        message = "No images found";
        submessage = "Copy an image to see it here";
        break;
      case 'favorites':
        message = "No favorites found";
        submessage = "Click the star icon to favorite items";
        break;
      default:
        // Use default message
    }
    
    return (
      <div className="empty-state">
        <i className="fas fa-clipboard"></i>
        <p>{message}</p>
        <p className="empty-state-sub">{submessage}</p>
      </div>
    );
  };
  
  /**
   * Render clipboard items
   * @returns {Array} Array of ClipboardItem components
   */
  const renderItems = () => {
    if (!items || items.length === 0) {
      return renderEmptyState();
    }
    
    return items.map((item) => (
      <ClipboardItem
        key={item.id}
        item={item}
        onCopy={onCopyItem}
        onDelete={onDeleteItem}
        onToggleFavorite={onToggleFavorite}
        isMultiSelectMode={isMultiSelectMode}
        isSelected={selectedItems.includes(item.id)}
        onToggleSelect={onToggleSelect}
      />
    ));
  };
  
  return (
    <div className={`clipboard-list-container ${isMultiSelectMode ? 'multiselect-enabled' : ''}`}>
      {isMultiSelectMode && (
        <div className="multiselect-controls">
          <label className="select-all-label">
            <input 
              type="checkbox" 
              checked={isAllSelected}
              onChange={handleSelectAllChange}
            />
            Select All ({selectedItems.length}/{items.length})
          </label>
          
          <div className="multiselect-actions">
            <button 
              className="btn"
              onClick={handleCopySelected}
              disabled={selectedItems.length === 0}
            >
              Copy All ({selectedItems.length})
            </button>
            <button 
              className="btn danger"
              onClick={handleDeleteSelected}
              disabled={selectedItems.length === 0}
            >
              Delete ({selectedItems.length})
            </button>
          </div>
        </div>
      )}
      
      <div className="clipboard-items" ref={listRef}>
        {isLoading ? (
          <div className="empty-state">
            <i className="fas fa-spinner fa-spin"></i>
            <p>Loading clipboard items...</p>
          </div>
        ) : items.length === 0 ? (
          renderEmptyState()
        ) : (
          items.map((item) => (
            <ClipboardItem 
              key={item.id} 
              item={item}
              onCopy={onCopyItem}
              onDelete={onDeleteItem}
              onToggleFavorite={onToggleFavorite}
              isMultiSelectMode={isMultiSelectMode}
              isSelected={selectedItems.includes(item.id)}
              onToggleSelect={handleToggleSelect}
              showCountInfo={compact ? false : true}
              compact={compact}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ClipboardList; 