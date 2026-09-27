// Pulls real numbers from the site's data files into src/data.json so the video stays accurate.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const yaml = require('../../node_modules/js-yaml');
const root = new URL('../../data/', import.meta.url);
const campaigns = yaml.load(fs.readFileSync(new URL('campaigns.yaml', root), 'utf8')).campaigns;
const authors = yaml.load(fs.readFileSync(new URL('authors.yaml', root), 'utf8')).authors;
const registry = JSON.parse(fs.readFileSync(new URL('images.json', root), 'utf8'));
const images = Object.values(registry).filter((i) => i.status === 'active');
const ids = new Set(campaigns.map((c) => c.hashtag.toLowerCase()));
const perCampaign = {};
for (const i of images) if (ids.has(i.campaignId)) perCampaign[i.campaignId] = (perCampaign[i.campaignId] || 0) + 1;
const out = {
  totalImages: Object.values(perCampaign).reduce((a, b) => a + b, 0),
  artists: authors.filter((a) => a.roles?.includes('artist')).length,
  episodes: campaigns.reduce((n, c) => n + String(c.episode_id).split('/').length, 0),
  campaigns: campaigns.map((c) => ({
    hashtag: c.hashtag, episode: c.episode, episodeId: String(c.episode_id), date: c.date,
    count: perCampaign[c.hashtag.toLowerCase()] || 0,
  })),
};
fs.writeFileSync('src/data.json', JSON.stringify(out, null, 2));
console.log(out.totalImages, out.artists, out.episodes, out.campaigns.length);
