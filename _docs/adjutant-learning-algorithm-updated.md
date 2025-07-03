# The Adjutant Adaptive Learning Algorithm - Updated Implementation

The core of Adjutant's intelligence lies in its adaptive learning algorithm, a dual-process system designed to develop a deep, long-term understanding of the user's content preferences. The system is composed of two distinct but interconnected workflows: the **Preference Profile Generation Workflow (The "Learner")** and the **Adaptive Scoring Workflow (The "Scorer")**.

## System Architecture Overview

The learning algorithm operates in distinct phases:

1. **Initial Phase**: All articles are fetched and displayed unscored
2. **Training Phase**: User provides feedback to build training data
3. **Profile Generation**: Manual trigger creates initial user profile
4. **Adaptive Phase**: New articles are scored using the personalized profile
5. **Evolution Phase**: Profile is manually updated based on new feedback

## Data Model

### Profile Collection Structure
- **Collection**: `profiles` (Firebase Firestore)
- **Document ID**: Fixed ID `user-profile` (single-user system)
- **Schema**:
  ```typescript
  interface UserProfile {
    likes: string[];        // Max 15 items
    dislikes: string[];     // Max 15 items
    changelog: string;      // AI explanation of changes
    last_updated: Timestamp;
    created_at: Timestamp;
  }
  ```

### Article Data Enhancement
- Existing `ArticleData` interface enhanced with optimization fields
- Articles without profiles are stored with `ai_score: null`
- Articles with profile-based scoring get `ai_score: 1-10`
- New optimization fields prevent re-processing:
  ```typescript
  interface ArticleData {
    // ... existing fields ...
    topic_filtered?: boolean;     // True if filtered out by topic check
    topic_filtered_at?: Date;     // When topic filtering occurred
  }
  ```

## 1. The Preference Profile Generation Workflow (The "Learner")

### Trigger Conditions
- **Manual Trigger**: "Generate Profile" button in main window
- **Minimum Requirements**: At least 2 relevant AND 2 not-relevant rated articles
- **Availability**: Button only appears when minimum threshold is met

### Inputs
1. **Recent User Feedback**: Queries articles collection for all user-rated articles (`relevant: true/false`)
2. **AI Summaries**: Uses existing `ai_summary` field from rated articles
3. **Existing Profile**: Fetches current profile (if exists) for evolutionary updates

### Process (LangGraph Orchestrated)
1. **Data Collection**: Gather all rated articles with their AI summaries
2. **Profile Evolution**: 
   - If no existing profile: Create new profile from scratch
   - If existing profile: Evolve existing profile based on new feedback
3. **Feature Extraction**: LLM generates descriptive phrases for likes/dislikes
4. **Validation**: Ensure output is well-formed JSON with proper limits
5. **Persistence**: Save updated profile to `profiles` collection

### Error Handling
- **LLM Failure**: Display error message to user, no profile changes
- **Validation Failure**: Retry with corrected prompt
- **Network Issues**: Show error, allow manual retry
- **Profile Corruption**: Preserve existing profile, show error

### Output
- Updated `UserProfile` document in Firebase
- Success/failure notification to user
- Profile immediately available for Scorer workflow

## 2. The Adaptive Scoring Workflow (The "Scorer")

### Integration Point
- **Replaces**: Existing `analyze.ts` node entirely
- **Triggers**: Every time new articles are fetched
- **Dependency**: Requires existing profile in database

### Inputs
1. **New Article**: Full content from content scraper
2. **User Profile**: Latest profile from `profiles` collection
3. **Topic Settings**: Existing topic description for initial filtering

### Process (LangGraph Orchestrated)
1. **Profile Check**: Verify profile exists, skip scoring if not
2. **Topic Triage**: Quick relevance check against user's topic settings
3. **Profile-Based Analysis**: 
   - Send article content + full likes/dislikes to LLM
   - Generate personalized relevance score (1-10)
   - Create summary if needed
4. **Persistence**: Save article with profile-based score

### Error Handling
- **No Profile**: Store article with `ai_score: null` (unscored)
- **LLM Failure**: Store article with `ai_score: null`, continue processing
- **Network Issues**: Store article with `ai_score: null`
- **Invalid Response**: Retry once, then store unscored

### Output
- Articles with personalized `ai_score` values
- Unscored articles when profile unavailable or errors occur

