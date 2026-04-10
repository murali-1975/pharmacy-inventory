#!/bin/bash

# ==============================================================================
# Pharmacy Inventory System - Data Migration Script
# 
# This script moves your local PostgreSQL backup to your Cloud SQL instance.
# ==============================================================================

set -e

# --- Configuration ---
PROJECT_ID=$(gcloud config get-value project)
REGION="asia-south1"
DB_INSTANCE="pharmacy-db-mumbai"
DB_NAME="pharmacy_prod"
BACKUP_FILE="pharmacy_backup_clean.sql"
BUCKET_NAME="pharmacy-migration-$(date +%s)"

echo "------------------------------------------------------------"
echo "🚛 Starting Data Migration to Cloud SQL"
echo "📁 File: $BACKUP_FILE"
echo "------------------------------------------------------------"

# 1. Create a temporary GCS Bucket
echo "🪣 Creating temporary storage bucket: $BUCKET_NAME..."
gcloud storage buckets create gs://$BUCKET_NAME --location=$REGION --project=$PROJECT_ID

# 2. Upload the SQL file
echo "📤 Uploading backup file..."
gcloud storage cp "$BACKUP_FILE" gs://$BUCKET_NAME/

# 3. Grant Permissions to Cloud SQL Service Account
echo "🔐 Granting access to Cloud SQL..."
# Get the Service Account email for the Cloud SQL instance
SQL_SA=$(gcloud sql instances describe $DB_INSTANCE --format='value(serviceAccountEmailAddress)')

# Grant storage.objectViewer role to the SQL Service Account for this bucket
gcloud storage buckets add-iam-policy-binding gs://$BUCKET_NAME \
    --member="serviceAccount:$SQL_SA" \
    --role="roles/storage.objectViewer"

# 4. Trigger the Import
echo "📥 Triggering Import into Cloud SQL (this may take a minute)..."
gcloud sql import sql $DB_INSTANCE gs://$BUCKET_NAME/$BACKUP_FILE \
    --database=$DB_NAME \
    --quiet

# 5. Cleanup
echo "🧹 Cleaning up temporary resources..."
gcloud storage rm -r gs://$BUCKET_NAME

echo "------------------------------------------------------------"
echo "🎉 DATA MIGRATION COMPLETE!"
echo "------------------------------------------------------------"
echo "Your cloud application now has the same data as your local backup."
echo "Please refresh your browser to see the changes."
