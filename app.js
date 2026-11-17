import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {SUPABASE_URL,SUPABASE_ANON_KEY} from './config.js';
const $=id=>document.getElementById(id);
const keys=['nome','cidade','telefone','email','idade','vaga','situacao','formacao','periodo','instituicao','objetivo','experiencia','cursos','habilidades','perfil','extras'];
const client=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
let user=null, rows=[], editingId=null, viewingId=null, photoData='',selectedTemplate='azul';
const msg=(id,s)=>{$(id).textContent=s;};
const displayName=u=>{const name=u?.user_metadata?.full_name||u?.user_metadata?.name;return String(name||u?.email?.split('@')[0]||'Usuário').trim().slice(0,80);};
const updateUsername=()=>{$('sidebarUsername').textContent=displayName(user);};
const values=()=>({...Object.fromEntries(keys.map(k=>[k,$(k).value.trim()])),foto:photoData,modelo:selectedTemplate});
function fallbackObjective(d){return d.situacao==='experiencia'?`Busco uma oportunidade${d.vaga?' na área de '+d.vaga:''} para aplicar meus conhecimentos, aprender e contribuir com a equipe.`:`Busco minha primeira oportunidade${d.vaga?' na área de '+d.vaga:''} para desenvolver minhas habilidades, aprender e contribuir com dedicação e responsabilidade.`;}
function cleanData(raw={}) {const d={...raw}; // Compatibilidade com currículos salvos em versões anteriores.
  if(!d.perfil && d.extras) d.perfil=d.extras;
  return d;
}
function renderResume(container,raw){
  const d=cleanData(raw);container.replaceChildren($('resumeTemplate').content.cloneNode(true));const root=container.querySelector('.resume');root.dataset.template=d.modelo||selectedTemplate;
  const set=(key,text)=>{const node=root.querySelector(`[data-r="${key}"]`);if(node)node.textContent=text??'';};
  set('nome',(d.nome||'SEU NOME').toLocaleUpperCase('pt-BR'));
  set('vaga',(d.vaga||'CARGO OU VAGA DESEJADA').toLocaleUpperCase('pt-BR'));
  const topo=[d.cidade,d.idade&&`${d.idade} anos`,d.situacao==='experiencia'?'Com experiência':'Primeiro emprego'].filter(Boolean).join(' • ');
  set('subtitulo',topo||'Currículo profissional');
  for(const key of ['cidade','telefone','email'])set(key,d[key]||'Não informado');
  set('idade',d.idade?`${d.idade} anos`:'');
  const formation=[d.formacao,d.periodo&&`Período: ${d.periodo}`,d.instituicao&&`Instituição: ${d.instituicao}`].filter(Boolean).join('\n');
  set('formacao',formation||'Não informado');
  set('objetivo',d.objetivo||fallbackObjective(d));
  set('experiencia',d.experiencia||(d.situacao==='experiencia'?'Não informada.':'Ainda não possuo experiência profissional, mas tenho disposição para aprender e me desenvolver.'));
  set('cursos',d.cursos||'');
  set('habilidades',d.habilidades||'');
  set('perfil',d.perfil||'');
  set('extras',d.extras||'');
  for(const key of ['idade','cursos','habilidades','perfil','extras']){
    const sec=root.querySelector(`[data-section="${key}"]`);
    if(sec) sec.hidden=!String(d[key]||'').trim();
  }
  const img=root.querySelector('img.resume-photo'),placeholder=root.querySelector('.photo-placeholder');
  if(typeof d.foto==='string' && /^data:image\/(jpeg|png|webp);base64,/.test(d.foto)){
    img.src=d.foto;img.hidden=false;placeholder.hidden=true;
  }else{img.removeAttribute('src');img.hidden=true;placeholder.hidden=false;}
}
function resetEditor(){editingId=null;photoData='';selectedTemplate='azul';$('form').reset();$('foto').value='';$('removePhoto').hidden=true;$('photoStatus').textContent='Nenhuma foto selecionada';$('editBanner').hidden=true;msg('editorMessage','');}
function populate(data){const d=cleanData(data);selectedTemplate=d.modelo||'azul';for(const k of keys)$(k).value=d[k]??'';photoData=d.foto||'';$('photoStatus').textContent=photoData?'Foto do currículo carregada':'Nenhuma foto selecionada';$('removePhoto').hidden=!photoData;}
function navigate(page){const valid=['criar','modelos','visualizar','salvos'].includes(page)?page:'criar';$('pageCriar').hidden=valid!=='criar';$('pageModelos').hidden=valid!=='modelos';$('pageVisualizar').hidden=valid!=='visualizar';$('pageSalvos').hidden=valid!=='salvos';document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===valid);b.setAttribute('aria-current',b.dataset.page===valid?'page':'false');});if(location.hash!=='#'+valid)history.replaceState(null,'','#'+valid);window.scrollTo(0,0);}
function authScreen(){const logged=!!user;$('authScreen').hidden=logged;$('workspace').hidden=!logged;if(logged){msg('authstatus',`Conectado: ${user.email}`);updateUsername();}else{$('authPassword').value='';resetEditor();rows=[];viewingId=null;$('savedViewer').hidden=true;}}
function selectedCard(row){const card=document.createElement('div');card.className='saved-card';const title=document.createElement('h3');title.textContent=row.nome||'Currículo';const date=document.createElement('small');date.textContent=`Salvo em ${new Date(row.updated_at||Date.now()).toLocaleDateString('pt-BR')}`;const btn=document.createElement('div');btn.className='actions';const open=document.createElement('button');open.textContent='Visualizar';open.onclick=()=>showSaved(row.id);const edit=document.createElement('button');edit.className='light';edit.textContent='Editar';edit.onclick=()=>editSaved(row.id);const del=document.createElement('button');del.className='danger';del.textContent='Excluir';del.onclick=()=>deleteSaved(row.id);btn.append(open,edit,del);card.append(title,date,btn);return card;}
function renderList(){const list=$('savedList');list.replaceChildren();if(!rows.length){const p=document.createElement('p');p.textContent='Você ainda não tem currículos salvos. Clique em Criar currículo para começar.';list.append(p);}else rows.forEach(r=>list.append(selectedCard(r)));}
async function refresh(){if(!user)return;const target=user.id;const {data,error}=await client.from('curriculos').select('id,nome,conteudo,updated_at').eq('usuario_id',target).order('updated_at',{ascending:false});if(target!==user?.id)return;if(error){msg('cloudmessage','Erro ao carregar currículos: '+error.message);return;}rows=data||[];renderList();}
function showSaved(id){const row=rows.find(r=>r.id===id);if(!row)return;viewingId=id;renderResume($('savedMount'),row.conteudo||{});$('savedViewerTitle').textContent=row.nome||'Currículo salvo';$('savedViewer').hidden=false;navigate('salvos');$('savedViewer').scrollIntoView({behavior:'smooth',block:'start'});}
function editSaved(id){const row=rows.find(r=>r.id===id);if(!row)return;resetEditor();editingId=id;populate(row.conteudo||{});$('editBanner').hidden=false;navigate('criar');}
async function deleteSaved(id){if(!confirm('Excluir este currículo da sua conta? Esta ação não pode ser desfeita.'))return;const {error}=await client.from('curriculos').delete().eq('id',id).eq('usuario_id',user.id);if(error)return msg('cloudmessage','Erro ao excluir: '+error.message);if(viewingId===id){viewingId=null;$('savedViewer').hidden=true;}if(editingId===id)resetEditor();await refresh();msg('cloudmessage','Currículo excluído.');}
async function submitAuth(method){const email=$('authEmail').value.trim(),password=$('authPassword').value;if(!email||!password)return msg('authmessage','Preencha e-mail e senha.');if(password.length<6)return msg('authmessage','A senha precisa ter pelo menos 6 caracteres.');const btn=$(method==='signUp'?'signup':'signin');btn.disabled=true;try{const name=$('authName').value.trim();if(method==='signUp' && !name)return msg('authmessage','Informe seu nome para criar a conta.');const {data,error}=method==='signUp'?await client.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:location.origin}}):await client.auth.signInWithPassword({email,password});if(error)throw error;if(method==='signUp' && !data.session)msg('authmessage','Cadastro solicitado. Confirme seu e-mail antes de entrar.');else msg('authmessage','Acesso realizado.');}catch(error){msg('authmessage',error.message||'Falha de autenticação.');}finally{btn.disabled=false;}}
$('editUsername').onclick=async()=>{if(!user)return;const name=prompt('Qual nome deve aparecer no menu?',displayName(user));if(name===null)return;const cleaned=name.trim().slice(0,80);if(!cleaned)return alert('Informe um nome válido.');const {data,error}=await client.auth.updateUser({data:{full_name:cleaned}});if(error)return alert('Não foi possível atualizar: '+error.message);user=data.user||user;updateUsername();};
$('signin').onclick=()=>submitAuth('signIn');$('signup').onclick=()=>submitAuth('signUp');
$('forgot').onclick=async()=>{const email=$('authEmail').value.trim();if(!email)return msg('authmessage','Informe seu e-mail para recuperar a senha.');const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin});msg('authmessage',error?error.message:'Se o e-mail estiver cadastrado, você receberá instruções.');};
$('logout').onclick=async()=>{await client.auth.signOut();user=null;authScreen();history.replaceState(null,'',location.pathname);};
$('navCriar').onclick=()=>{if(editingId)resetEditor();navigate('criar');};$('navModelos').onclick=()=>{buildGallery();navigate('modelos');};$('navVisualizar').onclick=()=>{renderChosen();navigate('visualizar');};$('navSalvos').onclick=()=>navigate('salvos');$('cancelEdit').onclick=()=>{resetEditor();navigate('criar');};$('newResume').onclick=()=>resetEditor();

