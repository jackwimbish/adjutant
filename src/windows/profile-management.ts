// Profile Management Window TypeScript
// Browser-compatible version without module exports

console.log('Profile Management TS loaded');

// Type definitions
interface FirebaseTimestamp {
  toDate(): Date;
  seconds: number;
  nanoseconds?: number;
}

interface UserProfile {
  likes: string[];
  dislikes: string[];
  changelog: string;
  last_updated: FirebaseTimestamp | Date | string;
  created_at: FirebaseTimestamp | Date | string;
  id?: string;
  articlesAnalyzed?: number;
  version?: number;
}

interface ProfileApiResponse {
  success: boolean;
  profile?: UserProfile;
  message?: string;
}

interface StagedChanges {
  likes: string[];
  dislikes: string[];
}

// DOM elements
const loadingDiv = document.getElementById('loading') as HTMLDivElement;
const errorDiv = document.getElementById('error') as HTMLDivElement;
const errorMessage = document.getElementById('error-message') as HTMLElement;
const noProfileDiv = document.getElementById('no-profile') as HTMLDivElement;
const profileContentDiv = document.getElementById('profile-content') as HTMLDivElement;

// Statistics elements
const likesCount = document.getElementById('likes-count') as HTMLElement;
const dislikesCount = document.getElementById('dislikes-count') as HTMLElement;
const articlesAnalyzed = document.getElementById('articles-analyzed') as HTMLElement;
const profileVersion = document.getElementById('profile-version') as HTMLElement;

// Preferences elements
const likesList = document.getElementById('likes-list') as HTMLUListElement;
const dislikesList = document.getElementById('dislikes-list') as HTMLUListElement;
const likesEmpty = document.getElementById('likes-empty') as HTMLElement;
const dislikesEmpty = document.getElementById('dislikes-empty') as HTMLElement;

// Metadata elements
const createdDate = document.getElementById('created-date') as HTMLElement;
const updatedDate = document.getElementById('updated-date') as HTMLElement;
const profileId = document.getElementById('profile-id') as HTMLElement;
const profileStatus = document.getElementById('profile-status') as HTMLElement;
const changelogSection = document.getElementById('changelog-section') as HTMLElement;
const changelog = document.getElementById('changelog') as HTMLElement;

// Action buttons
const refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;
const regenerateBtn = document.getElementById('regenerate-btn') as HTMLButtonElement;
const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
const deleteBtn = document.getElementById('delete-btn') as HTMLButtonElement;
const closeBtn = document.getElementById('close-btn') as HTMLButtonElement;

// Edit mode elements
const editModeBtn = document.getElementById('edit-mode-btn') as HTMLButtonElement;
const editModeActions = document.getElementById('edit-mode-actions') as HTMLElement;
const normalModeActions = document.getElementById('normal-mode-actions') as HTMLElement;
const saveChangesBtn = document.getElementById('save-changes-btn') as HTMLButtonElement;
const cancelEditBtn = document.getElementById('cancel-edit-btn') as HTMLButtonElement;

// Count displays
const likesCountDisplay = document.getElementById('likes-count-display') as HTMLElement;
const dislikesCountDisplay = document.getElementById('dislikes-count-display') as HTMLElement;

// Edit controls
const likesEditControls = document.getElementById('likes-edit-controls') as HTMLElement;
const dislikesEditControls = document.getElementById('dislikes-edit-controls') as HTMLElement;
const addLikeInput = document.getElementById('add-like-input') as HTMLInputElement;
const addLikeBtn = document.getElementById('add-like-btn') as HTMLButtonElement;
const addDislikeInput = document.getElementById('add-dislike-input') as HTMLInputElement;
const addDislikeBtn = document.getElementById('add-dislike-btn') as HTMLButtonElement;

// Current profile data and edit state
let currentProfile: UserProfile | null = null;
let isEditMode: boolean = false;
let stagedChanges: StagedChanges = {
    likes: [],
    dislikes: []
};
let hasUnsavedChanges: boolean = false;

/**
 * Initialize the profile management window
 */
async function initializeProfileManagement(): Promise<void> {
    console.log('Initializing profile management...');
    
    // Set up event listeners
    setupEventListeners();
    
    // Load profile data
    await loadProfileData();
}

/**
 * Set up event listeners for all interactive elements
 */
