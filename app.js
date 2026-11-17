import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {SUPABASE_URL,SUPABASE_ANON_KEY} from './config.js';
const $=id=>document.getElementById(id);
const keys=['nome','cidade','telefone','email','idade','vaga','situacao','formacao','periodo','instituicao','objetivo','experiencia','cursos','habilidades','perfil','extras'];
const client=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
let user=null, rows=[], editingId=null, viewingId=null, photoData='',selectedTemplate='azul',discResult=null;
const msg=(id,s)=>{$(id).textContent=s;};
const displayName=u=>{const name=u?.user_metadata?.full_name||u?.user_metadata?.name;return String(name||u?.email?.split('@')[0]||'Usuário').trim().slice(0,80);};
const updateUsername=()=>{$('sidebarUsername').textContent=displayName(user);};
const values=()=>({...Object.fromEntries(keys.map(k=>[k,$(k).value.trim()])),foto:photoData,modelo:selectedTemplate,disc:$('discInclude').checked?discResult:null});
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
    const dominant=Object.keys(labels).filter(k=>scores[k]===top).map(k=>labels[k]).join(' e ');
    const section=document.createElement('section');section.className='disc-result-box';
    const title=document.createElement('h3');title.textContent='PERFIL COMPORTAMENTAL — DISC';section.append(title);
    const summary=document.createElement('p');summary.textContent='Tendência(s) mais destacada(s): '+dominant;section.append(summary);
    const details=document.createElement('p');details.textContent=Object.keys(labels).map(k=>`${labels[k]}: ${scores[k]}%`).join(' · ');section.append(details);
    const note=document.createElement('small');note.textContent='Autoavaliação educativa de autoconhecimento; não é diagnóstico nem avaliação de contratação.';section.append(note);
    const body=root.querySelector('.resume-body');body.append(section);
  }
}
function resetEditor(){editingId=null;photoData='';selectedTemplate='azul';discResult=null;$('discInclude').checked=false;$('discInclude').disabled=true;updateDiscStatus();$('form').reset();$('foto').value='';$('removePhoto').hidden=true;$('photoStatus').textContent='Nenhuma foto selecionada';$('editBanner').hidden=true;renderResume($('previewMount'),values());msg('editorMessage','');}
function populate(data){const d=cleanData(data);selectedTemplate=d.modelo||'azul';discResult=d.disc||null;$('discInclude').disabled=!discResult;$('discInclude').checked=!!discResult;updateDiscStatus();for(const k of keys)$(k).value=d[k]??'';photoData=d.foto||'';$('photoStatus').textContent=photoData?'Foto do currículo carregada':'Nenhuma foto selecionada';$('removePhoto').hidden=!photoData;renderResume($('previewMount'),values());}
function navigate(page){const valid=['criar','disc','modelos','visualizar','salvos'].includes(page)?page:'criar';$('pageCriar').hidden=valid!=='criar';$('pageDisc').hidden=valid!=='disc';$('pageModelos').hidden=valid!=='modelos';$('pageVisualizar').hidden=valid!=='visualizar';$('pageSalvos').hidden=valid!=='salvos';document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===valid);b.setAttribute('aria-current',b.dataset.page===valid?'page':'false');});if(location.hash!=='#'+valid)history.replaceState(null,'','#'+valid);window.scrollTo(0,0);}
function authScreen(){const logged=!!user;$('authScreen').hidden=logged;$('workspace').hidden=!logged;if(logged){msg('authstatus',`Conectado: ${user.email}`);updateUsername();}else{$('authPassword').value='';resetEditor();rows=[];viewingId=null;$('savedViewer').hidden=true;}}
function selectedCard(row){const card=document.createElement('div');card.className='saved-card';const title=document.createElement('h3');title.textContent=row.nome||'Currículo';const date=document.createElement('small');date.textContent=`Salvo em ${new Date(row.updated_at||Date.now()).toLocaleDateString('pt-BR')}`;const btn=document.createElement('div');btn.className='actions';const open=document.createElement('button');open.textContent='Visualizar';open.onclick=()=>showSaved(row.id);const edit=document.createElement('button');edit.className='light';edit.textContent='Editar';edit.onclick=()=>editSaved(row.id);const del=document.createElement('button');del.className='danger';del.textContent='Excluir';del.onclick=()=>deleteSaved(row.id);btn.append(open,edit,del);card.append(title,date,btn);return card;}
function renderList(){const list=$('savedList');list.replaceChildren();if(!rows.length){const p=document.createElement('p');p.textContent='Você ainda não tem currículos salvos. Clique em Criar currículo para começar.';list.append(p);}else rows.forEach(r=>list.append(selectedCard(r)));}
async function refresh(){if(!user)return;const target=user.id;const {data,error}=await client.from('curriculos').select('id,nome,conteudo,updated_at').eq('usuario_id',target).order('updated_at',{ascending:false});if(target!==user?.id)return;if(error){msg('cloudmessage','Erro ao carregar currículos: '+error.message);return;}rows=data||[];renderList();}
function showSaved(id){const row=rows.find(r=>r.id===id);if(!row)return;viewingId=id;renderResume($('savedMount'),row.conteudo||{});$('savedViewerTitle').textContent=row.nome||'Currículo salvo';$('savedViewer').hidden=false;navigate('salvos');$('savedViewer').scrollIntoView({behavior:'smooth',block:'start'});}
function editSaved(id){const row=rows.find(r=>r.id===id);if(!row)return;resetEditor();editingId=id;populate(row.conteudo||{});$('editBanner').hidden=false;navigate('criar');}
async function deleteSaved(id){if(!confirm('Excluir este currículo da sua conta? Esta ação não pode ser desfeita.'))return;const {error}=await client.from('curriculos').delete().eq('id',id).eq('usuario_id',user.id);if(error)return msg('cloudmessage','Erro ao excluir: '+error.message);if(viewingId===id){viewingId=null;$('savedViewer').hidden=true;}if(editingId===id)resetEditor();await refresh();msg('cloudmessage','Currículo excluído.');}
async function submitAuth(method){const email=$('authEmail').value.trim(),password=$('authPassword').value;if(!email||!password)return msg('authmessage','Preencha e-mail e senha.');if(password.length<6)return msg('authmessage','A senha precisa ter pelo menos 6 caracteres.');const btn=$(method==='signUp'?'signup':'signin');btn.disabled=true;try{const name=$('authName').value.trim();if(method==='signUp' && !name)return msg('authmessage','Informe seu nome para criar a conta.');const {data,error}=method==='signUp'?await client.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:location.origin}}):await client.auth.signInWithPassword({email,password});if(error)throw error;if(method==='signUp' && !data.session)msg('authmessage','Cadastro solicitado. Confirme seu e-mail antes de entrar.');else msg('authmessage','Acesso realizado.');}catch(error){msg('authmessage',error.message||'Falha de autenticação.');}finally{btn.disabled=false;}}
function updateDiscStatus(){
 const status=$('discStatus'),checkbox=$('discInclude');
 if(discResult?.scores){
   const names={D:'Dominância',I:'Influência',S:'Estabilidade',C:'Conformidade'};
   const max=Math.max(...Object.values(discResult.scores));
   const tops=Object.keys(names).filter(k=>discResult.scores[k]===max).map(k=>names[k]).join(' e ');
   status.textContent='Resultado disponível: '+tops+'. Marque a opção abaixo se desejar incluí-lo no currículo.';
   checkbox.disabled=false;$('removeDisc').hidden=false;
 }else{status.textContent='Ainda não há resultado neste currículo. O teste é opcional.';checkbox.checked=false;checkbox.disabled=true;$('removeDisc').hidden=true;}
}
$('discInclude').onchange=()=>renderResume($('previewMount'),values());
$('removeDisc').onclick=()=>{discResult=null;$('discInclude').checked=false;updateDiscStatus();renderResume($('previewMount'),values());};
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==$('discFrame').contentWindow)return;
 const data=event.data;
 if(data?.type!=='microlins:disc-result')return;
 const result=data.result;
 if(!result||!result.scores||!['D','I','S','C'].every(k=>Number.isFinite(result.scores[k])&&result.scores[k]>=0&&result.scores[k]<=100))return;
 discResult={scores:{D:result.scores.D,I:result.scores.I,S:result.scores.S,C:result.scores.C},completedAt:result.completedAt||new Date().toISOString(),version:result.version||'educativo-1'};
 $('discInclude').checked=false;
 updateDiscStatus();
 msg('discPageStatus','Teste concluído. Para acrescentar o resultado ao currículo, marque a opção na página de preenchimento.');
 navigate('criar');
});
$('editUsername').onclick=async()=>{if(!user)return;const name=prompt('Qual nome deve aparecer no menu?',displayName(user));if(name===null)return;const cleaned=name.trim().slice(0,80);if(!cleaned)return alert('Informe um nome válido.');const {data,error}=await client.auth.updateUser({data:{full_name:cleaned}});if(error)return alert('Não foi possível atualizar: '+error.message);user=data.user||user;updateUsername();};
$('signin').onclick=()=>submitAuth('signIn');$('signup').onclick=()=>submitAuth('signUp');
$('forgot').onclick=async()=>{const email=$('authEmail').value.trim();if(!email)return msg('authmessage','Informe seu e-mail para recuperar a senha.');const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin});msg('authmessage',error?error.message:'Se o e-mail estiver cadastrado, você receberá instruções.');};
$('logout').onclick=async()=>{await client.auth.signOut();user=null;authScreen();history.replaceState(null,'',location.pathname);};
$('navDisc').onclick=()=>navigate('disc');$('goDisc').onclick=()=>navigate('disc');$('navCriar').onclick=()=>{if(editingId)resetEditor();navigate('criar');};$('navModelos').onclick=()=>{buildGallery();navigate('modelos');};$('navVisualizar').onclick=()=>{renderChosen();navigate('visualizar');};$('navSalvos').onclick=()=>navigate('salvos');$('cancelEdit').onclick=()=>{resetEditor();navigate('criar');};$('newResume').onclick=()=>resetEditor();
for(const k of keys)$(k).addEventListener('input',()=>renderResume($('previewMount'),values()));
$('foto').onchange=async()=>{const file=$('foto').files?.[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type))return msg('editorMessage','Escolha uma foto JPG, PNG ou WEBP.');if(file.size>12*1024*1024)return msg('editorMessage','A foto deve ter até 12 MB.');const read=()=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});try{const src=await read();const im=new Image();im.src=src;await im.decode();const side=460,ratio=Math.min(1,side/Math.max(im.width,im.height));const canvas=document.createElement('canvas');canvas.width=Math.round(im.width*ratio);canvas.height=Math.round(im.height*ratio);canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);photoData=canvas.toDataURL('image/jpeg',.76);$('photoStatus').textContent='Foto adicionada';$('removePhoto').hidden=false;msg('editorMessage','Foto pronta para salvar.');renderResume($('previewMount'),values());}catch(e){msg('editorMessage','Não foi possível abrir a foto. Tente outra imagem.');}};
$('removePhoto').onclick=()=>{photoData='';$('foto').value='';$('removePhoto').hidden=true;$('photoStatus').textContent='Nenhuma foto selecionada';renderResume($('previewMount'),values());};
async function saveCloudResume(){if(!user)return;const d=values();if(!d.nome)return msg('editorMessage','Preencha o nome completo antes de salvar.');const payload={nome:d.nome,conteudo:d,usuario_id:user.id};$('saveCloud').disabled=true;try{const q=editingId?client.from('curriculos').update(payload).eq('id',editingId).eq('usuario_id',user.id):client.from('curriculos').insert(payload);const {error}=await q;if(error)throw error;resetEditor();await refresh();navigate('salvos');msg('cloudmessage','Currículo salvo com sucesso! O formulário de criação já está em branco.');}catch(error){msg('editorMessage','Não foi possível salvar: '+error.message);}finally{$('saveCloud').disabled=false;}}
$('saveCloud').onclick=saveCloudResume; $('saveChosen').onclick=saveCloudResume;
$('closeSaved').onclick=()=>{$('savedViewer').hidden=true;viewingId=null;};$('printSaved').onclick=()=>printResume('savedMount');$('pdf').onclick=()=>{if(!$('nome').value.trim())return msg('editorMessage','Preencha o nome antes de gerar o PDF.');printResume('previewMount');};$('editSaved').onclick=()=>editSaved(viewingId);
function printResume(id){ // Mantém somente o documento selecionado na área de impressão.
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('print-target'));
 const section=id==='savedMount'?'pageSalvos':id==='selectedMount'?'pageVisualizar':'pageCriar';$(section).classList.add('print-target');
 $('previewMount').hidden=id!=='previewMount';$('savedMount').hidden=id!=='savedMount';$('selectedMount').hidden=id!=='selectedMount';
 window.print();}
