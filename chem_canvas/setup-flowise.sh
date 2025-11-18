#!/bin/bash

# Flowise Setup Script for Chem Canvas
# This script helps set up Flowise locally for iframe integration

echo "🚀 Setting up Flowise for Chem Canvas integration..."

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -gt 20 ]; then
    echo "⚠️  Warning: Node.js version $NODE_VERSION detected. Flowise recommends Node.js 20.x"
    echo "   Consider using nvm to switch to Node.js 20:"
    echo "   nvm install 20"
    echo "   nvm use 20"
    echo ""
fi

# Install Flowise globally
echo "📦 Installing Flowise..."
npm install -g flowise

# Create Flowise directory
mkdir -p flowise-data
cd flowise-data

# Initialize Flowise configuration
echo "⚙️  Setting up Flowise configuration..."

# Create basic config if it doesn't exist
if [ ! -f ".env" ]; then
    cat > .env << 'EOL'
PORT=3010
FLOWISE_USERNAME=admin
FLOWISE_PASSWORD=password123
DATABASE_TYPE=sqlite
DATABASE_PATH=./flowise.db
APIKEY_PATH=./api_keys.json
SECRETKEY_PATH=./secret_keys.json
LOG_PATH=./logs
BLOB_STORAGE_PATH=./storage
EOL
    echo "✅ Created .env configuration file"
fi

echo ""
echo "🎉 Flowise setup complete!"
echo ""
echo "To start Flowise:"
echo "  cd flowise-data"
echo "  npx flowise start"
echo ""
echo "Then in Chem Canvas:"
echo "  1. Enter Flow Mode"
echo "  2. Select 'Full Flowise' from the dropdown"
echo "  3. Set Flowise URL to: http://localhost:3010"
echo ""
echo "For production deployment, see DEPLOYMENT.md"
