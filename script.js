// -------------------------
// Constants and State
// -------------------------
const ADMIN_EMAIL = "admin@gmail.com"; // Replace with your admin email in DB
let editId = null;
let selectedCategory = "";
let imageDataUrl = "";
let userFavorites = new Set();
let latestFavorites = null; // holds last-fetched favorites list when viewing favorites
// API base for all frontend requests
const API_URL = "https://pandorasrecipe.onrender.com";

// Elements
const recipeForm = document.getElementById("recipeForm");
const recipeList = document.getElementById("recipeList");
const homeRecipeList = document.getElementById("homeRecipeList");
const favoriteCheckbox = document.getElementById("favoriteCheckbox");
const imageInput = document.getElementById("imageInput");
const previewImage = document.getElementById("previewImage");

const homeSection = document.getElementById("homeSection");
const makeRecipeSection = document.getElementById("makeRecipeSection");
const recipesSection = document.getElementById("recipesSection");

const recipesBtn = document.getElementById("recipesBtn");
const loginBtn = document.getElementById("loginBtn");
const menuToggle = document.getElementById("menuToggle");
const floatingSidebar = document.getElementById("floatingSidebar");
const categoryButtons = document.querySelectorAll(".categoryBtn");
const headerSearchInput = document.getElementById("headerSearchInput");

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const authMessage = document.getElementById("authMessage");

// -------------------------
// Helper Functions
// -------------------------

// Check if current user is admin
function isAdmin() {
  const user = JSON.parse(localStorage.getItem("user"));
  return user && user.is_admin;
}

// Rating helpers
function avgFromRatings(ratings) {
  if (!ratings) return { avg: 0.0, count: 0 };
  const arr = Array.isArray(ratings) ? ratings.map(Number) : Object.values(ratings).map(Number);
  const valid = arr.filter(n => !isNaN(n));
  if (!valid.length) return { avg: 0.0, count: 0 };
  const sum = valid.reduce((a, b) => a + b, 0);
  return { avg: +(sum / valid.length).toFixed(1), count: valid.length };
}

function renderStarsFromAvg(avg) {
  const rounded = Math.max(0, Math.min(5, Number(Math.round(avg))));
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= rounded) html += `<span class="star filled">★</span>`;
    else html += `<span class="star empty">☆</span>`;
  }
  return html;
}

// Show a specific section
function showSection(section) {
  [homeSection, makeRecipeSection, recipesSection].forEach(s => {
    if (s) s.style.display = "none";
  });
  if (section) section.style.display = "flex";
}

// Fetch recipes from backend
async function fetchRecipes(category = "") {
  try {
    const url = category ? `${API_URL}/api/recipes?category=${encodeURIComponent(category)}` : `${API_URL}/api/recipes`;
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });
    return res.ok ? await res.json() : [];
  } catch (err) {
    console.error(err);
    return [];
  }
}

// Load the current user's favorite recipe IDs
async function loadUserFavorites() {
  const token = localStorage.getItem('token');
  if (!token) { userFavorites = new Set(); return; }
  try {
    const res = await fetch(`${API_URL}/api/favorites/ids`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) { userFavorites = new Set(); return; }
    const data = await res.json();
    userFavorites = new Set((data.ids || []));
  } catch (err) {
    console.warn('Failed to load favorites', err);
    userFavorites = new Set();
  }
}

// Add recipe
async function addRecipe(recipeData) {
  try {
    const res = await fetch(`${API_URL}/api/recipes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify(recipeData)
    });
    console.log('POST /api/recipes status', res.status, 'headers', res.headers.get('content-type'));
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        console.error('Add recipe failed (json):', data);
        return { error: data.error || 'Unknown error', status: res.status };
      }
      return { recipe: data.recipe, message: data.message };
    } else {
      // Non-JSON response (likely HTML error page). Grab text for debugging.
      const text = await res.text();
      console.error('Add recipe returned non-JSON response:', res.status, text.slice(0,200));
      return { error: `Non-JSON response (${res.status})`, body: text, status: res.status };
    }
  } catch (err) {
    console.error(err);
    return { error: err.message || 'Network error' };
  }
}

// Update recipe
async function updateRecipe(id, recipeData) {
  try {
    const res = await fetch(`${API_URL}/api/recipes/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify(recipeData)
    });
    return await res.json();
  } catch (err) {
    console.error(err);
  }
}

