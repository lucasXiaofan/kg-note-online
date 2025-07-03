# Google Cloud Build Deployment Setup

This guide will help you deploy your kg-note-online API to Google Cloud Run using Cloud Build.

## Prerequisites

- Google Cloud SDK installed and configured
- Firebase service account key at `config/kg-note-credential.json`
- Project ID: `kg-note`

## Step 1: Enable Required APIs

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

## Step 2: Set Up IAM Permissions

```bash
# Get your project number
PROJECT_NUMBER=$(gcloud projects describe kg-note --format="value(projectNumber)")

# Grant Cloud Build service account necessary roles
gcloud projects add-iam-policy-binding kg-note \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding kg-note \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding kg-note \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# Grant yourself Cloud Build Editor role
gcloud projects add-iam-policy-binding kg-note \
    --member="user:lucaswe957@gmail.com" \
    --role="roles/cloudbuild.builds.editor"
```

## Step 3: Create Service Account for Cloud Run

```bash
gcloud iam service-accounts create kg-note-api \
    --display-name="KG Note API"

# Grant Firebase permissions to the service account
gcloud projects add-iam-policy-binding kg-note \
    --member="serviceAccount:kg-note-api@kg-note.iam.gserviceaccount.com" \
    --role="roles/firebase.admin"
```

## Step 4: Store Firebase Credentials in Secret Manager

```bash
# Upload your Firebase service account key to Secret Manager
gcloud secrets create firebase-credentials \
    --data-file="config/kg-note-credential.json"
```

## Step 5: Set Environment Variables (Optional)

If you need to set additional environment variables like API keys:

```bash
# Example: Store API keys in Secret Manager
gcloud secrets create deepseek-api-key --data-file=-
# (Enter your API key and press Ctrl+D)

gcloud secrets create google-client-id --data-file=-
# (Enter your Google Client ID and press Ctrl+D)

gcloud secrets create jwt-secret --data-file=-
# (Enter your JWT secret and press Ctrl+D)
```

## Step 6: Deploy to Cloud Run

```bash
gcloud builds submit --config=cloudbuild.yaml
```

## Step 7: Get Your API URL

After deployment, get your Cloud Run service URL:

```bash
gcloud run services describe kg-note-api --region=us-central1 --format="value(status.url)"
```

## Step 8: Update Chrome Extension

Update your Chrome extension to use the new API URL from Step 7.

## Troubleshooting

### Permission Denied Errors
- Ensure all IAM roles are properly assigned
- Check that the Cloud Build API is enabled
- Verify your account has the necessary permissions

### Firebase Connection Issues
- Ensure the service account has Firebase Admin permissions
- Check that the secret is properly created and accessible

### Build Failures
- Check the Cloud Build logs in Google Cloud Console
- Verify all dependencies are listed in requirements.txt
- Ensure the Dockerfile is correct

## Environment Variables in Cloud Run

Your deployed service will have access to these environment variables:
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to Firebase credentials (automatically set)
- `PYTHONUNBUFFERED=1` - For proper logging

To add more environment variables to your Cloud Run service:

```bash
gcloud run services update kg-note-api \
    --region=us-central1 \
    --set-env-vars="CUSTOM_VAR=value"
```

## Monitoring

View logs for your deployed service:

```bash
gcloud logs tail projects/kg-note/logs/run.googleapis.com%2Fstderr \
    --filter="resource.labels.service_name=kg-note-api"
```