function setupEventListeners(): void {
    // Normal mode buttons
    refreshBtn.addEventListener('click', handleRefresh);
    regenerateBtn.addEventListener('click', handleRegenerate);
    exportBtn.addEventListener('click', handleExport);
    deleteBtn.addEventListener('click', handleDelete);
    closeBtn.addEventListener('click', handleClose);
    
    // Edit mode buttons
    editModeBtn.addEventListener('click', enterEditMode);
    saveChangesBtn.addEventListener('click', saveChanges);
    cancelEditBtn.addEventListener('click', cancelEdit);
    
    // Add preference buttons
    addLikeBtn.addEventListener('click', () => addPreference('like'));
    addDislikeBtn.addEventListener('click', () => addPreference('dislike'));
    
    // Input enter key handling
    addLikeInput.addEventListener('keypress', (e: KeyboardEvent) => {
        if (e.key === 'Enter') addPreference('like');
    });
    addDislikeInput.addEventListener('keypress', (e: KeyboardEvent) => {
        if (e.key === 'Enter') addPreference('dislike');
    });
    
    // Input validation on type
    addLikeInput.addEventListener('input', () => validateInput(addLikeInput));
    addDislikeInput.addEventListener('input', () => validateInput(addDislikeInput));
}

/**
 * Load profile data from the main process
 */
async function loadProfileData(): Promise<void> {
    try {
        showLoading();
        
        console.log('Loading profile data...');
        
        // Check if electronAPI is available
        if (!(window as any).electronAPI || !(window as any).electronAPI.getProfile) {
            throw new Error('electronAPI.getProfile not available');
        }
        
        const result = await (window as any).electronAPI.getProfile();
        console.log('Profile API result:', result);
        
        if (result.success && result.profile) {
            console.log('Profile loaded successfully:', result.profile);
            currentProfile = result.profile;
            displayProfile(result.profile);
        } else {
            console.log('No profile found or error:', result.message);
            showNoProfile();
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        showError(`Failed to load profile data: ${errorMessage}`);
    }
}

/**
 * Display profile data in the UI
 */
function displayProfile(profile: UserProfile): void {
    console.log('Displaying profile:', profile);
    
    // Hide loading and error states
    hideLoading();
    hideError();
    hideNoProfile();
    
    // Show profile content
    profileContentDiv.style.display = 'block';
    
    // Show edit mode button
    editModeBtn.style.display = 'inline-flex';
    
    // Initialize staging data
    stagedChanges.likes = [...profile.likes];
    stagedChanges.dislikes = [...profile.dislikes];
    hasUnsavedChanges = false;
    
    // Update statistics
    updateStatistics(profile);
    
    // Update preferences
    updatePreferences(profile);
    
    // Update metadata
    updateMetadata(profile);
    
    // Update changelog if available
    updateChangelog(profile);
}

/**
 * Update statistics display
 */
function updateStatistics(profile: UserProfile): void {
    const likes = profile.likes || [];
    const dislikes = profile.dislikes || [];
    
    likesCount.textContent = likes.length.toString();
    dislikesCount.textContent = dislikes.length.toString();
    articlesAnalyzed.textContent = (profile.articlesAnalyzed || 0).toString();
    profileVersion.textContent = (profile.version || 1).toString();
}

/**
 * Update preferences display
 */
function updatePreferences(profile?: UserProfile): void {
    // Use staged changes if in edit mode, otherwise use profile data
    const likes = isEditMode ? stagedChanges.likes : (profile?.likes || []);
    const dislikes = isEditMode ? stagedChanges.dislikes : (profile?.dislikes || []);
    
    // Update count displays
    updateCountDisplays();
    
    // Update likes
    if (likes.length > 0) {
        likesList.innerHTML = '';
        likesEmpty.style.display = 'none';
        
        likes.forEach((like, index) => {
            const listItem = createPreferenceItem(like, 'like', index);
            likesList.appendChild(listItem);
        });
    } else {
        likesList.innerHTML = '';
        likesEmpty.style.display = 'block';
    }
    
    // Update dislikes
    if (dislikes.length > 0) {
        dislikesList.innerHTML = '';
        dislikesEmpty.style.display = 'none';
        
        dislikes.forEach((dislike, index) => {
            const listItem = createPreferenceItem(dislike, 'dislike', index);
            dislikesList.appendChild(listItem);
        });
    } else {
        dislikesList.innerHTML = '';
        dislikesEmpty.style.display = 'block';
    }
}

/**
 * Create a preference item element
 */
function createPreferenceItem(preference: string, type: 'like' | 'dislike', index: number): HTMLLIElement {
    const listItem = document.createElement('li');
    listItem.className = `preference-item ${isEditMode ? 'edit-mode' : ''}`;
    
    const textDiv = document.createElement('div');
    textDiv.className = 'preference-text';
    textDiv.textContent = preference;
    
    const typeSpan = document.createElement('span');
    typeSpan.className = `preference-type ${type}`;
    typeSpan.textContent = type === 'like' ? 'LIKE' : 'DISLIKE';
    
    listItem.appendChild(textDiv);
    listItem.appendChild(typeSpan);
    
    // Add remove button in edit mode
    if (isEditMode) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove this preference';
        removeBtn.addEventListener('click', () => removePreference(type, index));
        listItem.appendChild(removeBtn);
    }
    
    return listItem;
}

