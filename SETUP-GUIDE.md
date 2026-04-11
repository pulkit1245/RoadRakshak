═══════════════════════════════════════════════════════════════
ROADRAKSHAK FRONTEND SETUP GUIDE - STEP 1 COMPLETE
═══════════════════════════════════════════════════════════════

WHAT WE'VE BUILT:
✅ Vite project configuration
✅ Tailwind CSS setup  
✅ PostCSS configuration
✅ HTML entry point
✅ npm scripts ready

═══════════════════════════════════════════════════════════════
HOW TO COMPLETE THE SETUP (3 SIMPLE STEPS)
═══════════════════════════════════════════════════════════════

STEP 1: Create missing source files
────────────────────────────────────

A) Create src/index.css with:
───────────────────────────────
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  @apply box-border;
}

body {
  @apply bg-gray-50 text-gray-900;
}


B) Create src/main.jsx with:
────────────────────────────
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)


C) Create src/App.jsx with:
───────────────────────────
import React from 'react'
import './App.css'

function App() {
  return (
    <div className="w-full h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">🚦 RoadRakshak</h1>
        <p className="text-xl text-gray-600 mb-8">AI-Powered Traffic Management System</p>
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <p className="text-gray-700 mb-4">Frontend Setup Complete! ✅</p>
          <p className="text-sm text-gray-500">Ready for Step 2: API Integration</p>
        </div>
      </div>
    </div>
  )
}

export default App


D) Create src/App.css with:
───────────────────────────
/* Component-specific styles can go here */
/* Most styling uses Tailwind classes */


E) Create directories:
──────────────────────
src/pages/
src/components/
src/services/
src/utils/


STEP 2: Install dependencies
─────────────────────────────
Run this command in d:\projects\RoadRakshak:

    npm install


STEP 3: Start development server
─────────────────────────────────
Run this command:

    npm run dev

Then open: http://localhost:5173


═══════════════════════════════════════════════════════════════
AVAILABLE NPM SCRIPTS
═══════════════════════════════════════════════════════════════

npm run dev       - Start development server with hot reload
npm run build     - Build for production (creates dist/)
npm run preview   - Preview production build locally
npm run lint      - Run ESLint (when added)


═══════════════════════════════════════════════════════════════
PROJECT STRUCTURE CREATED
═══════════════════════════════════════════════════════════════

d:\projects\RoadRakshak/
├── index.html                 ← Entry HTML file
├── package.json              ← Dependencies & scripts
├── vite.config.js            ← Vite configuration
├── tailwind.config.js        ← Tailwind theme config
├── postcss.config.js         ← CSS processing config
├── .gitignore               ← Files to exclude from git
├── src/
│   ├── main.jsx             ← React entry point
│   ├── App.jsx              ← Root component
│   ├── App.css              ← App styles
│   ├── index.css            ← Global + Tailwind styles
│   ├── pages/               ← Page components (Login, Dashboard, etc)
│   ├── components/          ← Shared components (AlertBanner, etc)
│   ├── services/            ← API calls (api.js goes here)
│   └── utils/               ← Helper functions
└── dist/                    ← Build output (created after npm run build)


═══════════════════════════════════════════════════════════════
WHAT'S IN OUR package.json
═══════════════════════════════════════════════════════════════

DEPENDENCIES (runtime - shipped to browser):
  • react ^18.3.1           - UI library
  • react-dom ^18.3.1       - React for browsers
  • axios ^1.7.2            - HTTP requests
  • leaflet ^1.9.4          - Maps library
  • react-leaflet ^4.2.5    - Leaflet for React
  • react-webcam ^7.2.0     - Webcam access
  • recharts ^2.12.7        - Charts/graphs

DEV DEPENDENCIES (tools only, not shipped):
  • @vitejs/plugin-react    - React support in Vite
  • vite ^5.1.1             - Build tool
  • tailwindcss ^3.4.1      - CSS framework
  • postcss & autoprefixer  - CSS processing


═══════════════════════════════════════════════════════════════
KEY CONFIGURATION DETAILS
═══════════════════════════════════════════════════════════════

vite.config.js:
  • Dev server runs on port 5173
  • API proxy: /api/* → http://localhost:8000
  • React Fast Refresh enabled (live reload)

tailwind.config.js:
  • Custom color theme (primary, danger, accident, etc)
  • Scans src/**/*.{js,jsx} for class names

postcss.config.js:
  • Processes Tailwind & vendor prefixes (autoprefixer)


═══════════════════════════════════════════════════════════════
NEXT: STEP 2 - API MODULE
═══════════════════════════════════════════════════════════════

After frontend runs successfully, create src/services/api.js
This will centralize all HTTP requests to the FastAPI backend.

Commands:
  • Login: POST /auth/login
  • Dashboard: GET /stats (frames, violations, accidents, ambulances)
  • LiveFeed: WebSocket ws://localhost:8000/ws/detection
  • Analytics: GET /analytics/violations
  • MapView: GET /map/accidents, GET /map/hospitals
