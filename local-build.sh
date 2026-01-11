#!/bin/bash

set -e  # Exit on any error

echo "🧹 Cleaning previous builds..."
rm -rf npx-cli/dist
mkdir -p npx-cli/dist/macos-arm64

echo "🔨 Building frontend..."
(cd frontend && npm run build)

echo "🔨 Building Rust binaries..."
cargo build --release --manifest-path Cargo.toml
cargo build --release --bin vkm-mcp --manifest-path Cargo.toml

echo "📦 Creating distribution package..."

# Copy the main binary
cp target/release/vkm vkm
zip -q vkm.zip vkm
rm -f vkm
mv vkm.zip npx-cli/dist/macos-arm64/vkm.zip

# Copy the MCP binary
cp target/release/vkm-mcp vkm-mcp
zip -q vkm-mcp.zip vkm-mcp
rm -f vkm-mcp
mv vkm-mcp.zip npx-cli/dist/macos-arm64/vkm-mcp.zip

# Copy the Review CLI binary
cp target/release/vkm-review vkm-review
zip -q vkm-review.zip vkm-review
rm -f vkm-review
mv vkm-review.zip npx-cli/dist/macos-arm64/vkm-review.zip

echo "✅ Build complete!"
echo "📁 Files created:"
echo "   - npx-cli/dist/macos-arm64/vkm.zip"
echo "   - npx-cli/dist/macos-arm64/vkm-mcp.zip"
echo "   - npx-cli/dist/macos-arm64/vkm-review.zip"
echo ""
echo "🚀 To test locally, run:"
echo "   cd npx-cli && node bin/cli.js"
