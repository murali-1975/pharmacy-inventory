#!/bin/bash

# ==============================================================================
# Pharmacy Inventory - Cloud Sync Script (Inventory Ledger Update)
# 
# Use this script to push ONLY the code changes to your existing GCP environment.
# Assumption: Project ID, APIs, and Databases are already configured.
# ==============================================================================

set -e

# --- Configuration ---
# Ensure these match your existing deployment settings
PROJECT_ID=$(gcloud config get-value project)
REGION="asia-south1"
REPO_NAME="pharmacy-app"
BACKEND_SERVICE="pharmacy-backend"
FRONTEND_SERVICE="pharmacy-frontend"

echo "------------------------------------------------------------"
echo "🔄 Updating Ledger Feature for Project: $PROJECT_ID"
echo "------------------------------------------------------------"

# 1. Build and Push Backend Image (Contains the new /ledger API)
echo "🏗️ Building & Pushing Backend..."
gcloud builds submit --tag "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/backend:latest" ./backend

# 2. Build and Push Frontend Image (Contains the Ledger Tab and PDF Export)
echo "🏗️ Building & Pushing Frontend..."
gcloud builds submit --tag "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/frontend:latest" ./frontend

# 3. Deploy Backend Update
echo "🚀 Redeploying Backend Service..."
gcloud run deploy $BACKEND_SERVICE \
    --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/backend:latest" \
    --region $REGION \
    --quiet

# 4. Get the Backend URL (to ensure frontend has the latest endpoint)
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --region $REGION --format='value(status.url)')

# 5. Deploy Frontend Update
echo "🚀 Redeploying Frontend Service..."
gcloud run deploy $FRONTEND_SERVICE \
    --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/frontend:latest" \
    --region $REGION \
    --set-env-vars="BACKEND_URL=$BACKEND_URL" \
    --quiet

echo "------------------------------------------------------------"
echo "🎉 SYNC COMPLETE!"
echo "------------------------------------------------------------"
FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE --region $REGION --format='value(status.url)')
echo "Live App: $FRONTEND_URL"
echo "------------------------------------------------------------"
