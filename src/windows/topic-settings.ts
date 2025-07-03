// Topic Settings Page TypeScript
// Browser-compatible version without module exports

// Type definitions for our specific config structure
interface UserConfig {
  appSettings?: {
    topicDescription?: string;
  };
}

document.addEventListener('DOMContentLoaded', function(): void {
    console.log('Topic Settings page loaded');
    
    // Load existing settings
    loadCurrentSettings();
    
    // Set up form submission
    const form = document.getElementById('topicSettingsForm') as HTMLFormElement;
    if (form) {
        form.addEventListener('submit', handleSaveSettings);
    }
});

/**
 * Set button loading state
 * @param button - The button element
 * @param isLoading - Whether the button should be in loading state
 * @param loadingText - Text to show when loading
 * @param originalText - Original button text
 */
function setButtonLoading(
    button: HTMLButtonElement, 
    isLoading: boolean, 
    loadingText: string = 'Loading...', 
    originalText: string | null = null
): void {
    if (isLoading) {
        if (!originalText) {
            button.dataset.originalText = button.textContent || '';
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
 * @param message - The message to display
 * @param type - The type of message ('success', 'error')
 */
function showStatus(message: string, type: 'success' | 'error'): void {
    const statusDiv = document.getElementById('status') as HTMLDivElement;
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type} show`;
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            statusDiv.classList.remove('show');
        }, 5000);
    }
}

/**
 * Load current settings from the main process
 */
async function loadCurrentSettings(): Promise<void> {
    try {
        const config = await (window as any).electronAPI.loadConfig() as UserConfig | null;
        const topicDescriptionInput = document.getElementById('topicDescription') as HTMLInputElement;
        
        if (topicDescriptionInput) {
            if (config && config.appSettings && config.appSettings.topicDescription) {
                topicDescriptionInput.value = config.appSettings.topicDescription;
            } else {
                // Set default value if no existing config
                topicDescriptionInput.value = 'developer-focused AI stories';
            }
        }
    } catch (error) {
        console.error('Error loading current settings:', error);
        showStatus('Error loading current settings', 'error');
        
        // Set default value on error
        const topicDescriptionInput = document.getElementById('topicDescription') as HTMLInputElement;
        if (topicDescriptionInput) {
            topicDescriptionInput.value = 'developer-focused AI stories';
        }
    }
}

/**
 * Handle form submission
 */
async function handleSaveSettings(event: Event): Promise<void> {
    event.preventDefault();
    
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    if (!saveBtn) return;
    
    try {
        // Show loading state
        setButtonLoading(saveBtn, true, 'Saving...');
        
        // Get form data
        const target = event.target as HTMLFormElement;
        const formData = new FormData(target);
        const topicDescription = (formData.get('topicDescription') as string)?.trim();
        
        // Validate input
        if (!topicDescription) {
            showStatus('Topic description is required', 'error');
            return;
        }
        
        // Save the settings
        const success = await (window as any).electronAPI.saveTopicSettings({
            topicDescription: topicDescription
        });
        
        if (success) {
            showStatus('Settings saved successfully!', 'success');
            
            // Close the settings window after a short delay
            setTimeout(() => {
                (window as any).electronAPI.closeSettings();
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
function cancelSettings(): void {
    (window as any).electronAPI.closeSettings();
}

/**
 * Switch to API settings page
 */
function switchToApiSettings(): void {
    (window as any).electronAPI.openApiSettings();
}

// Handle window close request
window.addEventListener('beforeunload', function(e: BeforeUnloadEvent): null {
    // Allow the window to close normally
    return null;
});

// Handle keyboard shortcuts
document.addEventListener('keydown', function(e: KeyboardEvent): void {
    // ESC key to close
    if (e.key === 'Escape') {
        cancelSettings();
    }
    
    // Cmd+S / Ctrl+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        const form = document.getElementById('topicSettingsForm') as HTMLFormElement;
        if (form) {
            form.dispatchEvent(new Event('submit'));
        }
    }
}); 