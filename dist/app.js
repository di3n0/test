(() => {
  const grid = document.getElementById('serviceGrid');
  const filters = document.getElementById('serviceFilters');
  const search = document.getElementById('searchInput');
  const empty = document.getElementById('emptyState');
  const toast = document.getElementById('toast');
  let services = [];
  let selectedCategory = 'all';
  let toastTimeout;

  const openIcon = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';

  function showToast(message) {
    document.getElementById('toastText').textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('visible'), 4300);
  }

  function createServiceCard(service, index) {
    const card = document.createElement('article');
    card.className = 'service-card';
    card.style.setProperty('--accent', /^#[0-9a-f]{6}$/i.test(service.accent) ? service.accent : '#528de9');
    card.dataset.group = service.category;
    card.dataset.search = [service.name, service.subtitle, service.description, ...(service.keywords || [])].join(' ').toLocaleLowerCase();

    const visual = document.createElement('div');
    visual.className = 'card-visual';
    const image = document.createElement('img');
    image.src = service.image || 'assets/default-service.svg';
    image.alt = service.imageAlt || `${service.name}示意圖片`;
    image.loading = 'lazy';
    image.onerror = () => { if (!image.src.endsWith('/assets/default-service.svg')) image.src = 'assets/default-service.svg'; };
    visual.append(image);

    const body = document.createElement('div');
    body.className = 'card-body';
    const meta = document.createElement('div');
    meta.className = 'card-meta';
    const dot = document.createElement('i');
    meta.append(dot, document.createTextNode(service.subtitle || '安全服務'));
    const heading = document.createElement('h3');
    heading.textContent = service.name;
    const description = document.createElement('p');
    description.textContent = service.description || '';

    const bottom = document.createElement('div');
    bottom.className = 'card-bottom';
    const number = document.createElement('span');
    number.textContent = `${String(index + 1).padStart(2, '0')} / SECURITY SERVICE`;
    const link = document.createElement('a');
    link.className = 'service-link';
    link.textContent = '進入平台 ';
    link.insertAdjacentHTML('beforeend', openIcon);
    const rawUrl = typeof service.url === 'string' ? service.url.trim() : '';
    let validUrl = '';
    if (rawUrl) {
      try {
        const url = new URL(rawUrl);
        if (['https:', 'http:'].includes(url.protocol)) validUrl = url.href;
      } catch { /* invalid URL; the button will show an explanation */ }
    }
    link.href = validUrl || '#';
    if (validUrl) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `在新分頁開啟${service.name}`);
    } else {
      link.addEventListener('click', event => {
        event.preventDefault();
        showToast(rawUrl ? `「${service.name}」的連結格式有誤，請填入完整 HTTP/HTTPS 網址。` : `「${service.name}」尚未設定入口網址，請於服務清單填入實際連結。`);
      });
    }
    bottom.append(number, link);
    body.append(meta, heading, description, bottom);
    card.append(visual, body);
    return card;
  }

  function updateVisibleCards() {
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    for (const card of grid.children) {
      const match = (selectedCategory === 'all' || card.dataset.group === selectedCategory) && (!query || card.dataset.search.includes(query));
      card.hidden = !match;
      if (match) count++;
    }
    empty.hidden = count > 0;
  }

  function addFilter(label, id) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter' + (id === 'all' ? ' active' : '');
    button.dataset.filter = id;
    button.textContent = label;
    button.setAttribute('aria-pressed', String(id === 'all'));
    button.addEventListener('click', () => {
      selectedCategory = id;
      for (const item of filters.children) {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      }
      updateVisibleCards();
    });
    filters.append(button);
  }

  async function loadServices() {
    try {
      const response = await fetch('data/services.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.services)) throw new Error('Service list is missing');
      services = data.services.filter(item => item && typeof item.name === 'string' && typeof item.category === 'string');
      const countText = String(services.length).padStart(2, '0');
      document.getElementById('heroServiceCount').textContent = countText;
      document.getElementById('headerServiceCount').textContent = countText;

      filters.replaceChildren();
      addFilter('全部服務', 'all');
      const categories = Array.isArray(data.categories) ? data.categories : [];
      categories.filter(category => services.some(service => service.category === category.id)).forEach(category => addFilter(category.label, category.id));
      // Newly added categories also work without changing the website code.
      const known = new Set(categories.map(category => category.id));
      for (const service of services) {
        if (!known.has(service.category)) {
          known.add(service.category);
          addFilter(service.category, service.category);
        }
      }
      grid.replaceChildren(...services.map(createServiceCard));
      updateVisibleCards();
    } catch (error) {
      console.error('Cannot load service directory:', error);
      empty.hidden = false;
      empty.textContent = '服務清單目前無法載入，請確認設定檔已部署。';
      filters.replaceChildren();
    }
  }

  search.addEventListener('input', updateVisibleCards);
  loadServices();
})();
