import { list } from '@vercel/blob';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function downloadBlob(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {}); // Delete on error
      reject(err);
    });
  });
}

async function downloadCampaignImages(campaignPath) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error('❌ BLOB_READ_WRITE_TOKEN not found in environment');
    process.exit(1);
  }

  const blobPrefix = campaignPath ? `avatars/${campaignPath}/` : 'avatars/';
  const localDir = path.join(__dirname, `downloads/${campaignPath || 'all'}`);

  fs.mkdirSync(localDir, { recursive: true });

  console.log(`📦 Downloading images with prefix: ${blobPrefix}`);
  console.log(`📁 Saving to: ${localDir}`);

  try {
    let cursor;
    let totalDownloaded = 0;

    while (true) {
      const { blobs, cursor: nextCursor } = await list({
        prefix: blobPrefix,
        cursor
      });

      for (const blob of blobs) {
        if (!blob.pathname.match(/\.(png|jpg|jpeg|gif|webp|avif|bmp|svg)$/i)) continue;

        // Preserve directory structure by removing 'avatars/' prefix
        const relativePath = blob.pathname.replace(/^avatars\//, '');
        const filePath = path.join(localDir, relativePath);

        // Create subdirectories as needed
        const dirname = path.dirname(filePath);
        fs.mkdirSync(dirname, { recursive: true });

        try {
          await downloadBlob(blob.url, filePath);
          console.log(`✅ Downloaded: ${relativePath}`);
          totalDownloaded++;
        } catch (err) {
          console.error(`❌ Failed to download ${filename}:`, err.message);
        }
      }

      if (!nextCursor) break;
      cursor = nextCursor;
    }

    console.log(`\n✨ Done! Downloaded ${totalDownloaded} images to ${localDir}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

const campaignPath = process.argv[2] || '';
downloadCampaignImages(campaignPath);
