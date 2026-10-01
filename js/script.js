// products is now populated from the backend instead of being hardcoded.
let products = [];
let productLoadError = null;
const WHATSAPP_NUMBER = '919033720758';

document.addEventListener('DOMContentLoaded', () => {
  const t = document.querySelector('.menu-toggle'), n = document.querySelector('.nav-links');
  if (t) t.onclick = () => n.classList.toggle('show');

  const ob = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      if (e.target.classList.contains('stat')) counter(e.target.querySelector('strong'));
      ob.unobserve(e.target);
    }
  }), { threshold: .15 });
  document.querySelectorAll('.reveal').forEach(x => ob.observe(x));

  // Statistics: fetch live numbers from the backend and populate any
  // <strong data-stat="..."> element before its counter animation runs.
  if (document.querySelector('[data-stat]')) loadStatistics();

  if (document.getElementById('productList')) {
    loadProducts().then(() => { render(products); catalog(); });
  }

  const categoryGrid = document.getElementById('categoryProductGrid');
  if (categoryGrid) {
    loadProducts().then(() => renderCategoryProducts(categoryGrid.dataset.category));
  }

  if (document.getElementById('enquiryForm')) formSetup();
});

function counter(el) {
  if (el.dataset.done) return;
  el.dataset.done = 1;
  let target = +el.dataset.target, s = el.dataset.suffix || '', start = performance.now();
  function go(now) {
    let p = Math.min((now - start) / 1200, 1);
    el.textContent = Math.floor(target * p) + s;
    if (p < 1) requestAnimationFrame(go); else el.textContent = target + s;
  }
  requestAnimationFrame(go);
}

// ---- Statistics (GET /api/statistics) ----
async function loadStatistics() {
  try {
    const res = await fetch(`${API_BASE}/statistics`);
    if (!res.ok) throw new Error('Failed to load statistics');
    const stats = await res.json();
    const data = stats.data || stats; // support either {data:{...}} or {...}
    document.querySelectorAll('[data-stat]').forEach(el => {
      const key = el.dataset.stat;
      if (data[key] !== undefined && data[key] !== null) {
        el.dataset.target = data[key];
      }
    });
  } catch (err) {
    // Keep the placeholder numbers already present in the HTML if the
    // API is unreachable, so the site still looks correct offline.
    console.warn('Statistics API unavailable, using placeholder values.', err);
  }
}

// ---- Products (GET /api/products) ----
async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) throw new Error('Failed to load products');
    const body = await res.json();
    const rows = Array.isArray(body) ? body : body.data;
    if (!Array.isArray(rows)) throw new Error('Products API returned an invalid response.');
    products = rows.map(normalizeProduct);
    productLoadError = null;
  } catch (err) {
    console.error('Products API unavailable.', err);
    productLoadError = err;
    products = [];
  }
}

function normalizeProduct(product) {
  const categoryMap = {
    'supari-cutting': 'Betelnut',
    'almond-cutting': 'Almond',
    'cutting-machines': 'Processing'
  };
  const rawCategory = product.category && typeof product.category === 'object'
    ? product.category.name || product.category.categoryName || product.category.categoryId
    : product.category;
  const categoryValue = rawCategory || product.categoryId || product.categoryName || '';
  const category = categoryMap[String(categoryValue).toLowerCase()] || categoryValue;
  const id = product.id || product.productId || product._id || product.slug;
  const name = product.name || product.model || 'Product';
  const description = product.description || product.shortDescription || '';
  return {
    ...product,
    id,
    name,
    category,
    keywords: [product.keywords, product.model, product.productId, product.categoryId, product.slug]
      .filter(Boolean)
      .join(' '),
    image: resolveProductImage(product, category),
    short: product.short || product.shortDescription || description,
    description,
    material: product.material || product.materials || '',
    dimensions: product.dimensions || '',
    technical: product.technical || product.technicalInfo || ''
  };
}

