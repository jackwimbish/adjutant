// Settings window renderer script
// Browser-compatible version without module exports

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
    // Get DOM elements
    const form = document.getElementById('settings-form') as HTMLFormElement;
    const statusMessage = document.getElementById('status-message') as HTMLDivElement;
    const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
    const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
    const testFirebaseBtn = document.getElementById('test-firebase') as HTMLButtonElement;
    const testOpenAIBtn = document.getElementById('test-openai') as HTMLButtonElement;

    // Form input elements
    const inputs: {
        firebase: {
            apiKey: HTMLInputElement;
            authDomain: HTMLInputElement;
            projectId: HTMLInputElement;
            storageBucket: HTMLInputElement;
            messagingSenderId: HTMLInputElement;
            appId: HTMLInputElement
        };
        openai: {
            apiKey: HTMLInputElement
        }
    } = {
        firebase: {
            apiKey: document.getElementById('firebase-api-key') as HTMLInputElement,
            authDomain: document.getElementById('firebase-auth-domain') as HTMLInputElement,
            projectId: document.getElementById('firebase-project-id') as HTMLInputElement,
            storageBucket: document.getElementById('firebase-storage-bucket') as HTMLInputElement,
            messagingSenderId: document.getElementById('firebase-messaging-sender-id') as HTMLInputElement,
            appId: document.getElementById('firebase-app-id') as HTMLInputElement
        },
        openai: {
            apiKey: document.getElementById('openai-api-key') as HTMLInputElement
        }
    };

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
        statusMessage.className = `status-message ${type} show`;
        
        // Auto-hide after 5 seconds for non-persistent messages
        if (type !== 'info') {
            setTimeout(() => {
                statusMessage.classList.remove('show');
            }, 5000);
        }
    }

    /**
     * Higher-order function to handle API calls with consistent error handling and loading states
     * @param button - The button to manage loading state for
     * @param apiFunction - The async function to execute
     * @param loadingMessage - Message to show while loading
     * @param successMessage - Message to show on success
     * @param errorPrefix - Prefix for error messages
     * @returns The wrapped function
     */
    function withApiCall<T extends any[], R>(
        button: HTMLButtonElement, 
        apiFunction: (...args: T) => Promise<R>, 
        loadingMessage: string, 
        successMessage: string, 
        errorPrefix: string
    ): (...args: T) => Promise<R | false> {
        return async function(...args: T): Promise<R | false> {
            try {
                showStatus(loadingMessage, 'info');
                setButtonLoading(button, true);

                const result = await apiFunction(...args);
                
                if (result && typeof result === 'object' && 'success' in result) {
                    // Handle API responses with success/message format
                    const apiResult = result as unknown as { success: boolean; message: string };
                    if (apiResult.success) {
                        showStatus(successMessage, 'success');
                    } else {
                        showStatus(`${errorPrefix}: ${apiResult.message}`, 'error');
                    }
                } else if (result !== false) {
                    // Handle boolean/truthy responses
                    showStatus(successMessage, 'success');
                } else {
                    showStatus(`${errorPrefix}. Please try again.`, 'error');
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

    // Define event handlers first
    
    /**
     * Handle form submission
     */
    const handleFormSubmit = withApiCall(
        saveBtn,
        async function(event: Event): Promise<boolean> {
            event.preventDefault();
            
            if (!validateForm()) {
                return false;
            }

            const config = getConfigFromForm();
            const success = await window.settingsAPI.saveConfig(config);
            
            if (success) {
                setTimeout(() => {
                    window.settingsAPI.closeWindow();
                }, 1500);
            }
            
            return success;
        },
        'Saving configuration...',
        'Configuration saved successfully!',
        'Failed to save configuration'
    );

    /**
     * Handle cancel button click
     */
    function handleCancel(): void {
        window.settingsAPI.closeWindow();
    }

    /**
     * Handle Firebase connection test
     */
    const handleTestFirebase = withApiCall(
        testFirebaseBtn,
        async function(): Promise<{ success: boolean; message: string }> {
            const firebaseConfig = getFirebaseConfigFromForm();
            
            if (!validateFirebaseConfig(firebaseConfig)) {
                showStatus('Please fill in all Firebase fields before testing', 'error');
                return { success: false, message: 'Incomplete configuration' };
            }

            return await window.settingsAPI.testFirebase(firebaseConfig);
        },
        'Testing Firebase connection...',
        'Firebase connection successful!',
        'Firebase connection failed'
    );

    /**
     * Handle OpenAI connection test
     */
    const handleTestOpenAI = withApiCall(
        testOpenAIBtn,
        async function(): Promise<{ success: boolean; message: string }> {
            const openaiConfig = getOpenAIConfigFromForm();
            
            if (!openaiConfig.apiKey.trim()) {
                showStatus('Please enter OpenAI API key before testing', 'error');
                return { success: false, message: 'API key required' };
            }

            return await window.settingsAPI.testOpenAI(openaiConfig);
        },
        'Testing OpenAI connection...',
        'OpenAI connection successful!',
        'OpenAI connection failed'
    );

    // Event listeners
    form.addEventListener('submit', handleFormSubmit);
    cancelBtn.addEventListener('click', handleCancel);
    testFirebaseBtn.addEventListener('click', handleTestFirebase);
    testOpenAIBtn.addEventListener('click', handleTestOpenAI);

    // Listen for config saved event from main process
    window.settingsAPI.onConfigSaved(() => {
        showStatus('Configuration saved successfully!', 'success');
        setTimeout(() => {
            window.settingsAPI.closeWindow();
        }, 1500);
    });

    /**
     * Load existing configuration and populate form
     */
    async function loadExistingConfig(): Promise<void> {
        try {
            const config = await window.settingsAPI.loadConfig();
            if (config) {
                // Populate Firebase fields
                Object.keys(inputs.firebase).forEach((key) => {
                    const inputKey = key as keyof typeof inputs.firebase;
                    const configKey = key as keyof typeof config.firebase;
                    if (config.firebase[configKey]) {
                        inputs.firebase[inputKey].value = config.firebase[configKey];
                    }
                });

                // Populate OpenAI field
                if (config.openai.apiKey) {
                    inputs.openai.apiKey.value = config.openai.apiKey;
                }
            }
        } catch (error) {
            console.error('Error loading config:', error);
            showStatus('Error loading existing configuration', 'error');
        }
    }

    /**
     * Get complete configuration from form
     */
    function getConfigFromForm(): {
        firebase: {
            apiKey: string;
            authDomain: string;
            projectId: string;
            storageBucket: string;
            messagingSenderId: string;
            appId: string;
        };
        openai: {
            apiKey: string;
        };
        appSettings: {
            topicDescription: string;
        };
        firstRun: boolean;
    } {
        return {
            firebase: getFirebaseConfigFromForm(),
            openai: getOpenAIConfigFromForm(),
            appSettings: {
                topicDescription: 'developer-focused AI stories' // Default value
            },
            firstRun: false
        };
    }

    /**
     * Get Firebase configuration from form
     */
    function getFirebaseConfigFromForm(): {
        apiKey: string;
        authDomain: string;
        projectId: string;
        storageBucket: string;
        messagingSenderId: string;
        appId: string;
    } {
        return {
            apiKey: inputs.firebase.apiKey.value.trim(),
            authDomain: inputs.firebase.authDomain.value.trim(),
            projectId: inputs.firebase.projectId.value.trim(),
            storageBucket: inputs.firebase.storageBucket.value.trim(),
            messagingSenderId: inputs.firebase.messagingSenderId.value.trim(),
            appId: inputs.firebase.appId.value.trim()
        };
    }

    /**
     * Get OpenAI configuration from form
     */
    function getOpenAIConfigFromForm(): {
        apiKey: string;
    } {
        return {
            apiKey: inputs.openai.apiKey.value.trim()
        };
    }

    /**
     * Validate the entire form
     */
    function validateForm(): boolean {
        const firebaseConfig = getFirebaseConfigFromForm();
        const openaiConfig = getOpenAIConfigFromForm();

        if (!validateFirebaseConfig(firebaseConfig)) {
            showStatus('Please fill in all Firebase configuration fields', 'error');
            return false;
        }

        if (!openaiConfig.apiKey) {
            showStatus('Please enter your OpenAI API key', 'error');
            return false;
        }

        if (!openaiConfig.apiKey.startsWith('sk-')) {
            showStatus('OpenAI API key should start with "sk-"', 'error');
            return false;
        }

        return true;
    }

    /**
     * Validate Firebase configuration
     */
    function validateFirebaseConfig(config: {
        apiKey: string;
        authDomain: string;
        projectId: string;
        storageBucket: string;
        messagingSenderId: string;
        appId: string;
    }): boolean {
        const requiredFields: (keyof typeof config)[] = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
        return requiredFields.every(field => config[field] && config[field].length > 0);
    }

    /**
     * Clean up event listeners when window closes
     */
    window.addEventListener('beforeunload', (): void => {
        window.settingsAPI.removeAllListeners();
    });
});

/**
 * Switch to topic settings page
 */
function switchToTopicSettings(): void {
    window.settingsAPI.openTopicSettings();
} 