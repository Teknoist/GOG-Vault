const translations={tr:{
  'Library':'Kütüphane','Download':'Yedekle','Cloud saves':'Bulut kayıtları','Account':'Hesap',
  'LOCAL COLLECTION':'YEREL KOLEKSİYON','Your games, safely archived.':'Oyunların, güvenle arşivlendi.',
  '↻ Sync library':'↻ Kütüphaneyi güncelle','QUICK START':'HIZLI BAŞLANGI','Bring your GOG library home.':'GOG kütüphaneni kendi arşivine al.',
  'Sync your owned games, then create verified offline backups with resumable downloads.':'Oyunlarını eşitle, doğrulanan ve devam ettirilebilen çevrimdışı yedekler oluştur.',
  'Create a backup →':'Yedek oluştur →','Load games':'Oyunları yükle','Library not loaded yet':'Kütüphane henüz yüklenmedi',
  'Sign in, sync metadata, then load your games.':'Giriş yap, verileri eşitle ve oyunlarını yükle.',
  'BACKUP BUILDER':'YEDEK OLUŞTURUCU','Choose what to archive':'Arşivlenecek içerikleri seç','Destination':'Hedef klasör','Platform':'Platform','Language':'Dil',
  'Additional exact game title':'Ek oyun adı','Include extras':'Ekstraları dahil et','Fall back to English':'İngilizceye geri dön','Sync before download':'İndirmeden önce eşitle',
  'Start verified download ↓':'Doğrulanmış indirmeyi başlat ↓','CLOUD SAVES':'BULUT KAYITLARI','Back up your progress':'İlerlemeni yedekle',
  'Download cloud saves for every supported game into your archive.':'Desteklenen oyunların bulut kayıtlarını arşivine indir.','Back up saves':'Kayıtları yedekle',
  'Connect securely with a login code':'Giriş koduyla güvenli bağlan','Open the GOG authorization page.':'GOG yetkilendirme sayfasını aç.',
  'Sign in and copy the final blank-page URL.':'Giriş yap ve son boş sayfanın adresini kopyala.','Paste it below; it is sent only to this local app.':'Aşağıya yapıştır; yalnızca bu yerel uygulamaya gönderilir.',
  'Open GOG sign-in ↗':'GOG girişini aç ↗','Redirect URL or code':'Yönlendirme adresi veya kod','Connect account':'Hesabı bağla',
  'No library selection — all matching games will be downloaded.':'Kütüphaneden seçim yok — eşleşen tüm oyunlar indirilecek.','games selected':'oyun seçildi','SELECTED':'SEÇİLDİ','GOG LIBRARY':'GOG KÜTÜPHANESİ','Clear':'Temizle','Back up selected →':'Seçilenleri yedekle →'
}};
window.t=text=>(translations[localStorage.getItem('gog-vault-locale')||'en']||{})[text]||text;
const originalText=new WeakMap();
function applyLocale(locale){document.documentElement.lang=locale;localStorage.setItem('gog-vault-locale',locale);const dict=translations[locale]||{};document.querySelectorAll('button,h1,h2,h3,p,li,label,.eyebrow,.selected-summary').forEach(el=>{if(el.children.length&&el.tagName!=='BUTTON')return;if(!originalText.has(el))originalText.set(el,el.textContent.trim());const source=originalText.get(el);if(dict[source])el.textContent=dict[source];else if(locale==='en')el.textContent=source});const placeholders=locale==='tr'?{search:'Yerel kütüphanede ara…',directory:'Boş bırakırsan varsayılan klasör kullanılır',language:'tr',only:'İsteğe bağlı — seçili oyunlar zaten dahil',saveDirectory:'Kayıt yedekleme klasörü',loginCode:'GOG yönlendirme adresini yapıştır…'}:{search:'Search local library…',directory:'Leave empty to use the default',language:'en',only:'Optional — selected library games are already included',saveDirectory:'Cloud save backup folder',loginCode:'Paste the GOG redirect URL…'};Object.entries(placeholders).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.placeholder=value})}
const localeSelect=document.getElementById('locale');localeSelect.value=localStorage.getItem('gog-vault-locale')||((navigator.language||'').startsWith('tr')?'tr':'en');localeSelect.addEventListener('change',()=>applyLocale(localeSelect.value));applyLocale(localeSelect.value);
