const state = {
  campaigns: [],
  activeCampaignId: null,
  images: [],
  lightboxIndex: 0,
};

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) {
    if (child == null) continue;
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  }
  return node;
}

function renderNavbars() {
  const top = document.getElementById('top-navbar');
  const bottom = document.getElementById('bottom-navbar');
  top.innerHTML = '';
  bottom.innerHTML = '';

  const template = document.getElementById('campaign-pill-template');

  for (const c of state.campaigns) {
    const pillTop = template.content.firstElementChild.cloneNode(true);
    pillTop.textContent = `#${c.hashtag}`;
    pillTop.classList.toggle('active', c.id === state.activeCampaignId);
    pillTop.addEventListener('click', () => selectCampaign(c.id));
    top.appendChild(pillTop);

    const pillBottom = template.content.firstElementChild.cloneNode(true);
    pillBottom.textContent = `#${c.hashtag}`;
    pillBottom.classList.toggle('active', c.id === state.activeCampaignId);
    pillBottom.addEventListener('click', () => selectCampaign(c.id));
    bottom.appendChild(pillBottom);
  }
}

function renderCampaignInfo() {
  const container = document.getElementById('campaign-info');
  const campaign = state.campaigns.find((c) => c.id === state.activeCampaignId);
  if (!campaign) { container.innerHTML = ''; return; }

  const links = [
    campaign.fringenuity_link && ['Fringenuity', campaign.fringenuity_link],
    campaign.imdb_link && ['IMDB', campaign.imdb_link],
    campaign.wiki_link && ['Wiki', campaign.wiki_link],
  ].filter(Boolean);

  container.innerHTML = '';
  container.append(
    el('h1', {}, `${campaign.episode} (${campaign.episode_id})`),
    el('div', { className: 'campaign-meta' },
      el('span', {}, `Hashtag: #${campaign.hashtag}`),
      el('span', {}, `Air date: ${campaign.date}`),
      el('span', {}, `Path: ${campaign.icon_path}`),
    ),
    el('div', { className: 'campaign-links' }, ...links.map(([label, href]) => el('a', { href, target: '_blank', rel: 'noreferrer noopener' }, label)))
  );
}

function renderGallery() {
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = '';
  for (let i = 0; i < state.images.length; i += 1) {
    const img = state.images[i];
    const card = el('div', { className: 'card' });
    const image = el('img', { src: img.src, alt: img.fileName, loading: 'lazy' });
    image.addEventListener('click', () => openLightbox(i));
    const caption = el('div', { className: 'filename' }, img.fileName);
    card.append(image, caption);
    gallery.append(card);
  }
}

function openLightbox(index) {
  state.lightboxIndex = index;
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-image');
  const img = state.images[index];
  lbImg.src = img.src;
  lb.classList.remove('hidden');
  lb.setAttribute('aria-hidden', 'false');
  const download = document.getElementById('download-btn');
  download.href = img.src;
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  lb.classList.add('hidden');
  lb.setAttribute('aria-hidden', 'true');
}

function nextImage(delta) {
  if (state.images.length === 0) return;
  state.lightboxIndex = (state.lightboxIndex + delta + state.images.length) % state.images.length;
  const lbImg = document.getElementById('lightbox-image');
  lbImg.src = state.images[state.lightboxIndex].src;
  const download = document.getElementById('download-btn');
  download.href = state.images[state.lightboxIndex].src;
}

async function handleShare() {
  const img = state.images[state.lightboxIndex];
  const shareUrl = new URL(window.location.href);
  shareUrl.searchParams.set('img', img.src);
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Fringe Matrix', text: img.fileName, url: shareUrl.toString() });
    } catch {}
  } else {
    await navigator.clipboard.writeText(shareUrl.toString());
    alert('Link copied to clipboard');
  }
}

async function selectCampaign(id) {
  state.activeCampaignId = id;
  window.history.replaceState({}, '', `#${id}`);
  renderNavbars();
  renderCampaignInfo();
  const { images } = await fetchJSON(`/api/campaigns/${id}/images`);
  state.images = images;
  renderGallery();
}

async function init() {
  const { campaigns } = await fetchJSON('/api/campaigns');
  state.campaigns = campaigns;
  const hash = window.location.hash.replace('#', '');
  const initial = campaigns.find((c) => c.id === hash) || campaigns[0];
  renderNavbars();
  if (initial) await selectCampaign(initial.id);

  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('next-btn').addEventListener('click', () => nextImage(1));
  document.getElementById('prev-btn').addEventListener('click', () => nextImage(-1));
  document.getElementById('share-btn').addEventListener('click', handleShare);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') nextImage(1);
    else if (e.key === 'ArrowLeft') nextImage(-1);
  });
}

init().catch((e) => {
  console.error(e);
  alert('Failed to initialize app. Check console for details.');
});


