// auth.js

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const authMessage = document.getElementById("authMessage");

// Backend API URL
const API_URL = "http://localhost:5000/api/auth";

// ===== LOGIN =====
loginForm.addEventListener("submit", async function(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  authMessage.textContent = "Logging in...";
  authMessage.className = "";

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    // Save token to localStorage for admin actions
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    authMessage.textContent = data.message;
    authMessage.className = "auth-success";

    setTimeout(() => {
      window.location.href = "index.html";
    }, 1200);

  } catch (err) {
    authMessage.textContent = err.message;
    authMessage.className = "";
  }
});

// ===== SIGNUP =====
signupForm.addEventListener("submit", async function(e) {
  e.preventDefault();
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;

  authMessage.textContent = "Creating account...";
  authMessage.className = "";

  try {
    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    authMessage.textContent = data.message;
    authMessage.className = "auth-success";

    setTimeout(() => {
      // Show login form after successful signup
      document.getElementById("signupBox").style.display = "none";
      document.getElementById("loginBox").style.display = "flex";
      authMessage.textContent = "";
    }, 1200);

  } catch (err) {
    authMessage.textContent = err.message;
    authMessage.className = "";
  }
});
