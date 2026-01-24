(function(){
  const client = window.supabaseClient;
  const $ = (id) => document.getElementById(id);

  const loginView = $("loginView");
  const dashView = $("dashView");
  const btnLogout = $("btnLogout");

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
    client?.auth?.onAuthStateChange(() => refreshSessionUI());
  })();
})();
