(function(){
  const client = window.supabaseClient;
  const $ = (id) => document.getElementById(id);

  const loginView = $("loginView");
  const dashView = $("dashView");
  const btnLogout = $("btnLogout");
  const PAGES_TO_SCAN = [
    { name: "Início", path: "/404.html" },
    { name: "Pesquisa", path: "/pesquisa.html" },
    { name: "Ficha técnica", path: "/ficha-tecnica.html" },
    { name: "Relatório", path: "/relatorio.html" }
  ];
  let inventoryHooked = false;

  function showMsg(el, msg, ok=false){
    el.textContent = msg || "";
    el.style.color = ok ? "var(--ok)" : "var(--muted)";
  }

  async function requireClient(){
    if(!client){
      alert("Configure /js/supabase-config.js primeiro.");
      throw new Error("Supabase client não configurado.");
    }
  }

  async function refreshSessionUI(){
    await requireClient();
    const { data } = await client.auth.getSession();
    const has = !!data.session;
    loginView.classList.toggle("hidden", has);
    dashView.classList.toggle("hidden", !has);
    btnLogout.classList.toggle("hidden", !has);
  }

  // LOGIN
  $("btnLogin").addEventListener("click", async () => {
    try{
      await requireClient();
      const email = $("email").value.trim();
      const password = $("password").value;
      const out = $("loginMsg");
      showMsg(out, "Entrando...");

      const { error } = await client.auth.signInWithPassword({ email, password });
      if(error) return showMsg(out, "Erro: " + error.message);

      showMsg(out, "OK! Carregando painel...", true);
      await refreshSessionUI();
    }catch(e){
      console.warn(e);
    }
  });

  btnLogout.addEventListener("click", async () => {
    await client.auth.signOut();
    location.reload();
  });

  // TEXT CRUD
  $("btnLoadText").addEventListener("click", async () => {
    await requireClient();
    const key = $("txtKey").value.trim();
    if(!key) return showMsg($("textMsg"), "Informe a key.");
    showMsg($("textMsg"), "Carregando...");
    const { data, error } = await client.from("conteudo").select("value").eq("key", key).maybeSingle();
    if(error) return showMsg($("textMsg"), "Erro: " + error.message);
    $("txtValue").value = data?.value ?? "";
    showMsg($("textMsg"), data ? "Carregado." : "Não existe ainda (vai criar ao salvar).", true);
  });

  $("btnSaveText").addEventListener("click", async () => {
    await requireClient();
    const key = $("txtKey").value.trim();
    const value = $("txtValue").value;
    if(!key) return showMsg($("textMsg"), "Informe a key.");
    showMsg($("textMsg"), "Salvando...");
    const { error } = await client.from("conteudo").upsert({ key, value }, { onConflict: "key" });
    if(error) return showMsg($("textMsg"), "Erro: " + error.message);
    showMsg($("textMsg"), "Salvo com sucesso ✅", true);
  });

  $("btnDeleteText").addEventListener("click", async () => {
    await requireClient();
    const key = $("txtKey").value.trim();
    if(!key) return showMsg($("textMsg"), "Informe a key.");
    if(!confirm("Excluir este texto?")) return;
    showMsg($("textMsg"), "Excluindo...");
    const { error } = await client.from("conteudo").delete().eq("key", key);
    if(error) return showMsg($("textMsg"), "Erro: " + error.message);
    $("txtValue").value = "";
    showMsg($("textMsg"), "Excluído ✅", true);
  });

  // MEDIA CRUD + UPLOAD
  async function loadMedia(key){
    showMsg($("mediaMsg"), "Buscando...");
    const { data, error } = await client.from("midia").select("url,alt").eq("key", key).maybeSingle();
    if(error) return showMsg($("mediaMsg"), "Erro: " + error.message);
    if(!data){
      $("mediaPreview").classList.add("hidden");
      return showMsg($("mediaMsg"), "Slot não existe ainda.", true);
    }
    $("mediaAlt").value = data.alt || "";
    const prev = $("mediaPreview");
    prev.classList.remove("hidden");
    prev.innerHTML = data.url.match(/\.pdf($|\?)/i)
      ? `<a href="${data.url}" target="_blank">Abrir PDF</a><div style="margin-top:8px;color:#95a4c4;font-size:12px">${data.url}</div>`
      : `<img src="${data.url}" alt="${data.alt||""}"><div style="margin-top:8px;color:#95a4c4;font-size:12px">${data.url}</div>`;
    showMsg($("mediaMsg"), "Carregado.", true);
  }

  $("btnLoadMedia").addEventListener("click", async () => {
    await requireClient();
    const key = $("mediaKey").value.trim();
    if(!key) return showMsg($("mediaMsg"), "Informe o slot (key).");
    await loadMedia(key);
  });

  $("btnUpload").addEventListener("click", async () => {
    await requireClient();
    const key = $("mediaKey").value.trim();
    const alt = $("mediaAlt").value.trim();
    const file = $("mediaFile").files?.[0];
    if(!key) return showMsg($("mediaMsg"), "Informe o slot (key).");
    if(!file) return showMsg($("mediaMsg"), "Selecione um arquivo.");
    showMsg($("mediaMsg"), "Enviando...");

    // 1) Upload para bucket
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const safeKey = key.replace(/[^a-z0-9\-_.:/]/gi, "_");
    const path = `slots/${safeKey}.${ext}`;

    const up = await client.storage.from("site-assets").upload(path, file, { upsert: true });
    if(up.error) return showMsg($("mediaMsg"), "Erro upload: " + up.error.message);

    // 2) URL pública
    const pub = client.storage.from("site-assets").getPublicUrl(path);
    const url = pub.data.publicUrl;

    // 3) Salvar na tabela midia (upsert por key)
    const { error } = await client.from("midia").upsert({ key, url, alt }, { onConflict: "key" });
    if(error) return showMsg($("mediaMsg"), "Erro salvar: " + error.message);

    showMsg($("mediaMsg"), "Upload + salvo ✅", true);
    await loadMedia(key);
  });

  $("btnDeleteMedia").addEventListener("click", async () => {
    await requireClient();
    const key = $("mediaKey").value.trim();
    if(!key) return showMsg($("mediaMsg"), "Informe o slot (key).");
    if(!confirm("Excluir este slot da tabela midia? (não remove do bucket)")) return;
    showMsg($("mediaMsg"), "Excluindo...");
    const { error } = await client.from("midia").delete().eq("key", key);
    if(error) return showMsg($("mediaMsg"), "Erro: " + error.message);
    $("mediaPreview").classList.add("hidden");
    showMsg($("mediaMsg"), "Excluído ✅", true);
  });

  function uniq(arr){ return Array.from(new Set(arr)); }

  async function scanKeysFromPage(path){
    const res = await fetch(path, { cache: "no-store" });
    if(!res.ok) throw new Error(`Falha ao carregar ${path}: ${res.status}`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const contentKeys = [];
    const mediaKeys = [];

    doc.querySelectorAll("[data-content-key]").forEach(el=>{
      const k = el.getAttribute("data-content-key");
      if(k) contentKeys.push(k);
    });

    doc.querySelectorAll("img[data-media-key]").forEach(el=>{
      const k = el.getAttribute("data-media-key");
      if(k) mediaKeys.push(k);
    });

    doc.querySelectorAll("[data-bg-media-key]").forEach(el=>{
      const k = el.getAttribute("data-bg-media-key");
      if(k) mediaKeys.push(k);
    });

    return { contentKeys: uniq(contentKeys), mediaKeys: uniq(mediaKeys) };
  }

  async function scanSiteKeys(){
    const mapContentWhere = new Map();
    const mapMediaWhere = new Map();

    for(const p of PAGES_TO_SCAN){
      try{
        const { contentKeys, mediaKeys } = await scanKeysFromPage(p.path);

        contentKeys.forEach(k=>{
          const arr = mapContentWhere.get(k) || [];
          arr.push(`${p.name} (${p.path})`);
          mapContentWhere.set(k, arr);
        });

        mediaKeys.forEach(k=>{
          const arr = mapMediaWhere.get(k) || [];
          arr.push(`${p.name} (${p.path})`);
          mapMediaWhere.set(k, arr);
        });

      }catch(e){
        console.warn("[scan]", e.message);
      }
    }

    return { mapContentWhere, mapMediaWhere };
  }

  async function fetchSupabaseData(client){
    const [cRes, mRes] = await Promise.all([
      client.from("conteudo").select("key,value"),
      client.from("midia").select("key,url,alt,updated_at")
    ]);

    if(cRes.error) throw new Error("Erro conteudo: " + cRes.error.message);
    if(mRes.error) throw new Error("Erro midia: " + mRes.error.message);

    const conteudo = new Map();
    const midia = new Map();

    (cRes.data || []).forEach(r => conteudo.set(r.key, r.value));
    (mRes.data || []).forEach(r => midia.set(r.key, r));

    return { conteudo, midia };
  }

  function renderInventoryUI(conteudo, midia, mapContentWhere, mapMediaWhere){
    const tbTexts = document.querySelector("#tblTexts tbody");
    const tbMedia = document.querySelector("#tblMedia tbody");
    if(!tbTexts || !tbMedia) return;
    const searchEl = document.getElementById("invSearch");
    const search = (searchEl?.value || "").trim().toLowerCase();

    const contentKeysAll = uniq([
      ...Array.from(mapContentWhere.keys()),
      ...Array.from(conteudo.keys())
    ]).sort();

    const mediaKeysAll = uniq([
      ...Array.from(mapMediaWhere.keys()),
      ...Array.from(midia.keys())
    ]).sort();

    tbTexts.innerHTML = "";
    tbMedia.innerHTML = "";

    contentKeysAll
      .filter(k => !search || k.toLowerCase().includes(search))
      .forEach(k=>{
        const val = conteudo.get(k) ?? "";
        const where = mapContentWhere.get(k) || [];
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="k">${k}</td>
          <td>${(val || "").slice(0, 140)}${(val || "").length > 140 ? "…" : ""}</td>
          <td class="where">${where.length ? where.join("<br>") : "— (não detectado nas páginas)"}</td>
          <td>
            <div class="actionBtns">
              <button class="btn btnSm" data-act="editText" data-key="${k}">Editar</button>
              <button class="btn ghost btnSm" data-act="loadText" data-key="${k}">Carregar</button>
              <button class="btn danger ghost btnSm" data-act="delText" data-key="${k}">Excluir</button>
            </div>
          </td>
        `;
        tbTexts.appendChild(tr);
      });

    mediaKeysAll
      .filter(k => !search || k.toLowerCase().includes(search))
      .forEach(k=>{
        const row = midia.get(k);
        const where = mapMediaWhere.get(k) || [];
        const url = row?.url || "";
        const isPdf = /\.pdf($|\?)/i.test(url);

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="k">${k}</td>
          <td>
            ${
              url
              ? (isPdf
                ? `<a href="${url}" target="_blank">Abrir PDF</a>`
                : `<img class="previewThumb" src="${url}" alt="${row?.alt||""}">`
              )
              : `<span class="where">— sem mídia no Supabase</span>`
            }
            ${url ? `<div class="where" style="margin-top:6px">${url.slice(0,80)}${url.length>80?"…":""}</div>` : ""}
          </td>
          <td class="where">${where.length ? where.join("<br>") : "— (não detectado nas páginas)"}</td>
          <td>
            <div class="actionBtns">
              <button class="btn btnSm" data-act="useSlot" data-key="${k}">Trocar/Upload</button>
              <button class="btn ghost btnSm" data-act="loadMedia" data-key="${k}">Carregar</button>
              <button class="btn danger ghost btnSm" data-act="delMedia" data-key="${k}">Excluir</button>
            </div>
          </td>
        `;
        tbMedia.appendChild(tr);
      });
  }

  async function refreshInventory(client){
    const tbTexts = document.querySelector("#tblTexts tbody");
    const tbMedia = document.querySelector("#tblMedia tbody");
    if(!tbTexts || !tbMedia) return;
    const invMsg = document.getElementById("invMsg");
    if(invMsg) invMsg.textContent = "Atualizando inventário…";
    try{
      const [{ conteudo, midia }, { mapContentWhere, mapMediaWhere }] = await Promise.all([
        fetchSupabaseData(client),
        scanSiteKeys()
      ]);

      window.__invCache = { conteudo, midia, mapContentWhere, mapMediaWhere };
      renderInventoryUI(conteudo, midia, mapContentWhere, mapMediaWhere);
      if(invMsg){
        invMsg.textContent = "Inventário atualizado ✅";
        invMsg.style.color = "var(--ok)";
      }
    }catch(e){
      console.warn(e);
      if(invMsg){
        invMsg.textContent = "Erro no inventário: " + (e.message || e);
        invMsg.style.color = "var(--muted)";
      }
    }
  }

  function hookInventoryEvents(client){
    if(inventoryHooked) return;
    inventoryHooked = true;
    const btn = document.getElementById("btnRefreshInventory");
    const search = document.getElementById("invSearch");

    btn?.addEventListener("click", ()=> refreshInventory(client));

    search?.addEventListener("input", ()=>{
      const c = window.__invCache;
      if(!c) return;
      renderInventoryUI(c.conteudo, c.midia, c.mapContentWhere, c.mapMediaWhere);
    });

    document.addEventListener("click", async (ev) => {
      const b = ev.target.closest("button[data-act]");
      if(!b) return;

      const act = b.getAttribute("data-act");
      const key = b.getAttribute("data-key");

      const setVal = (id,val)=>{ const el=document.getElementById(id); if(el) el.value=val; };

      if(act === "loadText" || act === "editText"){
        setVal("txtKey", key);
        document.getElementById("btnLoadText")?.click();
        if(act === "editText") setTimeout(()=>document.getElementById("txtValue")?.focus(),200);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      if(act === "delText"){
        setVal("txtKey", key);
        document.getElementById("btnDeleteText")?.click();
        setTimeout(()=>refreshInventory(client), 500);
      }

      if(act === "useSlot"){
        setVal("mediaKey", key);
        document.getElementById("btnLoadMedia")?.click();
        document.getElementById("mediaFile")?.click();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      if(act === "loadMedia"){
        setVal("mediaKey", key);
        document.getElementById("btnLoadMedia")?.click();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      if(act === "delMedia"){
        setVal("mediaKey", key);
        document.getElementById("btnDeleteMedia")?.click();
        setTimeout(()=>refreshInventory(client), 500);
      }
    });
  }

  // PING
  $("btnPing").addEventListener("click", async () => {
    await requireClient();
    const out = $("pingOut");
    out.textContent = "Consultando...";
    const { data, error } = await client.from("conteudo").select("*").limit(5);
    if(error) out.textContent = "Erro: " + error.message;
    else out.textContent = JSON.stringify(data, null, 2);
  });

  // Init
  (async () => {
    await refreshSessionUI();
    const { data } = await client.auth.getSession();
    if(data.session){
      hookInventoryEvents(client);
      refreshInventory(client);
    }
    client?.auth?.onAuthStateChange((_event, session) => {
      refreshSessionUI();
      if(session){
        hookInventoryEvents(client);
        refreshInventory(client);
      }
    });
  })();
})();
