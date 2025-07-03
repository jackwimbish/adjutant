import { contextBridge, ipcRenderer } from 'electron';

// Expose API configuration-related functions to the renderer process
contextBridge.exposeInMainWorld('apiConfigAPI', {
    // Load configuration
    loadConfig: () => ipcRenderer.invoke('config:load'),
    
    // Save configuration
    saveConfig: (config: any) => ipcRenderer.invoke('config:save', config),
    
    // Test Firebase connection
    testFirebase: (firebaseConfig: any) => ipcRenderer.invoke('api-test:firebase', firebaseConfig),
    
    // Test OpenAI connection
    testOpenAI: (openaiConfig: any) => ipcRenderer.invoke('api-test:openai', openaiConfig),
    
    // Window management
    closeWindow: () => ipcRenderer.invoke('window:close-api-config')
}); 