/**
 * Update metadata display
 */
function updateMetadata(profile: UserProfile): void {
    // Format dates
    const created = profile.created_at ? formatDate(profile.created_at) : 'Unknown';
    const updated = profile.last_updated ? formatDate(profile.last_updated) : 'Unknown';
    
    createdDate.textContent = created;
    updatedDate.textContent = updated;
    profileId.textContent = profile.id || 'user-profile';
    profileStatus.textContent = 'Active';
}

/**
 * Update changelog display
 */
function updateChangelog(profile: UserProfile): void {
    if (profile.changelog && profile.changelog.trim()) {
        changelogSection.style.display = 'block';
        
        const changelogContent = document.createElement('div');
        changelogContent.innerHTML = `
            <h4>Latest Changes</h4>
            <p>${escapeHtml(profile.changelog)}</p>
        `;
        
        changelog.innerHTML = '';
        changelog.appendChild(changelogContent);
    } else {
        changelogSection.style.display = 'none';
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format date for display
 */
function formatDate(dateInput: FirebaseTimestamp | Date | string): string {
    try {
        let date: Date;
        
        if (dateInput && typeof (dateInput as FirebaseTimestamp).toDate === 'function') {
            // Firestore Timestamp object with toDate method
            date = (dateInput as FirebaseTimestamp).toDate();
        } else if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
            // Firebase Timestamp object with seconds and nanoseconds
            const timestamp = dateInput as FirebaseTimestamp;
            date = new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
        } else if (dateInput instanceof Date) {
            date = dateInput;
        } else if (typeof dateInput === 'string' || typeof dateInput === 'number') {
            date = new Date(dateInput);
        } else {
            console.warn('Unknown date format:', dateInput);
            return 'Unknown';
        }
        
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.warn('Error formatting date:', error, dateInput);
        return 'Unknown';
    }
}

/**
 * Handle refresh button click
 */
async function handleRefresh(): Promise<void> {
    console.log('Refreshing profile...');
    
    const originalText = refreshBtn.textContent || 'Refresh';
    refreshBtn.textContent = '🔄 Refreshing...';
    refreshBtn.disabled = true;
    
    try {
        await loadProfileData();
        
        // Show success briefly
        refreshBtn.textContent = '✅ Refreshed';
        setTimeout(() => {
            refreshBtn.textContent = originalText;
            refreshBtn.disabled = false;
        }, 1500);
    } catch (error) {
        console.error('Error refreshing profile:', error);
        refreshBtn.textContent = '❌ Error';
        setTimeout(() => {
            refreshBtn.textContent = originalText;
            refreshBtn.disabled = false;
        }, 2000);
    }
}

/**
 * Handle regenerate button click
 */
async function handleRegenerate(): Promise<void> {
    console.log('Regenerating profile...');
    
    const confirmed = confirm(
        'Are you sure you want to regenerate your profile?\n\n' +
        'This will analyze your current article ratings and create a new profile, ' +
        'potentially changing your preferences. This action cannot be undone.'
    );
    
    if (!confirmed) {
        return;
    }
    
    const originalText = regenerateBtn.textContent || 'Regenerate';
    regenerateBtn.textContent = '🧠 Regenerating...';
    regenerateBtn.disabled = true;
    
    try {
        const result = await (window as any).electronAPI.generateProfile();
        
        if (result.success) {
            regenerateBtn.textContent = '✅ Regenerated';
            
            // Reload profile data
            setTimeout(async () => {
                await loadProfileData();
                regenerateBtn.textContent = originalText;
                regenerateBtn.disabled = false;
            }, 1500);
        } else {
            throw new Error(result.message || 'Failed to regenerate profile');
        }
    } catch (error) {
        console.error('Error regenerating profile:', error);
        regenerateBtn.textContent = '❌ Error';
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert(`Failed to regenerate profile: ${errorMessage}`);
        
        setTimeout(() => {
            regenerateBtn.textContent = originalText;
            regenerateBtn.disabled = false;
        }, 2000);
    }
}

/**
 * Handle export button click
 */
async function handleExport(): Promise<void> {
    console.log('Exporting profile...');
    
    if (!currentProfile) {
        alert('No profile to export');
        return;
    }
    
    try {
        // Create export data
        const exportData = {
            profile: currentProfile,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
        
        // Convert to JSON
        const jsonData = JSON.stringify(exportData, null, 2);
        
        // Create download
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `adjutant-profile-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show success
        const originalText = exportBtn.textContent || 'Export';
        exportBtn.textContent = '✅ Exported';
        setTimeout(() => {
            exportBtn.textContent = originalText;
        }, 2000);
        
    } catch (error) {
        console.error('Error exporting profile:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert(`Failed to export profile: ${errorMessage}`);
    }
}

/**
 * Handle delete button click
 */
async function handleDelete(): Promise<void> {
    console.log('Deleting profile...');
    
    const confirmed = confirm(
        'Are you sure you want to delete your profile?\n\n' +
        'This will permanently remove all your preferences and learning data. ' +
        'This action cannot be undone.'
    );
    
    if (!confirmed) {
        return;
    }
    
    const originalText = deleteBtn.textContent || 'Delete';
    deleteBtn.textContent = '🗑️ Deleting...';
    deleteBtn.disabled = true;
    
    try {
        const result = await (window as any).electronAPI.deleteProfile();
        
        if (result.success) {
            deleteBtn.textContent = '✅ Deleted';
            
            // Reset UI to no profile state
            setTimeout(() => {
                currentProfile = null;
                showNoProfile();
                deleteBtn.textContent = originalText;
                deleteBtn.disabled = false;
            }, 1500);
        } else {
            throw new Error(result.message || 'Failed to delete profile');
        }
    } catch (error) {
        console.error('Error deleting profile:', error);
        deleteBtn.textContent = '❌ Error';
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert(`Failed to delete profile: ${errorMessage}`);
        
        setTimeout(() => {
            deleteBtn.textContent = originalText;
            deleteBtn.disabled = false;
        }, 2000);
    }
}

/**
 * Show loading state
 */
function showLoading(): void {
    loadingDiv.style.display = 'block';
    errorDiv.style.display = 'none';
    noProfileDiv.style.display = 'none';
    profileContentDiv.style.display = 'none';
}

/**
 * Hide loading state
 */
function hideLoading(): void {
    loadingDiv.style.display = 'none';
}

/**
 * Show error state
 */
function showError(message: string): void {
    errorDiv.style.display = 'block';
    errorMessage.textContent = message;
    loadingDiv.style.display = 'none';
    noProfileDiv.style.display = 'none';
    profileContentDiv.style.display = 'none';
}

/**
 * Hide error state
 */
function hideError(): void {
    errorDiv.style.display = 'none';
}

/**
 * Show no profile state
 */
function showNoProfile(): void {
    noProfileDiv.style.display = 'block';
    loadingDiv.style.display = 'none';
    errorDiv.style.display = 'none';
    profileContentDiv.style.display = 'none';
    editModeBtn.style.display = 'none';
}

/**
 * Hide no profile state
 */
function hideNoProfile(): void {
    noProfileDiv.style.display = 'none';
}

/**
 * Handle close button click
 */
function handleClose(): void {
    // Check for unsaved changes
    if (hasUnsavedChanges) {
        const confirmed = confirm(
            'You have unsaved changes. Are you sure you want to close without saving?'
        );
        if (!confirmed) {
            return;
        }
    }
    
    (window as any).electronAPI.closeWindow();
}

/**
 * Enter edit mode
 */
function enterEditMode(): void {
    console.log('Entering edit mode...');
    
    isEditMode = true;
    hasUnsavedChanges = false;
    
    // Update UI
    editModeBtn.style.display = 'none';
    normalModeActions.style.display = 'none';
    editModeActions.style.display = 'flex';
    likesEditControls.style.display = 'block';
    dislikesEditControls.style.display = 'block';
    
    // Refresh preferences display to show edit controls
    updatePreferences();
}

/**
 * Exit edit mode
 */
function exitEditMode(): void {
    console.log('Exiting edit mode...');
    
    isEditMode = false;
    hasUnsavedChanges = false;
    
    // Reset staged changes to current profile
    if (currentProfile) {
        stagedChanges.likes = [...currentProfile.likes];
        stagedChanges.dislikes = [...currentProfile.dislikes];
    }
    
    // Update UI
    editModeBtn.style.display = 'inline-flex';
    normalModeActions.style.display = 'flex';
    editModeActions.style.display = 'none';
    likesEditControls.style.display = 'none';
    dislikesEditControls.style.display = 'none';
    
    // Clear input fields
    addLikeInput.value = '';
    addDislikeInput.value = '';
    
    // Refresh preferences display
    updatePreferences(currentProfile || undefined);
}

/**
 * Cancel edit mode
 */
function cancelEdit(): void {
    if (hasUnsavedChanges) {
        const confirmed = confirm('Are you sure you want to cancel? All changes will be lost.');
        if (!confirmed) {
            return;
        }
    }
    
    exitEditMode();
}

/**
 * Save changes made in edit mode
 */
async function saveChanges(): Promise<void> {
    console.log('Saving changes...');
    
    const originalText = saveChangesBtn.textContent || 'Save Changes';
    saveChangesBtn.textContent = '💾 Saving...';
    saveChangesBtn.disabled = true;
    
    try {
        const result = await (window as any).electronAPI.updateProfileManual(
            stagedChanges.likes,
            stagedChanges.dislikes
        );
        
        if (result.success) {
            saveChangesBtn.textContent = '✅ Saved';
            
            // Update current profile with new data
            if (result.profile) {
                currentProfile = result.profile;
            }
            
            // Exit edit mode after successful save
            setTimeout(() => {
                exitEditMode();
                saveChangesBtn.textContent = originalText;
                saveChangesBtn.disabled = false;
            }, 1500);
        } else {
            throw new Error(result.message || 'Failed to save changes');
        }
    } catch (error) {
        console.error('Error saving changes:', error);
        saveChangesBtn.textContent = '❌ Error';
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert(`Failed to save changes: ${errorMessage}`);
        
        setTimeout(() => {
            saveChangesBtn.textContent = originalText;
            saveChangesBtn.disabled = false;
        }, 2000);
    }
}

/**
 * Add a new preference
 */
function addPreference(type: 'like' | 'dislike'): void {
    const input = type === 'like' ? addLikeInput : addDislikeInput;
    const value = input.value.trim();
    
    if (!validatePreferenceInput(value)) {
        return;
    }
    
    // Add to staged changes
    if (type === 'like') {
        stagedChanges.likes.push(value);
    } else {
        stagedChanges.dislikes.push(value);
    }
    
    // Clear input
    input.value = '';
    
    // Mark as having unsaved changes
    hasUnsavedChanges = true;
    
    // Update display
    updatePreferences();
    
    console.log(`Added ${type}: ${value}`);
}

/**
 * Remove a preference
 */
function removePreference(type: 'like' | 'dislike', index: number): void {
    if (type === 'like') {
        stagedChanges.likes.splice(index, 1);
    } else {
        stagedChanges.dislikes.splice(index, 1);
    }
    
    // Mark as having unsaved changes
    hasUnsavedChanges = true;
    
    // Update display
    updatePreferences();
    
    console.log(`Removed ${type} at index ${index}`);
}

/**
 * Validate preference input
 */
function validatePreferenceInput(value: string): boolean {
    if (!value || value.length < 2) {
        alert('Preference must be at least 2 characters long');
        return false;
    }
    
    if (value.length > 100) {
        alert('Preference must be less than 100 characters');
        return false;
    }
    
    return true;
}

/**
 * Validate input field and show visual feedback
 */
function validateInput(input: HTMLInputElement): void {
    const value = input.value.trim();
    
    if (value.length > 0 && value.length < 2) {
        input.classList.add('invalid');
    } else if (value.length > 100) {
        input.classList.add('invalid');
    } else {
        input.classList.remove('invalid');
    }
}

/**
 * Update count displays in edit mode
 */
function updateCountDisplays(): void {
    if (isEditMode) {
        likesCountDisplay.textContent = stagedChanges.likes.length.toString();
        dislikesCountDisplay.textContent = stagedChanges.dislikes.length.toString();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeProfileManagement); 