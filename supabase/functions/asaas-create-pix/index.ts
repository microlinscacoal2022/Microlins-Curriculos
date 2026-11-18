import { admin, asaas, cors, json, userFrom, validCpf } from '../_shared/common.ts';
Deno.serve(async (req) => {
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return json({error:'Método não permitido'},405);
 try{
  const user=await userFrom(req);if(!user)return json({error:'Faça login'},401);
  const body=await req.json();const curriculoId=String(body.curriculoId||'');const cpf=String(body.cpf||'').replace(/\D/g,'');
  if(!validCpf(cpf))return json({error:'CPF inválido'},400);
  const db=admin();
  const {data:resume,error:re}=await db.from('curriculos').select('id,nome,usuario_id').eq('id',curriculoId).eq('usuario_id',user.id).maybeSingle();
  if(re||!resume)return json({error:'Currículo não encontrado nesta conta'},403);
  const {data:released}=await db.from('curriculos_liberacoes').select('curriculo_id').eq('curriculo_id',curriculoId).eq('usuario_id',user.id).maybeSingle();
  if(released)return json({error:'Currículo já liberado; abra Meus currículos para baixar.'},409);
  let customerId:string;
  const {data:known}=await db.from('curriculos_asaas_clientes').select('asaas_id').eq('usuario_id',user.id).maybeSingle();
  if(known){customerId=known.asaas_id;}else{
   const customer=await asaas('/customers',{method:'POST',body:JSON.stringify({name:String(resume.nome||'Aluno Microlins').slice(0,200),cpfCnpj:cpf,email:user.email||undefined,externalReference:user.id,notificationDisabled:true})});
   customerId=customer.id;
   if(!customerId)throw new Error('Asaas não retornou cliente');
   const {error:ce}=await db.from('curriculos_asaas_clientes').upsert({usuario_id:user.id,asaas_id:customerId},{onConflict:'usuario_id'});if(ce)throw ce;
  }
  const {data:order,error:oe}=await db.from('curriculos_asaas_pagamentos').insert({usuario_id:user.id,curriculo_id:curriculoId,valor_centavos:1000,status:'CRIANDO'}).select('id').single();
  if(oe||!order)throw oe||new Error('Erro ao criar pedido');
  const date=new Date();date.setDate(date.getDate()+1);const dueDate=date.toISOString().slice(0,10);
  try{
   const payment=await asaas('/payments',{method:'POST',body:JSON.stringify({customer:customerId,billingType:'PIX',value:10,dueDate,externalReference:order.id,description:'Currículo em PDF - Microlins Cacoal'})});
   if(!payment.id)throw new Error('Asaas não retornou cobrança');
   const {error:pe}=await db.from('curriculos_asaas_pagamentos').update({asaas_id:payment.id,status:payment.status||'PENDING'}).eq('id',order.id);if(pe)throw pe;
   const qr=await asaas('/payments/'+encodeURIComponent(payment.id)+'/pixQrCode');
   if(!qr.payload||!qr.encodedImage)throw new Error('Asaas não retornou QR Code');
   return json({paymentId:payment.id,pixPayload:qr.payload,qrImage:qr.encodedImage,expiresAt:qr.expirationDate});
  }catch(e){await db.from('curriculos_asaas_pagamentos').update({status:'ERRO'}).eq('id',order.id).eq('status','CRIANDO');throw e;}
 }catch(e){console.error('asaas-create-pix',e);return json({error:'Não foi possível gerar o Pix. Verifique os dados e tente novamente.'},500);}
});