// Delete recipe
async function deleteRecipe(id) {
  if (!confirm("Are you sure you want to delete this recipe?")) return;
  try {
    const res = await fetch(`${API_URL}/api/recipes/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      }
    });
    const data = await res.json();
    console.log(data.message);
    loadRecipes(); // reload recipes
  } catch (err) {
    console.error(err);
  }
}

// Load a single recipe
async function loadRecipe(id) {
  const recipes = await fetchRecipes();
  return recipes.find(r => r.id == id);
}

// Render recipes in homepage
async function renderHomeRecipes(recipes = null) {
  // Deprecated: home recipe grid replaced with trending rows; keep function available but no-op
  return;
}

  // Render recipes into the home area (below slideshow) for a specific category
  async function renderHomeCategory(category) {
    const listEl = document.getElementById('homeRecipeList');
    if (!listEl) return;
    try {
      const recipes = await fetchRecipes(category || '');
      listEl.innerHTML = '';
      // ensure visible and hide trending rows
      listEl.style.display = 'grid';
      listEl.style.gridTemplateColumns = 'repeat(2, 1fr)';
      const trending = document.getElementById('trendingContainer'); if (trending) trending.style.display = 'none';

      recipes.forEach(r => {
        const ratingInfo = avgFromRatings(r.ratings);
        const card = document.createElement('div');
        card.className = 'recipe-card';
        card.style.position = 'relative';
        card.innerHTML = `
          <div class="recipe-card-flex">
            ${r.image ? `<img src="${r.image}" alt="Recipe Image" class="recipe-img-side">` : `<div class="recipe-img-side placeholder"></div>`}
            <div class="recipe-details-side">
              <div class="card-header">
                <h3 class="recipe-title">${r.title || ''}</h3>
                <button class="fav-btn" data-fav-id="${r.id}" onclick="event.stopPropagation(); toggleFavorite(${r.id});"><span class="heart ${userFavorites.has(r.id)?'favorited':''}">♥</span></button>
                <span class="category-badge">${r.category || ''}</span>
              </div>
              <p class="recipe-description">${((r.description||'').length>140)?(r.description||'').slice(0,137)+'...':(r.description||'')}</p>
              <div class="recipe-meta">${renderStarsFromAvg(ratingInfo.avg)} <span style="margin-left:8px;color:#666;">${ratingInfo.avg}</span></div>
            </div>
          </div>
        `;
        card.onclick = () => window.location.href = `recipe.html?id=${r.id}`;
        listEl.appendChild(card);
      });
    } catch (err) {
      console.error('renderHomeCategory error', err);
    }
  }

// Render recipes tab
async function renderRecipes(recipes = null) {
  if (!recipeList) return;
  if (!recipes) recipes = await fetchRecipes(selectedCategory);
  // apply alphabetical sort if selected in recipes header
  const recipesSort = document.getElementById('recipesSortSelect')?.value || 'none';
  recipes = sortByTitle(recipes, recipesSort);

  recipeList.innerHTML = "";
  recipes.forEach(r => {
    const ratingInfo = avgFromRatings(r.ratings);
    const avgRatingStr = ratingInfo.avg.toFixed ? ratingInfo.avg.toFixed(1) : String(ratingInfo.avg);
    const card = document.createElement("div");
    card.className = "recipe-card";
    card.style.cursor = "pointer";
    card.style.position = "relative";

    const heartHTML = `<button class="fav-btn" data-fav-id="${r.id}" onclick="event.stopPropagation(); toggleFavorite(${r.id});" aria-label="Toggle favorite"><span class="heart ${userFavorites.has(r.id) ? 'favorited' : ''}">♥</span></button>`;

    let adminButtonsHTML = "";
    if (isAdmin()) {
      adminButtonsHTML = `
        <div class="recipe-card-admin-buttons" style="position: absolute; top: 12px; right: 12px; display: flex; gap: 8px; z-index: 10;">
          <button class="recipe-edit-btn" onclick="event.stopPropagation(); editRecipe('${r.id}')" style="background:#4caf50; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:0.9rem; font-weight:bold;">Edit</button>
          <button class="recipe-delete-btn" onclick="event.stopPropagation(); deleteRecipe('${r.id}')" style="background:#e53935; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:0.9rem; font-weight:bold;">Delete</button>
        </div>
      `;
    }

    card.innerHTML = `
      ${adminButtonsHTML}
      <div class="recipe-card-flex">
        ${r.image ? `<img src="${r.image}" alt="Recipe Image" class="recipe-img-side">` : `<div class="recipe-img-side placeholder"></div>`}
        <div class="recipe-details-side">
          <div class="card-header">
            <h3 class="recipe-title">${(r.title || '')}</h3>
            ${heartHTML}
            <span class="category-badge">${r.category || ''}</span>
          </div>
          <p class="recipe-description">${((r.description || '').length > 140) ? (r.description || '').slice(0,137) + '...' : (r.description || '')}</p>
          <div class="recipe-meta">
            <span class="recipe-rating">${renderStarsFromAvg(ratingInfo.avg)} <span style="margin-left:8px;color:#666;">${avgRatingStr}</span></span>
            <span class="recipe-review-count">${ratingInfo.count ? (ratingInfo.count + ' ratings') : ((r.reviews && r.reviews.length) ? (r.reviews.length + ' reviews') : '')}</span>
          </div>
        </div>
      </div>
    `;
    card.onclick = () => window.location.href = `recipe.html?id=${r.id}`;
    recipeList.appendChild(card);
  });
}

// Render user's favorites in a card grid (old-style favorites view)
async function renderFavorites(recipes = null) {
  const favList = document.getElementById('favoritesList');
  if (!favList) return;
  favList.innerHTML = '';
  if (!recipes) {
    // try to load from server
    try {
      const res = await fetch(`${API_URL}/api/favorites`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      if (!res.ok) return;
      recipes = await res.json();
    } catch (e) { console.error('Failed to fetch favorites', e); return; }
  }

  // apply alphabetical sort if selected in favorites header
  const favSort = document.getElementById('favSortSelect')?.value || 'none';
  recipes = sortByTitle(recipes, favSort);

  // render each recipe similar to recipe cards
  recipes.forEach(r => {
    const ratingInfo = avgFromRatings(r.ratings);
    const avgRatingStr = ratingInfo.avg.toFixed ? ratingInfo.avg.toFixed(1) : String(ratingInfo.avg);
    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.style.cursor = 'pointer';
    card.style.position = 'relative';

    let adminButtonsHTML = '';
    if (isAdmin()) {
      adminButtonsHTML = `
        <div class="recipe-card-admin-buttons" style="position: absolute; top: 12px; right: 12px; display: flex; gap: 8px; z-index: 10;">
          <button class="recipe-edit-btn" onclick="event.stopPropagation(); editRecipe('${r.id}')" style="background:#4caf50; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:0.9rem; font-weight:bold;">Edit</button>
          <button class="recipe-delete-btn" onclick="event.stopPropagation(); deleteRecipe('${r.id}')" style="background:#e53935; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:0.9rem; font-weight:bold;">Delete</button>
        </div>
      `;
    }

    const heartHTML = `<button class="fav-btn" data-fav-id="${r.id}" onclick="event.stopPropagation(); toggleFavorite(${r.id});" aria-label="Toggle favorite"><span class="heart ${userFavorites.has(r.id) ? 'favorited' : ''}">♥</span></button>`;

    card.innerHTML = `
      ${adminButtonsHTML}
      <div class="recipe-card-flex">
        ${r.image ? `<img src="${r.image}" alt="Recipe Image" class="recipe-img-side">` : `<div class="recipe-img-side placeholder"></div>`}
        <div class="recipe-details-side">
          <div class="card-header">
            <h3 class="recipe-title">${(r.title || '')}</h3>
            ${heartHTML}
            <span class="category-badge">${r.category || ''}</span>
          </div>
          <p class="recipe-description">${((r.description || '').length > 140) ? (r.description || '').slice(0,137) + '...' : (r.description || '')}</p>
          <div class="recipe-meta">
            <span class="recipe-rating">${renderStarsFromAvg(ratingInfo.avg)} <span style="margin-left:8px;color:#666;">${avgRatingStr}</span></span>
            <span class="recipe-review-count">${ratingInfo.count ? (ratingInfo.count + ' ratings') : ((r.reviews && r.reviews.length) ? (r.reviews.length + ' reviews') : '')}</span>
          </div>
        </div>
      </div>
    `;

    card.onclick = () => window.location.href = `recipe.html?id=${r.id}`;
    favList.appendChild(card);
  });
}

// Toggle favorite for current user
window.toggleFavorite = async function(recipeId) {
  try {
    const token = localStorage.getItem('token');
    if (!token) return alert('Please log in to favorite recipes.');
    const res = await fetch(`${API_URL}/api/favorites/${recipeId}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    let data;
    try { data = await res.json(); } catch(e) { data = null; }
    if (!res.ok) {
      console.error('Toggle favorite failed', res.status, data);
      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return alert('Session expired — please log in again.');
      }
      return alert((data && (data.error || data.message)) || ('Failed to update favorite (' + res.status + ')'));
    }
    if (data.added) userFavorites.add(Number(recipeId));
    if (data.removed) {
      userFavorites.delete(Number(recipeId));
      // if we're viewing favorites list, remove the card
      const favList = document.getElementById('favoritesList');
      if (favList) {
        const btnEl = document.querySelector(`[data-fav-id=\"${recipeId}\"]`);
        if (btnEl) {
          const card = btnEl.closest && btnEl.closest('.recipe-card');
          if (card && card.parentNode) card.parentNode.removeChild(card);
        }
      }
    }
    // update any heart displays for this recipe on the page
    document.querySelectorAll(`[data-fav-id=\"${recipeId}\"] .heart`).forEach(el => {
      if (userFavorites.has(Number(recipeId))) el.classList.add('favorited'); else el.classList.remove('favorited');
    });
  } catch (err) {
    console.error(err);
  }
};

