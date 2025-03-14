// Window type detector for Clipboard Manager
window.addEventListener('DOMContentLoaded', () => {
    // Detect if this is the main popup or a floating window
    const isMainPopup = chrome.action && 
                       location.href.indexOf('popup.html') !== -1 && 
                       window.innerWidth === 380 && 
                       window.innerHeight === 550;
    
    // If not the main popup but using popup.html, it must be a floating window
    if (!isMainPopup && location.href.indexOf('popup.html') !== -1) {
        console.log('Detected floating window, adding class');
        document.body.classList.add('floating-window');
    }
    
    // Listen for resize events to update classes if window is resized
    window.addEventListener('resize', () => {
        console.log(`Window resized: ${window.innerWidth}x${window.innerHeight}`);
    });
    
    console.log(`Window type detection complete: ${isMainPopup ? 'Main Popup' : 'Floating Window'}`);
}); 