function resolveProductImage(product, category) {
  const categoryText = String(category || '').toLowerCase();
  const fallback = categoryText.includes('almond')
    ? 'assets/images/8e8a6a35-9a85-4e10-8095-39afca0647a9.png'
    : categoryText.includes('betelnut') || categoryText.includes('supari')
      ? 'assets/images/947418eb-9873-41ce-8302-8c2256c72f1d.png'
      : 'assets/images/5c1abfb5-9577-4a7b-94a6-26ca39982110.png';
  const image = product.image || product.featuredImage || product.image_url;
  if (typeof image !== 'string' || !image) return fallback;
  if (/^https?:\/\//i.test(image)) return image;

  const fileName = image.replace(/\\/g, '/').split('/').pop();
  const localImages = new Set([
    '947418eb-9873-41ce-8302-8c2256c72f1d.png',
    '8e8a6a35-9a85-4e10-8095-39afca0647a9.png',
    '5c1abfb5-9577-4a7b-94a6-26ca39982110.png'
  ]);
  return localImages.has(fileName)
    ? `assets/images/${fileName}`
    : fallback;
}

function productBelongsToCategory(product, category) {
  const value = `${product.category} ${product.categoryId || ''} ${product.keywords || ''}`.toLowerCase();
  if (category === 'Betelnut') {
    return value.includes('betelnut') || value.includes('supari');
  }
  if (category === 'Almond') {
    return value.includes('almond');
  }
  return product.category.toLowerCase() === category.toLowerCase();
}

function renderCategoryProducts(category) {
  const list = document.getElementById('categoryProductGrid');
  const noResults = document.getElementById('categoryNoResults');
  if (!list || !noResults) return;

  if (productLoadError) {
    list.innerHTML = '';
    noResults.textContent = 'Products could not be loaded. Please check that the backend is running.';
    noResults.style.display = 'block';
    return;
  }

  const categoryProducts = products.filter(product => productBelongsToCategory(product, category));
  const isAlmondCategory = category === 'Almond';
  list.innerHTML = categoryProducts.map(product => `
    <article class="product-card reveal">
      <img class="category-product-image" src="${product.image}" alt="${product.name}">
      <div class="card-body">
        <h3>${product.name}</h3>
        ${isAlmondCategory && product.model
          ? `<span class="category-product-model">Model: ${escapeHtml(product.model)}</span>`
          : ''}
        <p>${product.short}</p>
        <a class="btn btn-small" href="${isAlmondCategory
          ? `product-detail.html?id=${encodeURIComponent(product.id)}`
          : `enquiry.html?product=${encodeURIComponent(product.name)}`}">${isAlmondCategory ? 'View Details' : 'Request Quote'}</a>
      </div>
    </article>
  `).join('');
  noResults.textContent = `No ${category.toLowerCase()} machines found.`;
  noResults.style.display = categoryProducts.length ? 'none' : 'block';
  list.querySelectorAll('.reveal').forEach(card => card.classList.add('visible'));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function render(items) {
  let list = document.getElementById('productList'), no = document.getElementById('noResults');
  if (productLoadError) {
    list.innerHTML = '';
    no.textContent = 'Products could not be loaded. Please check that the backend is running.';
    no.style.display = 'block';
    return;
  }
  list.innerHTML = items.map(p => `
    <article class="catalog-card" id="${escapeHtml(p.id)}" data-product-id="${escapeHtml(p.id)}"
      tabindex="0" aria-label="View details for ${escapeHtml(p.name)}">
      <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}">
      <div class="card-body">
        <span class="category-tag">${escapeHtml(p.category)}</span>
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.short)}</p>
        <div class="card-actions">
          <button class="btn btn-small" type="button" data-action="view-details">View Details</button>
          <a class="btn btn-small quote-link" href="enquiry.html?product=${encodeURIComponent(p.name)}">Request Quote</a>
        </div>
      </div>
    </article>
  `).join('');
  no.textContent = 'No products found. Try another search.';
  no.style.display = items.length ? 'none' : 'block';
}

function catalog() {
  let cat = 'all', search = document.getElementById('productSearch');
  const list = document.getElementById('productList');
  list.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('a')) return;
    const card = target.closest('.catalog-card');
    if (!card) return;
    navigateToProductDetails(card.dataset.productId);
  });
  list.addEventListener('keydown', event => {
    if (event.target !== event.currentTarget && !(event.target instanceof HTMLElement && event.target.classList.contains('catalog-card'))) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const card = event.target instanceof HTMLElement && event.target.classList.contains('catalog-card')
      ? event.target
      : null;
    if (card) navigateToProductDetails(card.dataset.productId);
  });
  document.querySelectorAll('.filter').forEach(b => b.onclick = () => {
    document.querySelectorAll('.filter').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    cat = b.dataset.category;
    apply();
  });
  search.oninput = apply;
  function apply() {
    let q = search.value.toLowerCase();
    render(products.filter(p => (cat === 'all' || p.category.toLowerCase() === cat.toLowerCase()) && (`${p.name} ${p.model || ''} ${p.productId || ''} ${p.category} ${p.keywords || ''}`).toLowerCase().includes(q)));
  }
}

function navigateToProductDetails(id) {
  if (!id) return;
  window.location.href = `product-detail.html?id=${encodeURIComponent(id)}`;
}

document.addEventListener('click', e => {
  let m = document.getElementById('productModal');
  if (m && (e.target === m || e.target.classList.contains('modal-close'))) {
    m.classList.remove('show');
    document.body.style.overflow = '';
  }
});

