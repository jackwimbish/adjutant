// Profile Management Window JavaScript

console.log('Profile Management JS loaded');

// DOM elements
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const errorMessage = document.getElementById('error-message');
const noProfileDiv = document.getElementById('no-profile');
const profileContentDiv = document.getElementById('profile-content');

// Statistics elements
const likesCount = document.getElementById('likes-count');
const dislikesCount = document.getElementById('dislikes-count');
const articlesAnalyzed = document.getElementById('articles-analyzed');
const profileVersion = document.getElementById('profile-version');

// Preferences elements
const likesList = document.getElementById('likes-list');
const dislikesList = document.getElementById('dislikes-list');
const likesEmpty = document.getElementById('likes-empty');
const dislikesEmpty = document.getElementById('dislikes-empty');

// Metadata elements
const createdDate = document.getElementById('created-date');
const updatedDate = document.getElementById('updated-date');
const profileId = document.getElementById('profile-id');
const profileStatus = document.getElementById('profile-status');
const changelogSection = document.getElementById('changelog-section');
const changelog = document.getElementById('changelog');

// Action buttons
const refreshBtn = document.getElementById('refresh-btn');
const regenerateBtn = document.getElementById('regenerate-btn');
const exportBtn = document.getElementById('export-btn');
const deleteBtn = document.getElementById('delete-btn');
const closeBtn = document.getElementById('close-btn');

// Edit mode elements
const editModeBtn = document.getElementById('edit-mode-btn');
const editModeActions = document.getElementById('edit-mode-actions');
const normalModeActions = document.getElementById('normal-mode-actions');
const saveChangesBtn = document.getElementById('save-changes-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// Count displays
const likesCountDisplay = document.getElementById('likes-count-display');
const dislikesCountDisplay = document.getElementById('dislikes-count-display');

// Edit controls
const likesEditControls = document.getElementById('likes-edit-controls');
const dislikesEditControls = document.getElementById('dislikes-edit-controls');
const addLikeInput = document.getElementById('add-like-input');
const addLikeBtn = document.getElementById('add-like-btn');
const addDislikeInput = document.getElementById('add-dislike-input');
const addDislikeBtn = document.getElementById('add-dislike-btn');

// Current profile data and edit state
let currentProfile = null;
let isEditMode = false;
let stagedChanges = {
    likes: [],
    dislikes: []
};
let hasUnsavedChanges = false;

/**
 * Initialize the profile management window
 */
async function initializeProfileManagement() {
    console.log('Initializing profile management...');
    
    // Set up event listeners
    setupEventListeners();
    
    // Load profile data
    await loadProfileData();
}

/**
 * Set up event listeners for all interactive elements
 */
function setupEventListeners() {
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
    addLikeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addPreference('like');
    });
    addDislikeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addPreference('dislike');
    });
    
    // Input validation on type
    addLikeInput.addEventListener('input', () => validateInput(addLikeInput));
    addDislikeInput.addEventListener('input', () => validateInput(addDislikeInput));
}

/**
 * Load profile data from the main process
 */
async function loadProfileData() {
    try {
        showLoading();
        
        console.log('Loading profile data...');
        
        // Check if electronAPI is available
        if (!window.electronAPI || !window.electronAPI.getProfile) {
            throw new Error('electronAPI.getProfile not available');
        }
        
        const result = await window.electronAPI.getProfile();
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
        showError(`Failed to load profile data: ${error.message}`);
    }
}

/**
 * Display profile data in the UI
 */
