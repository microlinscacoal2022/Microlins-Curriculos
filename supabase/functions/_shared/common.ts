import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
export const cors = { 'Access-Control-Allow-Origin': Deno.env.get('SITE_ORIGIN') || 'https://microlins-curriculos.onrender.com', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } }); }
export const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
export async function userFrom(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.getUser(token);
  return error ? null : data.user;
}
export async function asaas(path: string, options: RequestInit = {}) {
  const base = Deno.env.get('ASAAS_ENV') === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
  const response = await fetch(base + path, { ...options, headers: { 'accept':'application/json', 'content-type':'application/json', 'access_token': Deno.env.get('ASAAS_API_KEY')!, ...options.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Asaas '+response.status+' — '+JSON.stringify(body).slice(0, 400));
  return body;
}
export function validCpf(raw:string) { const c=raw.replace(/\D/g,''); if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  for(let digit=9;digit<=10;digit++){const v=c.slice(0,digit).split('').reduce((a,n,i)=>a+Number(n)*(digit+1-i),0);const check=(v*10)%11%10;if(check!==Number(c[digit]))return false;}return true; }
export async function reconcile(row: any) {
  const payment = await asaas('/payments/' + encodeURIComponent(row.asaas_id));
  if (payment.id !== row.asaas_id || payment.billingType !== 'PIX' || Number(payment.value) !== 10 || String(payment.externalReference) !== String(row.id)) throw new Error('Cobrança Asaas não corresponde ao pedido interno');
  const db = admin();
  const status = String(payment.status || 'PENDING');
  // RECEIVED é o estado liquidado. Não liberar com PENDING, clique do usuário ou comprovante.
  if (status === 'RECEIVED') {
    const {error:e1}=await db.from('curriculos_liberacoes').upsert({curriculo_id:row.curriculo_id, usuario_id:row.usuario_id, origem:'pix'}, {onConflict:'curriculo_id,usuario_id', ignoreDuplicates:true});
    if(e1)throw e1;
    const {error:e2}=await db.from('curriculos_asaas_pagamentos').update({status:'RECEIVED',confirmado_em:new Date().toISOString()}).eq('id',row.id);
    if(e2)throw e2;
  } else {
    const {error}=await db.from('curriculos_asaas_pagamentos').update({status}).eq('id',row.id);
    if(error)throw error;
  }
  return status;
}
