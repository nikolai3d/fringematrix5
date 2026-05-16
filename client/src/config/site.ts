/**
 * Site Configuration
 *
 * Loads site-level settings from client/config.yaml under the `site` key.
 * Provides the canonical production URL and default share text used in
 * share links (e.g. Threads).
 */

import type { AppConfig } from '../types/appConfig';
import configYaml from '../../config.yaml';

const config = configYaml as AppConfig;

const DEFAULT_SITE_URL = 'https://fringematrix.art';
const DEFAULT_SHARE_TEXT = 'Check out Fringe Matrix';

/**
 * The canonical site URL used for share links.
 * Falls back to the production URL if not set in config.yaml.
 */
export const SITE_URL: string =
  typeof config.site?.url === 'string' && config.site.url.trim().length > 0
    ? config.site.url
    : DEFAULT_SITE_URL;

/**
 * Default share text prepended to Threads (and similar) share links.
 * Falls back to the default if not set in config.yaml.
 */
export const SITE_SHARE_TEXT: string =
  typeof config.site?.shareText === 'string' && config.site.shareText.trim().length > 0
    ? config.site.shareText
    : DEFAULT_SHARE_TEXT;
