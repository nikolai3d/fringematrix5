#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Project root is one level up from this script (which lives in scripts/)
const PROJECT_ROOT = path.join(__dirname, '..');
const BUILD_INFO_PATH = path.join(PROJECT_ROOT, 'build-info.json');

/**
 * Safely execute a command and return its output, or null if it fails
 */
function safeExec(command) {
  try {
    return execSync(command, { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
  } catch (error) {
    return null;
  }
}

/**
 * Detect if we're running in a CI/deployment environment
 */
function isDeploymentEnvironment() {
  // Check common CI environment variables
  const ciEnvVars = [
    'CI',             // Generic CI
    'VERCEL',         // Vercel
    'VERCEL_ENV',     // Vercel environment
    'GITHUB_ACTIONS', // GitHub Actions
    'GITLAB_CI',      // GitLab CI
    'JENKINS_URL',    // Jenkins
    'CIRCLECI',       // CircleCI
    'TRAVIS'          // Travis CI
  ];
  
  // Special case for Vercel: also check for Vercel-specific indicators
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    return true;
  }
  
  return ciEnvVars.some(envVar => process.env[envVar] === 'true' || process.env[envVar] === '1' || !!process.env[envVar]);
}

/**
 * Get git repository URL
 */
function getRepoUrl() {
  // Try Vercel environment variable first
  if (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG) {
    return `https://github.com/${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`;
  }
  
  // Try git command
  return safeExec('git remote get-url origin') || null;
}

/**
 * Get current commit hash
 */
function getCommitHash() {
  if (isDeploymentEnvironment()) {
    // Try multiple ways to get commit hash in deployment environments
    
    // 1. Try Vercel-specific environment variable
    if (process.env.VERCEL_GIT_COMMIT_SHA) {
      return process.env.VERCEL_GIT_COMMIT_SHA;
    }
    
    // 2. Try GitHub Actions environment variable
    if (process.env.GITHUB_SHA) {
      return process.env.GITHUB_SHA;
    }
    
    // 3. Try standard git command
    const hash = safeExec('git rev-parse HEAD');
    if (hash && hash.length >= 7) {
      return hash;
    }
    
    // 4. Try getting hash from git log (works with shallow clones)
    const logHash = safeExec('git log -1 --format="%H"');
    if (logHash && logHash.length >= 7) {
      return logHash.replace(/"/g, ''); // Remove quotes
    }
  }
  
  // For local development or if all methods fail
  return 'dev-local';
}

/**
 * Get commit timestamp for a given commit hash
 */
function getCommitTimestamp(commitHash) {
  if (commitHash === 'dev-local') {
    return 'N/A';
  }
  
  console.log(`   🕐 Attempting to get commit timestamp for: ${commitHash}`);
  
  // Try multiple ways to get commit timestamp
  
  // 1. Try with specific commit hash (ISO format)
  console.log(`   Trying: git show -s --format=%cI ${commitHash}`);
  let timestamp = safeExec(`git show -s --format=%cI ${commitHash}`);
  if (timestamp) {
    console.log(`   ✅ Success with specific hash: ${timestamp}`);
    return timestamp;
  }
  
  // 2. Try with HEAD (works better with shallow clones)
  console.log(`   Trying: git show -s --format=%cI HEAD`);
  timestamp = safeExec('git show -s --format=%cI HEAD');
  if (timestamp) {
    console.log(`   ✅ Success with HEAD: ${timestamp}`);
    return timestamp;
  }
  
  // 3. Try different format specifiers that might work in shallow clones
  console.log(`   Trying: git show -s --format=%ci ${commitHash}`);
  timestamp = safeExec(`git show -s --format=%ci ${commitHash}`); // committer date, ISO-like
  if (timestamp) {
    console.log(`   ✅ Success with %ci format: ${timestamp}`);
    return timestamp;
  }
  
  // 4. Try with HEAD using different format
  console.log(`   Trying: git show -s --format=%ci HEAD`);
  timestamp = safeExec('git show -s --format=%ci HEAD');
  if (timestamp) {
    console.log(`   ✅ Success with HEAD %ci: ${timestamp}`);
    return timestamp;
  }
  
  // 5. Try git log with different format options
  timestamp = safeExec('git log -1 --format="%ci"');
  if (timestamp) {
    return timestamp.replace(/"/g, ''); // Remove quotes
  }
  
  // 6. Try author date instead of commit date
  timestamp = safeExec(`git show -s --format=%aI ${commitHash}`);
  if (timestamp) {
    return timestamp;
  }
  
  // 7. Try author date with HEAD
  timestamp = safeExec('git show -s --format=%aI HEAD');
  if (timestamp) {
    return timestamp;
  }
  
  // 8. Try git log with author date
  timestamp = safeExec('git log -1 --format="%aI"');
  if (timestamp) {
    return timestamp.replace(/"/g, ''); // Remove quotes
  }
  
  // 9. Last resort: try with short hash if we have a long one
  if (commitHash.length > 7) {
    const shortHash = commitHash.substring(0, 7);
    timestamp = safeExec(`git show -s --format=%cI ${shortHash}`);
    if (timestamp) {
      return timestamp;
    }
  }
  
  console.log(`   ❌ All timestamp methods failed`);
  return 'N/A';
}

/**
 * Generate build info object
 */
function generateBuildInfo() {
  const now = new Date().toISOString();
  const repoUrl = getRepoUrl();
  const commitHash = getCommitHash();
  const committedAt = getCommitTimestamp(commitHash);
  
  console.log(`🔧 Generating build-info.json:`);
  console.log(`   Environment: ${isDeploymentEnvironment() ? 'CI/Deployment' : 'Local Development'}`);
  console.log(`   VERCEL: ${process.env.VERCEL || 'not set'}`);
  console.log(`   VERCEL_ENV: ${process.env.VERCEL_ENV || 'not set'}`);
  console.log(`   VERCEL_GIT_COMMIT_SHA: ${process.env.VERCEL_GIT_COMMIT_SHA || 'not set'}`);
  console.log(`   CI: ${process.env.CI || 'not set'}`);
  console.log(`   Repo URL: ${repoUrl || 'N/A'}`);
  console.log(`   Commit Hash: ${commitHash}`);
  console.log(`   Built At: ${now}`);
  console.log(`   Committed At: ${committedAt}`);

  return {
    repoUrl,
    commitHash,
    builtAt: now,
    committedAt
  };
}

/**
 * Write build info to file
 */
function writeBuildInfo(buildInfo) {
  try {
    const content = JSON.stringify(buildInfo, null, 2);
    fs.writeFileSync(BUILD_INFO_PATH, content, 'utf8');
    console.log(`✅ build-info.json written to ${BUILD_INFO_PATH}`);
  } catch (error) {
    console.error(`❌ Failed to write build-info.json:`, error.message);
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  const buildInfo = generateBuildInfo();
  writeBuildInfo(buildInfo);
}

module.exports = {
  generateBuildInfo,
  writeBuildInfo,
  isDeploymentEnvironment,
  getCommitHash,
  getCommitTimestamp,
  getRepoUrl
};