function displayProfile(profile) {
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
function updateStatistics(profile) {
    const likes = profile.likes || [];
    const dislikes = profile.dislikes || [];
    
    likesCount.textContent = likes.length;
    dislikesCount.textContent = dislikes.length;
    articlesAnalyzed.textContent = profile.articlesAnalyzed || 0;
    profileVersion.textContent = profile.version || 1;
}

/**
 * Update preferences display
 */
function updatePreferences(profile) {
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
function createPreferenceItem(preference, type, index) {
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
function updateMetadata(profile) {
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
function updateChangelog(profile) {
    if (profile.changelog && profile.changelog.trim()) {
        changelogSection.style.display = 'block';
        
        const changelogContent = document.createElement('div');
        changelogContent.innerHTML = `
            <h4>Latest Changes</h4>
            <p>${profile.changelog}</p>
        `;
        
        changelog.innerHTML = '';
        changelog.appendChild(changelogContent);
    } else {
        changelogSection.style.display = 'none';
    }
}

/**
 * Format date for display
 */
function formatDate(dateInput) {
    try {
        let date;
        
        if (dateInput && typeof dateInput.toDate === 'function') {
            // Firestore Timestamp object with toDate method
            date = dateInput.toDate();
        } else if (dateInput && typeof dateInput === 'object' && dateInput.seconds) {
            // Firebase Timestamp object with seconds and nanoseconds
            date = new Date(dateInput.seconds * 1000 + (dateInput.nanoseconds || 0) / 1000000);
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
async function handleRefresh() {
    console.log('Refreshing profile...');
    
    const originalText = refreshBtn.textContent;
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
async function handleRegenerate() {
    console.log('Regenerating profile...');
    
    const confirmed = confirm(
        'Are you sure you want to regenerate your profile?\n\n' +
        'This will analyze your current article ratings and create a new profile, ' +
        'potentially changing your preferences. This action cannot be undone.'
    );
    
    if (!confirmed) {
        return;
    }
    
    const originalText = regenerateBtn.textContent;
    regenerateBtn.textContent = '🧠 Regenerating...';
    regenerateBtn.disabled = true;
    
    try {
        const result = await window.electronAPI.generateProfile();
        
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
        alert(`Failed to regenerate profile: ${error.message}`);
        
        setTimeout(() => {
            regenerateBtn.textContent = originalText;
            regenerateBtn.disabled = false;
        }, 2000);
    }
}

/**
 * Handle export button click
 */
async function handleExport() {
    console.log('Exporting profile...');
    
    if (!currentProfile) {
        alert('No profile data to export');
        return;
    }
    
    const originalText = exportBtn.textContent;
    exportBtn.textContent = '📤 Exporting...';
    exportBtn.disabled = true;
    
    try {
        // Create export data
        const exportData = {
            profile: currentProfile,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
        
        // Create and download file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
            type: 'application/json' 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `adjutant-profile-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        exportBtn.textContent = '✅ Exported';
        setTimeout(() => {
            exportBtn.textContent = originalText;
            exportBtn.disabled = false;
        }, 1500);
    } catch (error) {
        console.error('Error exporting profile:', error);
        exportBtn.textContent = '❌ Error';
        alert(`Failed to export profile: ${error.message}`);
        
        setTimeout(() => {
            exportBtn.textContent = originalText;
            exportBtn.disabled = false;
        }, 2000);
    }
}

/**
 * Handle delete button click
 */
async function handleDelete() {
    console.log('Deleting profile...');
    
    const confirmed = confirm(
        'Are you sure you want to delete your profile?\n\n' +
        'This will permanently remove all your preferences and learning data. ' +
        'You will need to rate articles again to generate a new profile. ' +
        'This action cannot be undone.'
    );
    
    if (!confirmed) {
        return;
    }
    
    const originalText = deleteBtn.textContent;
    deleteBtn.textContent = '🗑️ Deleting...';
    deleteBtn.disabled = true;
    
    try {
        const result = await window.electronAPI.deleteProfile();
        
        if (result.success) {
            deleteBtn.textContent = '✅ Deleted';
            
            // Show no profile state
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
        alert(`Failed to delete profile: ${error.message}`);
        
        setTimeout(() => {
            deleteBtn.textContent = originalText;
            deleteBtn.disabled = false;
        }, 2000);
    }
}

/**
 * Show loading state
 */
function showLoading() {
    loadingDiv.style.display = 'block';
    errorDiv.style.display = 'none';
    noProfileDiv.style.display = 'none';
    profileContentDiv.style.display = 'none';
}

/**
 * Hide loading state
 */
function hideLoading() {
    loadingDiv.style.display = 'none';
}

/**
 * Show error state
 */
function showError(message) {
    errorMessage.textContent = message;
    errorDiv.style.display = 'block';
    loadingDiv.style.display = 'none';
    noProfileDiv.style.display = 'none';
    profileContentDiv.style.display = 'none';
}

/**
 * Hide error state
 */
function hideError() {
    errorDiv.style.display = 'none';
}

/**
 * Show no profile state
 */
function showNoProfile() {
    noProfileDiv.style.display = 'block';
    loadingDiv.style.display = 'none';
    errorDiv.style.display = 'none';
    profileContentDiv.style.display = 'none';
}

/**
 * Hide no profile state
 */
function hideNoProfile() {
    noProfileDiv.style.display = 'none';
}

/**
 * Handle close button click
 */
function handleClose() {
    // Check for unsaved changes
    if (hasUnsavedChanges) {
        const confirmed = confirm(
            'You have unsaved changes that will be lost.\n\n' +
            'Are you sure you want to close without saving?'
        );
        if (!confirmed) {
            return;
        }
    }
    
    console.log('Closing profile management window...');
    if (window.electronAPI && window.electronAPI.closeWindow) {
        window.electronAPI.closeWindow();
    } else {
        // Fallback: close the window using standard method
        window.close();
    }
}

// =============================================================================
// EDIT MODE FUNCTIONALITY
// =============================================================================

/**
 * Enter edit mode
 */
function enterEditMode() {
    console.log('Entering edit mode...');
    isEditMode = true;
    
    // Update UI state
    editModeBtn.style.display = 'none';
    editModeActions.style.display = 'flex';
    normalModeActions.style.display = 'none';
    likesEditControls.style.display = 'block';
    dislikesEditControls.style.display = 'block';
    
    // Refresh the preferences display to show remove buttons
    updatePreferences(currentProfile);
}

/**
 * Exit edit mode
 */
function exitEditMode() {
    console.log('Exiting edit mode...');
    isEditMode = false;
    hasUnsavedChanges = false;
    
    // Update UI state
    editModeBtn.style.display = 'inline-flex';
    editModeActions.style.display = 'none';
    normalModeActions.style.display = 'flex';
    likesEditControls.style.display = 'none';
    dislikesEditControls.style.display = 'none';
    
    // Clear inputs
    addLikeInput.value = '';
    addDislikeInput.value = '';
    addLikeInput.classList.remove('error');
    addDislikeInput.classList.remove('error');
    
    // Refresh the preferences display to hide remove buttons
    updatePreferences(currentProfile);
}

/**
 * Cancel edit mode
 */
function cancelEdit() {
    console.log('Canceling edit mode...');
    
    // Restore original data
    if (currentProfile) {
        stagedChanges.likes = [...currentProfile.likes];
        stagedChanges.dislikes = [...currentProfile.dislikes];
    }
    
    exitEditMode();
}

/**
 * Save changes
 */
async function saveChanges() {
    console.log('Saving changes...');
    
    const originalText = saveChangesBtn.textContent;
    saveChangesBtn.textContent = '💾 Saving...';
    saveChangesBtn.disabled = true;
    
    try {
        const result = await window.electronAPI.updateProfileManual(
            stagedChanges.likes,
            stagedChanges.dislikes
        );
        
        if (result.success) {
            saveChangesBtn.textContent = '✅ Saved';
            
            // Update the current profile with saved changes
            currentProfile.likes = [...stagedChanges.likes];
            currentProfile.dislikes = [...stagedChanges.dislikes];
            currentProfile.changelog = 'User manually adjusted likes/dislikes';
            currentProfile.last_updated = new Date();
            
            // Exit edit mode
            setTimeout(() => {
                exitEditMode();
                saveChangesBtn.textContent = originalText;
                saveChangesBtn.disabled = false;
                
                // Refresh to get updated profile from server
                handleRefresh();
            }, 1500);
        } else {
            throw new Error(result.message || 'Failed to save changes');
        }
    } catch (error) {
        console.error('Error saving changes:', error);
        saveChangesBtn.textContent = '❌ Error';
        alert(`Failed to save changes: ${error.message}`);
        
        setTimeout(() => {
            saveChangesBtn.textContent = originalText;
            saveChangesBtn.disabled = false;
        }, 2000);
    }
}

/**
 * Add a new preference
 */
function addPreference(type) {
    const input = type === 'like' ? addLikeInput : addDislikeInput;
    const value = input.value.trim();
    
    // Validate input
    if (!validatePreferenceInput(value)) {
        input.classList.add('error');
        return;
    }
    
    // Check limit
    const currentArray = type === 'like' ? stagedChanges.likes : stagedChanges.dislikes;
    if (currentArray.length >= 15) {
        alert(`Maximum 15 ${type}s allowed.`);
        return;
    }
    
    // Add to staged changes
    currentArray.push(value);
    hasUnsavedChanges = true;
    
    // Clear input
    input.value = '';
    input.classList.remove('error');
    
    // Update display
    updatePreferences(currentProfile);
    
    console.log(`Added ${type}: "${value}"`);
}

/**
 * Remove a preference
 */
function removePreference(type, index) {
    const currentArray = type === 'like' ? stagedChanges.likes : stagedChanges.dislikes;
    const removed = currentArray.splice(index, 1)[0];
    hasUnsavedChanges = true;
    
    // Update display
    updatePreferences(currentProfile);
    
    console.log(`Removed ${type}: "${removed}"`);
}

/**
 * Validate preference input
 */
function validatePreferenceInput(value) {
    return value.length >= 5 && value.trim().length >= 5;
}

/**
 * Validate input field
 */
function validateInput(input) {
    const value = input.value.trim();
    if (value.length > 0 && !validatePreferenceInput(value)) {
        input.classList.add('error');
    } else {
        input.classList.remove('error');
    }
}

/**
 * Update count displays
 */
function updateCountDisplays() {
    const likes = isEditMode ? stagedChanges.likes : (currentProfile?.likes || []);
    const dislikes = isEditMode ? stagedChanges.dislikes : (currentProfile?.dislikes || []);
    
    likesCountDisplay.textContent = `${likes.length}/15`;
    dislikesCountDisplay.textContent = `${dislikes.length}/15`;
    
    // Update color based on limit
    likesCountDisplay.style.color = likes.length >= 15 ? 'var(--warning-color)' : '';
    dislikesCountDisplay.style.color = dislikes.length >= 15 ? 'var(--warning-color)' : '';
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeProfileManagement);
} else {
    initializeProfileManagement();
} 