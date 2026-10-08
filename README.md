# 🎯 AI Mock Interview Coach

A full-stack, production-ready AI Mock Interview Coach designed for software engineering and technical role preparation. Built with **React 19 + Vite**, **Flask / Python 3**, **PostgreSQL**, **psycopg**, **TF-IDF RAG**, **Web Speech API**, and **Hugging Face LLMs**.

---

## 🌟 Architecture & Phases

```
┌────────────────────────────────────────────────────────┐
│                   React + Vite SPA                     │
│  - Resume Upload & Management   - Voice STT & TTS      │
│  - Adaptive Difficulty Badges   - Analytics Dashboard  │
│  - Real-time AI Feedback        - Question Stepper     │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / JWT Auth (VITE_API_URL)
┌──────────────────────────▼─────────────────────────────┐
│                 Flask REST API Backend                 │
│  - Auth & JWT Middleware        - Gunicorn WSGI        │
│  - PDF Resume Extraction        - Adaptive Engine      │
│  - Analytics & History Service  - CORS Security        │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
┌──────────────▼─────────────┐ ┌──────────▼──────────────┐
│    PostgreSQL Database     │ │   Hugging Face & RAG    │
│  - Users, Resumes          │ │  - TF-IDF Knowledge Base│
│  - Interviews, Questions   │ │  - Cosine Similarity    │
│  - Answers (Scores, JSONB) │ │  - Context-Rich Prompts │
└────────────────────────────┘ └─────────────────────────┘
```

- **Phase 1 – Core Interview Flow**: User authentication with secure JWT tokens, interactive interview session setup, AI question generation, multi-metric answer evaluation, and final executive report.
- **Phase 2 – Resume Grounding**: PDF upload and text extraction (`pypdf`). Resume is linked to the interview session via `resume_id` and injected into every prompt so questions are personalized to the candidate's actual projects, frameworks, and career history.
- **Phase 3 – RAG Knowledge Retrieval**: Curated interview knowledge base spanning Python, PostgreSQL, System Design, REST APIs, Web Security, React, DSA, and Behavioral STAR frameworks. Uses **TF-IDF + Cosine Similarity** to retrieve relevant domain concepts and ground Hugging Face prompts.
- **Phase 4 – Voice Controls**: In-browser **Speech-to-Text (STT)** for hands-free answer dictation and **Text-to-Speech (TTS)** for reading questions aloud, with manual keyboard typing always available as a seamless fallback.
- **Phase 5 – Adaptive Engine & Analytics**:
  - **Dynamic Difficulty**: Questions automatically scale between **Easy ⇄ Medium ⇄ Hard** based on answer scoring (Score $\ge 8.0$ elevates difficulty, Score $< 5.0$ lowers difficulty to reinforce fundamentals).
  - **Analytics Dashboard**: Tracks **Average Score**, **Personal Best Score**, **Completed Interviews**, **Topic-Wise Performance Breakdown** (with mastery indicators: Expert, Proficient, Needs Practice), and **Recent Interview History** with full question-by-question report inspection.

---

## 🚀 Local Setup Instructions

### Prerequisites
- **Python 3.10+** (Tested on Python 3.11, 3.12, 3.13)
- **Node.js 18+** & **npm**
- **PostgreSQL 13+**

---

### Step 1: PostgreSQL Database Setup

1. Start your local PostgreSQL server:
   ```bash
   # Linux / macOS
   sudo service postgresql start
   # Windows: Ensure PostgreSQL service is running in Services
   ```

2. Create the database:
   ```bash
   psql -U postgres
   CREATE DATABASE ai_mock_interview;
   \q
   ```

3. Initialize the schema using `database/schema.sql`:
   ```bash
   psql -U postgres -d ai_mock_interview -f database/schema.sql
   ```

*(Note: The Flask application also automatically runs `db.create_all()` upon boot for convenience).*

---

### Step 2: Backend Setup (Flask + PostgreSQL + psycopg)

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install required packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your credentials:
   ```env
   SECRET_KEY=your-secure-secret-key-32-chars
   JWT_SECRET_KEY=your-secure-jwt-secret-key-32-chars
   DATABASE_URL=postgresql+psycopg://postgres:yourpassword@localhost:5432/ai_mock_interview
   HF_API_TOKEN=your_huggingface_user_access_token
   HF_MODEL=Qwen/Qwen2.5-7B-Instruct
   FRONTEND_URL=http://localhost:5173
   MAX_RESUME_SIZE_MB=5
   ```

5. Start the backend server:
   ```bash
   python app.py
   ```
   The backend API will run at `http://localhost:5000` (Health check: `http://localhost:5000/api/health`).