// ---- Enquiry form (WhatsApp) ----
function formSetup() {
  let form = document.getElementById('enquiryForm'), sel = document.getElementById('product');
  setupLocationAutocomplete();

  // Populate the product dropdown from the backend so it always matches
  // whatever products currently exist in the database.
  fetch(`${API_BASE}/products`)
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(body => {
      const list = body.data || body;
      list.forEach(p => sel.insertAdjacentHTML('beforeend', `<option value="${p.name}">${p.name}</option>`));
      const pre = new URLSearchParams(location.search).get('product');
      if (pre) sel.value = pre;
    })
    .catch(err => console.error('Could not load product list for enquiry form.', err));

  form.onsubmit = e => {
    e.preventDefault();
    let ok = true;
    const checks = [
      ['name', v => v.trim().length > 1, 'Please enter your full name.'],
      ['phone', v => /^[0-9+\-\s()]{7,20}$/.test(v), 'Please enter a valid phone number.'],
      ['product', v => v !== '', 'Please select a product.'],
      ['message', v => v.trim().length >= 5, 'Please describe your requirements.']
    ];
    checks.forEach(([id, test, msg]) => {
      let x = document.getElementById(id), er = x.parentElement.querySelector('.error');
      if (!test(x.value)) { er.textContent = msg; ok = false; } else er.textContent = '';
    });
    if (!ok) return;

    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const email = document.getElementById('email').value.trim();
    const userLocation = document.getElementById('location').value.trim();
    const product = document.getElementById('product').value.trim();
    const message = document.getElementById('message').value.trim();
    const whatsappMessage = `New Website Enquiry

Name: ${name}
Phone: ${phone}
Email: ${email}
Location: ${userLocation || 'Not provided'}
Product: ${product}

Message:
${message}`;
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;
    const whatsappWindow = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    const successMsg = document.getElementById('formSuccess');
    successMsg.style.color = '';
    successMsg.textContent = whatsappWindow
      ? 'WhatsApp opened with your enquiry. Please press Send to submit it.'
      : 'Please allow pop-ups to open WhatsApp and send your enquiry.';
  };
}

async function setupLocationAutocomplete() {
  const input = document.getElementById('location');
  const container = document.getElementById('locationAutocomplete');
  const hint = document.getElementById('locationHint');
  const apiKey = window.CHAUDHARI_GOOGLE_MAPS_API_KEY;

  const useManualLocation = message => {
    container.hidden = true;
    input.hidden = false;
    hint.textContent = message;
    hint.hidden = false;
  };

  if (!apiKey) {
    useManualLocation('Location suggestions are unavailable. You can enter your city or area manually.');
    return;
  }

  const mapsScript = document.createElement('script');
  mapsScript.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&v=weekly`;
  mapsScript.async = true;

  try {
    await new Promise((resolve, reject) => {
      mapsScript.addEventListener('load', resolve, { once: true });
      mapsScript.addEventListener('error', () => reject(new Error('Google Maps JavaScript API failed to load.')), { once: true });
      document.head.appendChild(mapsScript);
    });

    const { PlaceAutocompleteElement } = await window.google.maps.importLibrary('places');
    const autocomplete = new PlaceAutocompleteElement();
    autocomplete.setAttribute('included-region-codes', 'in');
    autocomplete.setAttribute('placeholder', 'Start typing a city, area, or address');
    autocomplete.addEventListener('input', () => {
      input.value = '';
      hint.textContent = 'Choose a location from the suggestions.';
      hint.hidden = false;
    });
    autocomplete.addEventListener('gmp-select', async event => {
      const place = event.placePrediction.toPlace();
      try {
        await place.fetchFields({ fields: ['formattedAddress'] });
        input.value = place.formattedAddress || place.displayName || '';
        hint.textContent = input.value
          ? 'Location selected.'
          : 'Please select a suggested location or enter one manually.';
        hint.hidden = false;
      } catch (error) {
        console.error('Could not retrieve the selected location.', error);
        useManualLocation('The selected location could not be retrieved. Please enter it manually.');
      }
    });
    autocomplete.addEventListener('gmp-error', event => {
      console.error('Google Places autocomplete returned an error.', event);
      useManualLocation('Location suggestions could not load. You can enter your city or area manually.');
    });

    container.appendChild(autocomplete);
    container.hidden = false;
    input.hidden = true;
    hint.textContent = 'Choose a location from the suggestions.';
    hint.hidden = false;
  } catch (error) {
    console.error('Could not initialize Google Places location suggestions.', error);
    useManualLocation('Location suggestions could not load. You can enter your city or area manually.');
  }
}
