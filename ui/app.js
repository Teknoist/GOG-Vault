const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const terminal=$('#terminal'), runner=$('#runner');
let gameNames=[];
const gameArtwork=new Map();
const selectedGames=new Set();
let commandRunning=false;

function showView(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id))}
$$('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
$$('[data-go]').forEach(b=>b.onclick=()=>showView(b.dataset.go));
$('#closeRunner').onclick=()=>runner.classList.remove('open');

function stripAnsi(value){return value.replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n')}
async function run(command,{flags=[],options=[]}={}){
  if(commandRunning){notify('Command already running','Wait for the current operation to finish.',true);return false}
  commandRunning=true;
  runner.classList.add('open'); terminal.textContent=''; $('#runnerTitle').textContent=command.replaceAll('-',' ');
  let exitCode=null;
  const response=await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command,flags,options})});
  const reader=response.body.getReader(), decoder=new TextDecoder(); let buffer='';
  while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){if(!line)continue;const e=JSON.parse(line);if(e.data)terminal.textContent+=stripAnsi(e.data);if(e.message)terminal.textContent+='\n'+e.message;if(e.type==='error')exitCode=1;if(e.type==='exit'){exitCode=e.code;terminal.textContent+=`\n\nFinished with code ${e.code}.`}terminal.scrollTop=terminal.scrollHeight}}
  commandRunning=false;
  return exitCode===0;
}
function notify(title,message,error=false){$('#toastTitle').textContent=title;$('#toastMessage').textContent=message;$('#toast').classList.toggle('error',error);$('#toast').classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').classList.remove('show'),4500)}
const opt=(key,value)=>({key,value});
async function loadLibrary(){try{const data=await fetch('/api/library').then(r=>r.json());gameNames=data.games.map(game=>game.title);gameArtwork.clear();data.games.forEach(game=>gameArtwork.set(game.title,game.game_id));renderGames();runner.classList.remove('open')}catch(e){notify('Library failed to load',e.message,true)}}
$('#refreshBtn').onclick=async()=>{const ok=await run('update');if(ok){notify('Library synced','Your local game list is up to date.');await loadLibrary()}};
$('#listGames').onclick=loadLibrary;
function renderGames(){const q=$('#search').value.toLowerCase(), filtered=gameNames.filter(x=>x.toLowerCase().includes(q));$('#games').innerHTML=filtered.length?filtered.map((n,i)=>`<button class="game${selectedGames.has(n)?' selected':''}" data-game="${encodeURIComponent(n)}"><img loading="lazy" src="/api/artwork?id=${gameArtwork.get(n)}" alt="" onerror="this.classList.add('missing')"><span class="game-shade"></span><small>${selectedGames.has(n)?'✓ '+t('SELECTED'):t('GOG LIBRARY')} · ${String(i+1).padStart(2,'0')}</small><strong>${escapeHtml(n)}</strong></button>`).join(''):'<div class="empty"><h3>No matching games</h3><p>Try syncing your library first.</p></div>';$$('.game[data-game]').forEach(card=>card.onclick=()=>{const name=decodeURIComponent(card.dataset.game);selectedGames.has(name)?selectedGames.delete(name):selectedGames.add(name);renderGames();updateSelection()})}
function updateSelection(){const count=selectedGames.size;$('#selectionCount').textContent=count;$('#selectionBar').classList.toggle('show',count>0);$('#selectedSummary').classList.toggle('active',count>0);$('#selectedSummary').textContent=count?`${count} ${t('games selected')}: ${[...selectedGames].join(', ')}`:t('No library selection — all matching games will be downloaded.')}
$('#clearSelection').onclick=()=>{selectedGames.clear();renderGames();updateSelection()};
$('#backupSelection').onclick=()=>{showView('download');updateSelection()};
$('#search').oninput=renderGames;
$('#downloadBtn').onclick=async()=>{const destination=$('#directory').value.trim()||$('#destinationHint strong').textContent;notify('Backup started',`Files will be saved under ${destination}`);await run('download',{flags:[...($('#extras').checked?['extras']:[]),...($('#fallback').checked?['language-fallback-english']:[]),...($('#updateFirst').checked?['update']:[])],options:[opt('directory',$('#directory').value),opt('os',$('#os').value),opt('language',$('#language').value),...[...selectedGames].map(name=>opt('only',name)),opt('only',$('#only').value)]})};
$('#savesBtn').onclick=()=>run('download-saves',{options:[opt('directory',$('#saveDirectory').value)]});
$('#loginBtn').onclick=async()=>{const code=$('#loginCode').value.trim();if(!code){notify('Missing login code','Paste the GOG redirect URL first.',true);return}$('#loginCode').value='';$('#loginBtn').disabled=true;$('#loginBtn').textContent='Connecting…';try{const ok=await run('code-login',{options:[opt('code',code)]});notify(ok?'Account connected':'Connection failed',ok?'Your GOG session is ready. You can sync the library now.':'Open the activity panel for details.',!ok);$('#loginBtn').textContent=ok?'✓ Account connected':'Connect account'}catch(e){notify('Connection failed',e.message,true);$('#loginBtn').textContent='Connect account'}finally{$('#loginBtn').disabled=false}};
async function refreshStatus(){try{const s=await fetch('/api/status').then(r=>r.json());$('#statusDot').classList.toggle('ok',s.appReady);$('#systemText').textContent=s.activeJob?`${s.activeJob.command} running in background`:(s.appReady?`Engine ready · PHP ${s.php}`:'Run composer install');const target=$('#destinationHint strong');if(target)target.textContent=s.downloadLabel||s.downloadDirectory;return s}catch{$('#systemText').textContent='Engine unavailable';return null}}
async function initializeLibrary(){const status=await refreshStatus();if(!status)return;if(!status.activeJob){await loadLibrary();return}notify('Background task active',`${status.activeJob.command} is still running. Your library will load when it finishes.`);const poll=setInterval(async()=>{const next=await refreshStatus();if(next&&!next.activeJob){clearInterval(poll);notify('Library synced','Loading your updated game list.');await loadLibrary()}},3000)}
initializeLibrary();
window.addEventListener('beforeunload',e=>{if(commandRunning){e.preventDefault();e.returnValue=''}});
function escapeHtml(v){const d=document.createElement('div');d.textContent=v;return d.innerHTML}
