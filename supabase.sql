-- Execute no SQL Editor do Supabase (uma vez).
create extension if not exists pgcrypto;
create table if not exists public.curriculos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 200),
  conteudo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists curriculos_usuario_id_idx on public.curriculos(usuario_id);
alter table public.curriculos enable row level security;
-- Remover políticas anteriores com os mesmos nomes facilita reaplicar o script.
drop policy if exists "Ler apenas meus curriculos" on public.curriculos;
drop policy if exists "Criar apenas meus curriculos" on public.curriculos;
drop policy if exists "Alterar apenas meus curriculos" on public.curriculos;
drop policy if exists "Excluir apenas meus curriculos" on public.curriculos;
create policy "Ler apenas meus curriculos" on public.curriculos for select to authenticated using ((select auth.uid()) = usuario_id);
create policy "Criar apenas meus curriculos" on public.curriculos for insert to authenticated with check ((select auth.uid()) = usuario_id);
create policy "Alterar apenas meus curriculos" on public.curriculos for update to authenticated using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);
create policy "Excluir apenas meus curriculos" on public.curriculos for delete to authenticated using ((select auth.uid()) = usuario_id);
create or replace function public.atualizar_data_curriculo() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_atualizar_data_curriculo on public.curriculos;
create trigger trg_atualizar_data_curriculo before update on public.curriculos for each row execute function public.atualizar_data_curriculo();
