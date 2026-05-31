const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authBtn = document.getElementById("authBtn");
const authMessage = document.getElementById("authMessage");

const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const embers = document.getElementById("embers");

let mode = "login";

function getNextPage() {
  const params = new URLSearchParams(window.location.search);
  return params.get("next") || "pedidos.html";
}

function getRedirectUrl() {
  const nextPage = getNextPage();
  const baseUrl = window.location.origin + window.location.pathname.replace("auth.html", "");
  return `${baseUrl}auth.html?next=${encodeURIComponent(nextPage)}&confirmed=1`;
}

function setAuthMessage(text, type) {
  authMessage.textContent = text;
  authMessage.className = `authMessage ${type}`;
}

function setMode(newMode) {
  mode = newMode;

  if (mode === "login") {
    loginTab.classList.add("active");
    signupTab.classList.remove("active");
    authBtn.textContent = "Entrar";
  } else {
    signupTab.classList.add("active");
    loginTab.classList.remove("active");
    authBtn.textContent = "Criar conta";
  }

  setAuthMessage("", "");
}

function showConfirmedMessageIfNeeded() {
  const params = new URLSearchParams(window.location.search);

  if (params.get("confirmed") === "1") {
    setAuthMessage("E-mail confirmado. Agora entre com sua conta da Forja.", "success");
  }
}

async function checkAlreadyLogged() {
  const { data } = await forjaDB.auth.getSession();

  if (data.session) {
    window.location.href = getNextPage();
  }
}

loginTab.addEventListener("click", () => setMode("login"));
signupTab.addEventListener("click", () => setMode("signup"));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || !password) {
    setAuthMessage("Preencha e-mail e senha.", "error");
    return;
  }

  authBtn.disabled = true;
  authBtn.textContent = mode === "login" ? "Entrando..." : "Criando conta...";
  setAuthMessage("", "");

  if (mode === "login") {
    const { error } = await forjaDB.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error(error);
      setAuthMessage("E-mail não confirmado ou senha incorreta.", "error");
      authBtn.disabled = false;
      authBtn.textContent = "Entrar";
      return;
    }

    setAuthMessage("Entrada liberada. Abrindo a Forja...", "success");

    setTimeout(() => {
      window.location.href = getNextPage();
    }, 700);

    return;
  }

  const { error } = await forjaDB.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getRedirectUrl()
    }
  });

  if (error) {
    console.error(error);
    setAuthMessage(`Erro ao criar conta: ${error.message}`, "error");
    authBtn.disabled = false;
    authBtn.textContent = "Criar conta";
    return;
  }

  setAuthMessage(
    "Conta criada. Agora verifique seu e-mail e clique no link de confirmação antes de entrar.",
    "success"
  );

  authForm.reset();
  setMode("login");

  authBtn.disabled = false;
  authBtn.textContent = "Entrar";
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

showConfirmedMessageIfNeeded();
checkAlreadyLogged();