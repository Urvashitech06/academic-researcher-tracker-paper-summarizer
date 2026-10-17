# Scholar's Home — AI-Powered Academic Research Tracker & Paper Summarizer

[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0-lightgrey.svg)](https://palletsprojects.com/p/flask/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791.svg)](https://www.postgresql.org/)
[![Google Gemini](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-4285F4.svg)](https://ai.google.dev/)
[![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://www.docker.com/)

A production-ready, full-stack research workspace engineered for academic rigor and high-density technical utility. **Scholar's Home** ingests academic research PDFs, extracts textual content via `pypdf`, synthesizes structured executive summaries and domain taxonomies using **Google Gemini 2.5 Flash**, and indexes the data into a **PostgreSQL 15** database structured in **3rd Normal Form (3NF)** with raw, parameterized SQL transactions.

---

## Architecture Overview

```
                                  +---------------------------------------+
                                  |     Scholar's Home Frontend (SPA)     |
                                  |   (Vanilla ES6+, Fetch, localStorage) |
                                  +-------------------+-------------------+
                                                      |
                                             REST API | (Multipart / JSON)
                                                      v
                                  +---------------------------------------+
                                  |       Flask Backend (Python 3.11)     |
                                  |   (app.py - Raw psycopg2 SQL Engine)  |
                                  +---------+-------------------+---------+
                                            |                   |
                     Binary Stream Parsing  |                   | GenAI Synthesis
                                            v                   v
                               +----------------+   +-----------------------+
                               |     pypdf      |   | Google Gemini 2.5     |
                               | Text Extractor |   | Structured JSON Schema|
                               +----------------+   +-----------------------+
                                            |                   |
                                            +---------+---------+
                                                      |
                                                      | Atomic Transactions
                                                      | (Commit / Rollback)
                                                      v
                                  +---------------------------------------+
                                  |    PostgreSQL 15 Database (3NF)       |
                                  |  - users                              |
                                  |  - papers                             |
                                  |  - tags                               |
                                  |  - paper_tags (Many-to-Many Junction) |
                                  +---------------------------------------+
```

---

## 3rd Normal Form (3NF) Relational Database Schema

The database design strictly enforces **3rd Normal Form (3NF)** to eliminate data redundancy and preserve update/deletion anomalies:

```
[ users ] (1) <------- (N) [ papers ] (1) <------- (N) [ paper_tags ] (N) -------> (1) [ tags ]
  user_id (PK)               paper_id (PK)               paper_id (PK, FK)              tag_id (PK)
  email (UNIQUE)             user_id (FK)                tag_id (PK, FK)                tag_name (UNIQUE)
  created_at                 title
                             summary
                             abstract_raw
                             file_path
                             uploaded_at
```

### Table Specifications & Constraints:

1. **`users`**:
   - `user_id SERIAL PRIMARY KEY`: Unique surrogate identifier.
   - `email VARCHAR(255) UNIQUE NOT NULL`: Unique academic researcher email.
   - `password_hash VARCHAR(255)`: Secure PBKDF2/scrypt one-way cryptographic hash.
   - `full_name VARCHAR(150)`: Scholar's academic display name.
   - `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`.

2. **`papers`**:
   - `paper_id SERIAL PRIMARY KEY`: Unique paper identifier.
   - `user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE`: Foreign key strictly enforcing multi-tenant data ownership and isolation.
   - `title VARCHAR(500) NOT NULL`: Formal paper title.
   - `summary TEXT`: AI-synthesized executive summary.
   - `abstract_raw TEXT`: Raw manuscript extract.
   - `file_path VARCHAR(500)`: Disk relative path to original binary PDF.
   - `uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`.

3. **`tags`**:
   - `tag_id SERIAL PRIMARY KEY`: Unique tag identifier.
   - `tag_name VARCHAR(100) UNIQUE NOT NULL`: Atomic taxonomy domain tag (e.g. `"Transformers"`, `"Reinforcement Learning"`).

4. **`paper_tags`** (Junction Table):
   - `paper_id INTEGER NOT NULL REFERENCES papers(paper_id) ON DELETE CASCADE`.
   - `tag_id INTEGER NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE`.
   - `PRIMARY KEY (paper_id, tag_id)`: Composite primary key resolving Many-to-Many association.

---

## Security & Authentication Architecture

- **Session-Based Authentication & Route Guard**:
  - Flask session cookies signed with server-side secret key.
  - `@login_required` decorator guards all dashboard routes (`/`, `/analyzer`, `/matrix`, `/graph`) and API endpoints (`/api/upload-pdf`, `/api/papers`, `/api/papers/<id>`).
  - Unauthenticated visitors are automatically redirected to the Welcome & Login page (`/welcome`).
- **Strict Multi-Tenant Isolation**:
  - Every paper is tied to `session['user_id']`.
  - Queries (`GET /api/papers`) strictly filter by `WHERE p.user_id = %s`.
  - Deletions (`DELETE /api/papers/<id>`) enforce `WHERE paper_id = %s AND user_id = %s`, preventing any user from viewing or altering another researcher's vault.
- **Parameterized SQL Execution**:
  - Every query exclusively uses `%s` placeholders with `psycopg2-binary`. Direct string formatting (`f"..."`, `+`, `%`) is strictly forbidden to guarantee 100% SQL injection prevention.
- **Atomic Multi-Table Transactions**:
  - Multi-table operations (`papers`, `tags`, `paper_tags`) are bound within explicit `try...except` transaction blocks (`conn.commit()` on success, `conn.rollback()` on error).

---

## Project Structure

```
.
├── app.py                   # Flask backend with auth, raw parameterized SQL & Gemini API
├── requirements.txt         # Core Python dependencies
├── schema.sql               # 3NF PostgreSQL DDL setup script with auth migrations
├── test_db.py               # Standalone 4-part DB QA & isolation verification test suite
├── Dockerfile               # Production container definition for Flask
├── docker-compose.yml       # Multi-container orchestration (Flask + PostgreSQL 15)
├── .env.example             # Environment configuration template
├── static/
│   ├── css/
│   │   └── style.css        # Editorial academic design system (Stitch Scholar's Home)
│   └── js/
│       ├── app.js           # Vanilla JS SPA controller (Fetch API, DOM, localStorage)
│       └── scholar_auth.js  # Client auth state manager, live paper vault renderer & logout
├── templates/
│   ├── welcome.html         # Welcome, Sign In & Sign Up portal with live validation
│   ├── index.html           # Stitch Screen 1 (Research Feed & Vault)
│   ├── screen1.html         # Screen 1 template
│   ├── screen2.html         # Screen 2 (Cross-Paper Synthesis Matrix)
│   ├── screen3.html         # Screen 3 (Citation Graph & Influence Map)
│   └── screen4.html         # Screen 4 (Paper Deep-Dive Analyzer & AI Chat)
└── uploads/                 # Storage directory for uploaded PDF binaries
```

---

## Quick Start Guide

### Option A: Running with Docker Compose (Recommended)

1. **Clone and configure environment**:
   ```bash
   cp .env.example .env
   ```
   Add your Google Gemini API key to `.env`:
   ```ini
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

2. **Launch all services**:
   ```bash
   docker compose up --build
   ```

3. **Access the application**:
   - Open your browser at: **`http://localhost:5000`**
   - The PostgreSQL 15 database is exposed on port `5432` and automatically initialized with `schema.sql`.

---

### Option B: Local Development Setup (Without Docker)

1. **Prerequisites**:
   - Python 3.11+
   - PostgreSQL 15 running locally

2. **Create Python virtual environment**:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Initialize Database**:
   ```bash
   psql -U postgres -d postgres -c "CREATE DATABASE scholarshome_db;"
   psql -U postgres -d scholarshome_db -f schema.sql
   ```

5. **Configure environment**:
   Create `.env`:
   ```ini
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=scholarshome_db
   DB_USER=postgres
   DB_PASSWORD=postgres
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   PORT=5000
   ```

6. **Start the Flask server**:
   ```bash
   python app.py
   ```
   Open **`http://localhost:5000`** in your browser.

---

## Quality Assurance & Verification (`test_db.py`)

A standalone test suite is provided to verify database connectivity, relational integrity, and the transaction auto-rollback behavior:

```bash
python test_db.py
```

### Verification Checks Performed:
1. **Connection & Schema Verification**: Confirms PostgreSQL connectivity and checks that all required 3NF tables (`users`, `papers`, `tags`, `paper_tags`) exist.
2. **Auto-Rollback Verification**: Inserts a canary record within an uncommitted transaction, intentionally triggers a fatal database exception (simulating foreign key/syntax error), invokes `conn.rollback()`, and verifies with an isolated query that the canary record was **never** persisted.
3. **3NF Many-to-Many Linking & Cascading Delete**: Inserts a test paper, upserts test tags, links them in `paper_tags`, tests retrieval, and asserts that deleting the paper cascades cleanly without leaving orphaned records.

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves the Single Page Application dashboard |
| `GET` | `/health` | Server and PostgreSQL connectivity health check |
| `POST` | `/api/upload-pdf` | Upload multipart PDF binary, extract text with `pypdf`, synthesize with Gemini 2.5 Flash, and persist to PostgreSQL in atomic transaction |
| `GET` | `/api/papers` | Retrieve all indexed papers with aggregated taxonomy tags |
| `DELETE` | `/api/papers/<paper_id>` | Delete paper, cascading dependent `paper_tags` and deleting binary PDF from disk |
| `GET` | `/uploads/<filename>` | Serve original PDF binary for in-browser inspection |

---

## Frontend Features & Stitch Design System

- **Editorial Reading Aesthetic**:
  - Headings & summaries set in **Newsreader** (Google Fonts serif).
  - Operational controls & metrics set in **Inter**.
  - DOIs, tags, and IDs set in **JetBrains Mono**.
- **Dual View Modes**:
  - **Cards View**: Editorial paper cards with executive summaries, metadata, and interactive tag chips.
  - **Matrix View**: Tabular comparison matrix for rapid literature synthesis across multiple papers.
- **Live Upload Stepper**: Visual feedback during upload (`pypdf` extraction → Gemini synthesis → PostgreSQL transaction).
- **Paper Deep-Dive Drawer**: Full-screen modal inspector displaying full AI summaries, taxonomy tags, raw extracted manuscript excerpts, and links to original PDF.
- **Lightweight State Persistence**: Uses `localStorage` to preserve active view mode, search queries, and selected tag filters across reloads.
