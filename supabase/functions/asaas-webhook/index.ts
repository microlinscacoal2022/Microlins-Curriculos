import {admin,cors,json,reconcile} from '../_shared/common.ts';
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'Método não permitido'},405);
 const expected=Deno.env.get('ASAAS_WEBHOOK_TOKEN');
 if(!expected||req.headers.get('asaas-access-token')!==expected)return json({error:'Webhook não autorizado'},401);
 try{
  const event=await req.json();const id=String(event.id||'');const paymentId=String(event.payment?.id||'');
  if(!id||!paymentId)return json({error:'Evento incompleto'},400);
  const db=admin();
  const {data:order,error}=await db.from('curriculos_asaas_pagamentos').select('*').eq('asaas_id',paymentId).maybeSingle();
  if(error)throw error;
  if(!order)return json({ok:true,ignored:true});
  // A consulta autenticada ao Asaas impede que um payload forjado libere o currículo.
  await reconcile(order);
  return json({ok:true});
 }catch(e){console.error('asaas-webhook',e);return json({error:'Processamento pendente; o Asaas poderá reenviar o evento'},500);}
});
