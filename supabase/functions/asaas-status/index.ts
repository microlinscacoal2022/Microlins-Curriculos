import {admin,cors,json,userFrom,reconcile} from '../_shared/common.ts';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return json({error:'Método não permitido'},405);
 const user=await userFrom(req);if(!user)return json({error:'Faça login'},401);
 try{
  const {curriculoId}=await req.json();const id=String(curriculoId||'');const db=admin();
  const {data:resume}=await db.from('curriculos').select('id').eq('id',id).eq('usuario_id',user.id).maybeSingle();
  if(!resume)return json({error:'Currículo não encontrado'},404);
  const {data:latest}=await db.from('curriculos_asaas_pagamentos').select('*').eq('curriculo_id',id).eq('usuario_id',user.id).order('criado_em',{ascending:false}).limit(1).maybeSingle();
  let status=latest?.status||null;
  if(latest?.asaas_id && !['RECEIVED','REFUNDED'].includes(status)){status=await reconcile(latest);}
  const {data:access}=await db.from('curriculos_liberacoes').select('curriculo_id').eq('curriculo_id',id).eq('usuario_id',user.id).maybeSingle();
  return json({liberado:!!access,pagamento:latest?{status}:null});
 }catch(e){console.error('asaas-status',e);return json({error:'Falha na consulta ao Asaas'},502);}
});
