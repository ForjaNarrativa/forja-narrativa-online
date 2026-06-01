(function initForjaDiscordAlerts() {
  const MAX_PREVIEW = 180;

  function truncate(value, limit = MAX_PREVIEW) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= limit) return text;
    return `${text.slice(0, limit - 1)}…`;
  }

  async function getAccessToken() {
    if (!window.forjaDB) return "";
    const { data } = await forjaDB.auth.getSession();
    return data?.session?.access_token || "";
  }

  async function notifyForjaDiscord(type, payload = {}) {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const response = await fetch("/api/discord-alert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          type,
          siteUrl: window.location.origin,
          page: window.location.pathname.split("/").pop() || "index.html",
          ...payload,
          messagePreview: truncate(payload.messagePreview || payload.message || "")
        })
      });

      if (!response.ok) {
        const details = await response.text().catch(() => "");
        console.warn("Aviso Discord não enviado.", response.status, details);
      }
    } catch (error) {
      // Notificação externa nunca pode impedir pedido/chat de funcionar.
      console.warn("Sinos da Forja indisponíveis no momento.", error);
    }
  }

  window.notifyForjaDiscord = notifyForjaDiscord;
})();