window.addEventListener('afterprint',()=>{$('previewMount').hidden=false;$('savedMount').hidden=false;$('selectedMount').hidden=false;document.querySelectorAll('.page').forEach(p=>p.classList.remove('print-target'));});
window.addEventListener('hashchange',()=>{if(user)navigate(location.hash.slice(1));});

const templateNames=[['azul','Azul do portal','Identidade azul e branca'],['cinza-laranja','Cinza e laranja','Designer gráfico moderno'],['verde','Verde escuro','Clássico com foto'],['preto-laranja','Preto e laranja','Profissional de destaque'],['preto-branco','Preto e branco','Simples sem foto'],['preto-cinza','Preto e cinza','Jovem aprendiz minimalista']];
function buildGallery(){const gallery=$('modelGallery');gallery.replaceChildren();for(const [id,title,desc] of templateNames){const card=document.createElement('button');card.type='button';card.className='model-choice'+(selectedTemplate===id?' is-selected':'');card.setAttribute('aria-pressed',String(selectedTemplate===id));card.innerHTML=`<div class="thumb" data-template="${id}"><aside><span class="thumb-name">SEU NOME</span><span class="thumb-mini">Primeiro emprego</span><span class="thumb-role">CARGO OU VAGA</span><span class="mock-photo"></span></aside><main><div class="stack"><div class="mini-block"><i></i><i></i><i></i></div><div class="mini-block"><i></i><i></i><i></i></div><div class="mini-block"><i></i><i></i><i></i></div><div class="mini-block"><i></i><i></i><i></i></div></div></main></div><strong>${title}</strong><small>${desc}</small>`;card.onclick=()=>{selectedTemplate=id;buildGallery();};gallery.append(card);}}
function renderChosen(){const chosen=templateNames.find(t=>t[0]===selectedTemplate);$('chosenModelName').textContent=chosen?.[1]||'Modelo';renderResume($('selectedMount'),values());}
$('goModels').onclick=()=>{if(!$('nome').value.trim())return msg('editorMessage','Preencha o nome antes de escolher o modelo.');buildGallery();navigate('modelos');};
$('previewChosen').onclick=()=>{renderChosen();navigate('visualizar');};
$('returnToForm').onclick=()=>navigate('criar');
$('changeModel').onclick=()=>{buildGallery();navigate('modelos');};
$('backToForm').onclick=()=>navigate('criar');
$('printChosen').onclick=()=>{renderChosen();printResume('selectedMount');};

client.auth.onAuthStateChange((event,session)=>{
 if(event==='PASSWORD_RECOVERY'){setTimeout(async()=>{const pass=prompt('Digite uma nova senha com pelo menos 6 caracteres:');if(pass===null)return;if(pass.length<6)return alert('A senha precisa ter pelo menos 6 caracteres.');const {error}=await client.auth.updateUser({password:pass});alert(error?error.message:'Senha atualizada com sucesso.');},0);}
 const previous=user?.id;user=session?.user||null;authScreen();if(user&&previous!==user.id){resetEditor();navigate('criar');setTimeout(()=>refresh(),0);}
});
resetEditor();const {data:{session}}=await client.auth.getSession();user=session?.user||null;authScreen();if(user){navigate('criar');await refresh();}
