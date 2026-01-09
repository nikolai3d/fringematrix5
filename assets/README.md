# Vercel Blob Storage Migration

This directory contains scripts and documentation for migrating your avatar images from local filesystem to Vercel Blob Storage.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Get Your Vercel Blob Token

**Method A: Via Vercel CLI (Recommended)**
```bash
# Make sure your project is linked to Vercel
vercel link

# Pull all environment variables (including BLOB_READ_WRITE_TOKEN)
vercel env pull
```

This will create/update `.env.local` with your project's environment variables.

**Method B: Manual Setup (if needed)**
If you don't have blob storage set up yet:
1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → Your Project
2. Navigate to "Storage" tab → Create → Blob
3. Name your storage (e.g., "fringematrix-avatars")
4. The `BLOB_READ_WRITE_TOKEN` will be automatically added to your environment variables
5. Run `vercel env pull` to get the updated variables

### 3. Run Migration (Dry Run First)

**The script automatically loads `.env.local`** - no manual setup needed!
```bash
# See what would be uploaded
node assets/migrate-to-blob.mjs --dry-run

# Upload everything
node assets/migrate-to-blob.mjs

# Upload specific campaign only
node assets/migrate-to-blob.mjs --campaign=Season4
```

## Migration Script Options

### `migrate-to-blob.mjs`

**Purpose**: Upload all avatar images to Vercel Blob Storage while preserving directory structure.

**Usage**:
```bash
node assets/migrate-to-blob.mjs [options]
```

**Options**:
- `--dry-run` - Show what would be uploaded without actually uploading
- `--campaign=CAMPAIGN` - Upload only a specific campaign (e.g., Season4, Season5)  
- `--force` - Overwrite existing blobs (by default, skips existing files)
- `--list-existing` - List all existing blobs in storage without uploading
- `--help, -h` - Show help message

**Examples**:
```bash
# Preview what will be uploaded
node assets/migrate-to-blob.mjs --dry-run

# Upload only Season 4 images
node assets/migrate-to-blob.mjs --campaign=Season4

# Force re-upload everything (overwrite existing)
node assets/migrate-to-blob.mjs --force

# List all existing blobs in storage
node assets/migrate-to-blob.mjs --list-existing

# Upload everything (skips existing files)
node assets/migrate-to-blob.mjs
```

## Current Directory Structure

Your avatars are organized as:
```
avatars/
├── Season4/
│   ├── AcrossTheUniverse/
│   ├── BeABetterMan/
│   ├── BreakingOut/
│   └── ...
└── Season5/
    ├── AnotherWay/
    ├── FarFromNormal/
    └── ...
```

## Migration Process

### Before Migration
- Images served via Express.js static files: `/avatars/Season4/AcrossTheUniverse/image.jpg`
- Files stored locally in `avatars/` directory
- Missing from git (gitignored), causing deployment issues

### After Migration  
- Images stored in Vercel Blob Storage with CDN URLs
- Same directory structure preserved: `avatars/Season4/AcrossTheUniverse/image.jpg`
- Globally distributed via Vercel Edge Network
- No deployment size limits

## What Happens During Migration

1. **Scan Local Files**: Script recursively finds all image files in `avatars/`
2. **Check Existing**: Lists current blobs to avoid duplicates (unless `--force`)
3. **Upload Files**: Uploads each image preserving the directory path
4. **Progress Tracking**: Shows upload progress, file sizes, and success/error counts
5. **Generate URLs**: Each uploaded file gets a CDN URL like `https://xxx.public.blob.vercel-storage.com/avatars/Season4/image.jpg`

## Supported Image Formats

- `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp`, `.svg`

## Environment Variables

### Required
- `BLOB_READ_WRITE_TOKEN` - Your Vercel Blob Storage token

### Setting Environment Variables

**Recommended: Vercel CLI**
```bash
# Pull environment variables from your Vercel project
vercel env pull

# Load into your current shell session
set -a; source .env.local; set +a
```

**Alternative Methods**:

**Manual Export**:
```bash
export BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxx
```

**Inline with Command**:
```bash
BLOB_READ_WRITE_TOKEN=your_token node assets/migrate-to-blob.mjs --dry-run
```

### Loading `.env.local` into Shell

If you have a `.env.local` file, here are ways to load it:

**Method 1: `set -a` (Recommended)**
```bash
set -a; source .env.local; set +a
```

**Method 2: `export` each variable**
```bash
export $(grep -v '^#' .env.local | xargs)
```

**Method 3: Use with `dotenv` CLI**
```bash
npm install -g dotenv-cli
dotenv node assets/migrate-to-blob.mjs --dry-run
```

**Method 4: Auto-loading (Built into our script)**
```bash
# Our migration script automatically loads .env.local
# No manual environment setup needed!
node assets/migrate-to-blob.mjs --dry-run
```

**Vercel Dashboard Setup** (if blob storage doesn't exist):
1. Project Settings → Storage → Create → Blob
2. The `BLOB_READ_WRITE_TOKEN` is automatically created
3. Use `vercel env pull` to download it locally

## Migration Safety Features

- **Dry Run Mode**: Preview uploads without making changes
- **Duplicate Detection**: Skips files that already exist in blob storage
- **List Existing**: View all blobs already in storage with `--list-existing`
- **Error Handling**: Continues on individual file errors, reports summary
- **Progress Tracking**: Shows current file and overall progress
- **File Size Reporting**: Displays upload sizes and totals

## Post-Migration Steps

After successful migration:

1. **Update Server Code**: Modify `/api/campaigns/:id/images` to use blob URLs
2. **Test Locally**: Verify images load correctly
3. **Deploy**: Push server changes to Vercel  
4. **Remove Local Files**: Optional - remove `avatars/` from gitignore and repo
5. **Update Documentation**: Update any references to local file paths

## Troubleshooting

### "BLOB_READ_WRITE_TOKEN environment variable is required"
- **Get the token**: `vercel env pull` (creates/updates `.env.local`)
- **Run the script**: `node assets/migrate-to-blob.mjs --dry-run` (auto-loads `.env.local`)
- **If still getting this error**: Check that `.env.local` contains `BLOB_READ_WRITE_TOKEN=...`
- **If `.env.local` is empty**: You may need to create blob storage in Vercel Dashboard first

### "Avatars directory not found"  
- Run script from project root: `node assets/migrate-to-blob.mjs`
- Check that `avatars/` directory exists

### "Campaign directory not found"
- Check campaign name spelling: `--campaign=Season4` (case-sensitive)
- List available campaigns: `ls avatars/`

### Upload Failures
- Check internet connection
- Verify Vercel Blob token permissions
- Try smaller batches with `--campaign=Season4`
- Check Vercel Blob Storage limits in dashboard

## Cost Considerations

**Vercel Blob Storage Pricing** (as of 2024):
- **Free Tier**: 0.5 GB storage, 1 GB bandwidth
- **Pro Plan**: $0.15/GB storage, $0.30/GB bandwidth  
- **Enterprise**: Custom pricing

**Estimate for Your Project**:
- Typical avatar: 50KB - 500KB per image
- Season 4: ~15 episodes × ~20 images = ~300 images
- Season 5: ~12 episodes × ~20 images = ~240 images  
- **Total estimate**: ~540 images × 200KB avg = ~108 MB

Your collection should easily fit in the free tier!

## Next Steps

1. Run the migration script
2. Update server code to use blob URLs (next phase)
3. Test the new implementation
4. Deploy to production

See the main project documentation for server code changes.
