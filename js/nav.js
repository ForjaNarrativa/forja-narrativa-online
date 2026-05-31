const mainNav = document.getElementById("mainNav");

async function getCurrentSession() {
  const { data } = await forjaDB.auth.getSession();
  return data.session;
}

async function checkIsAdmin(userId) {
  if (!userId) return false;

  const { data, error } = await forjaDB
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .single();

  return !error && !!data;
}

function getHomeLink(anchor) {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  return currentPage === "index.html" ? anchor : `index.html${anchor}`;
}

async function renderMainNav() {
  if (!mainNav) return;

  const session = await getCurrentSession();

  if (!session) {
    mainNav.innerHTML = `
      <a href="${getHomeLink("#pacotes")}">Pacotes</a>
      <a href="auth.html?next=cliente.html">Fazer pedido</a>
      <a href="${getHomeLink("#contato")}">Contato</a>
      <a href="auth.html">Entrar</a>
    `;
    return;
  }

  const isAdmin = await checkIsAdmin(session.user.id);

  mainNav.innerHTML = `
    <a href="${getHomeLink("#pacotes")}">Pacotes</a>
    <a href="cliente.html">Fazer pedido</a>
    <a href="pedidos.html">Meus Pedidos</a>
    ${isAdmin ? `<a href="admin.html">Sala do Criador</a>` : ""}
    <button id="navLogoutBtn" class="navLogoutBtn">Sair</button>
  `;

  const logoutBtn = document.getElementById("navLogoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await forjaDB.auth.signOut();
      window.location.href = "index.html";
    });
  }
}

renderMainNav();