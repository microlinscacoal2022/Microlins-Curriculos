-- MICROLINS CACOAL | Pix automático Asaas — adicionar às tabelas já existentes
-- PRÉ-REQUISITO: INSTALAR_PAGAMENTO_E_CODIGOS.sql já executado.
-- NÃO apaga tabelas nem currículos. Cria duas tabelas novas.
-- O pagamento é confirmado em Edge Functions, nunca pelo navegador.
create table if not exists public.curriculos_asaas_clientes (
 usuario_id uuid primary key references auth.users(id) on delete cascade,
 asaas_id text not null,
 criado_em timestamptz not null default now()
);
create table if not exists public.curriculos_asaas_pagamentos (
 id uuid primary key default gen_random_uuid(),
 usuario_id uuid not null references auth.users(id) on delete cascade,
 curriculo_id text not null,
 asaas_id text unique,
 valor_centavos integer not null default 1000 check (valor_centavos=1000),
 status text not null default 'CRIANDO',
 criado_em timestamptz not null default now(),
 confirmado_em timestamptz
);
create index if not exists curriculos_asaas_usuario_curriculo_idx on public.curriculos_asaas_pagamentos(usuario_id,curriculo_id,criado_em desc);
alter table public.curriculos_asaas_clientes enable row level security;
alter table public.curriculos_asaas_pagamentos enable row level security;
revoke all on public.curriculos_asaas_clientes,public.curriculos_asaas_pagamentos from anon,authenticated;
grant select on public.curriculos_asaas_pagamentos to authenticated;
-- Aluno apenas lê seus registros; somente Edge Functions com service-role escrevem.
drop policy if exists curriculos_asaas_pagamentos_proprio on public.curriculos_asaas_pagamentos;
create policy curriculos_asaas_pagamentos_proprio on public.curriculos_asaas_pagamentos
 for select to authenticated using (usuario_id = (select auth.uid()) or (select public.is_curriculos_admin()));