---

### Step 3: Frontend Setup (React 19 + Vite)

1. Open a new terminal and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Create `frontend/.env` if your backend is hosted on a custom port or remote URL:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

---

## ☁️ Deployment Instructions

### 1. Render Deployment (Backend + PostgreSQL)

A complete Render Blueprint is pre-configured in `render.yaml`.

#### Option A: Using Render Blueprint (Recommended)
1. Push this repository to GitHub or GitLab.
2. In the Render Dashboard, click **New +** → **Blueprint**.
3. Select your repository. Render will automatically detect `render.yaml`, provisioning:
   - A managed **PostgreSQL Database** (`ai-mock-interview-db`).
   - A Python **Web Service** with Gunicorn (`ai-mock-interview-backend`).
   - Automatic environment variables linking (`DATABASE_URL`, `SECRET_KEY`, `JWT_SECRET_KEY`).
4. In the Render Web Service settings, enter your `HF_API_TOKEN` and your Vercel URL in `FRONTEND_URL`.

#### Option B: Manual Setup on Render
1. **Create PostgreSQL Database**:
   - In Render, click **New +** → **PostgreSQL**.
   - Name: `ai-mock-interview-db`.
   - Copy the **Internal Connection String** (or External Connection String).
2. **Create Web Service**:
   - In Render, click **New +** → **Web Service**.
   - Root Directory: `backend`
   - Runtime: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120`
3. **Set Environment Variables in Render**:
   - `DATABASE_URL`: Your Render PostgreSQL connection string (starts with `postgres://` or `postgresql://`). *The backend automatically normalizes this to `postgresql+psycopg://`.*
   - `SECRET_KEY`: A secure random string.
   - `JWT_SECRET_KEY`: A secure random string.
   - `HF_API_TOKEN`: Your Hugging Face API Token.
   - `HF_MODEL`: `Qwen/Qwen2.5-7B-Instruct`
   - `FRONTEND_URL`: URL of your deployed Vercel frontend (e.g. `https://my-mock-coach.vercel.app`).
   - `MAX_RESUME_SIZE_MB`: `5`

---

### 2. Vercel Deployment (Frontend)

The frontend is configured with `vercel.json` for client-side routing.

1. Connect your repository to Vercel.
2. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend` (or leave at root if deploying the monorepo root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add Environment Variable:
   - `VITE_API_URL`: `https://your-render-backend-name.onrender.com/api`
4. Click **Deploy**.
5. Once deployed, copy your Vercel URL (e.g., `https://ai-mock-interview-coach.vercel.app`) and add it to the `FRONTEND_URL` environment variable on Render to allow CORS.

---

## 🔒 Security & Best Practices

- **Hugging Face API Key Protection**: The `HF_API_TOKEN` is strictly held on the backend server. The client never receives or handles LLM credentials.
- **Git Hygiene**: `.gitignore` excludes `.env`, `node_modules/`, `venv/`, and `dist/`. Never commit real secrets.
- **JWT Authentication**: All protected API endpoints (`/api/resumes`, `/api/interviews`, `/api/analytics`) require a signed Bearer token issued upon login or registration.
- **CORS Defense**: The backend only accepts requests from origins specified in `FRONTEND_URL` (supports multiple comma-separated URLs).
- **Graceful LLM Fallbacks**: If the Hugging Face API experiences temporary outages or rate limits, the backend contains deterministic fallback evaluation algorithms to ensure the user flow never crashes.

---

## 📊 Environment Variables Reference

| Variable | Location | Description | Default / Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Backend | PostgreSQL connection URI | `postgresql+psycopg://postgres:password@localhost:5432/ai_mock_interview` |
| `SECRET_KEY` | Backend | Flask session encryption key | `dev-secret-change-in-production` |
| `JWT_SECRET_KEY` | Backend | Secret for signing JWT access tokens | `dev-jwt-secret-change-in-production` |
| `HF_API_TOKEN` | Backend | Hugging Face Access Token | `hf_xxxxxxxxxxxxxxxxxxxx` |
| `HF_MODEL` | Backend | Model identifier on HF router | `Qwen/Qwen2.5-7B-Instruct` |
| `FRONTEND_URL` | Backend | Allowed CORS origins (comma-separated) | `http://localhost:5173,https://your-app.vercel.app` |
| `MAX_RESUME_SIZE_MB` | Backend | Maximum allowed PDF resume size | `5` |
| `VITE_API_URL` | Frontend | Target backend API endpoint | `http://localhost:5000/api` |

---

## 📝 License
MIT License. Created for technical interview preparation and engineering mastery.
