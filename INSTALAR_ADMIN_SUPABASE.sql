-- Execute no SQL Editor do projeto Supabase, como proprietário do projeto.
-- Requer a tabela public.curriculos existente, com id, usuario_id, nome, conteudo, updated_at.
-- 1) Cadastre normalmente uma conta destinada à administração no site.
-- 2) Altere o e-mail na instrução final para o e-mail exato da conta criada.
-- ATENÇÃO: não insira service_role no site nem desative a RLS.

create table if not exists public.curriculos_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.curriculos_admins enable row level security;
revoke all on public.curriculos_admins from anon, authenticated;

create or replace function public.is_curriculos_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists(select 1 from public.curriculos_admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_curriculos_admin() from public, anon;
grant execute on function public.is_curriculos_admin() to authenticated;

-- Preserva políticas já existentes: acrescenta apenas permissões exclusivas de admin.
alter table public.curriculos enable row level security;
drop policy if exists "curriculos_admin_leitura" on public.curriculos;
create policy "curriculos_admin_leitura" on public.curriculos
for select to authenticated using ((select public.is_curriculos_admin()));
drop policy if exists "curriculos_admin_exclusao" on public.curriculos;
create policy "curriculos_admin_exclusao" on public.curriculos
for delete to authenticated using ((select public.is_curriculos_admin()));

-- IMPORTANTE: troque o e-mail abaixo pelo e-mail cadastrado para o administrador.
-- Sem um usuário com esse e-mail, o INSERT não promoverá ninguém.
insert into public.curriculos_admins (user_id)
select id from auth.users
where lower(email) = lower('SUBSTITUA-PELO-EMAIL-DO-ADMIN@exemplo.com')
on conflict (user_id) do nothing;

-- Confira que a conta foi promovida (o resultado deve mostrar uma linha).
select u.email, a.created_at
from public.curriculos_admins a join auth.users u on u.id = a.user_id;
