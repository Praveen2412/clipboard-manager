import React, { useState } from 'react';

/**
 * AddItemModal component for adding new clipboard items
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onAddItem - Add item handler
 * @returns {JSX.Element} AddItemModal component
 */
const AddItemModal = ({ isOpen, onClose, onAddItem }) => {
  const [content, setContent] = useState('');
  const [type, setType] = useState('text');
  const [isFavorite, setIsFavorite] = useState(false);
  
  if (!isOpen) {
    return null;
  }
  
  const handleContentChange = (event) => {
    setContent(event.target.value);
  };
  
  const handleTypeChange = (event) => {
    setType(event.target.value);
  };
  
  const handleFavoriteChange = (event) => {
    setIsFavorite(event.target.checked);
  };
  
  const handleSubmit = (event) => {
    event.preventDefault();
    
    if (!content.trim()) {
      alert('Please enter content');
      return;
    }
    
    if (onAddItem) {
      onAddItem(content, type, isFavorite);
    }
    
    // Reset form and close modal
    setContent('');
    setType('text');
    setIsFavorite(false);
    
    if (onClose) {
      onClose();
    }
  };
  
  const handleCancel = () => {
    // Reset form and close modal
    setContent('');
    setType('text');
    setIsFavorite(false);
    
    if (onClose) {
      onClose();
    }
  };
  
  return (
    <div className="add-item-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Add New Item</h2>
          <button className="btn close-btn" onClick={handleCancel}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <textarea 
              value={content}
              onChange={handleContentChange}
              placeholder="Enter content..."
              autoFocus
            />
            
            <select value={type} onChange={handleTypeChange}>
              <option value="text">Text</option>
              <option value="url">URL</option>
              <option value="code">Code</option>
            </select>
            
            <label class="favorite-label">
              <input 
                type="checkbox"
                checked={isFavorite}
                onChange={handleFavoriteChange}
              />
              Add to favorites
            </label>
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddItemModal; 