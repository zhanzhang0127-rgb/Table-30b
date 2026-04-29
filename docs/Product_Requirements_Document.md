# Taicang Bites

# 1. Project Overview

Taicang Bites is a student-exclusive, AI-enhanced dining discovery platform 

designed for the XJTLU Entrepreneur College (Taicang) community. It 

addresses the "information vacuum" faced by students in the developing Taicang campus area, where fragmented data and biased commercial reviews often lead to significant decision fatigue. By leveraging a Verified Student Network, the platform ensures $1 0 0 \%$ peer-generated, authentic dining insights. 

# 2. Core Functional Modules

Based on instructor feedback, the platform focuses on three primary pillars to ensure a complete user experience cycle: 

<table><tr><td>Module</td><td>Description</td><td>Problem Solved</td></tr><tr><td>Food Sharing Community</td><td>A centralized hub for students to post &quot;no-filter&quot; reviews and &quot;hidden gem&quot; reports.</td><td>Replaces ephemeral, unorganized WeChat groups with a searchable, permanent database.</td></tr><tr><td>AI Recommendation</td><td>A natural language interface that synthesizes community feedback into instant, actionable meal suggestions.</td><td>Eliminates the need to browse fragmented or fake reviews for 10+ minutes.</td></tr><tr><td>Food Rankings</td><td>Dynamic leaderboards (e.g., &quot;Best for Coding,&quot; &quot;Budget Favorites&quot;) generated from verified student ratings.</td><td>Reduces the risk of &quot;landmine&quot; experiences for cautious spenders like &quot;Leo&quot;.</td></tr></table>

# 3. User Stories & Feature Breakdown

Identity & Trust (P0) 

User Story: As a student, I want to log in via my university credentials so that I can trust all reviews are genuine and free from commercial bias. 

Feature: Verified Student Network. A secure gateway requiring XJTLU email/ID for access. 

#  Intelligent Discovery (P0)

User Story: As a student with a specific study-and-eat need, I want to ask for a "quiet spot for coding with spicy food" so I don't have to scroll through irrelevant listings. 

Feature: AI Smart Assistant. An LLM-powered agent that understands complex campus-specific queries. 

# Curated Navigation (P1)

User Story: As a budget-conscious student, I want to see a ranked list of "Group Discount" spots so I can plan a dinner with my peers efficiently. 

Feature: Campus-Specific Tagging & Ranking. Filters for "Late Night Study," "Group Discounts," and "Coding Friendly". 

# Contribution & Engagement (P2)

User Story: As a frequent diner, I want to be rewarded for sharing highquality reviews to gain recognition and benefits from the Food Society. 

Feature: Incentivized Contribution System. A gamified points system linked with campus organizations. 

# 4. Technical Architecture

To facilitate rapid deployment via tools like Manus or Copilot agents, the following modern web stack is utilized: 

# Frontend (Web)

Framework: Next.js / React for a responsive, SEO-friendly web interface. 

UI Library: Tailwind CSS to ensure a clean, minimalist aesthetic preferred by 21-year-old university students. 

# Backend & AI

Server: Python (FastAPI) to handle high-concurrency requests and AI integrations. 

 AI Engine: OpenAI API (GPT-4o) for semantic search, review summarization, and natural language interaction. 

# Data Storage

Relational Database (PostgreSQL): To store structured data including encrypted user IDs, restaurant metadata, and official ratings. 

 Vector Database (Pinecone / pgvector): To store embeddings of student reviews, enabling the AI Assistant to perform high-accuracy semantic retrieval. 

Object Storage (AWS S3 / OSS): For hosting high-resolution images uploaded by students in the Sharing Community. 

Cache (Redis): For maintaining real-time "Food Rankings" and session management to ensure 45-second discovery goals. 

# 5. Success Metrics

The project’s effectiveness will be measured against the following benchmarks: 

Usability: $80 \%$ of test users successfully find a meal recommendation via the AI assistant in under 45 seconds. 

 Adoption: Achieve a Weekly Active User (WAU) growth rate of $1 0 \%$ during the initial month-long pilot. 

 Content Volume: Collect a minimum of 100 unique, verified student reviews within the first 14 days of launch. 