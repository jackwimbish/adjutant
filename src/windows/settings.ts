// Settings window renderer script
// Browser-compatible version without module exports

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
    // Get DOM elements
    const form = document.getElementById('settings-form') as HTMLFormElement;
    const statusMessage = document.getElementById('status-message') as HTMLDivElement;
    const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
    const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
    const openApiConfigBtn = document.getElementById('open-api-config') as HTMLButtonElement;

    // Form input elements
    const topicDescriptionInput = document.getElementById('topic-description') as HTMLTextAreaElement;

    // UI Helper Functions
    
    /**
     * Set button loading state
     * @param button - The button element
     * @param isLoading - Whether the button should be in loading state
     */
    function setButtonLoading(button: HTMLButtonElement, isLoading: boolean): void {
        button.disabled = isLoading;
        if (isLoading) {
            button.classList.add('loading');
        } else {
            button.classList.remove('loading');
        }
    }

    /**
     * Show status message to user
     * @param message - The message to display
     * @param type - The type of message ('info', 'success', 'error')
     */
    function showStatus(message: string, type: 'info' | 'success' | 'error'): void {
        statusMessage.textContent = message;
        statusMessage.className = `status-message status-${type} show`;
        
        // Auto-hide after 5 seconds for non-persistent messages
        if (type !== 'info') {
            setTimeout(() => {
                statusMessage.classList.remove('show');
            }, 5000);
        }
    }

    /**
     * Higher-order function to handle operations with consistent error handling and loading states
     * @param button - The button to manage loading state for
     * @param operation - The async function to execute
     * @param loadingMessage - Message to show while loading
     * @param successMessage - Message to show on success
     * @param errorPrefix - Prefix for error messages
     * @returns The wrapped function
     */
    function withOperation<T extends any[], R>(
        button: HTMLButtonElement, 
        operation: (...args: T) => Promise<R>, 
        loadingMessage: string, 
        successMessage: string, 
        errorPrefix: string
    ): (...args: T) => Promise<R | false> {
        return async function(...args: T): Promise<R | false> {
            try {
                showStatus(loadingMessage, 'info');
                setButtonLoading(button, true);

                const result = await operation(...args);
                
                if (result !== false) {
                    showStatus(successMessage, 'success');
                }
                
                return result;
            } catch (error) {
                console.error(`${errorPrefix}:`, error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                showStatus(`${errorPrefix}: ${errorMessage}`, 'error');
                return false;
            } finally {
                setButtonLoading(button, false);
            }
        };
    }

    // Load existing configuration on startup
    await loadExistingConfig();

    // Define event handlers
    
    /**
     * Handle form submission
     */
    const handleFormSubmit = withOperation(
        saveBtn,
        async function(event: Event): Promise<boolean> {
            event.preventDefault();
            
            if (!validateForm()) {
                return false;
            }

            const settings = getSettingsFromForm();
            const success = await (window as any).settingsAPI.saveTopicSettings(settings);
            
            if (success) {
                setTimeout(() => {
                    (window as any).settingsAPI.closeWindow();
                }, 1500);
            }
            
            return success;
        },
        'Saving settings...',
        'Settings saved successfully!',
        'Failed to save settings'
    );

    /**
     * Handle cancel button click
     */
    function handleCancel(): void {
        (window as any).settingsAPI.closeWindow();
    }

    /**
     * Handle open API configuration button click
     */
    function handleOpenApiConfig(): void {
        (window as any).settingsAPI.openApiConfig();
    }

    // Attach event listeners
    form.addEventListener('submit', handleFormSubmit);
    cancelBtn.addEventListener('click', handleCancel);
    openApiConfigBtn.addEventListener('click', handleOpenApiConfig);

    // Configuration loading and form utilities

    /**
     * Load existing configuration into the form
     */
    async function loadExistingConfig(): Promise<void> {
        try {
            const config = await (window as any).settingsAPI.loadConfig();
            
            if (config && config.appSettings) {
                topicDescriptionInput.value = config.appSettings.topicDescription || '';
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
            showStatus('Error loading existing configuration', 'error');
        }
    }

    /**
     * Get settings from form inputs
     */
    function getSettingsFromForm(): {
        topicDescription: string;
    } {
        return {
            topicDescription: topicDescriptionInput.value.trim()
        };
    }

    /**
     * Validate the form
     */
    function validateForm(): boolean {
        const settings = getSettingsFromForm();
        
        if (!settings.topicDescription) {
            showStatus('Please enter a topic description', 'error');
            return false;
        }
        
        return true;
    }
}); 