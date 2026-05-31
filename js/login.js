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

async function isForjaAdminSession(session) {
  if (!session?.user) return false;
  if (isOwnerAdminEmail(session.user.email)) return true;

  try {
    const { data, error } = await forjaDB.rpc("is_forja_admin");
    if (!error && data === true) return true;
  } catch (error) {
    console.warn("RPC is_forja_admin indisponível. Tentando fallback local.", error);
  }

  try {
    const { data, error } = await forjaDB
      .from("admin_users")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    return !error && !!data;
  } catch (error) {
    console.warn("Fallback admin_users falhou.", error);
    return false;
  }
}

async function checkAlreadyLogged() {
  const { data } = await forjaDB.auth.getSession();

  if (!data.session) return;

  const isAdmin = await isForjaAdminSession(data.session);

  if (isAdmin) {
    window.location.href = "admin.html";
    return;
  }

  setLoginMessage("Você já está logado em uma conta de cliente. Esta entrada é reservada para a Sala do Criador.", "error");
  loginBtn.disabled = true;
  loginBtn.textContent = "Área reservada";
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

  const { data, error } = await forjaDB.auth.signInWithPassword({
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

  const isAdmin = await isForjaAdminSession(data.session);

  if (!isAdmin) {
    setLoginMessage("Login feito, mas essa conta não tem acesso à Sala do Criador. Volte ao site para usar a área de cliente.", "error");
    loginBtn.disabled = false;
    loginBtn.textContent = "Entrada reservada";
    return;
  }

  setLoginMessage("Acesso liberado. Entrando...", "success");

  setTimeout(() => {
    window.location.href = "admin.html";
  }, 700);
});

function createEmber() {
  const perf = window.forjaPerformance || {};
  if (!embers || perf.reducedMotion) return;
  if (embers.children.length >= (perf.emberLimit || 14)) return;

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

const perf = window.forjaPerformance || {};
setInterval(createEmber, perf.emberInterval || 360);
for (let i = 0; i < (perf.initialEmbers || 12); i += 1) createEmber();

checkAlreadyLogged();
