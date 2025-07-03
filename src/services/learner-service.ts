import { UserConfig } from '../config/user-config';

// Types for learner service responses
export interface ThresholdCheckResult {
  thresholdMet: boolean;
  relevantCount: number;
  notRelevantCount: number;
  message: string;
}

export interface ProfileGenerationResult {
  success: boolean;
  message: string;
  profile?: {
    likesCount: number;
    dislikesCount: number;
    lastUpdated: any;
  };
}

export interface ProfileLoadResult {
  success: boolean;
  message: string;
  profile?: any;
}

export interface ProfileDeleteResult {
  success: boolean;
  message: string;
}

export interface ProfileUpdateResult {
  success: boolean;
  message: string;
  profile?: any;
}

/**
 * Service class for managing user learning profiles and related operations
 */
export class LearnerService {
  private config: UserConfig;

  constructor(config: UserConfig) {
    this.config = config;
  }

  /**
   * Check if the user has enough article ratings to generate a profile
   */
  async checkThreshold(): Promise<ThresholdCheckResult> {
    try {
      console.log('📊 Checking learner threshold...');
      
      // Import Firebase modules
      const { initializeApp } = await import('firebase/app');
      const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
      
      // Initialize Firebase app for threshold checking
      const app = initializeApp(this.config.firebase, 'threshold-check-app');
      const db = getFirestore(app);
      
      // Query for relevant and not relevant articles
      const articlesRef = collection(db, 'articles');
      const relevantQuery = query(articlesRef, where('relevant', '==', true));
      const notRelevantQuery = query(articlesRef, where('relevant', '==', false));
      
      const [relevantSnap, notRelevantSnap] = await Promise.all([
        getDocs(relevantQuery),
        getDocs(notRelevantQuery)
      ]);
      
      const relevantCount = relevantSnap.size;
      const notRelevantCount = notRelevantSnap.size;
      const thresholdMet = relevantCount >= 2 && notRelevantCount >= 2;
      
      console.log(`📊 Threshold check: ${relevantCount} relevant, ${notRelevantCount} not relevant`);
      
      return {
        thresholdMet,
        relevantCount,
        notRelevantCount,
        message: thresholdMet 
          ? 'Ready to generate profile' 
          : `Need ${Math.max(0, 2 - relevantCount)} more relevant and ${Math.max(0, 2 - notRelevantCount)} more not relevant ratings`
      };
      
    } catch (error) {
      console.error('❌ Error checking threshold:', error);
      return { 
        thresholdMet: false, 
        message: `Error checking rating threshold: ${error instanceof Error ? error.message : 'Unknown error'}`,
        relevantCount: 0,
        notRelevantCount: 0
      };
    }
  }

