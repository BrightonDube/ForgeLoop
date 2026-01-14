<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ForgeLoop - AI-Powered Code Analysis Agent

An autonomous AI agent that analyzes GitHub repositories using Gemini AI to detect bugs, security issues, and code quality problems.

## Features

- 🔍 **Real GitHub Integration** - Connects to actual GitHub repositories via the GitHub API
- 🤖 **Gemini AI Analysis** - Uses Gemini 1.5 for intelligent code analysis
- 📊 **6-Phase Agent Pipeline** - Ingestion → Planning → Execution → Observation → Verification → Delivery
- 📝 **Live Logs** - Real-time streaming of agent thought process
- 🐛 **Issue Detection** - Automatic bug and code quality issue detection
- 💬 **AI Chat** - Ask questions about the analysis
- 🌐 **Full-Stack Architecture** - Real Express.js backend with REST API & WebSocket

## Quick Start (Simulation Mode)

Run without setting up backend - uses simulated data:

```bash
# Install frontend dependencies
npm install

# Start frontend
npm run dev
```

## Full Stack Mode (Real GitHub + Gemini)

### 1. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env and add your API keys:
# - GITHUB_TOKEN: Get from https://github.com/settings/tokens
# - GEMINI_API_KEY: Get from https://aistudio.google.com/apikey

# Start backend server
npm run dev
```

### 2. Frontend Setup

```bash
# In root directory
cp .env.local.example .env.local

# Edit .env.local and set:
# VITE_USE_REAL_BACKEND=true

# Start frontend
npm run dev
```

### 3. Usage

1. Open http://localhost:3000
2. Enter a GitHub repository URL (e.g., `owner/repo` or `https://github.com/owner/repo`)
3. Click "Analyze" to start the AI analysis

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check with service status |
| `/api/runs` | POST | Start a new analysis run |
| `/api/runs/:id` | GET | Get run state with logs, files, issues |
| `/api/runs/:id/stop` | POST | Stop a running analysis |
| `/api/validate/repo` | POST | Validate a GitHub repo URL |
| `/api/chat` | POST | Chat with AI about the analysis |
| `/ws?runId=...` | WebSocket | Real-time updates for a run |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Backend      │────▶│   GitHub API    │
│   React + Vite  │     │   Express.js    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   Gemini AI     │
                        │   (Analysis)    │
                        └─────────────────┘
```

## Development

### Run Tests

```bash
# Backend tests
cd backend && npm test

# Watch mode
cd backend && npm run test:watch
```

### Build

```bash
# Frontend
npm run build

# Backend
cd backend && npm run build
```

## Environment Variables

### Frontend (.env.local)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_USE_REAL_BACKEND` | Use real backend vs simulation | `false` |
| `VITE_API_URL` | Backend API URL | `http://localhost:3001` |
| `VITE_WS_URL` | WebSocket URL | `ws://localhost:3001` |

### Backend (.env)

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (3001) |
| `GITHUB_TOKEN` | GitHub API token | Yes |
| `GEMINI_API_KEY` | Gemini API key | Yes |
| `GEMINI_MODEL` | Gemini model to use | No (gemini-1.5-flash) |

## License

MIT
