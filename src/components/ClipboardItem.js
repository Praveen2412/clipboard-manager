import React, { useContext } from 'react';
import { formatTimestamp } from '../utils/clipboardUtils';
import { SettingsContext } from '../contexts/SettingsContext';

/**
 * ClipboardItem component for individual clipboard entries
 * @param {Object} props - Component props
 * @param {Object} props.item - Clipboard item data
 * @param {Function} props.onCopy - Copy handler
 * @param {Function} props.onDelete - Delete handler
 * @param {Function} props.onToggleFavorite - Favorite toggle handler
 * @param {boolean} props.isMultiSelectMode - Whether multiselect mode is active
 * @param {boolean} props.isSelected - Whether this item is selected
 * @param {Function} props.onToggleSelect - Handler for toggling selection
 * @returns {JSX.Element} ClipboardItem component
 */
const ClipboardItem = ({ 
  item, 
  onCopy, 
  onDelete, 
  onToggleFavorite,
  isMultiSelectMode = false,
  isSelected = false,
  onToggleSelect
}) => {
  if (!item) return null;
  
  // Get settings from context
  const { settings } = useContext(SettingsContext);
  const showCountInfo = settings?.showCharCount !== undefined ? settings.showCharCount : true;
  
  console.log(`ClipboardItem: Rendering item ${item.id}, showCountInfo=${showCountInfo}`);
  
  const handleCopyClick = (e) => {
    e.stopPropagation();
    if (onCopy) {
      onCopy(item.id);
    }
  };
  
  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(item.id);
    }
  };
  
  const handleFavoriteClick = (e) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(item.id);
    }
  };
  
  const handleToggleSelect = (e) => {
    e.stopPropagation();
    if (onToggleSelect) {
      onToggleSelect(item.id);
    }
  };
  
  const handleItemClick = () => {
    if (isMultiSelectMode && onToggleSelect) {
      onToggleSelect(item.id);
    } else if (!isMultiSelectMode && onCopy) {
      // In normal mode, clicking the item copies it
      onCopy(item.id);
    }
  };
  
  // Get formatted size/count text
  const getSizeCountText = () => {
    if (item.type === 'image') {
      // Handle image size
      if (typeof item.charCount === 'string' && item.charCount.endsWith('KB')) {
        return item.charCount;
      } else {
        return Math.round(item.content.length / 1024) + 'KB';
      }
    } else {
      // Handle text count
      return `${item.charCount} chars`;
    }
  };
  
  /**
   * Render item content based on type
   * @returns {JSX.Element} Rendered content
   */
  const renderContent = () => {
    switch (item.type) {
      case 'image':
        return (
          <div className="item-content image-content">
            <img src={item.content} alt="Clipboard image" />
          </div>
        );
        
      case 'url':
        return (
          <div className="item-content url-content">
            <a href={item.content} target="_blank" rel="noopener noreferrer">{item.content}</a>
          </div>
        );
        
      case 'code':
        return (
          <div className="item-content code-content">
            <pre>{item.content}</pre>
          </div>
        );
        
      case 'text':
      default:
        return (
          <div className="item-content text-content">
            {item.content}
          </div>
        );
    }
  };
  
  // Get the appropriate icon for content type
  const getCategoryIcon = (type) => {
    switch (type) {
      case 'code':
        return 'fa-code';
      case 'url':
        return 'fa-link';
      case 'image':
        return 'fa-image';
      case 'text':
      default:
        return 'fa-font';
    }
  };
  
  return (
    <div 
      className={`clipboard-item ${isSelected ? 'selected' : ''}`}
      onClick={handleItemClick}
    >
      <div className="item-category">
        {isMultiSelectMode ? (
          <input 
            type="checkbox" 
            className="category-checkbox"
            checked={isSelected}
            onChange={handleToggleSelect}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <i className={`fas ${getCategoryIcon(item.type)}`}></i>
        )}
      </div>
      
      <div className="item-header">
        <div className="item-time">{formatTimestamp(item.timestamp)}</div>
        {showCountInfo && (
          <div className="item-char-count">
            {getSizeCountText()}
          </div>
        )}
      </div>
      
      {renderContent()}
      
      <div className="item-actions">
        <button 
          className={`action-button favorite ${item.isFavorite ? 'active' : ''}`}
          title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={handleFavoriteClick}
        >
          <i className="fas fa-star"></i>
        </button>
        
        <button 
          className="action-button copy"
          title="Copy to clipboard"
          onClick={handleCopyClick}
        >
          <i className="fas fa-copy"></i>
        </button>
        
        <button 
          className="action-button delete"
          title="Delete"
          onClick={handleDeleteClick}
        >
          <i className="fas fa-trash"></i>
        </button>
      </div>
    </div>
  );
};

export default ClipboardItem; 