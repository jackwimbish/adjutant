Project Overview: Adjutant

**Adjutant** is a desktop productivity application designed to create a personalized and intelligent news feed. It automates the process of gathering and analyzing information from various online sources, presenting the user with a prioritized and summarized view of content relevant to their interests, with an initial focus on AI and technology news.

Core Features

* **Automated Content Aggregation**: The application automatically fetches articles from a configurable list of sources, including RSS feeds and Nitter pages.
* **AI-Powered Analysis**: Each article's content is processed by an AI model (OpenAI) to generate a concise summary, assign a relevance score, and determine its category.
* **Intelligent Ranking**: Articles are presented to the user in a ranked list based on their AI-generated score, ensuring the most relevant content is seen first.
* **Adaptive Filtering**: The system is designed to learn from user interactions (e.g., hiding articles) to refine its filtering criteria over time.
* **Local-First Architecture**: The core workflow runs locally on the user's machine, ensuring privacy and performance.

Technology Stack

* **Application Framework**: Electron
* **Language**: TypeScript
* **AI Workflow**: LangGraph
* **AI Model**: OpenAI API
* **Database**: Firebase Firestore
* **Frontend**: HTML/CSS
* **Core Libraries**: Node.js, `child_process`