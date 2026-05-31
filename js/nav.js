const mainNav = document.getElementById("mainNav");

const fallbackPublicPages = [
  { label: "Início", href: "index.html", match: ["", "index.html"] },
  { label: "Pacotes", href: "pacotes.html", match: ["pacotes.html"] },
  { label: "Memorial", href: "memorial.html", match: ["memorial.html"] },
  { label: "Créditos", href: "creditos.html", match: ["creditos.html"] },
  { label: "Pedidos", href: "pedidos.html", match: ["pedidos.html", "cliente.html"] }
];

let publicPages = fallbackPublicPages;
let navAlreadyBoundAuth = false;

const OWNER_ADMIN_EMAILS = ["forjanarrativa5790@gmail.com"];

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isOwnerAdminEmail(email) {
  return OWNER_ADMIN_EMAILS.includes(normalizeEmail(email));
}

function getForjaDB() {
  return window.forjaDB || (typeof forjaDB !== "undefined" ? forjaDB : null);
}

async function loadPublicPages() {
  try {
    const response = await fetch("data/json/site-pages.json");
    if (!response.ok) return fallbackPublicPages;
    const pages = await response.json();
    return pages.filter((page) => page.public !== false);
  } catch (error) {
    console.warn("Usando navegação fixa como fallback.", error);
    return fallbackPublicPages;
  }
}

function currentFileName() {
  return window.location.pathname.split("/").pop() || "index.html";
}

function isCurrentPage(page) {
  const file = currentFileName();
  return Array.isArray(page.match) && page.match.includes(file);
}

async function getCurrentSession() {
  const db = getForjaDB();
  if (!db) return null;

  try {
    const { data, error } = await db.auth.getSession();
    if (error) {
      console.warn("Não foi possível ler a sessão atual.", error);
      return null;
    }
    return data.session;
  } catch (error) {
    console.warn("Falha ao buscar sessão atual.", error);
    return null;
  }
}

async function checkIsAdmin(user) {
  const db = getForjaDB();
  if (!db || !user) return false;

  // A conta oficial da Forja sempre recebe a entrada da Sala do Criador no menu.
  if (isOwnerAdminEmail(user.email)) return true;

  try {
    const { data, error } = await db
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    return !error && !!data;
  } catch (error) {
    console.warn("Não foi possível confirmar admin_users.", error);
    return false;
  }
}

function createNavLink(page) {
  return `<a href="${page.href}">${page.label}</a>`;
}

function renderPublicLinks() {
  return publicPages
    .filter((page) => !isCurrentPage(page))
    .map(createNavLink)
    .join("");
}

function getSessionLinks(session, isAdmin, mobile = false) {
  if (!session) {
    return [
      {
        label: mobile ? "Entrar / Fazer pedido" : "Entrar",
        href: "auth.html?next=cliente.html",
        match: ["auth.html", "cliente.html"]
      }
    ].filter((page) => !isCurrentPage(page));
  }

  const links = [
    { label: mobile ? "Fazer pedido logado" : "Fazer pedido", href: "cliente.html", match: ["cliente.html"] },
    { label: "Meus Pedidos", href: "meus-pedidos.html", match: ["meus-pedidos.html"] }
  ];

  if (isAdmin) {
    links.push({ label: "Sala do Criador", href: "admin.html", match: ["admin.html", "login.html"] });
  }

  return links.filter((page) => !isCurrentPage(page));
}

function renderAuthLinks(session, isAdmin, mobile = false) {
  const links = getSessionLinks(session, isAdmin, mobile).map(createNavLink).join("");

  if (!session) return links;

  return `${links}<button id="${mobile ? "mobileLogoutBtn" : "navLogoutBtn"}" class="navLogoutBtn" type="button">Sair da conta</button>`;
}

function renderMobileMenu(session, isAdmin) {
  return `
    <button id="mobileMenuBtn" class="mobileMenuBtn" type="button" aria-label="Abrir menu" aria-expanded="false">
      <span></span>
      <span></span>
      <span></span>
    </button>

    <div id="mobileMenuOverlay" class="mobileMenuOverlay" aria-hidden="true"></div>

    <aside id="mobileMenuPanel" class="mobileMenuPanel" aria-hidden="true">
      <div class="mobileMenuHeader">
        <div>
          <strong>Forja Narrativa</strong>
          <span>Escolha seu próximo caminho</span>
        </div>
        <button id="mobileMenuClose" class="mobileMenuClose" type="button" aria-label="Fechar menu">×</button>
      </div>

      <div class="mobileMenuLinks">
        ${renderPublicLinks()}
        ${renderAuthLinks(session, isAdmin, true)}
      </div>
    </aside>
  `;
}

function bindMobileMenu() {
  const btn = document.getElementById("mobileMenuBtn");
  const panel = document.getElementById("mobileMenuPanel");
  const overlay = document.getElementById("mobileMenuOverlay");
  const close = document.getElementById("mobileMenuClose");

  if (!btn || !panel || !overlay || !close) return;

  function openMenu() {
    btn.setAttribute("aria-expanded", "true");
    panel.classList.add("open");
    overlay.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("menuOpen");
  }

  function closeMenu() {
    btn.setAttribute("aria-expanded", "false");
    panel.classList.remove("open");
    overlay.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("menuOpen");
  }

  btn.addEventListener("click", openMenu);
  close.addEventListener("click", closeMenu);
  overlay.addEventListener("click", closeMenu);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

function bindLogoutButtons() {
  const logoutButtons = [
    document.getElementById("navLogoutBtn"),
    document.getElementById("mobileLogoutBtn")
  ].filter(Boolean);

  logoutButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const db = getForjaDB();
      if (db) await db.auth.signOut();
      window.location.href = "index.html";
    });
  });
}

function bindAuthStateWatcher() {
  const db = getForjaDB();
  if (!db || navAlreadyBoundAuth) return;

  navAlreadyBoundAuth = true;
  db.auth.onAuthStateChange(() => {
    renderMainNav();
  });
}

async function renderMainNav() {
  if (!mainNav) return;

  publicPages = await loadPublicPages();

  const session = await getCurrentSession();
  const isAdmin = session ? await checkIsAdmin(session.user) : false;

  mainNav.innerHTML = `
    <div class="desktopNavLinks">
      ${renderPublicLinks()}
      ${renderAuthLinks(session, isAdmin, false)}
    </div>
    ${renderMobileMenu(session, isAdmin)}
  `;

  bindMobileMenu();
  bindLogoutButtons();
  bindAuthStateWatcher();
}

renderMainNav();
