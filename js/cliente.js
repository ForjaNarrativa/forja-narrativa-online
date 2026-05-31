const clientOrderForm = document.getElementById("clientOrderForm");
const clientOrderBtn = document.getElementById("clientOrderBtn");
const clientMessage = document.getElementById("clientMessage");
const embers = document.getElementById("embers");

let currentSession = null;

function setClientMessage(text, type) {
  clientMessage.textContent = text;
  clientMessage.className = `clientMessage ${type}`;
}

function generateOrderCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numbers = "23456789";

  let code = "FORJA-";

  for (let i = 0; i < 3; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }

  code += "-";

  for (let i = 0; i < 4; i++) {
    code += numbers[Math.floor(Math.random() * numbers.length)];
  }

  return code;
}

async function requireClientLogin() {
  const { data } = await forjaDB.auth.getSession();

  if (!data.session) {
    window.location.href = "auth.html?next=cliente.html";
    return false;
  }

  currentSession = data.session;
  return true;
}

clientOrderForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentSession) {
    await requireClientLogin();
    return;
  }

  const clientName = document.getElementById("clientName").value.trim();
  const packageName = document.getElementById("packageName").value;
  const characterIdea = document.getElementById("characterIdea").value.trim();
  const orderCode = generateOrderCode();

  if (!clientName || !packageName || !characterIdea) {
    setClientMessage("Preencha todos os campos antes de enviar.", "error");
    return;
  }

  clientOrderBtn.disabled = true;
  clientOrderBtn.textContent = "Enviando pedido...";
  setClientMessage("", "");

  const { error } = await forjaDB.from("orders").insert({
    user_id: currentSession.user.id,
    client_name: clientName,
    client_email: currentSession.user.email,
    package_name: packageName,
    character_idea: characterIdea,
    order_code: orderCode
  });

  if (error) {
    console.error(error);
    setClientMessage(`Erro ao enviar pedido: ${error.message}`, "error");
    clientOrderBtn.disabled = false;
    clientOrderBtn.textContent = "Enviar pedido para a Forja";
    return;
  }

  setClientMessage("Pedido enviado com sucesso! Ele já está em Meus Pedidos.", "success");

  clientOrderForm.reset();

  setTimeout(() => {
    window.location.href = "meus-pedidos.html";
  }, 1000);
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

requireClientLogin();