// Build home slideshow using up to 10 random recipe images
async function buildHomeSlideshow() {
  try {
    const recipes = await fetchRecipes();
    const imgs = recipes.filter(r => r.image).map(r => ({url: r.image, title: r.title || '', id: r.id}));
    if (!imgs.length) return;
    // pick up to 10 random unique images
    const shuffled = imgs.sort(() => 0.5 - Math.random());
    const chosen = shuffled.slice(0, 10);
    const slidesContainer = document.getElementById('homeDynamicSlides');
    slidesContainer.innerHTML = '';
    chosen.forEach((s, i) => {
      const img = document.createElement('img');
      img.src = s.url;
      img.className = 'slide' + (i === 0 ? ' active' : '');
      img.style.objectFit = 'cover';
      img.style.width = '100%';
      img.style.height = '100%';
      img.dataset.title = s.title;
      slidesContainer.appendChild(img);
    });

    // auto-advance every SLIDE_INTERVAL (ms) with pause-on-hover and usable arrows
    const SLIDE_INTERVAL = 3000; // 3 seconds
    let idx = 0; // points to the index that will be shown by showIndex
    const slidesList = () => Array.from(document.querySelectorAll('#homeDynamicSlides .slide'));

    function showIndex(i) {
      const s = slidesList();
      if (!s.length) return;
      const normalized = ((i % s.length) + s.length) % s.length;
      s.forEach((el, j) => el.classList.toggle('active', j === normalized));
      const caption = document.getElementById('homeSlideCaption');
      if (caption) { caption.style.display = 'block'; caption.textContent = s[normalized].dataset.title || ''; }
      // set idx to next index to show on auto-advance
      idx = (normalized + 1) % s.length;
    }

    function advance() { showIndex(idx); }

    // clear any existing interval
    if (window._homeSlideshowInterval) clearInterval(window._homeSlideshowInterval);
    advance();
    window._homeSlideshowInterval = setInterval(advance, SLIDE_INTERVAL);

    // pause on hover (mouse enter/leave on slideshow container)
    const slideshowEl = document.getElementById('categorySlideshow');
    if (slideshowEl) {
      slideshowEl.addEventListener('mouseenter', () => {
        if (window._homeSlideshowInterval) {
          clearInterval(window._homeSlideshowInterval);
          window._homeSlideshowInterval = null;
        }
      });
      slideshowEl.addEventListener('mouseleave', () => {
        if (!window._homeSlideshowInterval) {
          window._homeSlideshowInterval = setInterval(advance, SLIDE_INTERVAL);
        }
      });
    }

    // wire up prev/next buttons to be usable
    const prevBtn = document.querySelector('.slide-btn.prev');
    const nextBtn = document.querySelector('.slide-btn.next');
    if (prevBtn) {
      prevBtn.onclick = (e) => {
        e.stopPropagation();
        const s = slidesList();
        if (!s.length) return;
        // current visible index is (idx - 1)
        const current = (idx - 1 + s.length) % s.length;
        const prevIndex = (current - 1 + s.length) % s.length;
        showIndex(prevIndex);
      };
    }
    if (nextBtn) {
      nextBtn.onclick = (e) => {
        e.stopPropagation();
        const s = slidesList();
        if (!s.length) return;
        const current = (idx - 1 + s.length) % s.length;
        const nextIndex = (current + 1) % s.length;
        showIndex(nextIndex);
      };
    }
  } catch (err) {
    console.error('buildHomeSlideshow error', err);
  }
}

