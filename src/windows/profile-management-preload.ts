import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods for profile management window
contextBridge.exposeInMainWorld('electronAPI', {
  // Profile management methods
  getProfile: () => ipcRenderer.invoke('learner:get-profile'),
  generateProfile: () => ipcRenderer.invoke('learner:generate-profile'),
  deleteProfile: () => ipcRenderer.invoke('learner:delete-profile'),
  updateProfileManual: (likes: string[], dislikes: string[]) => ipcRenderer.invoke('learner:update-profile-manual', likes, dislikes),
  
  // Window management
  closeWindow: () => ipcRenderer.send('window:close'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
});

console.log('Profile Management preload script loaded'); 