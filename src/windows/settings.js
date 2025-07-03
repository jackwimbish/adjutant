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

    // Load existing configuration on startup
    await loadExistingConfig();

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
     * Handle form submission
     */
    async function handleFormSubmit(event) {
        event.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        const config = getConfigFromForm();
        
        try {
            showStatus('Saving configuration...', 'info');
            saveBtn.disabled = true;
            saveBtn.classList.add('loading');

            const success = await window.settingsAPI.saveConfig(config);
            
            if (success) {
                showStatus('Configuration saved successfully!', 'success');
                setTimeout(() => {
                    window.settingsAPI.closeWindow();
                }, 1500);
            } else {
                showStatus('Failed to save configuration. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error saving config:', error);
            showStatus('Error saving configuration: ' + error.message, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.classList.remove('loading');
        }
    }

    /**
     * Handle cancel button click
     */
    function handleCancel() {
        window.settingsAPI.closeWindow();
    }

    /**
     * Handle Firebase connection test
     */
    async function handleTestFirebase() {
        const firebaseConfig = getFirebaseConfigFromForm();
        
        if (!validateFirebaseConfig(firebaseConfig)) {
            showStatus('Please fill in all Firebase fields before testing', 'error');
            return;
        }

        try {
            showStatus('Testing Firebase connection...', 'info');
            testFirebaseBtn.disabled = true;
            testFirebaseBtn.classList.add('loading');

            const result = await window.settingsAPI.testFirebase(firebaseConfig);
            
            if (result.success) {
                showStatus('Firebase connection successful!', 'success');
            } else {
                showStatus('Firebase connection failed: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Error testing Firebase:', error);
            showStatus('Error testing Firebase: ' + error.message, 'error');
        } finally {
            testFirebaseBtn.disabled = false;
            testFirebaseBtn.classList.remove('loading');
        }
    }

    /**
     * Handle OpenAI connection test
     */
    async function handleTestOpenAI() {
        const openaiConfig = getOpenAIConfigFromForm();
        
        if (!openaiConfig.apiKey.trim()) {
            showStatus('Please enter OpenAI API key before testing', 'error');
            return;
        }

        try {
            showStatus('Testing OpenAI connection...', 'info');
            testOpenAIBtn.disabled = true;
            testOpenAIBtn.classList.add('loading');

            const result = await window.settingsAPI.testOpenAI(openaiConfig);
            
            if (result.success) {
                showStatus('OpenAI connection successful!', 'success');
            } else {
                showStatus('OpenAI connection failed: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Error testing OpenAI:', error);
            showStatus('Error testing OpenAI: ' + error.message, 'error');
        } finally {
            testOpenAIBtn.disabled = false;
            testOpenAIBtn.classList.remove('loading');
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
     * Show status message to user
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