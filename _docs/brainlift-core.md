# Adjutant Project Documentation

## Overview

Adjutant is an intelligent desktop application designed to manage and summarize news on AI and technology. The application serves as an intelligent assistant that sorts through information and presents the most important intelligence, tackling the common problem of information overload in the rapidly evolving AI and technology landscape.

## Project Architecture

### Technology Stack

- **Application Framework**: Electron (leveraging existing web development experience)
- **Language**: TypeScript (strong typing and ease of deployment within Electron ecosystem)
- **Database**: Firebase Firestore (real-time capabilities and simple JavaScript/TypeScript integration)
- **AI Model**: OpenAI API (users provide their own API keys via application settings)

## Development Phases

### Phase 1: Project Inception and Core Strategy

The project began with the goal of building a tool to manage and summarize AI and technology news. The application was named "Adjutant" to reflect its role as an intelligent assistant for information management.

Key decisions made during this phase:
- Chose Electron over native desktop development to leverage web development expertise
- Selected TypeScript over Python to avoid distribution complexities
- Established Firebase Firestore for real-time data capabilities
- Planned OpenAI API integration with user-provided API keys

### Phase 2: Data Ingestion and Processing Pipeline

A robust data ingestion pipeline was designed to gather content from multiple sources:

#### Data Sources
- **Nitter instances**: For real-time social media content (pivoted from X.com due to API restrictions)
- **RSS feeds**: High-quality, developer-focused sources including:
  - Hugging Face Blog
  - Towards Data Science
  - Ars Technica
  - Reddit (r/MachineLearning)
  - Company blogs (OpenAI, Google DeepMind)

#### Content Storage Strategy
- Store full text content of every article (not just links)
- Enable comprehensive AI analysis of all content

#### Triage Pipeline
1. **Initial Analysis**: Fast, low-cost AI model determines if content is broadly on-topic
2. **Filtering**: Off-topic content is logged and discarded
3. **Advanced Processing**: On-topic content proceeds to complex analysis stages

### Phase 3: The Adaptive Learning Algorithm

The core feature of Adjutant is its sophisticated dual-workflow system that creates a personalized filter that improves over time.

#### 1. The "Learner" Workflow (`learning_workflow.ts`)

**Purpose**: Background process that learns user preferences

**Process**:
- Runs periodically (daily)
- Fetches summaries of recently marked articles ("relevant" or "not relevant")
- Retrieves existing user profile for continuous learning
- Uses LLM prompt to analyze feedback and generate "Feature-Based User Profile"
- Outputs JSON object with descriptive phrases for likes and dislikes
- Orchestrated by LangGraph for resilience and automatic retries

**Example Profile Elements**:
- **Likes**: "Technical tutorials about specific libraries"
- **Dislikes**: "Opinion pieces about market trends"

#### 2. The "Scorer" Workflow (`workflow.ts`)

**Purpose**: Real-time article scoring based on learned preferences

**Process**:
- Runs frequently as new articles are fetched
- Processes articles that pass initial triage
- Fetches latest Feature-Based User Profile
- Augments scoring prompt with user's likes and dislikes
- Generates personalized `ai_score` for article ranking

### Phase 4: Incremental Development and Final Polish

The development was structured around a 4-day timeline with clear milestones:

#### Initial Prototype (Tuesday Deadline)
**Core Components**:
- `main.ts`: Main Electron process
- `renderer.ts`: UI rendering logic
- `workflow.ts`: Basic article processing
- `index.html`: Application interface

**Features**:
- Basic, non-adaptive workflow
- Real-time article fetching, scoring, and display
- Functional UI for article consumption

#### Final Features (Thursday Deadline)
**Advanced Components**:
- `learning_workflow.ts`: Adaptive learning system
- User profile integration in main workflow
- Enhanced UI features

**Polish Features**:
- Visual distinction between read/unread articles
- Status indicator for background tasks
- Robust error handling and workflow management
- Comprehensive documentation

## Key Features

### Intelligent Content Curation
- Multi-source content aggregation
- AI-powered relevance filtering
- Personalized content scoring

### Adaptive Learning
- User feedback integration
- Evolving preference profiles
- Continuous improvement of content relevance

### Desktop-First Design
- Persistent background processes
- Real-time content updates
- Offline-capable architecture

### User Control
- Personal API key management
- Feedback-driven learning
- Customizable content sources

## Technical Implementation

### Core Files Structure
```
adjutant/
├── main.ts              # Main Electron process
├── renderer.ts          # UI rendering and interaction
├── workflow.ts          # Article processing and scoring
├── learning_workflow.ts # Adaptive learning system
├── index.html          # Application interface
└── package.json        # Dependencies and configuration
```

### Workflow Architecture
1. **Content Ingestion**: RSS feeds and social media scraping
2. **Initial Triage**: Fast AI-based topic filtering
3. **Detailed Analysis**: Comprehensive content processing
4. **Personalized Scoring**: User profile-based ranking
5. **Continuous Learning**: Feedback-driven profile updates

## Project Goals Achievement

Adjutant successfully addresses the original project requirements:
- **Personal Productivity**: Solves information overload problem
- **Desktop Advantage**: Leverages persistent background processes
- **Intelligent Assistant**: Provides sophisticated content curation
- **Adaptive Technology**: Learns and improves over time

## Future Considerations

The modular architecture allows for future enhancements:
- Additional content sources
- Enhanced AI models
- Expanded user customization options
- Cross-platform deployment optimization