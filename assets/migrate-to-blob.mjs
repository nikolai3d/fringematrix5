#!/usr/bin/env node

/**
 * Vercel Blob Migration Script
 * 
 * Uploads all avatar images from the local filesystem to Vercel Blob Storage,
 * preserving the directory structure.
 * 
 * Prerequisites:
 * 1. Install dependencies: npm install
 * 2. Set environment variable: BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
 * 
 * Usage:
 *   node assets/migrate-to-blob.mjs [--dry-run] [--campaign=Season4]
 * 
 * Options:
 *   --dry-run        Show what would be uploaded without actually uploading
 *   --campaign       Upload only a specific campaign (e.g., Season4, Season5)
 *   --force          Overwrite existing blobs (by default, skips existing)
 *   --list-existing  List all existing blobs without uploading
 *   --help           Show this help message
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { put, list } from '@vercel/blob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auto-load .env.local if it exists
const ENV_LOCAL_PATH = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(ENV_LOCAL_PATH)) {
  const envContent = fs.readFileSync(ENV_LOCAL_PATH, 'utf8');
  const envVars = envContent
    .split('\n')
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .reduce((acc, line) => {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove surrounding quotes
      acc[key.trim()] = value;
      return acc;
    }, {});
  
  // Set environment variables if they're not already set
  Object.entries(envVars).forEach(([key, value]) => {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
  
  console.log(`📋 Loaded environment variables from .env.local`);
}

// Configuration
const PROJECT_ROOT = path.join(__dirname, '..');
const AVATARS_DIR = path.join(PROJECT_ROOT, 'avatars');
const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.svg'];

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    campaign: null,
    force: false,
    help: false,
    listExisting: false
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--campaign=')) {
      options.campaign = arg.split('=')[1];
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--list-existing') {
      options.listExisting = true;
    }
  }

  return options;
}

// Show help and exit
function showHelp() {
  console.log(`
Vercel Blob Migration Script

Uploads avatar images from local filesystem to Vercel Blob Storage.

Usage:
  node assets/migrate-to-blob.mjs [options]

Options:
  --dry-run              Show what would be uploaded without uploading
  --campaign=CAMPAIGN    Upload only specific campaign (e.g., Season4)
  --force               Overwrite existing blobs 
  --list-existing       List all existing blobs without uploading
  --help, -h            Show this help

Prerequisites:
  1. npm install (to install @vercel/blob)
  2. Set BLOB_READ_WRITE_TOKEN environment variable

Examples:
  node assets/migrate-to-blob.mjs --dry-run
  node assets/migrate-to-blob.mjs --campaign=Season4
  node assets/migrate-to-blob.mjs --force
  node assets/migrate-to-blob.mjs --list-existing
`);
  process.exit(0);
}

// Recursively walk directory and return all files
function walkDirectory(startDir) {
  const results = [];
  if (!fs.existsSync(startDir)) {
    return results;
  }

  const stack = [startDir];
  while (stack.length) {
    const current = stack.pop();
    let stat;
    try {
      stat = fs.statSync(current);
    } catch (err) {
      console.warn(`⚠️  Cannot read ${current}: ${err.message}`);
      continue;
    }

    if (stat.isDirectory()) {
      try {
        const children = fs.readdirSync(current);
        for (const child of children) {
          stack.push(path.join(current, child));
        }
      } catch (err) {
        console.warn(`⚠️  Cannot read directory ${current}: ${err.message}`);
      }
    } else if (stat.isFile()) {
      results.push(current);
    }
  }
  return results;
}

// Check if file is a supported image
function isImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

// Format file size for display
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Normalize pathname for comparison (remove leading slash, ensure consistent format)
function normalizePathname(pathname) {
  return pathname.replace(/^\/+/, ''); // Remove leading slashes
}

// Get existing blobs to avoid duplicates (with pagination support)
async function getExistingBlobs() {
  try {
    console.log('📋 Checking existing blobs...');
    const existing = new Set();
    let cursor = undefined;
    let pageCount = 0;
    
    do {
      const result = await list({ 
        prefix: 'avatars/', 
        limit: 1000,
        cursor 
      });
      
      for (const blob of result.blobs) {
        existing.add(normalizePathname(blob.pathname));
      }
      
      cursor = result.cursor;
      pageCount++;
      
      if (cursor) {
        console.log(`📋 Fetched page ${pageCount} (${existing.size} blobs so far)...`);
      }
    } while (cursor);
    
    console.log(`📋 Found ${existing.size} existing blobs`);
    return existing;
  } catch (error) {
    console.warn('⚠️  Could not list existing blobs:', error.message);
    return new Set();
  }
}

// Upload a single file to blob storage
async function uploadFile(filePath, blobPath, force = false, dryRun = false) {
  const stats = fs.statSync(filePath);
  const fileSize = formatFileSize(stats.size);
  
  if (dryRun) {
    console.log(`🔍 [DRY RUN] Would upload: ${blobPath} (${fileSize})`);
    return { success: true, skipped: false, size: stats.size };
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const blob = await put(blobPath, fileBuffer, {
      access: 'public',
      addRandomSuffix: false, // Keep original structure
    });

    console.log(`✅ Uploaded: ${blobPath} (${fileSize}) → ${blob.url}`);
    return { success: true, skipped: false, size: stats.size, url: blob.url };
  } catch (error) {
    console.error(`❌ Failed to upload ${blobPath}: ${error.message}`);
    return { success: false, skipped: false, size: 0, error: error.message };
  }
}

// Main migration function
async function migrate() {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
  }

  // Check prerequisites
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN environment variable is required');
    console.log('   Set it with: export BLOB_READ_WRITE_TOKEN=your_vercel_blob_token');
    process.exit(1);
  }

  if (!fs.existsSync(AVATARS_DIR)) {
    console.error(`❌ Error: Avatars directory not found: ${AVATARS_DIR}`);
    process.exit(1);
  }

  // Handle --list-existing mode
  if (options.listExisting) {
    console.log('📋 Listing existing blobs in Vercel Blob Storage...\n');
    try {
      const allBlobs = [];
      let cursor = undefined;
      let totalSize = 0;
      
      do {
        const result = await list({ 
          prefix: 'avatars/', 
          limit: 1000,
          cursor 
        });
        allBlobs.push(...result.blobs);
        cursor = result.cursor;
      } while (cursor);
      
      if (allBlobs.length === 0) {
        console.log('ℹ️  No blobs found with prefix "avatars/"');
      } else {
        console.log(`Found ${allBlobs.length} existing blobs:\n`);
        for (const blob of allBlobs) {
          const size = formatFileSize(blob.size);
          totalSize += blob.size;
          console.log(`  ${blob.pathname} (${size})`);
        }
        console.log(`\n📊 Total: ${allBlobs.length} blobs (${formatFileSize(totalSize)})`);
      }
    } catch (error) {
      console.error('❌ Failed to list blobs:', error.message);
      process.exit(1);
    }
    return;
  }

  console.log('🚀 Starting Vercel Blob migration...');
  console.log(`📂 Source directory: ${AVATARS_DIR}`);
  if (options.campaign) {
    console.log(`🎯 Target campaign: ${options.campaign}`);
  }
  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No files will be uploaded');
  }
  console.log();

  // Determine source directory
  const sourceDir = options.campaign 
    ? path.join(AVATARS_DIR, options.campaign)
    : AVATARS_DIR;

  if (!fs.existsSync(sourceDir)) {
    console.error(`❌ Error: Campaign directory not found: ${sourceDir}`);
    process.exit(1);
  }

  // Get all image files
  const allFiles = walkDirectory(sourceDir);
  const imageFiles = allFiles.filter(isImageFile);

  if (imageFiles.length === 0) {
    console.log('ℹ️  No image files found to migrate');
    return;
  }

  console.log(`📊 Found ${imageFiles.length} image files to process`);

  // Get existing blobs to check for duplicates
  const existingBlobs = options.force ? new Set() : await getExistingBlobs();

  // Process files
  let uploadCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  let totalBytes = 0;

  console.log('\n📤 Starting uploads...\n');

  for (const [index, filePath] of imageFiles.entries()) {
    // Convert to blob path
    const relativePath = path.relative(AVATARS_DIR, filePath);
    const blobPath = `avatars/${relativePath.split(path.sep).join('/')}`;
    const normalizedBlobPath = normalizePathname(blobPath);
    
    // Progress indicator
    const progress = `[${index + 1}/${imageFiles.length}]`;
    
    // Check if already exists
    if (existingBlobs.has(normalizedBlobPath)) {
      console.log(`⏭️  ${progress} Skipping existing: ${blobPath}`);
      skipCount++;
      continue;
    }

    // Upload file
    const result = await uploadFile(filePath, blobPath, options.force, options.dryRun);
    
    if (result.success && !result.skipped) {
      uploadCount++;
      totalBytes += result.size;
    } else if (result.success && result.skipped) {
      skipCount++;
    } else {
      errorCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Summary
  console.log('\n🎉 Migration complete!');
  console.log(`✅ Uploaded: ${uploadCount} files (${formatFileSize(totalBytes)})`);
  console.log(`⏭️  Skipped: ${skipCount} files`);
  if (errorCount > 0) {
    console.log(`❌ Errors: ${errorCount} files`);
  }

  if (options.dryRun) {
    console.log('\n💡 This was a dry run. Run without --dry-run to actually upload files.');
  } else if (uploadCount > 0) {
    console.log('\n💡 Files are now available via Vercel Blob CDN URLs.');
    console.log('💡 You can update your server code to use blob storage.');
  }
}

// Run migration
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().catch(error => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
}

export { migrate, walkDirectory, isImageFile };