$('foto').onchange=async()=>{const file=$('foto').files?.[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type))return msg('editorMessage','Escolha uma foto JPG, PNG ou WEBP.');if(file.size>12*1024*1024)return msg('editorMessage','A foto deve ter até 12 MB.');const read=()=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});try{const src=await read();const im=new Image();im.src=src;await im.decode();const side=460,ratio=Math.min(1,side/Math.max(im.width,im.height));const canvas=document.createElement('canvas');canvas.width=Math.round(im.width*ratio);canvas.height=Math.round(im.height*ratio);canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);photoData=canvas.toDataURL('image/jpeg',.76);$('photoStatus').textContent='Foto adicionada';$('removePhoto').hidden=false;msg('editorMessage','Foto pronta para salvar.');}catch(e){msg('editorMessage','Não foi possível abrir a foto. Tente outra imagem.');}};
$('removePhoto').onclick=()=>{photoData='';$('foto').value='';$('removePhoto').hidden=true;$('photoStatus').textContent='Nenhuma foto selecionada';};
async function saveCloudResume(){if(!user)return;const d=values();if(!d.nome)return msg('editorMessage','Preencha o nome completo antes de salvar.');const payload={nome:d.nome,conteudo:d,usuario_id:user.id};$('saveChosen').disabled=true;try{const q=editingId?client.from('curriculos').update(payload).eq('id',editingId).eq('usuario_id',user.id):client.from('curriculos').insert(payload);const {error}=await q;if(error)throw error;resetEditor();await refresh();navigate('salvos');msg('cloudmessage','Currículo salvo com sucesso! O formulário de criação já está em branco.');}catch(error){msg('editorMessage','Não foi possível salvar: '+error.message);}finally{$('saveChosen').disabled=false;}}
$('saveChosen').onclick=saveCloudResume;
$('closeSaved').onclick=()=>{$('savedViewer').hidden=true;viewingId=null;};$('printSaved').onclick=()=>printResume('savedMount');$('editSaved').onclick=()=>editSaved(viewingId);
function printResume(id){
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('print-target'));
 const section=id==='savedMount'?'pageSalvos':'pageVisualizar';
 $(section).classList.add('print-target');
 $('savedMount').hidden=id!=='savedMount';
 $('selectedMount').hidden=id!=='selectedMount';
 window.print();
}
window.addEventListener('afterprint',()=>{
 $('savedMount').hidden=false;$('selectedMount').hidden=false;
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('print-target'));
});
window.addEventListener('hashchange',()=>{if(user)navigate(location.hash.slice(1));});

const templateNames=[['azul','Azul do portal','Identidade azul e branca'],['cinza-laranja','Cinza e laranja','Designer gráfico moderno'],['verde','Verde escuro','Clássico com foto'],['preto-laranja','Preto e laranja','Profissional de destaque'],['preto-branco','Preto e branco','Simples sem foto'],['preto-cinza','Preto e cinza','Jovem aprendiz minimalista']];
function buildGallery(){
 const gallery=$('modelGallery');gallery.replaceChildren();
 const data=values();
 for(const [id,title,desc] of templateNames){
  const card=document.createElement('button');card.type='button';
  card.className='model-choice'+(selectedTemplate===id?' is-selected':'');
  card.setAttribute('aria-pressed',String(selectedTemplate===id));
  const thumb=document.createElement('div');thumb.className='live-thumb';
  // Modelo real com dados do formulário, sem modificar o formulário.
  renderResume(thumb,{...data,modelo:id});
  const name=document.createElement('strong');name.textContent=title;
  const explanation=document.createElement('small');explanation.textContent=desc;
  card.append(thumb,name,explanation);
  card.onclick=()=>{selectedTemplate=id;buildGallery();};
  gallery.append(card);
 }
}
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
