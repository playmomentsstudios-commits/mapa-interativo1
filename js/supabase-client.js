(function () {
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    console.warn("[Supabase] supabase-config.js não configurado.");
    window.supabaseClient = null;
    return;
  }

  // supabase-js v2 via CDN (incluído nos HTMLs)
  window.supabaseClient = supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );
})();
