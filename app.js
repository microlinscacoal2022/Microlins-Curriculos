import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const el = (id) => document.getElementById(id);
const fields = ['nome','cidade','telefone','email','vaga','situacao','objetivo','formacao','cursos','habilidades','experiencia','extras'];
const configured = SUPABASE_URL.startsWith('https://') && !SUPABASE_ANON_KEY.startsWith('COLE_');
const db = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
let user = null;
let selectedId = null;
let cache = [];
const message = (id, text) => { el(id).textContent = text; };
const authPanel = el('authpanel');
el('loginToggle').onclick = () => authPanel.classList.toggle('hide');
function values() { return Object.fromEntries(fields.map(k => [k, el(k).value])); }
function resetEditor() { el('form').reset(); selectedId = null; el('savedResumes').value = ''; window.atualizar?.(); }
function populate(data) { fields.forEach(k => { el(k).value = data?.[k] ?? (k === 'situacao' ? 'primeiro' : ''); }); window.atualizar?.(); document.getElementById('gerar').click(); }
function updateUI() {
  el('saveCloud').disabled = !user;
  el('logout').classList.toggle('hide', !user);
  el('loginToggle').classList.toggle('hide', !!user);
  el('savedResumes').disabled = !user;
  el('loadResume').disabled = !user;
  el('deleteResume').disabled = !user;
  message('authstatus', user ? `Conectado: ${user.email}` : 'Entre na sua conta para salvar e recuperar seus currículos. Sem login, você pode criar e imprimir normalmente.');
  if (user) authPanel.classList.add('hide');
}
async function refresh() {
  if (!user) return;
  const {data,error} = await db.from('curriculos').select('id,nome,updated_at,conteudo').order('updated_at',{ascending:false});
  if(error) return message('cloudmessage', `Não foi possível carregar: ${error.message}`);
  cache = data ?? [];
  const select = el('savedResumes');
  select.replaceChildren(new Option('Selecione um currículo salvo', ''));
  cache.forEach(x => select.add(new Option(`${x.nome} — ${new Date(x.updated_at).toLocaleDateString('pt-BR')}`, x.id)));
  // Por segurança, nunca selecionar automaticamente um currículo para edição.
  select.value = ''; 
}
function credentials() { return { email:el('authEmail').value.trim(), password:el('authPassword').value }; }
async function sign(method) {
  if (!db) return message('authmessage','Configure config.js com a URL e a chave pública do Supabase.');
  const {email,password} = credentials();
  if (!email || !password) return message('authmessage','Informe seu e-mail e senha.');
  if (method === 'signUp' && password.length < 6) return message('authmessage','A senha precisa ter pelo menos 6 caracteres.');
  const {error} = await db.auth[method]({email,password});
  message('authmessage', error ? error.message : (method === 'signUp' ? 'Conta solicitada. Confira seu e-mail para confirmar o cadastro, se necessário.' : 'Login realizado.'));
}
el('signin').onclick = () => sign('signInWithPassword');
el('signup').onclick = () => sign('signUp');
el('forgot').onclick = async () => {
  if (!db) return message('authmessage','Configure o Supabase primeiro.');
  const email = el('authEmail').value.trim();
  if (!email) return message('authmessage','Informe seu e-mail para recuperar a senha.');
  const {error} = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
  message('authmessage',error ? error.message : 'Se o e-mail estiver cadastrado, você receberá instruções de recuperação.');
};
el('logout').onclick = async () => { await db.auth.signOut(); selectedId=null; cache=[]; message('cloudmessage','Sessão encerrada.'); };
el('saveCloud').onclick = async () => {
  if (!user) return;
  const data = values();
  if (!data.nome.trim()) return message('cloudmessage','Preencha o nome antes de salvar.');
  const payload = {nome:data.nome.trim(),conteudo:data, usuario_id:user.id};
  const query = selectedId ? db.from('curriculos').update(payload).eq('id', selectedId).eq('usuario_id',user.id).select('id').single() : db.from('curriculos').insert(payload).select('id').single();
  const {data:result,error} = await query;
  if(error) return message('cloudmessage',`Não foi possível salvar: ${error.message}`);
  resetEditor(); await refresh(); message('cloudmessage','Currículo salvo com sucesso! O formulário foi limpo. Para consultar, selecione-o em Meus currículos salvos.');
  el('meus-curriculos').scrollIntoView({behavior:'smooth',block:'start'});
};
el('savedResumes').onchange = () => { /* Escolher um item não altera o currículo em edição. */ };
el('loadResume').onclick = () => {
  const item = cache.find(x => x.id === el('savedResumes').value);
  if(!item) return message('cloudmessage','Selecione um currículo.');
  selectedId=item.id; populate(item.conteudo); message('cloudmessage','Currículo carregado.');
};
el('deleteResume').onclick = async () => {
  const id=el('savedResumes').value;
  if (!id || !confirm('Excluir este currículo da sua conta?')) return;
  const {error} = await db.from('curriculos').delete().eq('id',id).eq('usuario_id',user.id);
  if(error) return message('cloudmessage',`Não foi possível excluir: ${error.message}`);
  if(selectedId===id) resetEditor(); await refresh(); message('cloudmessage','Currículo excluído.');
};
el('newResume').onclick = () => { resetEditor(); message('cloudmessage','Formulário limpo para um novo currículo.'); el('nome').focus(); };
el('limpar').addEventListener('click', () => { selectedId=null; if (el('savedResumes')) el('savedResumes').value=''; });
// Evita que o navegador restaure os dados de um aluno ao abrir/recarregar a página.
resetEditor();
if(db) {
  db.auth.onAuthStateChange((event,session) => {
    if(event === 'PASSWORD_RECOVERY') setTimeout(async () => {
      const password = prompt('Defina sua nova senha (mínimo 6 caracteres):');
      if(password === null) return;
      if(password.length < 6) return message('authmessage','A nova senha deve ter no mínimo 6 caracteres. Solicite outro link de recuperação.');
      const {error} = await db.auth.updateUser({password});
      message('authmessage',error ? `Erro ao alterar a senha: ${error.message}` : 'Senha alterada com sucesso.');
    },0);
    user = session?.user ?? null;
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') resetEditor();
    updateUI();
    if(user) setTimeout(() => { refresh().catch(console.error); },0);
    else {cache=[]; el('savedResumes').replaceChildren(new Option('Entre na sua conta para carregar',''));}
  });
  const {data:{session}} = await db.auth.getSession();
  user=session?.user ?? null;
  resetEditor(); updateUI(); if(user) await refresh();
} else { updateUI(); message('cloudmessage','Modo demonstração: o gerador funciona e imprime PDF. Para salvar na nuvem, configure o Supabase.'); }