  /**
   * Generate a new user profile using the learner workflow
   */
  async generateProfile(): Promise<ProfileGenerationResult> {
    try {
      console.log('🧠 Starting learner workflow for profile generation...');
      
      // Import and run the learner workflow
      const { runLearnerWorkflow } = await import('../workflows/learner-workflow');
      const result = await runLearnerWorkflow(this.config);
      
      // Check if profile was successfully generated
      if ((result as any).generatedProfile) {
        const profile = (result as any).generatedProfile;
        console.log('✅ Profile generated successfully');
        return { 
          success: true, 
          message: 'Profile generated successfully',
          profile: {
            likesCount: profile.likes.length,
            dislikesCount: profile.dislikes.length,
            lastUpdated: profile.last_updated
          }
        };
      } else if ((result as any).validationPassed === false) {
        console.log('❌ Profile generation failed - insufficient training data');
        return { 
          success: false, 
          message: 'Need at least 2 relevant and 2 not relevant ratings to generate profile'
        };
      } else {
        console.log('❌ Profile generation failed after retries');
        return { 
          success: false, 
          message: 'Profile generation failed after multiple attempts'
        };
      }
      
    } catch (error) {
      console.error('❌ Error in learner workflow:', error);
      return { 
        success: false, 
        message: `Profile generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Load the user's existing profile from Firebase
   */
  async getProfile(): Promise<ProfileLoadResult> {
    try {
      console.log('👤 Loading user profile...');
      
      // Import Firebase modules
      const { initializeApp } = await import('firebase/app');
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');
      
      // Initialize Firebase app for profile loading with unique name
      const appName = `profile-load-${Date.now()}`;
      const app = initializeApp(this.config.firebase, appName);
      const db = getFirestore(app);
      
      // Load profile document
      const profileRef = doc(db, 'profiles', 'user-profile');
      console.log('📄 Attempting to load profile document...');
      const profileDoc = await getDoc(profileRef);
      
      if (profileDoc.exists()) {
        const profileData = profileDoc.data();
        console.log('✅ Profile loaded:', profileData.likes?.length || 0, 'likes,', profileData.dislikes?.length || 0, 'dislikes');
        console.log('📊 Profile data structure:', JSON.stringify(profileData, null, 2));
        
        // Return profile with proper field mapping (keep snake_case as is)
        const profile = {
          id: profileDoc.id,
          likes: profileData.likes || [],
          dislikes: profileData.dislikes || [],
          changelog: profileData.changelog || '',
          last_updated: profileData.last_updated,
          created_at: profileData.created_at,
          version: profileData.version || 1,
          articlesAnalyzed: profileData.articlesAnalyzed || 0
        };
        
        console.log('📤 Returning profile result:', JSON.stringify({ success: true, profile }, null, 2));
        
        return {
          success: true,
          message: 'Profile loaded successfully',
          profile
        };
      } else {
        console.log('ℹ️ No profile found');
        return {
          success: false,
          message: 'No profile found'
        };
      }
      
    } catch (error) {
      console.error('❌ Error loading profile:', error);
      return {
        success: false,
        message: `Error loading profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Delete the user's profile from Firebase
   */
  async deleteProfile(): Promise<ProfileDeleteResult> {
    try {
      console.log('🗑️ Deleting user profile...');
      
      // Import Firebase modules
      const { initializeApp } = await import('firebase/app');
      const { getFirestore, doc, deleteDoc, getDoc } = await import('firebase/firestore');
      
      // Initialize Firebase app for profile deletion
      const app = initializeApp(this.config.firebase, 'profile-delete-app');
      const db = getFirestore(app);
      
      // Check if profile exists
      const profileRef = doc(db, 'profiles', 'user-profile');
      const profileDoc = await getDoc(profileRef);
      
      if (profileDoc.exists()) {
        // Delete the profile document
        await deleteDoc(profileRef);
        console.log('✅ Profile deleted successfully');
        
        return {
          success: true,
          message: 'Profile deleted successfully'
        };
      } else {
        console.log('ℹ️ No profile found to delete');
        return {
          success: false,
          message: 'No profile found to delete'
        };
      }
      
    } catch (error) {
      console.error('❌ Error deleting profile:', error);
      return {
        success: false,
        message: `Error deleting profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Manually update the user's profile with new likes and dislikes
   */
  async updateProfileManual(likes: string[], dislikes: string[]): Promise<ProfileUpdateResult> {
    try {
      // Input validation
      if (!Array.isArray(likes) || !Array.isArray(dislikes)) {
        return { success: false, message: 'Invalid input: likes and dislikes must be arrays' };
      }
      
      if (likes.length > 15 || dislikes.length > 15) {
        return { success: false, message: 'Maximum 15 likes and 15 dislikes allowed' };
      }
      
      // Validate each preference
      const validatePreference = (pref: string): boolean => {
        if (typeof pref !== 'string') return false;
        const trimmed = pref.trim();
        return trimmed.length >= 5 && trimmed.length > 0;
      };
      
      const invalidLikes = likes.filter(like => !validatePreference(like));
      const invalidDislikes = dislikes.filter(dislike => !validatePreference(dislike));
      
      if (invalidLikes.length > 0 || invalidDislikes.length > 0) {
        return { 
          success: false, 
          message: 'All preferences must be at least 5 characters long and not empty' 
        };
      }
      
      console.log('📝 Updating user profile manually...');
      console.log(`   Likes: ${likes.length}, Dislikes: ${dislikes.length}`);
      
      // Import Firebase modules
      const { initializeApp } = await import('firebase/app');
      const { getFirestore, doc, updateDoc, getDoc } = await import('firebase/firestore');
      
      // Initialize Firebase app for profile update
      const appName = `profile-update-${Date.now()}`;
      const app = initializeApp(this.config.firebase, appName);
      const db = getFirestore(app);
      
      // Check if profile exists
      const profileRef = doc(db, 'profiles', 'user-profile');
      const profileDoc = await getDoc(profileRef);
      
      if (!profileDoc.exists()) {
        return {
          success: false,
          message: 'No profile found to update. Please generate a profile first.'
        };
      }
      
      // Update the profile with new preferences and timestamp
      const updateData = {
        likes: likes.map(like => like.trim()),
        dislikes: dislikes.map(dislike => dislike.trim()),
        last_updated: new Date(),
        changelog: 'Profile manually updated by user'
      };
      
      await updateDoc(profileRef, updateData);
      console.log('✅ Profile updated successfully');
      
      // Load and return the updated profile
      const updatedDoc = await getDoc(profileRef);
      const updatedData = updatedDoc.data();
      
      return {
        success: true,
        message: 'Profile updated successfully',
        profile: {
          id: updatedDoc.id,
          likes: updatedData?.likes || [],
          dislikes: updatedData?.dislikes || [],
          changelog: updatedData?.changelog || '',
          last_updated: updatedData?.last_updated,
          created_at: updatedData?.created_at,
          version: updatedData?.version || 1,
          articlesAnalyzed: updatedData?.articlesAnalyzed || 0
        }
      };
      
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      return {
        success: false,
        message: `Error updating profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
} 