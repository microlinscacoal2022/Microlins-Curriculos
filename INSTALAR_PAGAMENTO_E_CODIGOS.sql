-- MICROLINS CACOAL | Controle de autorização de exportação
-- Execute no SQL Editor DEPOIS de INSTALAR_ADMIN_SUPABASE.sql.
-- Não remove dados existentes. Admins são os da tabela public.curriculos_admins.
-- Importante: esta versão usa aprovação manual de pagamento Pix pelo admin.
-- Não armazene comprovantes, chaves secretas nem service_role no código do site.

create table if not exists public.curriculos_codigos (
 id uuid primary key default gen_random_uuid(),
 codigo text not null unique,
 criado_por uuid not null references auth.users(id),
 criado_em timestamptz not null default now(),
 usado_por uuid references auth.users(id),
 curriculo_id text,
 usado_em timestamptz,
 constraint codigo_uso_integro check ((usado_em is null and usado_por is null and curriculo_id is null) or (usado_em is not null and usado_por is not null and curriculo_id is not null))
);
create table if not exists public.curriculos_liberacoes (
 curriculo_id text not null,
 usuario_id uuid not null references auth.users(id) on delete cascade,
 origem text not null check (origem in ('codigo','pix')),
 liberado_em timestamptz not null default now(),
 primary key (curriculo_id,usuario_id)
);
create table if not exists public.curriculos_pix_config (
 id integer primary key default 1 check (id=1),
 chave_pix text not null default '',
 recebedor text not null default 'Microlins Cacoal',
 valor_centavos integer not null default 1000 check(valor_centavos=1000)
);
insert into public.curriculos_pix_config(id) values (1) on conflict (id) do nothing;
create table if not exists public.curriculos_pix_pedidos (
 id uuid primary key default gen_random_uuid(),
 curriculo_id text not null,
 usuario_id uuid not null references auth.users(id) on delete cascade,
 valor_centavos integer not null default 1000 check (valor_centavos=1000),
 pagador_nome text not null default '',
 status text not null default 'pendente' check (status in ('pendente','aprovado','recusado')),
 solicitado_em timestamptz not null default now(),
 decidido_em timestamptz,
 decidido_por uuid references auth.users(id)
);
create unique index if not exists curriculos_pix_um_pendente on public.curriculos_pix_pedidos(curriculo_id,usuario_id) where status='pendente';

alter table public.curriculos_codigos enable row level security;
alter table public.curriculos_liberacoes enable row level security;
alter table public.curriculos_pix_config enable row level security;
alter table public.curriculos_pix_pedidos enable row level security;
revoke all on public.curriculos_codigos, public.curriculos_liberacoes, public.curriculos_pix_pedidos from anon,authenticated;
revoke all on public.curriculos_pix_config from anon,authenticated;
grant select on public.curriculos_codigos to authenticated;
grant select on public.curriculos_pix_pedidos to authenticated;
grant select on public.curriculos_pix_config to authenticated;

-- Admin vê códigos e pedidos; usuário comum vê apenas os próprios pedidos.
drop policy if exists curriculos_codigos_admin_leitura on public.curriculos_codigos;
create policy curriculos_codigos_admin_leitura on public.curriculos_codigos for select to authenticated using ((select public.is_curriculos_admin()));
drop policy if exists curriculos_pix_pedidos_leitura on public.curriculos_pix_pedidos;
create policy curriculos_pix_pedidos_leitura on public.curriculos_pix_pedidos for select to authenticated using ((select public.is_curriculos_admin()) or usuario_id=(select auth.uid()));
drop policy if exists curriculos_pix_config_leitura on public.curriculos_pix_config;
create policy curriculos_pix_config_leitura on public.curriculos_pix_config for select to authenticated using (true);

-- Criação segura pelo administrador; não aceita código escolhido pelo navegador.
create or replace function public.criar_codigo_curriculo()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare novo text;
begin
 if (select auth.uid()) is null or not (select public.is_curriculos_admin()) then raise exception 'Acesso não autorizado'; end if;
 loop
   novo := upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
   begin
    insert into public.curriculos_codigos(codigo,criado_por) values(novo,(select auth.uid()));
    return novo;
   exception when unique_violation then null;
   end;
 end loop;
end $$;

-- Uma mesma liberação vale para futuras impressões do mesmo currículo.
-- Se o currículo for excluído, a liberação antiga deixa de funcionar; limpeza periódica opcional.
create or replace function public.pode_exportar_curriculo(p_curriculo text)
returns boolean language sql stable security definer set search_path = '' as $$
 select (select public.is_curriculos_admin()) or exists (
 select 1 from public.curriculos_liberacoes l
 join public.curriculos c on c.id::text=l.curriculo_id
 where l.curriculo_id=p_curriculo and l.usuario_id=(select auth.uid()) and c.usuario_id=(select auth.uid())
 );
$$;

