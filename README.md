# PromptForge

**PromptForge** is a CMS (Content Management System) for AI Prompts. It allows developers and product managers to write, test, version-control, and analyze prompts in a visual web dashboard. When the main application needs to generate text, it fetches the latest active prompt version from Firebase instead of relying on hardcoded strings.

## Features

- **Workspace Management** — Create and organize projects (e.g., "Customer Support Chatbot")
- **Prompt Editor** — Write system prompts with `{{variable}}` syntax; variables are detected instantly via Regular Expressions and dynamic input fields appear automatically with a smooth slide-in animation
- **Arena (A/B Testing)** — Select two AI models, fill in variable values, and run side-by-side comparisons via a secure Firebase Cloud Function
- **Version Control** — Every save creates a new version (`v1`, `v2`, …); roll back to any previous version instantly
- **Analytics Dashboard** — Bento-box layout with latency comparison bars, token usage, estimated cost, and recent test run history

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 7 |
| Routing | React Router v7 |
| Database | Firebase Firestore |
| Backend | Firebase Cloud Functions (Node 20) |
| AI Models | Google Gemini API, OpenAI API |
| Hosting | Firebase Hosting |

## UI/UX

- **Dark IDE aesthetic** — `#0F111A` backgrounds with neon purple/cyan accents
- **CSS Grid Bento-box** analytics layout
- **Glassmorphism** modals with `backdrop-filter: blur`
- **Animated skeleton loaders** (glowing sweep gradients) while fetching data
- **Sliding CSS transitions** when variable fields appear

## Firestore Data Architecture

```
workspaces/{workspaceId}
  prompts/{promptId}
    versions/{versionId}     ← template_string, model_used, temperature
    metrics/{metricId}       ← latency, token usage, cost per Arena run
```

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/Harshitkashyap2027/PromptForge
cd PromptForge
npm install
```

### 2. Configure Firebase

Copy `.env.example` to `.env.local` and fill in your Firebase project credentials:

```bash
cp .env.example .env.local
```

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:0000000000000000
VITE_CLOUD_FUNCTIONS_URL=https://us-central1-your-project.cloudfunctions.net
```

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### 4. Deploy Cloud Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Set your AI API keys in the Firebase Functions environment:

```bash
firebase functions:config:set gemini.api_key="YOUR_GEMINI_KEY" openai.api_key="YOUR_OPENAI_KEY"
```

### 5. Deploy the full app

```bash
npm run build
firebase deploy
```

## Project Structure

```
PromptForge/
├── src/
│   ├── components/
│   │   ├── ArenaPanel.jsx      # A/B testing panel with side-by-side results
│   │   ├── Sidebar.jsx         # Navigation sidebar
│   │   └── ToastContainer.jsx  # Toast notification system
│   ├── hooks/
│   │   └── useToast.js         # Toast state management hook
│   ├── pages/
│   │   ├── WorkspacesPage.jsx  # Project listing & creation
│   │   ├── PromptsPage.jsx     # Prompt listing within a workspace
│   │   ├── EditorPage.jsx      # Prompt editor + version history
│   │   └── AnalyticsPage.jsx   # Analytics dashboard (Bento grid)
│   ├── utils/
│   │   └── helpers.js          # extractVariables, injectVariables, estimateCost, etc.
│   ├── firebase.js             # Firebase app initialization
│   └── App.jsx                 # React Router routes
├── functions/
│   └── index.js                # Cloud Function: runArenaTest
├── firestore.rules             # Firestore security rules
├── firestore.indexes.json      # Composite index definitions
└── firebase.json               # Firebase project configuration
```

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |
