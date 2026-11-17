import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {SUPABASE_URL,SUPABASE_ANON_KEY} from './config.js';
const $=id=>document.getElementById(id);
const keys=['nome','cidade','telefone','email','idade','vaga','situacao','formacao','periodo','instituicao','objetivo','experiencia','cursos','habilidades','perfil','extras'];
const client=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
// Estilos do quadro DISC para os seis modelos, sem alterar seus temas de cores.
const discCss=document.createElement('style');
discCss.textContent=`
.disc-all-scores{display:grid;gap:9px;margin:12px 0 13px}
.disc-score-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;font-weight:600;margin-bottom:4px}
.disc-score-heading strong{font-variant-numeric:tabular-nums;font-size:12px}
.disc-score-track{height:6px;background:rgba(128,128,128,.20);border-radius:30px;overflow:hidden}
.disc-score-fill{height:100%;background:var(--accent,#0e5792);border-radius:30px}
@media print{.disc-score-line{break-inside:avoid}.disc-score-track,.disc-score-fill{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
`;
document.head.append(discCss);

let isAdmin=false, adminRows=[], adminOffset=0, adminHasMore=false, adminViewing=null;
let user=null, rows=[], editingId=null, viewingId=null, photoData='',selectedTemplate='azul',discResult=null,accountDisc=null,discSaving=false;
const msg=(id,s)=>{$(id).textContent=s;};
const displayName=u=>{const name=u?.user_metadata?.full_name||u?.user_metadata?.name;return String(name||u?.email?.split('@')[0]||'Usuário').trim().slice(0,80);};
const updateUsername=()=>{$('sidebarUsername').textContent=displayName(user);};
const isValidDisc=r=>!!(r?.scores&&['D','I','S','C'].every(k=>Number.isFinite(r.scores[k])&&r.scores[k]>=0&&r.scores[k]<=100));
const accountDiscFrom=u=>isValidDisc(u?.user_metadata?.disc_result)?u.user_metadata.disc_result:null;
const values=()=>({...Object.fromEntries(keys.map(k=>[k,$(k).value.trim()])),foto:photoData,modelo:selectedTemplate,disc:accountDisc});
function syncAccountDisc(){accountDisc=accountDiscFrom(user);discResult=accountDisc;updateDiscStatus();updateDiscPage();}
function updateDiscPage(){
 const complete=isValidDisc(accountDisc);
 const panel=$('discCompleted');const frame=$('discFrame');
 if(panel)panel.hidden=!complete;
 if(frame)frame.hidden=complete;
 if(complete){
  const names={D:'Dominância',I:'Influência',S:'Estabilidade',C:'Conformidade'};
  const score=accountDisc.scores, highest=Math.max(...Object.values(score));
  const tops=Object.keys(names).filter(k=>score[k]===highest).map(k=>names[k]);
  $('discCompletedSummary').textContent='Perfil predominante: '+tops.join(' e ')+'.';
  $('discCompletedScores').textContent=Object.entries(names).map(([k,n])=>`${n}: ${Math.round(score[k])}%`).join(' • ');
  const stamp=accountDisc.completedAt?new Date(accountDisc.completedAt):null;
  $('discCompletedDate').textContent=stamp&&!Number.isNaN(stamp.getTime())?'Realizado em '+stamp.toLocaleDateString('pt-BR')+'. Resultado salvo nesta conta.':'Resultado salvo nesta conta.';
 }
 const btn=$('goDisc');if(btn){btn.hidden=complete;btn.disabled=complete;}
}

function fallbackObjective(d){return d.situacao==='experiencia'?`Busco uma oportunidade${d.vaga?' na área de '+d.vaga:''} para aplicar meus conhecimentos, aprender e contribuir com a equipe.`:`Busco minha primeira oportunidade${d.vaga?' na área de '+d.vaga:''} para desenvolver minhas habilidades, aprender e contribuir com dedicação e responsabilidade.`;}
function cleanData(raw={}) {
  return {...raw};
}
function renderResume(container,raw){
  const d=cleanData(raw);
  container.replaceChildren($('resumeTemplate').content.cloneNode(true));
  const root=container.querySelector('.resume');
  root.dataset.template=d.modelo||selectedTemplate;
  const field=k=>String(d[k]??'').trim();
  const set=(key,text)=>{
    const node=root.querySelector(`[data-r="${key}"]`);
    if(node) node.textContent=text??'';
  };
  const setSection=(key,text)=>{
    set(key,text);
    const el=root.querySelector(`[data-section="${key}"]`);
    if(el)el.hidden=!String(text||'').trim();
  };
  set('nome',field('nome').toLocaleUpperCase('pt-BR'));
  const role=root.querySelector('.role-pill');
  set('vaga',field('vaga').toLocaleUpperCase('pt-BR'));
  role.hidden=!field('vaga');
  const topo=[
    field('cidade'),
    field('idade')&&`${field('idade')} anos`,
    field('situacao')==='experiencia'?'Com experiência':field('situacao')==='primeiro'?'Primeiro emprego':''
  ].filter(Boolean).join(' • ');
  set('subtitulo',topo);
  root.querySelector('.resume-topline').hidden=!topo;
  for(const key of ['cidade','telefone','email']){
    set(key,field(key));
    const node=root.querySelector(`[data-r="${key}"]`);
    if(node)node.closest('.contact-item').hidden=!field(key);
  }
  setSection('idade',field('idade')?`${field('idade')} anos`:'');
  const formation=[
    field('formacao'),
    field('periodo')&&`Período: ${field('periodo')}`,
    field('instituicao')&&`Instituição: ${field('instituicao')}`
  ].filter(Boolean).join('\n');
  setSection('formacao',formation);
  setSection('objetivo',field('objetivo'));
  setSection('experiencia',field('experiencia'));
  setSection('cursos',field('cursos'));
  setSection('habilidades',field('habilidades'));
  setSection('perfil',field('perfil'));
  setSection('extras',field('extras'));
  const contacts=root.querySelector('.contact-list');
  const contactSection=contacts?.closest('.mod-block');
  if(contactSection)contactSection.hidden=!Array.from(contacts.querySelectorAll('.contact-item')).some(el=>!el.hidden);
  const img=root.querySelector('img.resume-photo');
  const photoSlot=root.querySelector('.photo-slot');
  const photoValid=typeof d.foto==='string'&&/^data:image\/(jpeg|png|webp);base64,/.test(d.foto);
  photoSlot.hidden=!photoValid;
  if(photoValid){
    img.src=d.foto;
    img.hidden=false;
  }else{
    img.removeAttribute('src');
    img.hidden=true;
  }
  const placeholder=root.querySelector('.photo-placeholder');
  if(placeholder)placeholder.hidden=true;
  if(d.disc && d.disc.scores && ['D','I','S','C'].every(k=>Number.isFinite(d.disc.scores[k])&&d.disc.scores[k]>=0&&d.disc.scores[k]<=100)){
    const labels={D:'Dominância',I:'Influência',S:'Estabilidade',C:'Conformidade'};
    const scores=d.disc.scores;
    const top=Math.max(...Object.values(scores));
    const winners=Object.keys(labels).filter(k=>scores[k]===top);
    const brief={
      D:'Identifica-se com iniciativa, tomada de decisões e desafios.',
      I:'Identifica-se com comunicação, entusiasmo e interação.',
      S:'Identifica-se com paciência, escuta e colaboração.',
      C:'Identifica-se com organização, atenção aos detalhes e planejamento.'
    };
    const section=document.createElement('section');section.className='disc-result-box';
    const title=document.createElement('h3');title.textContent='PERFIL COMPORTAMENTAL — DISC';section.append(title);
    const results=document.createElement('div');results.className='disc-all-scores';
    for(const key of ['D','I','S','C']){
      const line=document.createElement('div');line.className='disc-score-line';
      const heading=document.createElement('div');heading.className='disc-score-heading';
      const name=document.createElement('span');name.textContent=`${key} — ${labels[key]}`;
      const percent=document.createElement('strong');percent.textContent=`${Math.round(scores[key])}%`;
      heading.append(name,percent);
      const track=document.createElement('div');track.className='disc-score-track';
      const fill=document.createElement('div');fill.className='disc-score-fill';fill.style.width=`${scores[key]}%`;
      track.append(fill);line.append(heading,track);results.append(line);
    }
    section.append(results);
    const summary=document.createElement('p');
    summary.textContent=(winners.length===1?'Tendência predominante: ':'Tendências predominantes (empate): ')+winners.map(k=>labels[k]).join(' e ');
    section.append(summary);
    const description=document.createElement('p');description.textContent=winners.map(k=>brief[k]).join(' ');section.append(description);
    const note=document.createElement('small');note.textContent='Percentuais independentes por dimensão; não precisam somar 100%. Autoavaliação educativa, não avaliação psicológica.';section.append(note);
    const body=root.querySelector('.resume-body');body.append(section);
  }
}
function resetEditor(){editingId=null;photoData='';selectedTemplate='azul';discResult=accountDisc;updateDiscStatus();$('form').reset();$('foto').value='';$('removePhoto').hidden=true;$('photoStatus').textContent='Nenhuma foto selecionada';$('editBanner').hidden=true;renderResume($('previewMount'),values());msg('editorMessage','');}
function populate(data){const d=cleanData(data);selectedTemplate=d.modelo||'azul';discResult=accountDisc;updateDiscStatus();for(const k of keys)$(k).value=d[k]??'';photoData=d.foto||'';$('photoStatus').textContent=photoData?'Foto do currículo carregada':'Nenhuma foto selecionada';$('removePhoto').hidden=!photoData;renderResume($('previewMount'),values());}
function hasDisc(){return isValidDisc(accountDisc);}
function requireDisc(messageId='editorMessage'){
 if(hasDisc())return true;
 msg(messageId,'Conclua primeiro o teste DISC obrigatório (24 perguntas).');
 navigate('disc');return false;
}
function navigate(page){
 if(['modelos','visualizar'].includes(page)&&!hasDisc()){
  msg('discPageStatus','Para continuar, conclua primeiro as 24 perguntas do teste DISC.');
  page='disc';
 }
 if(page==='admin'&&!isAdmin)page='criar';
 const valid=['criar','disc','modelos','visualizar','salvos','admin'].includes(page)?page:'criar';$('pageCriar').hidden=valid!=='criar';$('pageDisc').hidden=valid!=='disc';$('pageModelos').hidden=valid!=='modelos';$('pageVisualizar').hidden=valid!=='visualizar';$('pageSalvos').hidden=valid!=='salvos';$('pageAdmin').hidden=valid!=='admin';if(valid==='admin'&&isAdmin&&!adminRows.length)loadAdmin(true);document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===valid);b.setAttribute('aria-current',b.dataset.page===valid?'page':'false');});if(location.hash!=='#'+valid)history.replaceState(null,'','#'+valid);window.scrollTo(0,0);}