// Compute top N recipes by avg rating for a category
function topNByCategory(recipes, category, n = 8) {
  const byCat = recipes.filter(r => (r.category || '').toString().trim().toLowerCase() === (category || '').toString().trim().toLowerCase());
  const withAvg = byCat.map(r => ({ r, avg: avgFromRatings(r.ratings).avg }));
  withAvg.sort((a,b) => b.avg - a.avg);
  return withAvg.slice(0,n).map(x => x.r);
}

// Render trending rows into their containers
async function renderTrendingRows() {
  try {
    await loadUserFavorites();
    const recipes = await fetchRecipes();
    const breakfast = topNByCategory(recipes, 'Breakfast', 8);
    const lunch = topNByCategory(recipes, 'Lunch', 8);
    const dinner = topNByCategory(recipes, 'Dinner', 8);
    const desserts = topNByCategory(recipes, 'Desserts', 8);

    const mapping = [ ['trendingBreakfast', breakfast], ['trendingLunch', lunch], ['trendingDinner', dinner], ['trendingDesserts', desserts] ];
    for (const [id, list] of mapping) {
      const container = document.getElementById(id);
      if (!container) continue;
      container.innerHTML = '';
      if (!list || !list.length) {
        const el = document.createElement('div');
        el.style.padding = '18px';
        el.style.color = '#666';
        el.textContent = 'No trending recipes yet in this category.';
        container.appendChild(el);
        continue;
      }
      list.forEach(r => {
        const ratingInfo = avgFromRatings(r.ratings);
        const card = document.createElement('div');
        card.className = 'recipe-card flip-card';
        const inner = document.createElement('div');
        inner.className = 'flip-card-inner';

        const front = document.createElement('div');
        front.className = 'flip-card-front';
        front.innerHTML = `
          ${r.image ? `<img src="${r.image}" style="width:100%; height:140px; object-fit:cover; border-radius:10px;">` : `<div style="height:140px;background:#eee;border-radius:10px"></div>`}
          <div style="padding:10px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div style="font-weight:700;">${r.title || ''}</div>
              <div style="font-size:0.95rem; color:#666;">${renderStarsFromAvg(ratingInfo.avg)} <span style="margin-left:6px;">${ratingInfo.avg}</span></div>
            </div>
            <div style="margin-top:8px; color:#444; font-size:0.95rem;">${(r.description||'').slice(0,100)}${(r.description||'').length>100? '...':''}</div>
            <div class="card-buttons">
              <button class="btn view" onclick="event.stopPropagation(); window.location.href='recipe.html?id=${r.id}'">View Recipe</button>
              <button class="btn fav ${userFavorites.has(r.id)?'favorited':''}" onclick="event.stopPropagation(); toggleFavorite(${r.id}); this.classList.toggle('favorited');">Favorite</button>
            </div>
          </div>
        `;

        const back = document.createElement('div');
        back.className = 'flip-card-back';
        // show first review text and date if exists
        const firstReview = (r.reviews && r.reviews.length) ? r.reviews[0] : null;
        function formatDateStr(d) {
          if (!d) return '';
          try {
            const dt = new Date(d);
            if (isNaN(dt.getTime())) return d;
            return dt.toLocaleString();
          } catch (e) { return d; }
        }
        if (firstReview) {
          const reviewer = firstReview.reviewer || firstReview.uid || 'Anonymous';
          const text = firstReview.text || firstReview.comment || firstReview.body || 'No review text';
          const date = firstReview.created_at || firstReview.createdAt || firstReview.date || null;
          back.innerHTML = `
            <div style="font-weight:700; margin-bottom:8px;">Review</div>
            <div style="color:#333; font-size:0.95rem; margin-bottom:6px;">${escapeHtml(text)}</div>
            <div style="font-size:0.85rem; color:#666;">— ${escapeHtml(reviewer)} • ${formatDateStr(date)}</div>
          `;
        } else {
          back.innerHTML = `<div style="font-weight:700; margin-bottom:8px;">Review</div><div style="color:#333">No comments yet</div>`;
        }

        inner.appendChild(front);
        inner.appendChild(back);
        card.appendChild(inner);

        // flip on click
        card.addEventListener('click', () => {
          card.classList.toggle('flipped');
        });

        container.appendChild(card);
      });
    }
  } catch (err) {
    console.error('renderTrendingRows error', err);
  }
}

