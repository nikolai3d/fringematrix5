/**
 * Get the current branch prefix from the URL path
 * @returns {string} The branch prefix (e.g., '/main', '/test-branch', etc.)
 */
export function getBranchPrefix() {
  const path = window.location.pathname;
  const match = path.match(/^\/([^\/]+)/);
  return match ? `/${match[1]}` : '';
}

/**
 * Get an API URL with the correct branch prefix
 * @param {string} endpoint - The API endpoint (e.g., '/api/campaigns')
 * @returns {string} The full API URL with branch prefix
 */
export function getApiUrl(endpoint) {
  const branchPrefix = getBranchPrefix();
  return `${branchPrefix}${endpoint}`;
}