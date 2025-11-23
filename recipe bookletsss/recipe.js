// Backend-driven recipe detail page (uses REST API instead of Firebase)
const API_URL = "https://pandorasrecipe.onrender.com";

function resolveImageUrl(url) {
  if (!url) return '';
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return API_URL.replace(/\/$/, '') + trimmed;
  return trimmed;
}
function getRecipeId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

const recipeId = getRecipeId();
if (!recipeId) window.location.href = 'index.html';

async function fetchRecipe(id) {
  try {
    const res = await fetch(`${API_URL}/api/recipes/${id}`);
    if (!res.ok) throw new Error('Recipe not found');
    return await res.json();
  } catch (err) {
    console.error('Fetch recipe failed', err);
    return null;
  }
}

function renderStars(rating) {
  let html = '';
  const r = Number(rating) || 0;
  for (let i = 1; i <= 5; i++) {
    if (i <= r) html += `<span class="star filled">★</span>`;
    else html += `<span class="star empty">☆</span>`;
  }
  return html;
}

async function loadRecipe() {
  const r = await fetchRecipe(recipeId);
  if (!r) return window.location.href = 'index.html';

  document.getElementById('recipeTitle').textContent = r.title;
  document.getElementById('recipeImage').src = resolveImageUrl(r.image || '');
  document.getElementById('recipeDescriptionText').textContent = r.description || 'No description';

  // Ingredients
  const ingredientsList = document.getElementById('ingredientsList');
  ingredientsList.innerHTML = '';
  (r.ingredients || '').split('\n').forEach(ing => {
    if (ing.trim()) {
      const li = document.createElement('li');
      li.textContent = ing.trim();
      ingredientsList.appendChild(li);
    }
  });

  // Directions
  const directionsList = document.getElementById('directionsList');
  directionsList.innerHTML = '';
  (r.instructions || '').split('\n').forEach(step => {
    if (step.trim()) {
      const li = document.createElement('li');
      li.textContent = step.trim();
      directionsList.appendChild(li);
    }
  });

  // Ratings (stored as JSONB, object/map or array)
  let ratingsArr = [];
  if (r.ratings) {
    if (Array.isArray(r.ratings)) ratingsArr = r.ratings;
    else ratingsArr = Object.values(r.ratings);
  }
  const avgRating = ratingsArr.length ? (ratingsArr.reduce((a, b) => a + b, 0) / ratingsArr.length).toFixed(1) : '0.0';
  document.getElementById('recipeRating').textContent = `⭐ ${avgRating}`;
  document.getElementById('recipeReviewCount').textContent = `${ratingsArr.length} ratings`;

  // User rating input (clickable stars)
  const userRatingDiv = document.getElementById('userRating');
  userRatingDiv.innerHTML = '';
  const currentUser = JSON.parse(localStorage.getItem('user'));
  let userCurrentRating = 0;
  if (currentUser && r.ratings) {
    if (Array.isArray(r.ratings)) {
      // array: cannot map user -> rating reliably
      userCurrentRating = 0;
    } else {
      userCurrentRating = r.ratings[currentUser.id] || 0;
    }
  }
  for (let i = 1; i <= 5; i++) {
    const span = document.createElement('span');
    span.textContent = i <= userCurrentRating ? '★' : '☆';
    span.dataset.star = i;
    span.style.cursor = 'pointer';
    span.style.fontSize = '1.5rem';
    span.addEventListener('click', async function(e) {
      if (!currentUser) return alert('Please log in to rate.');
      const uid = currentUser.id;
      const rating = Number(this.dataset.star);
      try {
        const res = await fetch(`${API_URL}/api/recipes/${recipeId}/rate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, rating })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Rate failed');
        // reload recipe to update averages
        await loadRecipe();
      } catch (err) {
        alert('Rating failed: ' + err.message);
      }
    });
    userRatingDiv.appendChild(span);
  }

  // Reviews
  renderReviews(r.reviews || {});

  // Admin controls: show delete button if user is admin (based on localStorage)
  const user = JSON.parse(localStorage.getItem('user'));
  const isAdmin = user && user.is_admin;
  const adminControls = document.getElementById('adminControls');
  if (adminControls) adminControls.remove();
  if (isAdmin) {
    const container = document.querySelector('main');
    const controls = document.createElement('div');
    controls.id = 'adminControls';
    controls.style.marginTop = '24px';
    controls.innerHTML = `
      <button id="editRecipeBtn" style="background:#ff9800;color:#fff;border:none;padding:8px 16px;border-radius:6px;margin-right:8px;cursor:pointer;">Edit Recipe</button>
      <button id="deleteRecipeBtn" style="background:#e53935;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">Delete Recipe</button>
    `;
    container.appendChild(controls);

    document.getElementById('editRecipeBtn').onclick = function() {
      // navigate to homepage with edit query; index script checks query for edit
      window.location.href = `index.html?edit=${recipeId}`;
    };
    document.getElementById('deleteRecipeBtn').onclick = async function() {
      if (!confirm('Are you sure you want to delete this recipe?')) return;
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/recipes/${recipeId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Delete failed');
        window.location.href = 'index.html';
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    };
  }
}

loadRecipe();

// Submit review: POST to backend
document.getElementById('reviewForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user) return alert('Please log in to submit a review.');

  const uid = user.id;
  const text = document.getElementById('reviewText').value.trim();
  const rating = parseInt(document.getElementById('reviewRating').value);
  const reviewer = user.email || 'Anonymous';
  if (!text) return;

  try {
    const res = await fetch(`${API_URL}/api/recipes/${recipeId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, reviewer, text, rating })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Review failed');
    document.getElementById('reviewForm').reset();
    // reload recipe to show new review
    await loadRecipe();
  } catch (err) {
    alert('Error submitting review: ' + err.message);
  }
});

function renderReviews(reviews) {
  const reviewsContainer = document.getElementById("reviewsContainer");
  reviewsContainer.innerHTML = "";
  // reviews may be array or object
  const arr = Array.isArray(reviews) ? reviews : Object.values(reviews || {});
  arr.forEach(r => {
    const div = document.createElement("div");
    div.className = "review-card";
    div.innerHTML = `
      <div class="review-rating">${renderStars(Number(r.rating) || 0)} <span style="color:#666;font-size:0.95rem;margin-left:8px;">${(Number(r.rating) || 0)}/5</span></div>
      <div style="margin:8px 0;">${r.text}</div>
      <div style="font-size:0.95em;color:#444;margin-bottom:4px;">
        <strong>By:</strong> ${r.reviewer ? r.reviewer : "Anonymous"}
      </div>
      <div class="review-date">${(function(){
        const d = r.created_at || r.date || r.createdAt || r.timestamp || null;
        try { return d ? new Date(d).toLocaleString() : '' } catch(e){ return '' }
      })()}</div>
    `;
    reviewsContainer.appendChild(div);
  });
}

// Description editing functionality
document.getElementById("editDescriptionBtn")?.addEventListener("click", function() {
  const descriptionInput = document.getElementById("descriptionInput");
  const descriptionText = document.getElementById("recipeDescriptionText").textContent;
  descriptionInput.value = descriptionText === "No description" ? "" : descriptionText;
  
  this.style.display = "none";
  document.getElementById("adminDescriptionControls").style.display = "block";
});

document.getElementById("cancelDescriptionBtn")?.addEventListener("click", function() {
  document.getElementById("adminDescriptionControls").style.display = "none";
  document.getElementById("editDescriptionBtn").style.display = "block";
});

document.getElementById("saveDescriptionBtn")?.addEventListener("click", function() {
  const newDescription = document.getElementById('descriptionInput').value.trim();
  (async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/recipes/${recipeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: newDescription })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      document.getElementById('recipeDescriptionText').textContent = newDescription || 'No description';
      document.getElementById('adminDescriptionControls').style.display = 'none';
      document.getElementById('editDescriptionBtn').style.display = 'block';
    } catch (error) {
      alert('Error saving description: ' + error.message);
    }
  })();
});