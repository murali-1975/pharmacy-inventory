#!/bin/bash

# ==============================================================================
# Pharmacy Inventory System - Streamlined Frontend Update
# This script redeploys only the frontend changes to Cloud Run.
# ==============================================================================

set -e

# Configuration
REGION="asia-south1"
REPO_NAME="pharmacy-app"
PROJECT_ID=$(gcloud config get-value project)

echo "------------------------------------------------------------"
echo "🛠️ Updating Frontend in Cloud Project: $PROJECT_ID"
echo "------------------------------------------------------------"

# 1. Get Backend URL
echo "🔍 Finding Backend Service URL..."
BACKEND_URL=$(gcloud run services describe pharmacy-backend --region $REGION --format='value(status.url)')

if [ -z "$BACKEND_URL" ]; then
    echo "❌ Error: Could not find pharmacy-backend service. Please run full deploy_gcp.sh first."
    exit 1
fi

echo "✅ Found Backend: $BACKEND_URL"

# 2. Build and Push Frontend Image
echo "🏗️ Building Frontend Image in the Cloud (this may take a few minutes)..."
gcloud builds submit --tag "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/frontend:latest" ./frontend

# 3. Deploy Frontend to Cloud Run
echo "🚀 Deploying Frontend Service..."
gcloud run deploy pharmacy-frontend \
    --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/frontend:latest" \
    --region $REGION \
    --set-env-vars="BACKEND_URL=$BACKEND_URL" \
    --allow-unauthenticated \
    --port 80

echo "------------------------------------------------------------"
echo "🎉 FRONTEND UPDATE COMPLETE!"
echo "------------------------------------------------------------"
FRONTEND_URL=$(gcloud run services describe pharmacy-frontend --region $REGION --format='value(status.url)')
echo "Application URL: $FRONTEND_URL"
echo "------------------------------------------------------------"
