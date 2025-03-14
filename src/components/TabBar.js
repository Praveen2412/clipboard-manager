import React from 'react';

/**
 * TabBar component for category navigation
 * @param {Object} props - Component props
 * @param {string} props.activeTab - Currently selected tab
 * @param {Function} props.onTabChange - Tab change handler
 * @returns {JSX.Element} TabBar component
 */
const TabBar = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'text', label: 'Text' },
    { id: 'url', label: 'URLs' },
    { id: 'code', label: 'Code' },
    { id: 'image', label: 'Images' },
    { id: 'favorites', label: 'Favorites' }
  ];
  
  const handleTabClick = (tabId) => {
    if (onTabChange) {
      onTabChange(tabId);
    }
  };
  
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div 
          key={tab.id}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => handleTabClick(tab.id)}
        >
          {tab.label}
        </div>
      ))}
    </div>
  );
};

export default TabBar; 