// small helper to escape HTML in user content
function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Sort helper: alphabetical by title
function sortByTitle(list, order) {
  if (!list || !Array.isArray(list)) return list;
  if (!order || order === 'none') return list;
  const copy = list.slice();
  copy.sort((a, b) => {
    const A = (a.title || '').toLowerCase();
    const B = (b.title || '').toLowerCase();
    if (A < B) return order === 'asc' ? -1 : 1;
    if (A > B) return order === 'asc' ? 1 : -1;
    return 0;
  });
  return copy;
}

// -------------------------
// Event Listeners
// -------------------------

// Navigation
recipesBtn?.addEventListener("click", () => {
  showSection(recipesSection);
  // show recipes header and hide slideshow/favorites header
  const recHdr = document.getElementById('recipesHeaderContainer'); if (recHdr) recHdr.style.display = 'block';
  const ss = document.getElementById('slideshowContainer'); if (ss) ss.style.display = 'none';
  const favHdr = document.getElementById('favoritesHeaderContainer'); if (favHdr) favHdr.style.display = 'none';
  const trending = document.getElementById('trendingContainer'); if (trending) trending.style.display = 'flex';
  // clear any favorites state
  latestFavorites = null;
  // reset selected category so the recipes header buttons control filtering
  selectedCategory = '';
  // clear active states for fav/category buttons
  document.querySelectorAll('.favCategoryBtn, .categoryFilterBtn').forEach(b => b.classList.remove('active'));
  renderRecipes();
});
const favoritesBtn = document.getElementById('favoritesBtn');
favoritesBtn?.addEventListener('click', async () => {
  // show user's favorites in the home section
  if (!localStorage.getItem('token')) return alert('Please log in to view favorites.');
  showSection(homeSection);
  try {
    await loadUserFavorites();
    const res = await fetch(`${API_URL}/api/favorites`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    if (!res.ok) {
      // try to parse json error message
      let bodyText = '';
      try {
        const json = await res.json(); bodyText = json.error || json.message || JSON.stringify(json);
      } catch (e) {
        bodyText = await res.text().catch(() => 'Unable to read error');
      }
      console.warn('Favorites load failed', res.status, bodyText);
      if (res.status === 401) {
        // token invalid/expired — clear stored auth and prompt login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return alert('Session expired or unauthorized. Please log in again.');
      }
      return alert('Failed to load favorites: ' + (bodyText || res.status));
    }
    const favs = await res.json();
    // hide the slideshow and show favorites header
    const ss = document.getElementById('slideshowContainer'); if (ss) ss.style.display = 'none';
    const favHdr = document.getElementById('favoritesHeaderContainer'); if (favHdr) favHdr.style.display = 'block';
    const catTitle = document.getElementById('categoryTitleContainer'); if (catTitle) catTitle.style.display = 'none';
    // clear global selectedCategory and set latestFavorites
    selectedCategory = '';
    latestFavorites = favs;
    // show favorites list (old-style) instead of trending rows
    const trending = document.getElementById('trendingContainer'); if (trending) trending.style.display = 'none';
    const favList = document.getElementById('favoritesList'); if (favList) favList.style.display = 'flex';
    renderFavorites(favs);
  } catch (err) {
    console.error(err);
    alert('Error loading favorites');
  }
});

// Favorites category buttons: filter only within favorites
document.addEventListener('click', (e) => {
  const btn = e.target.closest && e.target.closest('.favCategoryBtn');
  if (!btn) return;
  e.preventDefault();
  const cat = btn.dataset.category || '';
  // set selectedCategory and re-render using latestFavorites
  selectedCategory = cat;
  // highlight active
  document.querySelectorAll('.favCategoryBtn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (!latestFavorites) {
    // reload favorites from server and then filter
    (async () => {
      await loadUserFavorites();
      const res = await fetch(`${API_URL}/api/favorites`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      if (!res.ok) {
        let body = '';
        try { body = JSON.stringify(await res.json()); } catch(e){ body = await res.text().catch(()=> ''); }
        return alert('Failed to load favorites: ' + (body || res.status));
      }
      latestFavorites = await res.json();
      // render filtered favorites
      const filtered = (selectedCategory ? latestFavorites.filter(r => ((r.category||'').toString().trim().toLowerCase()) === selectedCategory.toString().trim().toLowerCase()) : latestFavorites);
      renderFavorites(filtered);
    })();
  } else {
    const filtered = (selectedCategory ? latestFavorites.filter(r => ((r.category||'').toString().trim().toLowerCase()) === selectedCategory.toString().trim().toLowerCase()) : latestFavorites);
    renderFavorites(filtered);
  }
});

// Recipes category filter buttons
document.addEventListener('click', (e) => {
  const btn = e.target.closest && e.target.closest('.categoryFilterBtn');
  if (!btn) return;
  e.preventDefault();
  const cat = btn.dataset.category || '';
  selectedCategory = cat;
  // highlight active in recipes buttons
  document.querySelectorAll('.categoryFilterBtn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // ensure recipes header visible
  const recHdr = document.getElementById('recipesHeaderContainer'); if (recHdr) recHdr.style.display = 'block';
  // hide favorites header if visible
  const favHdr = document.getElementById('favoritesHeaderContainer'); if (favHdr) favHdr.style.display = 'none';
  // render recipes with selectedCategory
  renderRecipes();
});
loginBtn?.addEventListener("click", () => window.location.href = "auth.html");

// Category buttons
categoryButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    // set selected category and highlight
    selectedCategory = btn.dataset.category;
    // highlight active button
    document.querySelectorAll('.categoryBtn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById("slideshowContainer").style.display = "none";
    document.getElementById("categoryTitleContainer").style.display = "block";
    document.getElementById("categoryTitle").textContent = selectedCategory;
    // If Favorites view is active, render favorites filtered by this category
    const favHdr = document.getElementById('favoritesHeaderContainer');
    const favListEl = document.getElementById('favoritesList');
    if (favHdr && favHdr.style.display === 'block' && latestFavorites) {
      // filter latestFavorites and render favorites
      selectedCategory = btn.dataset.category || '';
      const filtered = latestFavorites.filter(r => ((r.category || '').toString().trim().toLowerCase()) === (selectedCategory || '').toString().trim().toLowerCase() || !selectedCategory);
      renderFavorites(filtered);
    } else {
      // show recipes view filtered by this category
      showSection(recipesSection);
      const recHdr = document.getElementById('recipesHeaderContainer'); if (recHdr) recHdr.style.display = 'block';
      const trending = document.getElementById('trendingContainer'); if (trending) trending.style.display = 'none';
      // render recipes (renderRecipes reads selectedCategory when fetching)
      renderRecipes();
    }
    if (floatingSidebar) floatingSidebar.style.display = "none";
  });
});

