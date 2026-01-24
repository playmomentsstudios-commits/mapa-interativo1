-- 1) Extensões úteis (opcional)
create extension if not exists "uuid-ossp";

-- 2) Tabela de conteúdo textual (key/value)
create table if not exists public.conteudo (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

-- 3) Tabela de mídia (imagens/arquivos) por slot/key
create table if not exists public.midia (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique,
  url text not null,
  alt text not null default '',
  updated_at timestamptz not null default now()
);

-- 4) Triggers para updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_conteudo_updated_at on public.conteudo;
create trigger trg_conteudo_updated_at
before update on public.conteudo
for each row execute function public.set_updated_at();

drop trigger if exists trg_midia_updated_at on public.midia;
create trigger trg_midia_updated_at
before update on public.midia
for each row execute function public.set_updated_at();

-- 5) RLS
alter table public.conteudo enable row level security;
alter table public.midia enable row level security;

-- Conteudo: leitura pública
drop policy if exists "conteudo_select_public" on public.conteudo;
create policy "conteudo_select_public"
on public.conteudo for select
to anon, authenticated
using (true);

-- Conteudo: escrita apenas autenticado
drop policy if exists "conteudo_write_auth" on public.conteudo;
create policy "conteudo_write_auth"
on public.conteudo for all
to authenticated
using (true)
with check (true);

-- Midia: leitura pública
drop policy if exists "midia_select_public" on public.midia;
create policy "midia_select_public"
on public.midia for select
to anon, authenticated
using (true);

-- Midia: escrita apenas autenticado
drop policy if exists "midia_write_auth" on public.midia;
create policy "midia_write_auth"
on public.midia for all
to authenticated
using (true)
with check (true);

-- IMPORTANTE:
-- No Supabase Storage, crie o bucket "site-assets" e marque como PUBLIC.
-- (ou use policies de storage; para simplicidade, bucket público + gravação via authenticated)