function authScreen(){const logged=!!user;$('authScreen').hidden=logged;$('workspace').hidden=!logged;if(logged){checkAdmin();msg('authstatus',`Conectado: ${user.email}`);updateUsername();syncAccountDisc();}else{isAdmin=false;adminRows=[];adminViewing=null;$('navAdmin').hidden=true;$('pageAdmin').hidden=true;$('authPassword').value='';accountDisc=null;discResult=null;resetEditor();updateDiscPage();rows=[];viewingId=null;$('savedViewer').hidden=true;}}
function selectedCard(row){const card=document.createElement('div');card.className='saved-card';const title=document.createElement('h3');title.textContent=row.nome||'Currículo';const date=document.createElement('small');date.textContent=`Salvo em ${new Date(row.updated_at||Date.now()).toLocaleDateString('pt-BR')}`;const btn=document.createElement('div');btn.className='actions';const open=document.createElement('button');open.textContent='Visualizar';open.onclick=()=>showSaved(row.id);const edit=document.createElement('button');edit.className='light';edit.textContent='Editar';edit.onclick=()=>editSaved(row.id);const del=document.createElement('button');del.className='danger';del.textContent='Excluir';del.onclick=()=>deleteSaved(row.id);btn.append(open,edit,del);card.append(title,date,btn);return card;}
function renderList(){const list=$('savedList');list.replaceChildren();if(!rows.length){const p=document.createElement('p');p.textContent='Você ainda não tem currículos salvos. Clique em Criar currículo para começar.';list.append(p);}else rows.forEach(r=>list.append(selectedCard(r)));}
async function refresh(){
 if(!user)return;
 const target=user.id;
 const {data,error}=await client.from('curriculos').select('id,nome,conteudo,updated_at').eq('usuario_id',target).order('updated_at',{ascending:false});
 if(target!==user?.id)return;
 if(error){msg('cloudmessage','Erro ao carregar currículos: '+error.message);return;}
 rows=data||[];renderList();
 // Recupera resultados de currículos antigos que já tinham DISC e os associa à conta uma vez.
 if(!accountDisc){
  const old=rows.find(row=>isValidDisc(row.conteudo?.disc))?.conteudo.disc;
  if(old){
   const {data:updated,error:updateError}=await client.auth.updateUser({data:{disc_result:old}});
   if(target!==user?.id)return;
   if(updateError){msg('cloudmessage','Currículos carregados, mas não foi possível associar o DISC antigo à conta: '+updateError.message);return;}
   user=updated.user||user;syncAccountDisc();renderResume($('previewMount'),values());
  }
 }
}
function showSaved(id){const row=rows.find(r=>r.id===id);if(!row)return;viewingId=id;renderResume($('savedMount'),row.conteudo||{});$('savedViewerTitle').textContent=row.nome||'Currículo salvo';$('savedViewer').hidden=false;navigate('salvos');$('savedViewer').scrollIntoView({behavior:'smooth',block:'start'});}
function editSaved(id){const row=rows.find(r=>r.id===id);if(!row)return;resetEditor();editingId=id;populate(row.conteudo||{});$('editBanner').hidden=false;navigate('criar');}
async function deleteSaved(id){if(!confirm('Excluir este currículo da sua conta? Esta ação não pode ser desfeita.'))return;const {error}=await client.from('curriculos').delete().eq('id',id).eq('usuario_id',user.id);if(error)return msg('cloudmessage','Erro ao excluir: '+error.message);if(viewingId===id){viewingId=null;$('savedViewer').hidden=true;}if(editingId===id)resetEditor();await refresh();msg('cloudmessage','Currículo excluído.');}
async function submitAuth(method){const email=$('authEmail').value.trim(),password=$('authPassword').value;if(!email||!password)return msg('authmessage','Preencha e-mail e senha.');if(password.length<6)return msg('authmessage','A senha precisa ter pelo menos 6 caracteres.');const btn=$(method==='signUp'?'signup':'signin');btn.disabled=true;try{const name=$('authName').value.trim();if(method==='signUp' && !name)return msg('authmessage','Informe seu nome para criar a conta.');const {data,error}=method==='signUp'?await client.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:location.origin}}):await client.auth.signInWithPassword({email,password});if(error)throw error;if(method==='signUp' && !data.session)msg('authmessage','Cadastro solicitado. Confirme seu e-mail antes de entrar.');else msg('authmessage','Acesso realizado.');}catch(error){msg('authmessage',error.message||'Falha de autenticação.');}finally{btn.disabled=false;}}
function updateDiscStatus(){
 const status=$('discStatus');if(!status)return;
 if(isValidDisc(accountDisc)){
  const names={D:'Dominância',I:'Influência',S:'Estabilidade',C:'Conformidade'};
  const top=Math.max(...Object.values(accountDisc.scores));
  const winners=Object.keys(names).filter(k=>accountDisc.scores[k]===top);
  status.textContent='✓ DISC concluído e salvo na sua conta. Perfil predominante: '+winners.map(k=>`${names[k]} (${accountDisc.scores[k]}%)`).join(' e ')+'. O resultado será usado automaticamente em todos os currículos.';
 }else status.textContent='Teste obrigatório pendente. Responda uma vez às 24 perguntas. O resultado ficará salvo na sua conta para os próximos currículos.';
}
window.addEventListener('message',async event=>{
 if(event.origin!==location.origin||event.source!==$('discFrame').contentWindow)return;
 if(event.data?.type!=='microlins:disc-result'||!user||discSaving||isValidDisc(accountDisc))return;
 const result=event.data.result;
 if(!isValidDisc(result))return;
 discSaving=true;
 const owner=user.id;
 const candidate={scores:{D:result.scores.D,I:result.scores.I,S:result.scores.S,C:result.scores.C},completedAt:result.completedAt||new Date().toISOString(),version:result.version||'educativo-1'};
 msg('discPageStatus','Salvando seu resultado na conta...');
 const {data,error}=await client.auth.updateUser({data:{disc_result:candidate}});
 discSaving=false;
 if(owner!==user?.id)return;
 if(error){msg('discPageStatus','Não foi possível salvar o DISC: '+error.message+'. Reabra a página e conclua o teste novamente, se necessário.');return;}
 user=data.user||user;
 syncAccountDisc();
 renderResume($('previewMount'),values());
 msg('discPageStatus','Resultado salvo no Supabase. Você não precisará repetir o teste nesta conta.');
 navigate('criar');
});
$('editUsername').onclick=async()=>{if(!user)return;const name=prompt('Qual nome deve aparecer no menu?',displayName(user));if(name===null)return;const cleaned=name.trim().slice(0,80);if(!cleaned)return alert('Informe um nome válido.');const {data,error}=await client.auth.updateUser({data:{full_name:cleaned}});if(error)return alert('Não foi possível atualizar: '+error.message);user=data.user||user;updateUsername();};
$('signin').onclick=()=>submitAuth('signIn');$('signup').onclick=()=>submitAuth('signUp');
$('forgot').onclick=async()=>{const email=$('authEmail').value.trim();if(!email)return msg('authmessage','Informe seu e-mail para recuperar a senha.');const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin});msg('authmessage',error?error.message:'Se o e-mail estiver cadastrado, você receberá instruções.');};
$('logout').onclick=async()=>{await client.auth.signOut();user=null;authScreen();history.replaceState(null,'',location.pathname);};
$('navAdmin').onclick=()=>{if(isAdmin)navigate('admin')};$('adminRefresh').onclick=()=>loadAdmin(true);$('adminMore').onclick=()=>loadAdmin(false);$('adminSearch').oninput=renderAdminList;$('adminClose').onclick=()=>{$('adminViewer').hidden=true;adminViewing=null};$('adminPrint').onclick=()=>{if(adminViewing)printResume('adminMount')};
$('navDisc').onclick=()=>navigate('disc');$('goDisc').onclick=()=>navigate('disc');$('navCriar').onclick=()=>{if(editingId)resetEditor();navigate('criar');};$('navModelos').onclick=()=>{if(!requireDisc())return;buildGallery();navigate('modelos');};$('navVisualizar').onclick=()=>{if(!requireDisc())return;renderChosen();navigate('visualizar');};$('navSalvos').onclick=()=>navigate('salvos');$('cancelEdit').onclick=()=>{resetEditor();navigate('criar');};$('newResume').onclick=()=>resetEditor();
for(const k of keys)$(k).addEventListener('input',()=>renderResume($('previewMount'),values()));
$('foto').onchange=async()=>{const file=$('foto').files?.[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type))return msg('editorMessage','Escolha uma foto JPG, PNG ou WEBP.');if(file.size>12*1024*1024)return msg('editorMessage','A foto deve ter até 12 MB.');const read=()=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});try{const src=await read();const im=new Image();im.src=src;await im.decode();const side=460,ratio=Math.min(1,side/Math.max(im.width,im.height));const canvas=document.createElement('canvas');canvas.width=Math.round(im.width*ratio);canvas.height=Math.round(im.height*ratio);canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);photoData=canvas.toDataURL('image/jpeg',.76);$('photoStatus').textContent='Foto adicionada';$('removePhoto').hidden=false;msg('editorMessage','Foto pronta para salvar.');renderResume($('previewMount'),values());}catch(e){msg('editorMessage','Não foi possível abrir a foto. Tente outra imagem.');}};
$('removePhoto').onclick=()=>{photoData='';$('foto').value='';$('removePhoto').hidden=true;$('photoStatus').textContent='Nenhuma foto selecionada';renderResume($('previewMount'),values());};
async function saveCloudResume(){if(!user)return;const d=values();if(!d.nome)return msg('editorMessage','Preencha o nome completo antes de salvar.');if(!requireDisc())return;const payload={nome:d.nome,conteudo:d,usuario_id:user.id};$('saveCloud').disabled=true;try{const q=editingId?client.from('curriculos').update(payload).eq('id',editingId).eq('usuario_id',user.id):client.from('curriculos').insert(payload);const {error}=await q;if(error)throw error;resetEditor();await refresh();navigate('salvos');msg('cloudmessage','Currículo salvo com sucesso! O formulário de criação já está em branco.');}catch(error){msg('editorMessage','Não foi possível salvar: '+error.message);}finally{$('saveCloud').disabled=false;}}
$('saveCloud').onclick=saveCloudResume; $('saveChosen').onclick=saveCloudResume;
$('closeSaved').onclick=()=>{$('savedViewer').hidden=true;viewingId=null;};$('printSaved').onclick=()=>printResume('savedMount');$('pdf').onclick=()=>{if(!$('nome').value.trim())return msg('editorMessage','Preencha o nome antes de gerar o PDF.');if(!requireDisc())return;renderResume($('previewMount'),values());printResume('previewMount');};$('editSaved').onclick=()=>editSaved(viewingId);
function printResume(id){ // Mantém somente o documento selecionado na área de impressão.
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('print-target'));
 const section=id==='adminMount'?'pageAdmin':id==='savedMount'?'pageSalvos':id==='selectedMount'?'pageVisualizar':'pageCriar';$(section).classList.add('print-target');
 $('previewMount').hidden=id!=='previewMount';$('savedMount').hidden=id!=='savedMount';$('selectedMount').hidden=id!=='selectedMount';$('adminMount').hidden=id!=='adminMount';
 window.print();}
