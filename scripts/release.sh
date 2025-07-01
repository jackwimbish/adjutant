#!/bin/bash

# Adjutant Release Script
# This script builds the macOS app and prepares it for distribution

set -e

echo "🚀 Building Adjutant for Release..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/

# Build the app
echo "📦 Building application..."
npm run dist:mac

# Check if build was successful
if [ -d "dist" ]; then
    echo "✅ Build completed successfully!"
    echo ""
    echo "📁 Build artifacts:"
    ls -la dist/
    echo ""
    echo "🎉 Ready for release!"
    echo ""
    echo "Next steps:"
    echo "1. Test the app in dist/ folder"
    echo "2. Create a new release on GitHub"
    echo "3. Upload the .dmg file from dist/ folder"
    echo "4. Include README-SETUP.md in the release notes"
    echo ""
    echo "💡 DMG file location: $(pwd)/dist/Adjutant-1.0.0.dmg"
else
    echo "❌ Build failed!"
    exit 1
fi 