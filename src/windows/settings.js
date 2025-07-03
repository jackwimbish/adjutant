// Settings window renderer script
document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements
    const form = document.getElementById('settings-form');
    const statusMessage = document.getElementById('status-message');
    const saveBtn = document.getElementById('save-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const testFirebaseBtn = document.getElementById('test-firebase');
    const testOpenAIBtn = document.getElementById('test-openai');

    // Form input elements
    const inputs = {
        firebase: {
            apiKey: document.getElementById('firebase-api-key'),
            authDomain: document.getElementById('firebase-auth-domain'),
            projectId: document.getElementById('firebase-project-id'),
            storageBucket: document.getElementById('firebase-storage-bucket'),
            messagingSenderId: document.getElementById('firebase-messaging-sender-id'),
            appId: document.getElementById('firebase-app-id')
        },
        openai: {
            apiKey: document.getElementById('openai-api-key')
        }
    };

    // UI Helper Functions
    
    /**
     * Set button loading state
     * @param {HTMLElement} button - The button element
     * @param {boolean} isLoading - Whether the button should be in loading state
     */
    function setButtonLoading(button, isLoading) {
        button.disabled = isLoading;
        if (isLoading) {
            button.classList.add('loading');
        } else {
            button.classList.remove('loading');
        }
    }

    /**
     * Show status message to user
     * @param {string} message - The message to display
     * @param {string} type - The type of message ('info', 'success', 'error')
     */
    function showStatus(message, type) {
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
     * @param {HTMLElement} button - The button to manage loading state for
     * @param {Function} apiFunction - The async function to execute
     * @param {string} loadingMessage - Message to show while loading
     * @param {string} successMessage - Message to show on success
     * @param {string} errorPrefix - Prefix for error messages
     * @returns {Function} - The wrapped function
     */
    function withApiCall(button, apiFunction, loadingMessage, successMessage, errorPrefix) {
        return async function(...args) {
            try {
                showStatus(loadingMessage, 'info');
                setButtonLoading(button, true);

                const result = await apiFunction.apply(this, args);
                
                if (result && result.success !== undefined) {
                    // Handle API responses with success/message format
                    if (result.success) {
                        showStatus(successMessage, 'success');
                    } else {
                        showStatus(`${errorPrefix}: ${result.message}`, 'error');
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
                showStatus(`${errorPrefix}: ${error.message}`, 'error');
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
        async function(event) {
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
    function handleCancel() {
        window.settingsAPI.closeWindow();
    }

    /**
     * Handle Firebase connection test
     */
    const handleTestFirebase = withApiCall(
        testFirebaseBtn,
        async function() {
            const firebaseConfig = getFirebaseConfigFromForm();
            
            if (!validateFirebaseConfig(firebaseConfig)) {
                showStatus('Please fill in all Firebase fields before testing', 'error');
                return false;
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
        async function() {
            const openaiConfig = getOpenAIConfigFromForm();
            
            if (!openaiConfig.apiKey.trim()) {
                showStatus('Please enter OpenAI API key before testing', 'error');
                return false;
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
    async function loadExistingConfig() {
        try {
            const config = await window.settingsAPI.loadConfig();
            if (config) {
                // Populate Firebase fields
                Object.keys(inputs.firebase).forEach(key => {
                    if (config.firebase[key]) {
                        inputs.firebase[key].value = config.firebase[key];
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
    function getConfigFromForm() {
        return {
            firebase: getFirebaseConfigFromForm(),
            openai: getOpenAIConfigFromForm(),
            firstRun: false
        };
    }

    /**
     * Get Firebase configuration from form
     */
    function getFirebaseConfigFromForm() {
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
    function getOpenAIConfigFromForm() {
        return {
            apiKey: inputs.openai.apiKey.value.trim()
        };
    }

    /**
     * Validate the entire form
     */
    function validateForm() {
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
    function validateFirebaseConfig(config) {
        const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
        return requiredFields.every(field => config[field] && config[field].length > 0);
    }

    /**
     * Clean up event listeners when window closes
     */
    window.addEventListener('beforeunload', () => {
        window.settingsAPI.removeAllListeners();
    });
});

/**
 * Switch to topic settings page
 */
function switchToTopicSettings() {
    window.settingsAPI.openTopicSettings();
} 