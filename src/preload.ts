import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Expose method to get Firebase config
  getFirebaseConfig: () => ipcRenderer.invoke('get-firebase-config'),
  
  // Expose method to open settings window
  openSettings: () => ipcRenderer.send('open-settings'),
});

// Expose a promise-based Firebase config getter
contextBridge.exposeInMainWorld('getFirebaseConfig', () => 
  ipcRenderer.invoke('get-firebase-config')
); 