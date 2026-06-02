#!/bin/bash
set -e

echo "=== Building production images ==="
docker-compose -f docker-compose.prod.yaml build

echo ""
echo "=== Build complete ==="
echo "Run the production stack with:"
echo "  docker-compose -f docker-compose.prod.yaml up -d"
echo ""
echo "Or with custom .env.production:"
echo "  docker-compose -f docker-compose.prod.yaml --env-file .env.production up -d"