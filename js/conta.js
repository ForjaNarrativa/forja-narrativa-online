const accountProfileForm = document.getElementById("accountProfileForm");
const accountName = document.getElementById("accountName");
const accountEmail = document.getElementById("accountEmail");
const accountSaveBtn = document.getElementById("accountSaveBtn");
const accountMessage = document.getElementById("accountMessage");
const accountRecoveryBtn = document.getElementById("accountRecoveryBtn");
const accountLogoutBtn = document.getElementById("accountLogoutBtn");
const embers = document.getElementById("embers");

let currentSession = null;

function setAccountMessage(text, type = "") {
  accountMessage.textContent = text;
  accountMessage.className = `accountMessage ${type}`;
}

function getBaseUrl() {
  return window.location.origin + window.location.pathname.replace("conta.html", "");
}

async function requireAccountLogin() {
  const { data } = await forjaDB.auth.getSession();

  if (!data.session) {
    window.location.href = "auth.html?next=conta.html";
    return false;
  }

  currentSession = data.session;
  accountEmail.value = currentSession.user.email || "";
  return true;
}

async function loadProfile() {
  const { data, error } = await forjaDB
    .from("profiles")
    .select("nome,email")
    .eq("user_id", currentSession.user.id)
    .maybeSingle();

  if (error) {
    console.warn("Não foi possível carregar perfil.", error);
    setAccountMessage("Não foi possível carregar seu perfil agora.", "error");
    return;
  }

  if (data?.nome) accountName.value = data.nome;

  if (!data) {
    await forjaDB.from("profiles").insert({
      user_id: currentSession.user.id,
      email: currentSession.user.email,
      nome: ""
    });
  }
}

async function saveProfile(event) {
  event.preventDefault();

  const nome = accountName.value.trim();

  accountSaveBtn.disabled = true;
  accountSaveBtn.textContent = "Salvando...";
  setAccountMessage("", "");

  const { error } = await forjaDB.from("profiles").upsert({
    user_id: currentSession.user.id,
    email: currentSession.user.email,
    nome
  }, { onConflict: "user_id" });

  accountSaveBtn.disabled = false;
  accountSaveBtn.textContent = "Salvar perfil";

  if (error) {
    console.error(error);
    setAccountMessage(`Erro ao salvar perfil: ${error.message}`, "error");
    return;
  }

  setAccountMessage("Perfil salvo. A Forja vai usar esse nome nos próximos pedidos.", "success");
}

async function sendRecoveryEmail() {
  if (!currentSession?.user?.email) return;

  accountRecoveryBtn.disabled = true;
  accountRecoveryBtn.textContent = "Enviando...";
  setAccountMessage("", "");

  const { error } = await forjaDB.auth.resetPasswordForEmail(currentSession.user.email, {
    redirectTo: `${getBaseUrl()}auth.html?recovery=1`
  });

  accountRecoveryBtn.disabled = false;
  accountRecoveryBtn.textContent = "Enviar recuperação de senha";

  if (error) {
    console.error(error);
    setAccountMessage(`Erro ao enviar recuperação: ${error.message}`, "error");
    return;
  }

  setAccountMessage("Link de recuperação enviado para o e-mail da sua conta.", "success");
}

async function logoutAccount() {
  await forjaDB.auth.signOut();
  window.location.href = "index.html";
}

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
  setTimeout(() => ember.remove(), (duration + delay) * 1000);
}

async function initAccountPage() {
  const hasLogin = await requireAccountLogin();
  if (!hasLogin) return;

  await loadProfile();

  accountProfileForm.addEventListener("submit", saveProfile);
  accountRecoveryBtn.addEventListener("click", sendRecoveryEmail);
  accountLogoutBtn.addEventListener("click", logoutAccount);
}

const perf = window.forjaPerformance || {};
setInterval(createEmber, perf.emberInterval || 360);
for (let i = 0; i < (perf.initialEmbers || 12); i += 1) createEmber();

initAccountPage();
