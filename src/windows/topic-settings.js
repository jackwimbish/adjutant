// Topic Settings Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('Topic Settings page loaded');
    
    // Load existing settings
    loadCurrentSettings();
    
    // Set up form submission
    const form = document.getElementById('topicSettingsForm');
    form.addEventListener('submit', handleSaveSettings);
});

/**
 * Set button loading state
 * @param {HTMLElement} button - The button element
 * @param {boolean} isLoading - Whether the button should be in loading state
 * @param {string} loadingText - Text to show when loading
 * @param {string} originalText - Original button text
 */
function setButtonLoading(button, isLoading, loadingText = 'Loading...', originalText = null) {
    if (isLoading) {
        if (!originalText) {
            button.dataset.originalText = button.textContent;
        }
        button.textContent = loadingText;
        button.disabled = true;
    } else {
        button.textContent = originalText || button.dataset.originalText || button.textContent;
        button.disabled = false;
        delete button.dataset.originalText;
    }
}

/**
 * Show status message
 * @param {string} message - The message to display
 * @param {string} type - The type of message ('success', 'error')
 */
function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type} show`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        statusDiv.classList.remove('show');
    }, 5000);
}

/**
 * Load current settings from the main process
 */
async function loadCurrentSettings() {
    try {
        const config = await window.electronAPI.loadConfig();
        
        if (config && config.appSettings && config.appSettings.topicDescription) {
            document.getElementById('topicDescription').value = config.appSettings.topicDescription;
        } else {
            // Set default value if no existing config
            document.getElementById('topicDescription').value = 'developer-focused AI stories';
        }
    } catch (error) {
        console.error('Error loading current settings:', error);
        showStatus('Error loading current settings', 'error');
        // Set default value on error
        document.getElementById('topicDescription').value = 'developer-focused AI stories';
    }
}

/**
 * Handle form submission
 */
async function handleSaveSettings(event) {
    event.preventDefault();
    
    const saveBtn = document.getElementById('saveBtn');
    
    try {
        // Show loading state
        setButtonLoading(saveBtn, true, 'Saving...');
        
        // Get form data
        const formData = new FormData(event.target);
        const topicDescription = formData.get('topicDescription').trim();
        
        // Validate input
        if (!topicDescription) {
            showStatus('Topic description is required', 'error');
            return;
        }
        
        // Save the settings
        const success = await window.electronAPI.saveTopicSettings({
            topicDescription: topicDescription
        });
        
        if (success) {
            showStatus('Settings saved successfully!', 'success');
            
            // Close the settings window after a short delay
            setTimeout(() => {
                window.electronAPI.closeSettings();
            }, 1500);
        } else {
            showStatus('Error saving settings. Please try again.', 'error');
        }
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showStatus('Error saving settings. Please try again.', 'error');
    } finally {
        // Reset button state
        setButtonLoading(saveBtn, false);
    }
}

/**
 * Cancel settings and close window
 */
function cancelSettings() {
    window.electronAPI.closeSettings();
}

/**
 * Switch to API settings page
 */
function switchToApiSettings() {
    window.electronAPI.openApiSettings();
}

// Handle window close request
window.addEventListener('beforeunload', function(e) {
    // Allow the window to close normally
    return null;
});

// Handle keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // ESC key to close
    if (e.key === 'Escape') {
        cancelSettings();
    }
    
    // Cmd+S / Ctrl+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        document.getElementById('topicSettingsForm').dispatchEvent(new Event('submit'));
    }
}); 