const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authBtn = document.getElementById("authBtn");
const authMessage = document.getElementById("authMessage");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");

const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const embers = document.getElementById("embers");

let mode = "login";

function getNextPage() {
  const params = new URLSearchParams(window.location.search);
  return params.get("next") || "meus-pedidos.html";
}

function getBaseUrl() {
  return window.location.origin + window.location.pathname.replace("auth.html", "");
}

function getRedirectUrl() {
  const nextPage = getNextPage();
  return `${getBaseUrl()}auth.html?next=${encodeURIComponent(nextPage)}&confirmed=1`;
}

function getRecoveryRedirectUrl() {
  return `${getBaseUrl()}auth.html?recovery=1`;
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
    authPassword.placeholder = "Sua senha";
    forgotPasswordBtn.style.display = "inline-block";
  } else if (mode === "signup") {
    signupTab.classList.add("active");
    loginTab.classList.remove("active");
    authBtn.textContent = "Criar conta";
    authPassword.placeholder = "Crie uma senha para a Forja";
    forgotPasswordBtn.style.display = "none";
  } else if (mode === "recovery") {
    loginTab.classList.add("active");
    signupTab.classList.remove("active");
    authBtn.textContent = "Salvar nova senha";
    authPassword.placeholder = "Digite sua nova senha";
    forgotPasswordBtn.style.display = "none";
  }

  setAuthMessage("", "");
}

function showConfirmedMessageIfNeeded() {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  if (params.get("confirmed") === "1") {
    setAuthMessage("E-mail confirmado. Agora entre com sua conta da Forja.", "success");
  }

  if (params.get("recovery") === "1" || hash.get("type") === "recovery") {
    setMode("recovery");
    setAuthMessage("Digite sua nova senha para recuperar o acesso à Forja.", "success");
  }
}

async function checkAlreadyLogged() {
  if (mode === "recovery") return;

  const { data } = await forjaDB.auth.getSession();

  if (data.session) {
    window.location.href = getNextPage();
  }
}

loginTab.addEventListener("click", () => setMode("login"));
signupTab.addEventListener("click", () => setMode("signup"));

forgotPasswordBtn.addEventListener("click", async () => {
  const email = authEmail.value.trim();

  if (!email) {
    setAuthMessage("Digite seu e-mail primeiro para receber o link de recuperação.", "error");
    authEmail.focus();
    return;
  }

  forgotPasswordBtn.disabled = true;
  forgotPasswordBtn.textContent = "Enviando link...";

  const { error } = await forjaDB.auth.resetPasswordForEmail(email, {
    redirectTo: getRecoveryRedirectUrl()
  });

  if (error) {
    console.error(error);
    setAuthMessage(`Erro ao enviar recuperação: ${error.message}`, "error");
  } else {
    setAuthMessage("Link de recuperação enviado. Verifique seu e-mail.", "success");
  }

  forgotPasswordBtn.disabled = false;
  forgotPasswordBtn.textContent = "Esqueci minha senha";
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (mode !== "recovery" && (!email || !password)) {
    setAuthMessage("Preencha e-mail e senha.", "error");
    return;
  }

  if (mode === "recovery" && !password) {
    setAuthMessage("Digite a nova senha.", "error");
    return;
  }

  authBtn.disabled = true;
  authBtn.textContent = mode === "login" ? "Entrando..." : mode === "signup" ? "Criando conta..." : "Salvando...";
  setAuthMessage("", "");

  if (mode === "recovery") {
    const { error } = await forjaDB.auth.updateUser({ password });

    if (error) {
      console.error(error);
      setAuthMessage(`Erro ao trocar senha: ${error.message}`, "error");
      authBtn.disabled = false;
      authBtn.textContent = "Salvar nova senha";
      return;
    }

    setAuthMessage("Senha atualizada. Você já pode entrar na Forja.", "success");
    await forjaDB.auth.signOut();
    setMode("login");
    authForm.reset();
    authBtn.disabled = false;
    authBtn.textContent = "Entrar";
    return;
  }

  if (mode === "login") {
    const { error } = await forjaDB.auth.signInWithPassword({ email, password });

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
    options: { emailRedirectTo: getRedirectUrl() }
  });

  if (error) {
    console.error(error);
    setAuthMessage(`Erro ao criar conta: ${error.message}`, "error");
    authBtn.disabled = false;
    authBtn.textContent = "Criar conta";
    return;
  }

  setAuthMessage("Conta criada. Agora verifique seu e-mail e clique no link de confirmação antes de entrar.", "success");
  authForm.reset();
  setMode("login");
  authBtn.disabled = false;
  authBtn.textContent = "Entrar";
});

function createEmber() {
  if (!embers || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const perf = window.forjaPerformance || {};
  const maxEmbers = perf.emberLimit || (window.innerWidth < 720 ? 8 : 18);
  if (embers.children.length >= maxEmbers) return;

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
  setTimeout(() => ember.remove(), (duration + delay) * 1000);
}

const perf = window.forjaPerformance || {};
setInterval(createEmber, perf.emberInterval || (window.innerWidth < 720 ? 700 : 360));
for (let i = 0; i < (perf.initialEmbers || (window.innerWidth < 720 ? 6 : 14)); i += 1) createEmber();

showConfirmedMessageIfNeeded();
checkAlreadyLogged();