-- O bloqueio FOR UPDATE torna atômico o resgate, mesmo com duas requisições simultâneas.
create or replace function public.resgatar_codigo_curriculo(p_codigo text,p_curriculo text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid; v_normalizado text := upper(regexp_replace(coalesce(p_codigo,''),'[^A-Za-z0-9]','','g'));
begin
 if (select auth.uid()) is null then raise exception 'Faça login'; end if;
 if not exists(select 1 from public.curriculos where id::text=p_curriculo and usuario_id=(select auth.uid())) then raise exception 'Currículo não pertence a esta conta'; end if;
 if length(v_normalizado)<>12 then raise exception 'Código inválido'; end if;
 select id into v_id from public.curriculos_codigos where codigo=v_normalizado and usado_em is null for update;
 if v_id is null then raise exception 'Código inválido ou já utilizado'; end if;
 update public.curriculos_codigos set usado_em=now(), usado_por=(select auth.uid()), curriculo_id=p_curriculo where id=v_id;
 insert into public.curriculos_liberacoes(curriculo_id,usuario_id,origem) values (p_curriculo,(select auth.uid()),'codigo') on conflict(curriculo_id,usuario_id) do nothing;
 return true;
end $$;

create or replace function public.pedir_liberacao_pix(p_curriculo text,p_pagador_nome text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_uuid uuid;
begin
 if (select auth.uid()) is null then raise exception 'Faça login'; end if;
 if length(trim(coalesce(p_pagador_nome,''))) < 3 or length(p_pagador_nome)>120 then raise exception 'Informe o nome do pagador'; end if;
 if not exists(select 1 from public.curriculos where id::text=p_curriculo and usuario_id=(select auth.uid())) then raise exception 'Currículo não pertence a esta conta'; end if;
 if not exists(select 1 from public.curriculos_pix_config where id=1 and length(trim(chave_pix))>0) then raise exception 'Pix ainda não configurado pelo administrador'; end if;
 if (select public.pode_exportar_curriculo(p_curriculo)) then raise exception 'Currículo já liberado'; end if;
 insert into public.curriculos_pix_pedidos(curriculo_id,usuario_id,pagador_nome) values(p_curriculo,(select auth.uid()),trim(p_pagador_nome))
 on conflict(curriculo_id,usuario_id) where status='pendente' do update set solicitado_em=public.curriculos_pix_pedidos.solicitado_em
 returning id into v_uuid;
 return v_uuid;
end $$;

create or replace function public.configurar_chave_pix(p_chave text,p_recebedor text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
 if (select auth.uid()) is null or not (select public.is_curriculos_admin()) then raise exception 'Acesso não autorizado'; end if;
 if length(trim(coalesce(p_chave,'')))<5 or length(trim(coalesce(p_chave,'')))>160 then raise exception 'Informe uma chave Pix válida'; end if;
 if length(trim(coalesce(p_recebedor,'')))<2 or length(trim(coalesce(p_recebedor,'')))>100 then raise exception 'Informe o nome do recebedor'; end if;
 insert into public.curriculos_pix_config(id,chave_pix,recebedor) values(1,trim(p_chave),trim(p_recebedor))
 on conflict(id) do update set chave_pix=excluded.chave_pix, recebedor=excluded.recebedor;
 return true;
end $$;

create or replace function public.decidir_pedido_pix(p_pedido uuid,p_aprovar boolean)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_pedido public.curriculos_pix_pedidos%rowtype;
begin
 if (select auth.uid()) is null or not (select public.is_curriculos_admin()) then raise exception 'Acesso não autorizado'; end if;
 select * into v_pedido from public.curriculos_pix_pedidos where id=p_pedido for update;
 if not found or v_pedido.status<>'pendente' then raise exception 'Pedido não encontrado ou já decidido'; end if;
 if p_aprovar then
  insert into public.curriculos_liberacoes(curriculo_id,usuario_id,origem)
  values(v_pedido.curriculo_id,v_pedido.usuario_id,'pix') on conflict(curriculo_id,usuario_id) do nothing;
 end if;
 update public.curriculos_pix_pedidos set status=case when p_aprovar then 'aprovado' else 'recusado' end,
 decidido_em=now(), decidido_por=(select auth.uid()) where id=p_pedido;
 return true;
end $$;

revoke all on function public.criar_codigo_curriculo(), public.pode_exportar_curriculo(text), public.resgatar_codigo_curriculo(text,text), public.pedir_liberacao_pix(text,text), public.configurar_chave_pix(text,text), public.decidir_pedido_pix(uuid,boolean) from public,anon;
grant execute on function public.criar_codigo_curriculo(), public.pode_exportar_curriculo(text), public.resgatar_codigo_curriculo(text,text), public.pedir_liberacao_pix(text,text), public.configurar_chave_pix(text,text), public.decidir_pedido_pix(uuid,boolean) to authenticated;
