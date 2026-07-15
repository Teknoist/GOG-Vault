const advancedEscape=value=>escapeHtml(String(value??''));
const advancedDate=value=>new Intl.DateTimeFormat(document.documentElement.lang||'en',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));

function updateDashboard(){
  const total=games.length,backed=games.filter(game=>game.backed_up).length,percent=total?Math.round(backed/total*100):0;
  $('#libraryCount').textContent=total;$('#missingCount').textContent=total-backed;$('#selectedCountStat').textContent=selectedGames.size;
  $('#healthMeter').style.width=`${percent}%`;$('#healthTitle').textContent=total?`${percent}% ${t('archived')}`:t('Waiting for library');
  $('#healthText').textContent=total?`${backed} / ${total} ${t('games are backed up')}`:t('Sync your library to calculate coverage.');
}
const baseRenderGames=renderGames;renderGames=function(){baseRenderGames();updateDashboard()};
const baseShowView=showView;showView=function(id){baseShowView(id);history.replaceState(null,'',`#${id}`);document.body.classList.remove('menu-open');if(id==='activity')loadActivity();if(id==='storage')loadStorage()};
$$('[data-view],[data-go]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.view||button.dataset.go;if(id)history.replaceState(null,'',`#${id}`)}));
window.addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(document.getElementById(id)?.classList.contains('view'))baseShowView(id)});
const initialView=location.hash.slice(1);if(initialView&&document.getElementById(initialView)?.classList.contains('view'))baseShowView(initialView);

$('#menuToggle').onclick=()=>document.body.classList.toggle('menu-open');
$('#syncBackupBtn').onclick=async()=>{const count=games.filter(game=>!game.backed_up).length;if(!confirm(`${count} ${t('games need a backup. Sync and continue?')}`))return;const synced=await run('update');if(synced){await loadLibrary();await run('download',{flags:['extras','language-fallback-english']});await loadLibrary();await loadActivity()}};

function activityRows(items){return items.length?items.map(item=>`<div class="activity-row"><strong>${advancedEscape(item.command)}</strong><small>${advancedDate(item.startedAt)}${item.duration?` · ${item.duration}s`:''}</small><span class="activity-status ${item.code===0?'ok':'fail'}">${item.code===0?t('Completed'):t('Failed')}</span></div>`).join(''):`<p>${t('No activity yet.')}</p>`}
async function loadActivity(){try{const data=await fetch('/api/history').then(response=>response.json());$('#activityHistory').innerHTML=activityRows(data.history||[]);$('#recentActivity').innerHTML=activityRows((data.history||[]).slice(0,3));const active=data.activeJob;if(active){$('#activeQueue').classList.add('running');$('#activeQueue').innerHTML=`<p class="eyebrow">${t('ACTIVE NOW')}</p><h3>${advancedEscape(active.command)}</h3><p>${advancedDate(active.startedAt)}</p><button class="ghost" id="queueStop">${t('Stop')}</button>`;$('#queueStop').onclick=()=>$('#cancelRunner').click()}else{$('#activeQueue').classList.remove('running');$('#activeQueue').innerHTML=`<p>${t('No active operation.')}</p>`}$('#activityBadge').hidden=!active}catch(error){notify(t('Activity unavailable'),error.message,true)}}
$('#refreshActivity').onclick=loadActivity;

async function loadStorage(){try{const data=await fetch('/api/storage').then(response=>response.json());$('#storageUsed').textContent=formatSize(data.used);$('#storageExpected').textContent=formatSize(data.expected);$('#storageFiles').textContent=data.files.toLocaleString();$('#storagePath').textContent=data.path;const percent=data.expected?Math.min(100,Math.round(data.used/data.expected*100)):0;$('#storageMeter').style.width=`${percent}%`;$('#storageCoverage').textContent=`${percent}% ${t('of the expected archive size is present on disk.')}`}catch(error){notify(t('Storage scan failed'),error.message,true)}}
$('#refreshStorage').onclick=loadStorage;

const baseOpenGameDetail=openGameDetail;openGameDetail=async function(id){await baseOpenGameDetail(id);const title=$('#detailContent h2')?.textContent;if(!title)return;const actions=document.createElement('div');actions.className='game-actions';actions.innerHTML=`<button class="primary" data-action="backup">${t('Back up')}</button><button class="ghost" data-action="verify">${t('Verify & repair')}</button><button class="ghost" data-action="redownload">${t('Re-download')}</button>`;actions.onclick=async event=>{const action=event.target.dataset.action;if(!action)return;$('#gameDetail').close();const previous=[...selectedGames];selectedGames.clear();selectedGames.add(title);if(action==='backup')await run('download',{flags:['extras'],options:[opt('only',title)]});if(action==='verify')await run('download',{flags:['remove-invalid','extras'],options:[opt('only',title)]});if(action==='redownload'&&confirm(t('Download a fresh verified copy?')))await run('download',{flags:['extras'],options:[opt('only',title)]});selectedGames.clear();previous.forEach(item=>selectedGames.add(item));await loadLibrary()};$('#detailContent').append(actions)};

const backgroundInput=$('#backgroundInput'),backgroundDim=$('#backgroundDim');
function applyBackground(){const image=localStorage.getItem('gog-vault-background');const dim=localStorage.getItem('gog-vault-background-dim')||'45';backgroundDim.value=dim;document.body.style.setProperty('--background-dim',dim);if(image){document.body.classList.add('has-background');document.body.style.setProperty('--custom-background',`url(${JSON.stringify(image)})`)}else document.body.classList.remove('has-background')}
backgroundInput.onchange=()=>{const file=backgroundInput.files[0];if(!file)return;if(file.size>3*1024*1024){notify(t('Image too large'),t('Choose an image smaller than 3 MB.'),true);return}const reader=new FileReader();reader.onload=()=>{localStorage.setItem('gog-vault-background',reader.result);applyBackground()};reader.readAsDataURL(file)};
backgroundDim.oninput=()=>{localStorage.setItem('gog-vault-background-dim',backgroundDim.value);applyBackground()};$('#clearBackground').onclick=()=>{localStorage.removeItem('gog-vault-background');applyBackground()};applyBackground();loadActivity();
