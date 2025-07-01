import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any APIs you need to expose to the renderer
  // For example:
  // invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),
  // on: (channel: string, func: Function) => ipcRenderer.on(channel, func),
}); 