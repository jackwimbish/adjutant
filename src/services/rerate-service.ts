import { UserConfig } from '../config/user-config';
import { ArticleData } from '../types/index';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

interface RerateResult {
  success: boolean;
  message: string;
  processed: number;
}

interface RerateProgress {
  current: number;
  total: number;
}

/**
 * Re-rate all non-topic-filtered articles using the current user profile
 */
export async function rerateArticles(
  userConfig: UserConfig,
  onProgress?: (progress: RerateProgress) => void
): Promise<RerateResult> {
  try {
    console.log('🔄 Starting rerate articles workflow...');
    
    // Initialize Firebase app with unique name
    const appName = `rerate-articles-${Date.now()}`;
    const app = initializeApp(userConfig.firebase, appName);
    const db = getFirestore(app);
    
    // Query for all articles that are not topic-filtered
    console.log('📊 Querying eligible articles...');
    const articlesRef = collection(db, 'articles');
    
    // Get all articles where topic_filtered is not true (includes null/undefined)
    const q = query(articlesRef, where('topic_filtered', '!=', true));
    const querySnapshot = await getDocs(q);
    
    const articles = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as (ArticleData & { id: string })[];
    
    console.log(`📊 Found ${articles.length} eligible articles to rerate`);
    
    if (articles.length === 0) {
      return {
        success: true,
        message: 'No articles found to rerate',
        processed: 0
      };
    }
    
    // Import and initialize the adaptive scorer workflow
    const { initializeAdaptiveScorerWorkflow, runAdaptiveScorerWorkflow } = await import('../workflows/adaptive-scorer-workflow');
    
    // Initialize the workflow with user config
    initializeAdaptiveScorerWorkflow(userConfig);
    
    let processed = 0;
    
    // Process each article through the adaptive scorer workflow
    for (const article of articles) {
      try {
        console.log(`🔄 Re-rating article ${processed + 1}/${articles.length}: ${article.title}`);
        
        // Call progress callback if provided
        if (onProgress) {
          onProgress({ current: processed + 1, total: articles.length });
        }
        
        // Run the article through the adaptive scorer workflow
        const result = await runAdaptiveScorerWorkflow(
          article,
          userConfig.appSettings.topicDescription,
          userConfig
        );
        
        // Update the article with the new scores
        const articleRef = doc(db, 'articles', article.id);
        const updateData: any = {};
        
        if (result.ai_score !== undefined) {
          updateData.ai_score = result.ai_score;
        }
        
        if (result.topic_filtered !== undefined) {
          updateData.topic_filtered = result.topic_filtered;
        }
        
        // Only update if we have data to update
        if (Object.keys(updateData).length > 0) {
          await updateDoc(articleRef, updateData);
          console.log(`✅ Updated article ${article.id} with ai_score: ${result.ai_score}, topic_filtered: ${result.topic_filtered}`);
        }
        
        processed++;
        
      } catch (error) {
        console.error(`❌ Error processing article ${article.id}:`, error);
        // Continue processing other articles even if one fails
        processed++;
      }
    }
    
    console.log(`✅ Rerate articles completed: ${processed} articles processed`);
    
    return {
      success: true,
      message: `Successfully re-rated ${processed} articles`,
      processed
    };
    
  } catch (error) {
    console.error('❌ Error in rerate articles workflow:', error);
    return {
      success: false,
      message: `Rerate articles failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      processed: 0
    };
  }
} 