window.addEventListener('afterprint',()=>{$('previewMount').hidden=false;$('savedMount').hidden=false;$('selectedMount').hidden=false;$('adminMount').hidden=false;document.querySelectorAll('.page').forEach(p=>p.classList.remove('print-target'));});
window.addEventListener('hashchange',()=>{if(user)navigate(location.hash.slice(1));});

const templateNames=[['azul','Azul do portal','Identidade azul e branca'],['cinza-laranja','Cinza e laranja','Designer gráfico moderno'],['verde','Verde escuro','Clássico com foto'],['preto-laranja','Preto e laranja','Profissional de destaque'],['preto-branco','Preto e branco','Simples sem foto'],['preto-cinza','Preto e cinza','Jovem aprendiz minimalista']];
function buildGallery(){const gallery=$('modelGallery');gallery.replaceChildren();for(const [id,title,desc] of templateNames){const card=document.createElement('button');card.type='button';card.className='model-choice'+(selectedTemplate===id?' is-selected':'');card.setAttribute('aria-pressed',String(selectedTemplate===id));card.innerHTML=`<div class="thumb" data-template="${id}"><aside><span class="thumb-name">SEU NOME</span><span class="thumb-mini">Primeiro emprego</span><span class="thumb-role">CARGO OU VAGA</span><span class="mock-photo"></span></aside><main><div class="stack"><div class="mini-block"><i></i><i></i><i></i></div><div class="mini-block"><i></i><i></i><i></i></div><div class="mini-block"><i></i><i></i><i></i></div><div class="mini-block"><i></i><i></i><i></i></div></div></main></div><strong>${title}</strong><small>${desc}</small>`;card.onclick=()=>{selectedTemplate=id;buildGallery();};gallery.append(card);}}
function renderChosen(){const chosen=templateNames.find(t=>t[0]===selectedTemplate);$('chosenModelName').textContent=chosen?.[1]||'Modelo';renderResume($('selectedMount'),values());}
$('goModels').onclick=()=>{if(!$('nome').value.trim())return msg('editorMessage','Preencha o nome antes de escolher o modelo.');if(!requireDisc())return;buildGallery();navigate('modelos');};
$('previewChosen').onclick=()=>{if(!requireDisc())return;renderChosen();navigate('visualizar');};
$('returnToForm').onclick=()=>navigate('criar');
$('changeModel').onclick=()=>{buildGallery();navigate('modelos');};
$('backToForm').onclick=()=>navigate('criar');
$('printChosen').onclick=()=>{if(!requireDisc())return;renderChosen();printResume('selectedMount');};

