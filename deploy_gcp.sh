#!/bin/bash

# ==============================================================================
# Pharmacy Inventory System - Google Cloud Deployment Script (Mumbai)
# 
# This script automates the setup and deployment of the Pharmacy Inventory app
# on GCP using Cloud Run, Cloud SQL, and Secret Manager in asia-south1.
# 
# Prerequisites:
# 1. GCloud CLI installed and authenticated (gcloud auth login)
# 2. Billing enabled for the project
# 3. Project ID known
# ==============================================================================

# Set strict error handling
set -e

# --- Configuration ---
PROJECT_ID=$(gcloud config get-value project)
REGION="asia-south1"
REPO_NAME="pharmacy-app"
DB_INSTANCE="pharmacy-db-mumbai"
DB_NAME="pharmacy_prod"
DB_USER="pharmacy_admin"

echo "------------------------------------------------------------"
echo "🚀 Starting Deployment for Project: $PROJECT_ID"
echo "📍 Region: $REGION"
echo "------------------------------------------------------------"

# 1. Enable Required APIs
echo "📡 Enabling APIs (this may take a minute)..."
gcloud services enable \
    run.googleapis.com \
    sqladmin.googleapis.com \
    secretmanager.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com

# 2. Create Artifact Registry
echo "📦 Creating Artifact Registry..."
gcloud artifacts repositories create $REPO_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Docker repository for Pharmacy Inventory" || echo "Repository already exists."

# 3. Setup Cloud SQL (Postgres)
# Note: Creating a DB instance can take 5-10 minutes.
echo "🗄️ Checking Cloud SQL Instance..."
if ! gcloud sql instances describe $DB_INSTANCE >/dev/null 2>&1; then
    echo "🏗️ Creating Cloud SQL Instance (Postgres 15)... This takes several minutes."
    gcloud sql instances create $DB_INSTANCE \
        --database-version=POSTGRES_15 \
        --tier=db-f1-micro \
        --region=$REGION \
        --storage-type=HDD \
        --backup-start-time=03:00
else
    echo "✅ Cloud SQL Instance $DB_INSTANCE already exists."
fi

# Ensure Database and User exist
echo "🛠️ Configuring Database and User..."
gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE || echo "DB already exists."
echo "Please enter a password for the database user '$DB_USER':"
read -s DB_PASSWORD

if gcloud sql users describe $DB_USER --instance=$DB_INSTANCE >/dev/null 2>&1; then
    echo "🔐 User exists. Updating password..."
    gcloud sql users set-password $DB_USER --instance=$DB_INSTANCE --password=$DB_PASSWORD
else
    echo "👤 Creating new database user..."
    gcloud sql users create $DB_USER --instance=$DB_INSTANCE --password=$DB_PASSWORD
fi

# 4. Prepare Secrets in Secret Manager
echo "🔐 Setting up Secrets..."
function create_secret() {
    SECRET_NAME=$1
    SECRET_VAL=$2
    if ! gcloud secrets describe $SECRET_NAME >/dev/null 2>&1; then
        gcloud secrets create $SECRET_NAME --replication-policy="automatic"
    fi
    echo -n "$SECRET_VAL" | gcloud secrets versions add $SECRET_NAME --data-file=-
}

# Construct the Cloud SQL connection string for Unix Socket
INSTANCE_CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE --format='value(connectionName)')
# Format: postgresql+psycopg2://user:pass@/dbname?host=/cloudsql/connection_name
DATABASE_URL="postgresql+psycopg2://$DB_USER:$DB_PASSWORD@/$DB_NAME?host=/cloudsql/$INSTANCE_CONNECTION_NAME"

echo "Creating PHARMACY_DB_URL secret..."
create_secret "PHARMACY_DB_URL" "$DATABASE_URL"

echo "Please enter a random string for your JWT SECRET_KEY:"
read -s SEC_KEY_VAL
create_secret "PHARMACY_SECRET_KEY" "$SEC_KEY_VAL"

# 5. Build and Push Images using Cloud Build
echo "🏗️ Building Backend Image in the Cloud..."
gcloud builds submit --tag "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/backend:latest" ./backend

echo "🏗️ Building Frontend Image in the Cloud..."
gcloud builds submit --tag "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/frontend:latest" ./frontend

# 6. Deploy Backend to Cloud Run
echo "🚀 Configuring Permissions..."
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
SERVICE_ACCOUNT="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

echo "🔐 Granting Secret Accessor role to $SERVICE_ACCOUNT..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor"

echo "🚀 Deploying Backend Service..."
gcloud run deploy pharmacy-backend \
    --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/backend:latest" \
    --region $REGION \
    --set-secrets="DATABASE_URL=PHARMACY_DB_URL:latest,SECRET_KEY=PHARMACY_SECRET_KEY:latest" \
    --add-cloudsql-instances $INSTANCE_CONNECTION_NAME \
    --allow-unauthenticated \
    --port 8000

# Get the Backend URL
BACKEND_URL=$(gcloud run services describe pharmacy-backend --region $REGION --format='value(status.url)')
echo "✅ Backend deployed at: $BACKEND_URL"

# 7. Deploy Frontend to Cloud Run
echo "🚀 Deploying Frontend Service..."
gcloud run deploy pharmacy-frontend \
    --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/frontend:latest" \
    --region $REGION \
    --set-env-vars="BACKEND_URL=$BACKEND_URL" \
    --allow-unauthenticated \
    --port 80

echo "------------------------------------------------------------"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "------------------------------------------------------------"
FRONTEND_URL=$(gcloud run services describe pharmacy-frontend --region $REGION --format='value(status.url)')
echo "Frontend: $FRONTEND_URL"
echo "Backend:  $BACKEND_URL"
echo "------------------------------------------------------------"
echo "Note: It may take a moment for the SSL certificates to provision."
