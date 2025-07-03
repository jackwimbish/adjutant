import { contextBridge, ipcRenderer } from 'electron';

/**
 * Expose secure API methods to the renderer process
 * This allows the topic settings page to communicate with the main process
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Load current user configuration
   */
  loadConfig: async () => {
    return await ipcRenderer.invoke('load-config');
  },

  /**
   * Save topic settings
   */
  saveTopicSettings: async (settings: { topicDescription: string }) => {
    return await ipcRenderer.invoke('save-topic-settings', settings);
  },

  /**
   * Close the settings window
   */
  closeSettings: () => {
    ipcRenderer.send('close-settings');
  },

  /**
   * Open API settings window
   */
  openApiSettings: () => {
    ipcRenderer.send('open-api-settings');
  }
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      loadConfig: () => Promise<any>;
      saveTopicSettings: (settings: { topicDescription: string }) => Promise<boolean>;
      closeSettings: () => void;
      openApiSettings: () => void;
    };
  }
} 