// A segurança efetiva é garantida pelas políticas RLS no Supabase.
// A interface nunca recebe ou usa a chave service_role.
async function checkAdmin(){
 const id=user?.id;if(!id)return;
 const {data,error}=await client.rpc('is_curriculos_admin');
 if(id!==user?.id)return;
 isAdmin=!error&&data===true;
 $('navAdmin').hidden=!isAdmin;
 if(error&&location.hash==='#admin')msg('authstatus','Administração não configurada no Supabase.');
 if(!isAdmin){adminRows=[];adminViewing=null;$('pageAdmin').hidden=true;}
}
async function loadAdmin(reset=true){
 if(!isAdmin||!user)return;
 if(reset){adminOffset=0;adminRows=[];adminViewing=null;$('adminViewer').hidden=true;}
 const owner=user.id;
 msg('adminMessage','Carregando currículos...');
 const {data,error}=await client.from('curriculos')
  .select('id,usuario_id,nome,conteudo,updated_at')
  .order('updated_at',{ascending:false})
  .range(adminOffset,adminOffset+49);
 if(owner!==user?.id||!isAdmin)return;
 if(error){msg('adminMessage','Falha ao carregar: '+error.message+'. Verifique a configuração SQL de administrador.');return;}
 adminRows.push(...(data||[]));adminOffset+=data?.length||0;
 adminHasMore=(data?.length||0)===50;
 $('adminMore').hidden=!adminHasMore;
 msg('adminMessage','');renderAdminList();
}
function renderAdminList(){
 const list=$('adminList');list.replaceChildren();
 const query=$('adminSearch').value.trim().toLocaleLowerCase('pt-BR');
 const visible=adminRows.filter(r=>[r.nome,r.conteudo?.email,r.conteudo?.cidade,r.conteudo?.vaga].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(query)));
 $('adminCount').textContent=`${visible.length} exibidos de ${adminRows.length} carregados${adminHasMore?' (há mais currículos)':''}.`;
 if(!visible.length){const p=document.createElement('p');p.textContent=query?'Nenhum currículo encontrado entre os registros carregados.':'Nenhum currículo encontrado.';list.append(p);}
 for(const r of visible){
  const card=document.createElement('div');card.className='saved-card';
  const name=document.createElement('h3');name.textContent=r.nome||'Currículo sem nome';
  const meta=document.createElement('small');meta.textContent=[r.conteudo?.email,r.conteudo?.cidade,new Date(r.updated_at||Date.now()).toLocaleDateString('pt-BR')].filter(Boolean).join(' • ');
  const actions=document.createElement('div');actions.className='actions';
  const open=document.createElement('button');open.type='button';open.textContent='Visualizar';open.onclick=()=>{adminViewing=r.id;renderResume($('adminMount'),r.conteudo||{});$('adminViewerTitle').textContent=r.nome||'Currículo';$('adminViewer').hidden=false;document.getElementById('adminViewer').scrollIntoView({behavior:'smooth'});};
  const del=document.createElement('button');del.type='button';del.className='danger';del.textContent='Excluir';del.onclick=()=>deleteAdminResume(r);
  actions.append(open,del);card.append(name,meta,actions);list.append(card);
 }
}
async function deleteAdminResume(r){
 if(!isAdmin||!confirm(`Excluir DEFINITIVAMENTE o currículo de ${r.nome||'nome não informado'}? Essa ação não poderá ser desfeita.`))return;
 const {error}=await client.from('curriculos').delete().eq('id',r.id);
 if(error){msg('adminMessage','Erro ao excluir: '+error.message);return;}
 if(adminViewing===r.id){$('adminViewer').hidden=true;adminViewing=null;}
 adminRows=adminRows.filter(x=>x.id!==r.id);renderAdminList();msg('adminMessage','Currículo excluído.');
}

client.auth.onAuthStateChange((event,session)=>{
 if(event==='PASSWORD_RECOVERY'){setTimeout(async()=>{const pass=prompt('Digite uma nova senha com pelo menos 6 caracteres:');if(pass===null)return;if(pass.length<6)return alert('A senha precisa ter pelo menos 6 caracteres.');const {error}=await client.auth.updateUser({password:pass});alert(error?error.message:'Senha atualizada com sucesso.');},0);}
 const previous=user?.id;user=session?.user||null;if(previous!==user?.id){isAdmin=false;adminRows=[];$('navAdmin').hidden=true;}authScreen();if(user&&previous!==user.id){resetEditor();navigate('criar');setTimeout(()=>refresh(),0);}else if(user){renderResume($('previewMount'),values());}
});
resetEditor();const {data:{user:verifiedUser}}=await client.auth.getUser();user=verifiedUser||null;authScreen();if(user){resetEditor();navigate('criar');await refresh();}
