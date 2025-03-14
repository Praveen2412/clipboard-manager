import React, { useState, useEffect, useRef, useContext } from 'react';
import { SettingsContext } from '../contexts/SettingsContext';

/**
 * Settings component for configuring the extension
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether settings panel is open
 * @param {Function} props.onClose - Close handler
 * @returns {JSX.Element} Settings component
 */
const Settings = ({ isOpen, onClose }) => {
  // Access the settings context
  const { settings: globalSettings, updateSettings } = useContext(SettingsContext);
  
  // Local state for settings
  const [verboseLogging, setVerboseLogging] = useState(false);
  const [maxItems, setMaxItems] = useState(50);
  const [theme, setTheme] = useState('dark');
  const [showCharCount, setShowCharCount] = useState(true);
  const [maxTextLength, setMaxTextLength] = useState(10000);
  const [maxImageSize, setMaxImageSize] = useState(1000); // in KB
  
  // UI state
  const [showSaveMessage, setShowSaveMessage] = useState(false);
  const [exportUrl, setExportUrl] = useState('');
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  
  // Refs
  const fileInputRef = useRef(null);
  
  // Update local state when global settings change or component opens
  useEffect(() => {
    if (isOpen) {
      // Get latest settings from context
      setVerboseLogging(globalSettings.verboseLogging || false);
      setMaxItems(globalSettings.maxItems || 50);
      setTheme(globalSettings.theme || 'dark');
      setShowCharCount(globalSettings.showCharCount !== undefined ? globalSettings.showCharCount : true);
      setMaxTextLength(globalSettings.maxTextLength || 10000);
      setMaxImageSize(globalSettings.maxImageSize || 1000);
      
      // Reset unsaved changes flag
      setUnsavedChanges(false);
      
      console.log('Settings loaded in component:', globalSettings);
    }
  }, [isOpen, globalSettings]);
  
  // Hide save message after timeout
  useEffect(() => {
    let timer;
    if (showSaveMessage) {
      timer = setTimeout(() => {
        setShowSaveMessage(false);
      }, 3000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showSaveMessage]);
  
  // Clean up export URL when component unmounts
  useEffect(() => {
    return () => {
      if (exportUrl) {
        URL.revokeObjectURL(exportUrl);
      }
    };
  }, [exportUrl]);
  
  if (!isOpen) {
    return null;
  }
  
  // Save all settings
  const handleSaveSettings = () => {
    // Create updated settings object
    const updatedSettings = {
      verboseLogging,
      maxItems,
      theme,
      showCharCount,
      maxTextLength,
      maxImageSize
    };
    
    // Update both local and global state
    updateSettings(updatedSettings);
      setShowSaveMessage(true);
    setUnsavedChanges(false);
    
    // Log updates for debugging
    console.log('Settings saved:', updatedSettings);
  };
  
  const handleVerboseLoggingChange = (event) => {
    setVerboseLogging(event.target.checked);
    setUnsavedChanges(true);
  };
  
  const handleMaxItemsChange = (event) => {
    setMaxItems(parseInt(event.target.value, 10));
    setUnsavedChanges(true);
  };
  
  const handleThemeChange = (event) => {
    setTheme(event.target.value);
    setUnsavedChanges(true);
  };
  
  const handleShowCharCountChange = (event) => {
    setShowCharCount(event.target.checked);
    setUnsavedChanges(true);
  };
  
  const handleMaxTextLengthChange = (event) => {
    setMaxTextLength(parseInt(event.target.value, 10));
    setUnsavedChanges(true);
  };
  
  const handleMaxImageSizeChange = (event) => {
    setMaxImageSize(parseInt(event.target.value, 10));
    setUnsavedChanges(true);
  };
  
  const handleExportData = () => {
    chrome.storage.local.get('clipboardData', (result) => {
      if (result.clipboardData) {
        const dataStr = JSON.stringify(result.clipboardData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        setExportUrl(url);
        
        // Create temporary link and click it
        const a = document.createElement('a');
        a.href = url;
        a.download = `clipboard-data-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    });
  };
  
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleImportData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        
        // Validate data structure
        if (!importedData.items || !Array.isArray(importedData.items)) {
          throw new Error('Invalid data format: items array missing');
        }
        
        // Load existing clipboard data
        chrome.storage.local.get('clipboardData', (result) => {
          let currentData = result.clipboardData || { items: [], favorites: [] };
          
          // Process imported items
          const importedItems = importedData.items.map(item => ({
            ...item,
            type: item.type || categorizeContent(item.content),
            // Ensure each item has an ID
            id: item.id || generateId()
          }));
          
          // Add imported items to existing items, avoiding duplicates
          const existingContentSet = new Set(currentData.items.map(item => item.content));
          const newItems = importedItems.filter(item => !existingContentSet.has(item.content));
          
          const updatedData = {
            items: [...newItems, ...currentData.items],
            favorites: currentData.favorites
          };
          
          // Update favorites if imported data has them
          if (importedData.favorites && Array.isArray(importedData.favorites)) {
            // Add only new favorites
            const existingFavoritesSet = new Set(currentData.favorites.map(item => item.content));
            const newFavorites = importedData.favorites.filter(item => !existingFavoritesSet.has(item.content));
            updatedData.favorites = [...newFavorites, ...currentData.favorites];
          } else {
            // Update favorites based on imported items marked as favorites
            const newFavoriteItems = importedItems.filter(item => item.isFavorite);
            const newFavoriteContentSet = new Set(newFavoriteItems.map(item => item.content));
            const newFavorites = newFavoriteItems.filter(item => !existingFavoritesSet.has(item.content));
            updatedData.favorites = [...newFavorites, ...currentData.favorites];
          }
          
          // Import the merged data
          chrome.storage.local.set({ clipboardData: updatedData }, () => {
            // Notify background script
            chrome.runtime.sendMessage({ action: 'clipboardDataUpdated' });
            
            // Show success notification
            setShowSaveMessage(true);
            // Update notification message
            showNotification(`Successfully imported ${newItems.length} new items`);
          });
        });
      } catch (error) {
        console.error('Error importing data:', error);
        alert('Error importing data: ' + error.message);
      }
    };
    
    reader.readAsText(file);
    // Reset the input
    event.target.value = '';
  };
  
  // Helper function to generate a unique ID
  const generateId = () => {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };
  
  // Helper function to categorize content
  const categorizeContent = (content) => {
    if (!content) return 'text';
    
    // Check if it's an image (data URL)
    if (typeof content === 'string' && content.startsWith('data:image/')) {
      return 'image';
    }
    
    // Check if it's a URL
    try {
      const urlPattern = /^(https?:\/\/|www\.)[^\s/$.?#].[^\s]*$/i;
      if (urlPattern.test(content.trim())) {
        return 'url';
      }
    } catch (error) {
      // Not a URL
    }
    
    // Check if it's likely code
    try {
      const codeIndicators = [
        '{', '}', '()', '=>', 'function', 'class', 'import', 'export',
        'const', 'let', 'var', 'def ', 'elif', 'for (', 'while (', 
        '<div>', '<span>', '</div>', '</span>', '<?php', '#!/usr'
      ];
      
      if (codeIndicators.some(indicator => content.includes(indicator))) {
        return 'code';
      }
    } catch (error) {
      // Not code
    }
    
    // Default to text
    return 'text';
  };
  
  const handleClose = () => {
    // Prompt if unsaved changes
    if (unsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
    if (onClose) {
          onClose();
        }
      }
    } else if (onClose) {
      onClose();
    }
  };
  
  const showNotification = (message, type = 'success') => {
    chrome.runtime.sendMessage({
      action: 'showNotification',
      notification: {
        type: type,
        message: message
      }
    });
  };
  
  return (
    <div className="settings-panel">
      <div className="modal-content">
      <div className="settings-header">
        <h3>Settings</h3>
        <button className="btn" onClick={handleClose}>×</button>
      </div>
      
      <div className="settings-body">
          <div className="settings-section">
            <h4 className="settings-section-title">General</h4>
            
        <label>
          <input
            type="checkbox"
            checked={verboseLogging}
            onChange={handleVerboseLoggingChange}
          />
          Enable verbose logging
        </label>
        
            <div className="input-with-label">
              <label htmlFor="maxItems">Maximum items to store</label>
          <input
                id="maxItems"
            type="number"
            min="10"
            max="500"
            value={maxItems}
            onChange={handleMaxItemsChange}
          />
            </div>
          </div>
          
          <div className="settings-section">
            <h4 className="settings-section-title">Theme</h4>
            
            <div className="theme-options">
              <label className="theme-option">
                <input
                  type="radio"
                  name="theme"
                  value="dark"
                  checked={theme === 'dark'}
                  onChange={handleThemeChange}
                />
                <span>Dark</span>
              </label>
              
              <label className="theme-option">
                <input
                  type="radio"
                  name="theme"
                  value="light"
                  checked={theme === 'light'}
                  onChange={handleThemeChange}
                />
                <span>Light</span>
        </label>
              
              <label className="theme-option">
                <input
                  type="radio"
                  name="theme"
                  value="system"
                  checked={theme === 'system'}
                  onChange={handleThemeChange}
                />
                <span>System</span>
              </label>
            </div>
          </div>
          
          <div className="settings-section">
            <h4 className="settings-section-title">Display</h4>
        
        <label>
          <input
            type="checkbox"
                checked={showCharCount}
                onChange={handleShowCharCountChange}
          />
              Show character count / size information
        </label>
          </div>
          
          <div className="settings-section">
            <h4 className="settings-section-title">Content Limits</h4>
            
            <div className="input-with-label">
              <label htmlFor="maxTextLength">Max text length (chars)</label>
              <input
                id="maxTextLength"
                type="number"
                min="100"
                max="100000"
                value={maxTextLength}
                onChange={handleMaxTextLengthChange}
              />
            </div>
            
            <div className="input-with-label">
              <label htmlFor="maxImageSize">Max image size (KB)</label>
              <input
                id="maxImageSize"
                type="number"
                min="100"
                max="5000"
                value={maxImageSize}
                onChange={handleMaxImageSizeChange}
              />
            </div>
          </div>
          
          <div className="settings-section">
            <h4 className="settings-section-title">Data Management</h4>
            
            <div className="data-management-buttons">
              <button 
                className="btn-secondary" 
                onClick={handleImportClick}
              >
                Import Data
              </button>
              
              <button 
                className="btn-secondary" 
                onClick={handleExportData}
              >
                Export Data
              </button>
              
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".json"
                onChange={handleImportData}
              />
            </div>
          </div>
          
          <div className="settings-save-section">
            <button 
              className="btn-primary save-settings-btn"
              onClick={handleSaveSettings}
              disabled={!unsavedChanges}
            >
              Save Settings
            </button>
          </div>
        
        <p className="settings-info">
          Version: {chrome.runtime.getManifest().version}
        </p>
        
        {showSaveMessage && (
          <div className="settings-saved">Settings saved!</div>
        )}
        </div>
      </div>
    </div>
  );
};

export default Settings; 