// Floating sidebar toggle
menuToggle?.addEventListener("click", () => {
  if (!floatingSidebar) return;
  floatingSidebar.style.display = floatingSidebar.style.display === 'block' ? 'none' : 'block';
});

// Sort select listeners: re-render when changed
document.getElementById('recipesSortSelect')?.addEventListener('change', () => {
  // only when recipes view is visible
  if (recipesSection && recipesSection.style.display !== 'none') renderRecipes();
});
document.getElementById('favSortSelect')?.addEventListener('change', () => {
  // re-render favorites if visible; use latestFavorites if available
  const favHdr = document.getElementById('favoritesHeaderContainer');
  if (favHdr && favHdr.style.display === 'block') {
    renderFavorites(latestFavorites);
  }
});

// Clear category
document.getElementById("clearCategoryBtn")?.addEventListener("click", () => {
  selectedCategory = "";
  document.getElementById("slideshowContainer").style.display = "block";
  document.getElementById("categoryTitleContainer").style.display = "none";
  renderHomeRecipes();
});

// Image preview
// Image preview + client-side resize/compression + automatic upload
imageInput?.addEventListener("change", function() {
  const file = imageInput.files[0];
  if (!file) return;

  const MAX_DIM = 900; // max width/height in px (reduced)
  const TARGET_BYTES = 500000; // target ~500 KB

  showSpinner('Resizing image...');

  const reader = new FileReader();
  reader.onload = async (e) => {
    const img = new Image();
    img.onload = async () => {
      let width = img.width;
      let height = img.height;

      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round(height * (MAX_DIM / width));
          width = MAX_DIM;
        } else {
          width = Math.round(width * (MAX_DIM / height));
          height = MAX_DIM;
        }
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      function toDataURLWithQuality(q, mime) {
        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        return canvas.toDataURL(mime, q);
      }

      let quality = 0.8;
      let mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      let dataUrl = toDataURLWithQuality(quality, mime);

      while (dataUrl.length > TARGET_BYTES && quality > 0.35) {
        quality -= 0.1;
        dataUrl = toDataURLWithQuality(quality, mime === 'image/png' ? 'image/jpeg' : mime);
      }

      while (dataUrl.length > TARGET_BYTES && (width > 400 || height > 400)) {
        width = Math.round(width * 0.8);
        height = Math.round(height * 0.8);
        dataUrl = toDataURLWithQuality(Math.max(quality - 0.1, 0.4), 'image/jpeg');
      }

      // Convert dataURL to Blob
      try {
        const blob = await (await fetch(dataUrl)).blob();
        // Quick client-side checks before upload
        const token = localStorage.getItem('token');
        const user = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch(e){ return null } })();
        if (!token) {
          alert('Please log in before uploading images.');
          hideSpinner();
          return;
        }
        // check token expiry (simple base64 decode of payload)
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            if (payload.exp && (payload.exp * 1000) < Date.now()) {
              alert('Session expired — please log in again.');
              hideSpinner();
              return;
            }
          }
        } catch (e) {
          // ignore parse errors
        }
        // require admin for upload (server enforces it too)
        if (!user || !user.is_admin) {
          alert('Image uploads require an admin account.');
          hideSpinner();
          return;
        }

        // Upload to server
        showSpinner('Uploading image...');
        const form = new FormData();
        form.append('image', blob, file.name || 'upload.jpg');
        const uploadRes = await fetch(`${API_URL}/api/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: form
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          console.error('Upload failed', uploadData);
          alert('Image upload failed: ' + (uploadData.error || uploadData.message || uploadRes.status));
          // fallback to using inline dataUrl as last resort
          imageDataUrl = dataUrl;
        } else {
          // server returns public URL in uploadData.url
          imageDataUrl = uploadData.url || uploadData.filename ? `/uploads/${uploadData.filename}` : dataUrl;
        }
        previewImage.src = imageDataUrl;
        previewImage.style.display = 'block';
      } catch (err) {
        console.error('Image processing/upload failed', err);
        imageDataUrl = dataUrl;
        previewImage.src = imageDataUrl;
        previewImage.style.display = 'block';
      } finally {
        hideSpinner();
      }
    };
    img.onerror = () => {
      imageDataUrl = e.target.result;
      previewImage.src = imageDataUrl;
      previewImage.style.display = 'block';
      hideSpinner();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

// Spinner UI
function showSpinner(text = 'Working...') {
  let overlay = document.getElementById('uploadSpinnerOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'uploadSpinnerOverlay';
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0,0,0,0.4)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';
    overlay.style.color = '#fff';
    overlay.style.fontSize = '1.2rem';
    overlay.innerHTML = `<div style="padding:18px 24px; background:#333; border-radius:8px; display:flex; gap:12px; align-items:center;"><div class='spinner' style='width:22px;height:22px;border:3px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite'></div><div id='uploadSpinnerText'></div></div>`;
    document.body.appendChild(overlay);
    const style = document.createElement('style');
    style.innerHTML = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }
  document.getElementById('uploadSpinnerText').textContent = text;
  overlay.style.display = 'flex';
}

function hideSpinner() {
  const overlay = document.getElementById('uploadSpinnerOverlay');
  if (overlay) overlay.style.display = 'none';
}

// Add/Edit Recipe
recipeForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdmin()) return;

  const recipeData = {
    title: document.getElementById("title").value.trim(),
    description: document.getElementById("description").value.trim(),
    ingredients: document.getElementById("ingredients").value.trim(),
    instructions: document.getElementById("instructions").value.trim(),
    category: document.getElementById("category").value,
    favorite: favoriteCheckbox.checked,
    image: imageDataUrl
  };

  // Prevent sending extremely large base64 images that may trigger 413 Payload Too Large.
  if (recipeData.image && recipeData.image.length > 1500000) {
    // If image is huge, drop it and warn the user. Recommend compressing the image.
    alert('The selected image is too large to upload. The recipe will be saved without the image. Please resize or pick a smaller image and edit the recipe later.');
    recipeData.image = null;
  }

  if (!recipeData.title || !recipeData.ingredients || !recipeData.instructions || !recipeData.category) return;

  if (editId) {
    const result = await updateRecipe(editId, recipeData);
    if (result && result.error) {
      alert('Update failed: ' + result.error);
      return;
    }
    editId = null;
  } else {
    const result = await addRecipe(recipeData);
    if (result && result.error) {
      alert('Save failed: ' + result.error);
      return;
    }
  }

  recipeForm.reset();
  previewImage.style.display = 'none';
  imageDataUrl = '';
  showSection(homeSection);
  loadRecipes();
});

// Edit Recipe
window.editRecipe = async function(id) {
  const r = await loadRecipe(id);
  document.getElementById("title").value = r.title;
  document.getElementById("description").value = r.description || "";
  document.getElementById("ingredients").value = r.ingredients;
  document.getElementById("instructions").value = r.instructions;
  document.getElementById("category").value = r.category;
  favoriteCheckbox.checked = r.favorite;
  previewImage.src = r.image || '';
  previewImage.style.display = r.image ? 'block' : 'none';
  imageDataUrl = r.image || '';
  editId = id;
  showSection(makeRecipeSection);
};

// Delete Recipe
window.deleteRecipe = deleteRecipe;

// Search: live filter + Enter behavior
headerSearchInput?.addEventListener("input", async () => {
  const q = (headerSearchInput.value || '').toString().trim().toLowerCase();
  const isRecipesVisible = recipesSection && recipesSection.style.display !== 'none';
  if (isRecipesVisible) {
    // live filter within the Recipes section
    try {
      let recipes = await fetchRecipes(selectedCategory);
      if (q) {
        recipes = recipes.filter(r => (((r.title||'') + ' ' + (r.description||'') + ' ' + (r.ingredients||'')).toLowerCase().includes(q)));
      }
      renderRecipes(recipes);
    } catch (err) {
      console.error('Search filter error', err);
    }
  } else {
    // keep existing behavior for home (deprecated home renderer preserved)
    renderHomeRecipes();
  }
});

headerSearchInput?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const q = (headerSearchInput.value || '').toString().trim();
    const isIndex = /index\.html?$/.test(window.location.pathname) || window.location.pathname === '/' || window.location.pathname.endsWith('/');
    const isRecipesVisible = recipesSection && recipesSection.style.display !== 'none';
    if (!q) {
      // empty search -> show all
      selectedCategory = '';
      if (isIndex) renderHomeRecipes();
      else if (isRecipesVisible) renderRecipes();
      else window.location.href = 'index.html';
    } else {
      if (isIndex) {
        // already on index: just render with current input
        renderHomeRecipes();
      } else if (isRecipesVisible) {
        // render filtered recipes in-place
        try {
          let recipes = await fetchRecipes(selectedCategory);
          recipes = recipes.filter(r => (((r.title||'') + ' ' + (r.description||'') + ' ' + (r.ingredients||'')).toLowerCase().includes(q.toLowerCase())));
          renderRecipes(recipes);
        } catch (err) { console.error('Search enter error', err); }
      } else {
        // navigate to index and apply query param
        window.location.href = `index.html?q=${encodeURIComponent(q)}`;
      }
    }
  }
});

// Apply `q` query param to header search when landing on index from other pages
try {
  const params = new URLSearchParams(window.location.search);
  const qParam = params.get('q') || params.get('search') || '';
  if (qParam && headerSearchInput) {
    headerSearchInput.value = qParam;
    // trigger a render after a short delay so DOM is ready
    setTimeout(() => { headerSearchInput.dispatchEvent(new Event('input')); }, 80);
  }
} catch (err) { /* ignore on pages without window.search */ }

// Initial load
async function loadRecipes() {
  await loadUserFavorites();
  // build slideshow and trending rows for home
  buildHomeSlideshow();
  renderTrendingRows();
  // also prepare recipes list
  const recipes = await fetchRecipes();
  renderRecipes(recipes);
}
loadRecipes();

// Update admin controls
function updateAdminControls() {
  // Toggle all admin button containers (there may be multiple in the DOM)
  const adminContainers = document.querySelectorAll('#adminButtonContainer');
  adminContainers.forEach(c => { c.style.display = isAdmin() ? 'block' : 'none'; });
}
updateAdminControls();

// Attach click handlers to any "Add Recipe" buttons (may be multiple in DOM)
document.querySelectorAll('#addRecipeBtn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    // Only allow admins to open the form
    if (!isAdmin()) return alert('Admin access required');
    editId = null;
    if (recipeForm) recipeForm.reset();
    if (previewImage) { previewImage.style.display = 'none'; previewImage.src = ''; }
    imageDataUrl = '';
    showSection(makeRecipeSection);
  });
});

// -------------------------
// Auth Page (Login/Register)
// -------------------------
if (loginForm && signupForm && authMessage) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authMessage.textContent = "";

    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        authMessage.textContent = "Logged in successfully!";
        authMessage.className = "auth-success";

        if (data.user.is_admin) window.location.href = "admin.html";
        else window.location.href = "index.html";
      } else {
        authMessage.textContent = data.error;
        authMessage.className = "";
      }
    } catch (err) {
      authMessage.textContent = "Server error. Try again.";
      authMessage.className = "";
    }
  });

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authMessage.textContent = "";

    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok) {
        authMessage.textContent = "Account created! You can now log in.";
        authMessage.className = "auth-success";
        setTimeout(() => {
          signupForm.reset();
          showLogin();
        }, 1200);
      } else {
        authMessage.textContent = data.error;
        authMessage.className = "";
      }
    } catch (err) {
      authMessage.textContent = "Server error. Try again.";
      authMessage.className = "";
    }
  });
}

// -------------------------
// DOMContentLoaded: User Info & Logout
// -------------------------
document.addEventListener("DOMContentLoaded", function() {
  const loginBtn = document.getElementById("loginBtn");
  const userInfoSpan = document.getElementById("userInfoSpan");
  const user = JSON.parse(localStorage.getItem("user"));
  if (loginBtn && userInfoSpan) {
    if (user) {
      userInfoSpan.textContent = user.email;
      loginBtn.textContent = "Log Out";
      loginBtn.onclick = () => {
        localStorage.clear();
        window.location.reload();
      };
    } else {
      userInfoSpan.textContent = "";
      loginBtn.textContent = "Log In";
      loginBtn.onclick = () => window.location.href = "auth.html";
    }
  }
});

app.get("/api/test-db", async (req, res) => {
  try {
    // Check connection
    const result = await pool.query("SELECT COUNT(*) FROM recipes");
    
    // Send response
    res.json({
      message: "Database connected successfully!",
      recipes_count: result.rows[0].count
    });
  } catch (err) {
    console.error("Database test error:", err);
    res.json({ error: err.message || "Unknown error" });
  }
});
