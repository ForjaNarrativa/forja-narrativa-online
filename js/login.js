const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");
const embers = document.getElementById("embers");

const OWNER_ADMIN_EMAILS = ["forjanarrativa5790@gmail.com"];

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isOwnerAdminEmail(email) {
  return OWNER_ADMIN_EMAILS.includes(normalizeEmail(email));
}


function setLoginMessage(text, type) {
  loginMessage.textContent = text;
  loginMessage.className = `loginMessage ${type}`;
}

async function checkAlreadyLogged() {
  const { data } = await forjaDB.auth.getSession();

  if (data.session) {
    window.location.href = "admin.html";
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    setLoginMessage("Preencha e-mail e senha.", "error");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Abrindo a Forja...";
  setLoginMessage("", "");

  const { error } = await forjaDB.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error(error);
    setLoginMessage("E-mail ou senha incorretos.", "error");
    loginBtn.disabled = false;
    loginBtn.textContent = "Entrar no Painel";
    return;
  }

  setLoginMessage("Acesso liberado. Entrando...", "success");

  setTimeout(() => {
    window.location.href = "admin.html";
  }, 700);
});

function createEmber() {
  if (!embers) return;

  const ember = document.createElement("span");
  ember.className = "ember";

  const size = Math.random() * 4 + 2;
  const left = Math.random() * 100;
  const duration = Math.random() * 8 + 6;
  const delay = Math.random() * 2;

  ember.style.width = `${size}px`;
  ember.style.height = `${size}px`;
  ember.style.left = `${left}%`;
  ember.style.animationDuration = `${duration}s`;
  ember.style.animationDelay = `${delay}s`;

  embers.appendChild(ember);

  setTimeout(() => {
    ember.remove();
  }, (duration + delay) * 1000);
}

setInterval(createEmber, 300);

for (let i = 0; i < 20; i++) {
  createEmber();
}

checkAlreadyLogged();