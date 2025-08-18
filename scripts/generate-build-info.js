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
    'CI',           // Generic CI
    'VERCEL',       // Vercel
    'GITHUB_ACTIONS', // GitHub Actions
    'GITLAB_CI',    // GitLab CI
    'JENKINS_URL',  // Jenkins
    'CIRCLECI',     // CircleCI
    'TRAVIS'        // Travis CI
  ];
  
  return ciEnvVars.some(envVar => process.env[envVar] === 'true' || process.env[envVar] === '1' || !!process.env[envVar]);
}

/**
 * Get git repository URL
 */
function getRepoUrl() {
  return safeExec('git remote get-url origin') || null;
}

/**
 * Get current commit hash
 */
function getCommitHash() {
  if (isDeploymentEnvironment()) {
    // In deployment, try to get the actual commit hash
    const hash = safeExec('git rev-parse HEAD');
    if (hash && hash.length >= 7) {
      return hash;
    }
  }
  
  // For local development or if git fails
  return 'dev-local';
}

/**
 * Get commit timestamp for a given commit hash
 */
function getCommitTimestamp(commitHash) {
  if (commitHash === 'dev-local') {
    return 'N/A';
  }
  
  // Try to get the commit timestamp
  const timestamp = safeExec(`git show -s --format=%cI ${commitHash}`);
  return timestamp || 'N/A';
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
