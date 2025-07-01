**Core Data Model**

We'll primarily use two main collections: `sources` and `articles`.

1. `sources` Collection

This collection will store the list of data sources your workflow needs to check. This is better than hardcoding them in your script because it allows you to potentially add or remove sources from the app's UI later.

A document in the `sources` collection would look like this:

JSON

```
{
  "id": "huggingface_blog_rss",
  "name": "Hugging Face Blog",
  "type": "RSS",
  "url": "https://huggingface.co/blog/feed.xml",
  "source_weight": 1.0
}
```

2. `articles` Collection

This will be the main collection in your database. Each document represents a single article that has been fetched and processed. The **Document ID** should be a unique hash of the article's URL to prevent duplicates.

Here is the structure for a document in the `articles` collection:

JSON

```
{
  // --- Core Content & Identity ---
  "url": "https://example.com/blog/new-ai-model",
  "title": "A New AI Model That Changes Everything",
  "author": "Jane Doe",
  "full_content_text": "The full, cleaned text of the article goes here...",
  "source_name": "Example Tech Blog", // From the 'sources' collection
  "published_at": "2025-07-02T10:00:00Z", // Original publication time
  "fetched_at": "2025-07-02T12:30:00Z",   // When our workflow fetched it

  // --- AI-Generated Analysis ---
  "ai_summary": "This article introduces a new AI model with breakthrough performance.",
  "ai_score": 9.2, // The 1-10 relevance score from the LLM
  "ai_category": "New Model", // 'New Tool', 'Tutorial', 'Research', etc.

  // --- User Interaction & State ---
  "is_read": false, // Set to true when the user reads it
  "is_hidden": false, // Set to true if user clicks "not interested"
  "is_favorite": false // For a potential "favorites" feature
}
```

**Data Flow Diagram**

This simple diagram illustrates how the data flows between the components we've designed:

Code snippet

```
graph TD
    A[sources Collection] --> B(Node.js/LangGraph Workflow);
    B -->|Fetches & Processes| C(articles Collection);
    C -->|Reads/Updates| D[Electron UI];
    D -->|User Interaction| C;
```

This data model provides a solid foundation. It's robust enough to support your initial build and flexible enough to accommodate future enhancements like more complex adaptive filtering or user-specific settings.