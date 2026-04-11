#!/bin/bash
# RoadRakshak Frontend Setup Script (for WSL/Mac/Linux)

echo "🚀 RoadRakshak Frontend - Step 1 Setup"
echo "=====================================\n"

# Create directory structure
echo "📁 Creating directories..."
mkdir -p src/pages src/components src/services src/utils

# Create source files
echo "📝 Creating source files..."

# src/index.css
cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  @apply box-border;
}

body {
  @apply bg-gray-50 text-gray-900;
}
EOF

# src/main.jsx
cat > src/main.jsx << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
EOF

# src/App.jsx
cat > src/App.jsx << 'EOF'
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
EOF

# src/App.css
cat > src/App.css << 'EOF'
/* Component-specific styles can go here */
/* Most styling uses Tailwind classes */
EOF

echo "✅ Files created successfully!\n"

# Install dependencies
echo "📦 Installing dependencies (this may take a minute)..."
npm install

echo "\n✅ Setup complete!\n"
echo "Next steps:"
echo "  1. npm run dev     - Start development server"
echo "  2. Open http://localhost:5173 in your browser"
