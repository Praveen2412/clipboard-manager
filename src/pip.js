import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import ClipboardList from './components/ClipboardList';
import useClipboardData from './hooks/useClipboardData';

/**
 * PiPApp component for the minimalistic picture-in-picture mode
 * @returns {JSX.Element} PiPApp component
 */
const PiPApp = () => {
  // State
  const [isDragging, setIsDragging] = useState(false);
  const [theme, setTheme] = useState('dark'); // Default theme
  
  // Refs
  const headerRef = useRef(null);
  const draggableRef = useRef(null);
  
  // Use custom hook for clipboard data management with fixed tab and no search
  const {
    filteredItems,
    copyItem,
    deleteItem,
    toggleFavorite,
    selectedItems,
    isMultiSelectMode,
    toggleItemSelection,
    selectAllItems,
    clearSelection,
    toggleMultiSelectMode,
    deleteSelectedItems,
    isLoading,
    loadData
  } = useClipboardData('all', ''); // Always show 'all' items in PiP mode
  
  // Set up polling for automatic updates
  useEffect(() => {
    console.log('Setting up PiP window direct polling');
    
    // Initial data load
    loadData();
    
    // Create a direct polling mechanism that doesn't depend on the useClipboardData hook
    const pollingInterval = setInterval(() => {
      console.log('PiP window poll - refreshing data');
      
      // Direct request to background script for fresh data
      chrome.runtime.sendMessage({ action: 'getClipboardData' }, (result) => {
        if (chrome.runtime.lastError) {
          console.error('Error refreshing PiP window data:', chrome.runtime.lastError);
        } else if (result && result.items) {
          console.log('PiP window received updated data, items:', result.items.length);
          // Force refresh data from background
          loadData();
        }
      });
    }, 800); // Poll slightly faster than 1 second to ensure we don't miss updates
    
    // Also listen for direct update messages
    const updateListener = (message) => {
      if (message.action === 'clipboardDataUpdated' || message.action === 'refreshClipboardData') {
        console.log('PiP window received update notification, refreshing data');
        loadData();
      }
    };
    
    chrome.runtime.onMessage.addListener(updateListener);
    
    // Clean up interval on unmount
    return () => {
      clearInterval(pollingInterval);
      chrome.runtime.onMessage.removeListener(updateListener);
    };
  }, [loadData]);
  
  // Load theme from settings
  useEffect(() => {
    const loadTheme = async () => {
      try {
        // Get theme from chrome storage
        chrome.storage.local.get('settings', (result) => {
          if (chrome.runtime.lastError) {
            console.error('Error loading theme:', chrome.runtime.lastError);
            return;
          }

          const settings = result.settings || {};
          const savedTheme = settings.theme || 'dark';
          setTheme(savedTheme);
          
          // Apply theme to document
          document.documentElement.setAttribute('data-theme', savedTheme);
        });
        
        // Listen for theme changes
        const messageListener = (message) => {
          if (message.action === 'settingsUpdated' && message.settings) {
            const newTheme = message.settings.theme || 'dark';
            setTheme(newTheme);
            document.documentElement.setAttribute('data-theme', newTheme);
          }
        };
        
        chrome.runtime.onMessage.addListener(messageListener);
        
        return () => {
          chrome.runtime.onMessage.removeListener(messageListener);
        };
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };
    
    loadTheme();
  }, []);
  
  // Effect for draggable window functionality
  useEffect(() => {
    // Exit if running in regular popup context
    if (!draggableRef.current) return;
    
    let offsetX, offsetY;
    
    // Handlers for dragging
    const handleMouseDown = (e) => {
      // Only trigger dragging on the header
      if (!headerRef.current.contains(e.target)) return;
      
      // If the target is a button or interactive element, don't start dragging
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      
      setIsDragging(true);
      
      const rect = draggableRef.current.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    };
    
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      // Move the window with the mouse
      draggableRef.current.style.left = `${e.clientX - offsetX}px`;
      draggableRef.current.style.top = `${e.clientY - offsetY}px`;
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    // Add event listeners
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    // Cleanup event listeners
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleCloseWindow = () => {
    window.close();
  };

  return (
    <div className="pip-app-container" ref={draggableRef}>
      <div className="pip-header" ref={headerRef}>
        <div className="header-controls">
          {!isLoading && filteredItems.length > 0 && (
            <button 
              className="btn"
              title={isMultiSelectMode ? "Exit select mode" : "Select items"}
              onClick={toggleMultiSelectMode}
            >
              <i className="fas fa-check-square"></i>
            </button>
          )}
          
          <button 
            className="btn"
            title="Close"
            onClick={handleCloseWindow}
          >
            <i className="fas fa-times"></i>
          </button>
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
        activeTab="all"
        isLoading={isLoading}
        searchQuery=""
        compact={true}
      />
    </div>
  );
};

// Initialize the PiP window app
const container = document.getElementById('pip-root');
const root = createRoot(container);
root.render(<PiPApp />); 