## User Interface Integration

### Main Window Enhancements
- **Generate Profile Button**: 
  - Appears when minimum rating threshold met
  - Shows loading state during profile generation
  - Displays success/error messages
  - Disappears after successful profile creation

### New Profile Management Window
- **Access**: Via Settings menu → "Profile Settings"
- **Features**:
  - View current likes (up to 15)
  - View current dislikes (up to 15)
  - Edit existing entries (inline editing)
  - Remove entries (with confirmation)
  - Manually add new likes/dislikes
  - View profile changelog
  - "Update Profile" button (re-runs Learner workflow)

### Article Display
- **Unscored Articles**: Display without score badge
- **Scored Articles**: Display with existing score UI (1-10)
- **Error Articles**: Display without score, no error indication to user

## Workflow States and Transitions

### State 1: Initial State
- **Condition**: No profile exists
- **Article Display**: All articles unscored
- **UI**: "Generate Profile" button hidden
- **Scoring**: No scoring performed

### State 2: Training State
- **Condition**: User rating articles, minimum threshold not met
- **Article Display**: All articles unscored
- **UI**: "Generate Profile" button hidden
- **Scoring**: No scoring performed

### State 3: Ready for Profile Generation
- **Condition**: Minimum threshold met (2+ relevant, 2+ not-relevant)
- **Article Display**: All articles unscored
- **UI**: "Generate Profile" button visible
- **Scoring**: No scoring performed

### State 4: Profile Generation in Progress
- **Condition**: Learner workflow running
- **Article Display**: All articles unscored
- **UI**: "Generate Profile" button shows loading state
- **Scoring**: No scoring performed

### State 5: Adaptive State
- **Condition**: Profile exists and is valid
- **Article Display**: New articles scored, old articles remain unscored
- **UI**: "Generate Profile" button hidden, profile management available
- **Scoring**: All new articles scored with profile

## Testing and Validation Strategy

### Phase 1: Initial Training
1. Start with clean database
2. Fetch initial articles (all unscored)
3. User rates articles to build training data
4. Generate initial profile
5. Validate profile structure and content

### Phase 2: Scoring Validation
1. Clear articles from database
2. Re-fetch articles with profile active
3. Verify all new articles receive scores
4. Validate score quality and personalization

### Phase 3: Profile Evolution
1. User rates newly scored articles
2. Trigger profile update
3. Verify profile evolution maintains consistency
4. Test with cleared database and re-fetch

## Technical Implementation Details

### LangGraph Workflow Structure
```
Learner Workflow:
[Start] → [Collect Ratings] → [Load Profile] → [Generate/Update] → [Validate] → [Save] → [End]
                                                      ↓
                                               [Retry on Failure]

Scorer Workflow:
[Start] → [Load Profile] → [Topic Check] → [Score Article] → [Save] → [End]
             ↓                                    ↓
      [Skip if None]                    [Save Unscored on Failure]
```

### Error Recovery Mechanisms
- **Graceful Degradation**: System continues functioning without profiles
- **Retry Logic**: Automatic retries for transient failures
- **User Feedback**: Clear error messages with actionable guidance
- **Data Integrity**: Profile corruption prevention and recovery

### Performance Considerations
- **Profile Caching**: Cache profile in memory during article processing
- **Batch Processing**: Process multiple articles efficiently
- **Rate Limiting**: Respect OpenAI API limits
- **Database Optimization**: Efficient queries for rated articles

## Benefits of This Implementation

### User Experience
- **Gradual Learning**: System improves over time without overwhelming users
- **Transparency**: Users can see and control their preference profile
- **Flexibility**: Manual control over when learning occurs
- **Reliability**: Graceful handling of failures and edge cases

### Technical Advantages
- **Scalable**: Clean separation of concerns between workflows
- **Maintainable**: Clear state management and error handling
- **Testable**: Well-defined phases enable comprehensive testing
- **Extensible**: Architecture supports future enhancements

### Intelligence Features
- **Deep Understanding**: Natural language processing of content preferences
- **Long-term Memory**: Evolutionary profile updates maintain consistency
- **Personalization**: Truly adaptive content curation
- **Resilience**: Robust error handling ensures continuous operation

This implementation creates a sophisticated, user-controlled learning system that evolves with user preferences while maintaining reliability and transparency. 