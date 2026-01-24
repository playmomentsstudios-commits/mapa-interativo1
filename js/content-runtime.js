(async function () {
  // Aplica texto em elementos com [data-content-key="..."]
  // Aplica mídia em:
  //  - <img data-media-key="...">
  //  - elementos com style background-image e atributo [data-bg-media-key="..."]
  // Faz fallback: se não houver no supabase, mantém o que já está no HTML.

  const client = window.supabaseClient;
  if (!client) return;

  async function fetchAll() {
    const [cRes, mRes] = await Promise.all([
      client.from("conteudo").select("key,value"),
      client.from("midia").select("key,url,alt")
    ]);
    const conteudo = new Map();
    const midia = new Map();

    if (!cRes.error && Array.isArray(cRes.data)) {
      cRes.data.forEach((r) => conteudo.set(r.key, r.value));
    }
    if (!mRes.error && Array.isArray(mRes.data)) {
      mRes.data.forEach((r) => midia.set(r.key, { url: r.url, alt: r.alt || "" }));
    }
    return { conteudo, midia };
  }

  function applyText(conteudo) {
    document.querySelectorAll("[data-content-key]").forEach((el) => {
      const key = el.getAttribute("data-content-key");
      if (!key) return;
      const value = conteudo.get(key);
      if (typeof value !== "string") return;
      el.textContent = value;
    });
  }

  function applyMedia(midia) {
    // <img data-media-key="...">
    document.querySelectorAll("img[data-media-key]").forEach((img) => {
      const key = img.getAttribute("data-media-key");
      const m = midia.get(key);
      if (!m) return;
      img.src = m.url;
      if (m.alt) img.alt = m.alt;
    });

    // background-image via data-bg-media-key
    document.querySelectorAll("[data-bg-media-key]").forEach((el) => {
      const key = el.getAttribute("data-bg-media-key");
      const m = midia.get(key);
      if (!m) {
        const fallback = el.getAttribute("data-bg-fallback");
        if (fallback) {
          el.style.backgroundImage = `url('${fallback}')`;
        }
        return;
      }
      el.style.backgroundImage = `url('${m.url}')`;
    });
  }

  try {
    const { conteudo, midia } = await fetchAll();
    applyText(conteudo);
    applyMedia(midia);
  } catch (e) {
    console.warn("[content-runtime] Falha:", e);
  }
})();
