/* RUVA Detailing | Yönetim Sistemi v24.0
   Mevcut uygulamayı değiştirmeden sync_items / ruva_job kayıtlarını kullanır.
   Özel fotoğraflar için sql/ruva-photo-storage.sql gereklidir.
*/
(() => {
  'use strict';
  if (document.getElementById('ruvaManagementPage')) return;
  const ITEM_TYPE = 'ruva_job';
  const BUCKET = 'ruva-job-photos';
  const STAGES = [
    ['accepted', 'Araç Kabul'],
    ['approval', 'Onay Bekliyor'],
    ['working', 'İşlemde'],
    ['quality', 'Kalite Kontrol'],
    ['ready', 'Teslime Hazır'],
    ['delivered', 'Teslim Edildi']
  ];
  const TASKS = ['Araç Yıkama','Pasta Cila','Boya Düzeltme','Seramik Kaplama','PPF Kaplama','Cam Filmi','İç Detaylı Temizlik','Motor Koruma','Diğer'];
  const el = id => document.getElementById(id);
  const escM = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatTL = value => new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(value)||0);
  const dateToday = () => { const d = new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+'-'+Math.random().toString(36).slice(2);
  const stageName = key => (STAGES.find(([id])=>id===key)||STAGES[0])[1];
  const serviceOpts = TASKS.map(t=>`<option value="${escM(t)}">${escM(t)}</option>`).join('');
  const stageOpts = STAGES.map(([id,title])=>`<option value="${id}">${title}</option>`).join('');
  let jobs = [];
  let currentUserId = '';
  let loading = false;
  let saving = false;
  let modalId = '';
  let filter = 'open';
  let search = '';
  let pendingPhotoFiles = [];
  const page = document.createElement('section');
  page.className = 'page';page.id = 'ruvaManagementPage';
  page.innerHTML = `
    <div class="ruva-head"><div><div class="ruva-eyebrow">RUVA DETAILING / BUSINESS MANAGER</div><h2>İş Yönetimi</h2><p>Her aracın sürecini kabulden teslimata kadar yönet.</p></div><button type="button" id="ruvaNewJob" class="primary">+ Araç Kabul</button></div>
    <div class="ruva-metrics" id="ruvaMetrics"></div>
    <div class="ruva-toolbar"><div class="ruva-filters" id="ruvaFilters"><button class="ruva-chip selected" data-filter="open">Aktif İşler</button><button class="ruva-chip" data-filter="all">Tümü</button><button class="ruva-chip" data-filter="delivered">Teslim Edilen</button></div><div class="ruva-tools"><input type="search" id="ruvaSearch" placeholder="Plaka, müşteri, hizmet ara"><button class="secondary" type="button" id="ruvaRefresh">↻</button></div></div>
    <div class="ruva-notice">Satış/ciro işlemleri mevcut <strong>Yeni</strong> ve <strong>Kayıtlar</strong> sayfalarında kalır. Buradan oluşturulan iş emri ikinci kez ciroya yazılmaz.</div>
    <div class="ruva-board" id="ruvaBoard"><div class="empty">Yükleniyor…</div></div>
  `;
  const nav = document.querySelector('.bottomnav .navinner');
  const main = document.querySelector('.app main') || document.querySelector('main');
  if (!nav || !main) return;
  main.insertBefore(page, main.firstChild);
  const tab = document.createElement('button');
  tab.className = 'navbtn';tab.dataset.page = 'ruvaManagementPage';tab.type = 'button';
  tab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h18v13H3zM7 7V4h10v3M3 12h18M9 16h6"/></svg><span>İşler</span>';
  nav.insertBefore(tab,nav.querySelector('[data-page="recordsPage"]'));

  const style = document.createElement('style');
  style.textContent = `
    .ruva-head{display:flex;align-items:center;justify-content:space-between;gap:15px;margin:4px 2px 18px}
    .ruva-head h2{font-size:27px;letter-spacing:-.8px;margin:4px 0 2px}
    .ruva-head p{margin:0;font-size:12px;color:var(--muted)}
    .ruva-eyebrow{font-size:10px;font-weight:800;letter-spacing:1.5px;color:#b98739}
    .ruva-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
    .ruva-metric{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:15px;box-shadow:var(--shadow)}
    .ruva-metric small{display:block;color:var(--muted);font-size:10px;margin-bottom:8px;font-weight:700}
    .ruva-metric b{display:block;font-size:27px;line-height:1.1}
    .ruva-toolbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin:6px 0 12px}
    .ruva-filters,.ruva-tools{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
    .ruva-tools input{width:min(240px,70vw);margin:0;background:var(--card)}
    .ruva-chip{border-radius:99px;border:1px solid var(--line);padding:8px 12px;background:var(--card);color:var(--text);font-size:11px;cursor:pointer}
    .ruva-chip.selected{background:#24201b;border-color:#b98739;color:#f4d8a5}
    .ruva-notice{font-size:10px;line-height:1.6;color:var(--muted);background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:11px;margin-bottom:14px}
    .ruva-board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-items:start}
    .ruva-col{min-width:0;background:var(--soft);border:1px solid var(--line);border-radius:17px;padding:10px;min-height:145px}
    .ruva-col-head{display:flex;justify-content:space-between;align-items:center;margin:3px 2px 12px;gap:8px}
    .ruva-col-head strong{font-size:12px}.ruva-col-head small{background:var(--card);padding:4px 7px;border-radius:9px;color:var(--muted)}
    .ruva-job{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px;margin-bottom:9px;box-shadow:0 4px 10px rgba(0,0,0,.03)}
    .ruva-job .plate{font-size:15px;font-weight:800;letter-spacing:.4px}
    .ruva-job .sub{font-size:11px;color:var(--muted);margin-top:3px;overflow-wrap:anywhere}
    .ruva-job .details{font-size:11px;line-height:1.6;margin:9px 0 8px;overflow-wrap:anywhere}
    .ruva-job .smallrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:var(--muted);font-size:10px}
    .ruva-job .actions{display:flex;gap:6px;justify-content:flex-start;margin-top:11px}
    .ruva-job button{min-height:32px;padding:7px 10px;font-size:10px}
    .ruva-tag{display:inline-flex;border:1px solid #b9873966;color:#a87732;border-radius:8px;font-size:10px;padding:3px 6px;margin-top:7px}
    .ruva-overlay{display:none;position:fixed;inset:0;z-index:6500;background:rgba(2,8,19,.78);overflow:auto;padding:12px;align-items:flex-start;justify-content:center}
    .ruva-overlay.open{display:flex}
    .ruva-dialog{background:var(--card);color:var(--text);max-width:760px;width:100%;margin:24px auto;border:1px solid var(--line);box-shadow:0 25px 100px rgba(0,0,0,.35);border-radius:20px;padding:18px}
    .ruva-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:15px}
    .ruva-dialog-head h3{margin:0;font-size:21px}.ruva-dialog-head p{margin:5px 0 0;color:var(--muted);font-size:11px}
    .ruva-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .ruva-fields label{display:block;margin:0 0 5px;font-weight:750;font-size:10px;color:var(--muted)}
    .ruva-fields input,.ruva-fields select,.ruva-fields textarea{width:100%;min-width:0;background:var(--soft);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:11px}
    .ruva-fields textarea{min-height:70px;resize:vertical}
    .ruva-fields .span2{grid-column:1/-1}
    .ruva-dialog h4{font-size:12px;margin:18px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}
    .ruva-photo-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .ruva-photo{min-width:0;background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:8px}
    .ruva-photo img{width:100%;height:105px;object-fit:cover;border-radius:9px;background:#26313f}
    .ruva-photo small{display:block;font-size:9px;color:var(--muted);overflow-wrap:anywhere;margin-top:3px}
    .ruva-photo button{font-size:10px;min-height:30px}
    .ruva-dialog-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap}
    .ruva-empty{font-size:11px;color:var(--muted);padding:12px 4px}
    @media(max-width:800px){.ruva-board{grid-template-columns:repeat(2,minmax(0,1fr))}.ruva-metrics{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:570px){.ruva-head h2{font-size:23px}.ruva-head .primary{font-size:11px;padding:10px}.ruva-board{grid-template-columns:1fr}.ruva-fields{grid-template-columns:1fr}.ruva-fields .span2{grid-column:1}.ruva-dialog{padding:14px}.ruva-dialog-head h3{font-size:18px}.ruva-photo-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.className = 'ruva-overlay'; modal.id = 'ruvaModal';
  modal.innerHTML = `
    <div class="ruva-dialog" role="dialog" aria-modal="true" aria-labelledby="ruvaDialogTitle">
      <div class="ruva-dialog-head"><div><h3 id="ruvaDialogTitle">Araç Kabul</h3><p>Plaka, işlem, teslim ve fotoğraf kaydı</p></div><button type="button" class="secondary" id="ruvaClose">Kapat</button></div>
      <form id="ruvaJobForm">
        <div class="ruva-fields">
          <div><label for="ruvaPlate">PLAKA *</label><input id="ruvaPlate" maxlength="20" autocomplete="off" required placeholder="20 ABC 123"></div>
          <div><label for="ruvaVehicle">ARAÇ / MODEL</label><input id="ruvaVehicle" maxlength="100" placeholder="BMW 320i"></div>
          <div><label for="ruvaCustomer">MÜŞTERİ ADI</label><input id="ruvaCustomer" maxlength="110" placeholder="Ad Soyad"></div>
          <div><label for="ruvaPhone">TELEFON</label><input id="ruvaPhone" maxlength="25" inputmode="tel" placeholder="05xx ..."></div>
          <div><label for="ruvaService">İŞLEM *</label><select id="ruvaService" required>${serviceOpts}</select></div>
          <div><label for="ruvaStage">İŞ AŞAMASI</label><select id="ruvaStage">${stageOpts}</select></div>
          <div><label for="ruvaWorker">SORUMLU PERSONEL</label><input id="ruvaWorker" maxlength="90" placeholder="Personel adı"></div>
          <div><label for="ruvaDelivery">PLANLANAN TESLİM</label><input id="ruvaDelivery" type="datetime-local"></div>
          <div><label for="ruvaMileage">KİLOMETRE</label><input id="ruvaMileage" maxlength="20" inputmode="numeric" placeholder="63.500"></div>
          <div><label for="ruvaFuel">YAKIT SEVİYESİ</label><select id="ruvaFuel"><option value="">Seç</option><option value="0">Boş</option><option value="25">1/4</option><option value="50">1/2</option><option value="75">3/4</option><option value="100">Dolu</option></select></div>
          <div><label for="ruvaEstimate">TAHMİNİ TUTAR (₺)</label><input id="ruvaEstimate" type="number" min="0" step="1" placeholder="0"></div>
          <div><label for="ruvaOrderRef">İLGİLİ İŞ EMRİ</label><select id="ruvaOrderRef"><option value="">Bağlantı yok</option></select></div>
          <div class="span2"><label for="ruvaDamage">TESPİT EDİLEN ÇİZİK / HASAR</label><textarea id="ruvaDamage" maxlength="3000" placeholder="Örn. Sağ kapıda çizik, jant kenarında sürtme..."></textarea></div>
          <div class="span2"><label for="ruvaBelongings">ARAÇTA KALAN EŞYA</label><textarea id="ruvaBelongings" maxlength="1800" placeholder="Koltuk, gözlük, anahtar..."></textarea></div>
          <div class="span2"><label for="ruvaNotes">İŞLEM / MÜŞTERİ NOTU</label><textarea id="ruvaNotes" maxlength="3000" placeholder="Ek işlem talebi, önemli detay..."></textarea></div>
          <div class="span2"><label for="ruvaQc">KALİTE KONTROL NOTU</label><textarea id="ruvaQc" maxlength="1800" placeholder="Son kontrol, yeniden işlem gereken bölgeler..."></textarea></div>
        </div>
        <h4>Araç Fotoğrafları</h4>
        <div class="ruva-fields"><div><label for="ruvaPhotoType">FOTOĞRAF TÜRÜ</label><select id="ruvaPhotoType"><option value="arrival">Araç kabul / önce</option><option value="damage">Hasar</option><option value="process">İşlem aşaması</option><option value="after">İşlem sonrası</option></select></div><div><label for="ruvaPhotoInput">GÖRSEL EKLE (en çok 8 adet)</label><input id="ruvaPhotoInput" type="file" accept="image/jpeg,image/png,image/webp" multiple></div></div>
        <div class="ruva-photo-list" id="ruvaPhotoList" style="margin-top:10px"></div>
        <p class="ruva-notice" style="margin-top:12px">Fotoğraflar özel Supabase alanında saklanır. İlk kullanımdan önce paket içindeki <strong>ruva-photo-storage.sql</strong> komutunu Supabase SQL Editor'da çalıştırın. Fotoğraf yüklemek için internet gerekir.</p>
        <div class="ruva-dialog-foot"><button type="button" class="secondary" id="ruvaCancel">Vazgeç</button><button type="submit" class="primary" id="ruvaSave">İş Kaydını Kaydet</button></div>
      </form>
    </div>`;
  document.body.appendChild(modal);
  const photoLabels = {arrival:'Kabul',damage:'Hasar',process:'İşlem',after:'Sonrası'};

  const loggedIn = () => typeof cloudUser !== 'undefined' && Boolean(cloudUser && cloudUser.id);
  const owner = () => loggedIn() ? cloudUser.id : '';
  const notify = msg => typeof toast==='function' ? toast(msg) : alert(msg);
  const jobList = () => jobs.filter(j=>j && !j.deleted);
  const toMoney = n => Number.isFinite(Number(n))?Math.max(0,Math.round(Number(n))):0;
  const shortDate = value => {if(!value)return 'Teslim saati belirtilmedi'; const date = new Date(value);return isNaN(date.getTime())?String(value).slice(0,16):date.toLocaleString('tr-TR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});};
  function summarize() {
    const all=jobList(), active=all.filter(j=>j.stage!=='delivered');
    const todayStr=dateToday();
    const cards=[['Açık iş',active.length],['İşlemde',active.filter(j=>j.stage==='working').length],['Teslime hazır',active.filter(j=>j.stage==='ready').length],['Bugün kabul',all.filter(j=>j.acceptedAt?.slice(0,10)===todayStr).length]];
    el('ruvaMetrics').innerHTML=cards.map(([title,value])=>`<div class="ruva-metric"><small>${title}</small><b>${value}</b></div>`).join('');
  }
  function render() {
    summarize();
    el('ruvaFilters').querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.dataset.filter===filter));
    if(!loggedIn()){
      el('ruvaBoard').innerHTML='<div class="card" style="grid-column:1/-1">Önce mevcut RUVA bulut hesabınla giriş yap. İş kayıtları yalnızca giriş yapan hesabın verilerine bağlanır.</div>';
      return;
    }
    if(loading){el('ruvaBoard').innerHTML='<div class="card">İş kayıtları yükleniyor…</div>';return;}
    const q=search.toLocaleLowerCase('tr-TR');
    const picked=jobList().filter(j=>(filter==='all'||(filter==='open'?j.stage!=='delivered':j.stage==='delivered')) &&
      [j.plate,j.vehicle,j.customer,j.service,j.worker].join(' ').toLocaleLowerCase('tr-TR').includes(q));
    const stages=STAGES.filter(([s])=>filter!=='delivered'||s==='delivered');
    el('ruvaBoard').innerHTML=stages.map(([stage,title])=>{
      const list=picked.filter(j=>j.stage===stage).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));
      return `<div class="ruva-col"><div class="ruva-col-head"><strong>${title}</strong><small>${list.length}</small></div>${list.map(j=>`
      <article class="ruva-job"><div class="plate">${escM(j.plate)}</div><div class="sub">${escM(j.vehicle||j.customer||'Araç')}</div>
      <div class="details"><strong>${escM(j.service)}</strong>${j.worker?`<div>Personel: ${escM(j.worker)}</div>`:''}</div>
      <div class="smallrow"><span>◷ ${escM(shortDate(j.deliveryAt))}</span>${j.estimate?`<span>· ${formatTL(j.estimate)}</span>`:''}</div>
      ${(j.photos||[]).length?`<span class="ruva-tag">📷 ${j.photos.length} fotoğraf</span>`:''}
      <div class="actions"><button type="button" class="secondary" data-edit="${escM(j.id)}">Detay / Düzenle</button>${stage!=='delivered'?`<button type="button" class="secondary" data-next="${escM(j.id)}">Sonraki →</button>`:''}</div></article>`).join('') || '<div class="ruva-empty">Bu aşamada araç yok.</div>'}</div>`;
    }).join('');
  }
  async function loadJobs() {
    const id=owner();
    if(!id){currentUserId='';jobs=[];render();return;}
    if(loading)return;
    loading=true;currentUserId=id;render();
    try{
      const result=await cloudFetch(`/rest/v1/sync_items?select=item_id,data,updated_at,deleted&user_id=eq.${encodeURIComponent(id)}&item_type=eq.${ITEM_TYPE}&order=updated_at.desc`,{method:'GET'});
      if(owner()!==id)return;
      jobs=Array.isArray(result)?result.filter(x=>!x.deleted).map(x=>({...x.data,id:x.item_id})):[];
    }catch(err){if(owner()===id)notify('İş kayıtları alınamadı: '+err.message);}
    finally{loading=false;render();}
  }
  async function persist(job) {
    if(!loggedIn())throw new Error('Bulut hesabına giriş yapın.');
    const id=owner(), payload={user_id:id,item_type:ITEM_TYPE,item_id:String(job.id),data:job,updated_at:Number(job.updatedAt||Date.now()),deleted:false};
    await cloudFetch('/rest/v1/sync_items?on_conflict=user_id,item_type,item_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(payload)});
    if(owner()!==id)throw new Error('Oturum değişti, kaydı yenileyin.');
    const index=jobs.findIndex(x=>x.id===job.id);
    if(index>=0)jobs[index]=job;else jobs.unshift(job);
    render();
  }
  const txt=id=>el(id).value.trim();
  function loadWorkOrders(selected) {
    const docs=typeof settings!=='undefined' && Array.isArray(settings?.quoteWorkOrders)?settings.quoteWorkOrders:[];
    const opts=docs.filter(d=>d.type==='workorder');
    el('ruvaOrderRef').innerHTML='<option value="">Bağlantı yok</option>'+opts.map(d=>`<option value="${escM(d.id)}">${escM(d.number||'İş emri')} · ${escM(d.plate||d.customer||'')}</option>`).join('');
    el('ruvaOrderRef').value=selected||'';
  }
  function showModal(id='') {
    if(!loggedIn()){notify('Önce bulut hesabına giriş yap.');return;}
    modalId=id;
    pendingPhotoFiles=[];
    const job=jobs.find(j=>j.id===id)||null;
    el('ruvaJobForm').reset();
    el('ruvaDialogTitle').textContent=job?'İş Kaydını Düzenle':'Yeni Araç Kabul';
    const fields={ruvaPlate:'plate',ruvaVehicle:'vehicle',ruvaCustomer:'customer',ruvaPhone:'phone',ruvaService:'service',ruvaStage:'stage',ruvaWorker:'worker',ruvaDelivery:'deliveryAt',ruvaMileage:'mileage',ruvaFuel:'fuel',ruvaEstimate:'estimate',ruvaDamage:'damage',ruvaBelongings:'belongings',ruvaNotes:'notes',ruvaQc:'qc'};
    for(const [target,key] of Object.entries(fields))if(job && job[key]!==undefined)el(target).value=String(job[key]);
    if(!job){el('ruvaStage').value='accepted';el('ruvaService').value=TASKS[0];}
    loadWorkOrders(job?.orderId);
    renderPhotos(job);
    modal.classList.add('open');
    el('ruvaPlate').focus();
  }
  function closeModal() {modal.classList.remove('open');modalId='';pendingPhotoFiles=[];el('ruvaPhotoInput').value='';}
  async function signedPhoto(path) {
    const r=await cloudFetch(`/storage/v1/object/sign/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'POST',body:JSON.stringify({expiresIn:600})});
    const signed=r.signedURL||r.signedUrl;
    if(!signed)throw new Error('Fotoğraf bağlantısı üretilemedi');
    return signed.startsWith('http')?signed:SUPABASE_URL+(signed.startsWith('/storage/')?signed:'/storage/v1'+signed);
  }
  async function renderPhotos(job) {
    const box=el('ruvaPhotoList');
    const existing=(job?.photos||[]);
    box.innerHTML=existing.map((p,i)=>`<div class="ruva-photo" data-photo-index="${i}"><a href="#" data-open-photo="${i}" title="Fotoğrafı aç"><img alt="Fotoğraf" src="" data-photo-img="${i}"></a><small>${escM(photoLabels[p.type]||p.type||'Fotoğraf')}</small><button class="secondary" type="button" data-remove-photo="${i}">Kaldır</button></div>`).join('')+
      pendingPhotoFiles.map((p,i)=>`<div class="ruva-photo"><small>Yeni fotoğraf: ${escM(p.file.name)}</small><small>${photoLabels[p.type]}</small><button type="button" class="secondary" data-drop-pending="${i}">Çıkar</button></div>`).join('') || '<div class="ruva-empty">Henüz fotoğraf eklenmedi.</div>';
    for(let i=0;i<existing.length;i++){
      try{
        const url=await signedPhoto(existing[i].path);
        if(!modal.classList.contains('open')||modalId!==job?.id)return;
        const img=box.querySelector(`[data-photo-img="${i}"]`);if(img)img.src=url;
        const a=box.querySelector(`[data-open-photo="${i}"]`);if(a)a.href=url;
      }catch(e){const img=box.querySelector(`[data-photo-img="${i}"]`);if(img)img.alt='Fotoğraf açılamadı';}
    }
  }
  async function compressImage(file) {
    if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error('Yalnızca JPEG, PNG veya WebP fotoğraf seçin.');
    if(file.size>18*1024*1024)throw new Error('Fotoğraf 18 MB sınırını aşıyor.');
    const bitmap=await createImageBitmap(file);
    const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Fotoğraf işlenemedi.');
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
    return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Fotoğraf sıkıştırılamadı')),'image/jpeg',.82));
  }
  async function uploadPhoto(jobId,file,type) {
    const id=owner();if(!id)throw new Error('Bulut hesabına giriş yapın.');
    const blob=await compressImage(file);
    const path=`${id}/${jobId}/${uuid()}.jpg`;
    const session=await ensureCloudSession();
    if(!session?.access_token)throw new Error('Bulut oturumu sona erdi.');
    const url=SUPABASE_URL+'/storage/v1/object/'+BUCKET+'/'+path.split('/').map(encodeURIComponent).join('/');
    const response=await fetch(url,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'image/jpeg','x-upsert':'false'},body:blob,cache:'no-store'});
    if(!response.ok){let reason='HTTP '+response.status;try{const d=await response.json();reason=d.message||d.error||reason;}catch{}throw new Error(reason);}
    return {path,type,createdAt:new Date().toISOString()};
  }
  async function removeStoredPhoto(path) {
    const session=await ensureCloudSession();if(!session?.access_token)throw new Error('Oturum sona erdi');
    const url=SUPABASE_URL+'/storage/v1/object/'+BUCKET+'/'+path.split('/').map(encodeURIComponent).join('/');
    const response=await fetch(url,{method:'DELETE',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+session.access_token},cache:'no-store'});
    if(!response.ok)throw new Error('Fotoğraf silinemedi');
  }
  async function removePhoto(index) {
    const j=jobs.find(x=>x.id===modalId);if(!j)return;
    const p=j.photos?.[index];if(!p)return;
    if(!confirm('Bu fotoğrafı kalıcı olarak kaldırmak istiyor musun?'))return;
    try{
      await removeStoredPhoto(p.path);
      const next={...j,photos:j.photos.filter((_,i)=>i!==index),updatedAt:Date.now()};
      await persist(next);renderPhotos(next);notify('Fotoğraf kaldırıldı');
    }catch(e){alert('Fotoğraf kaldırma başarısız: '+e.message);}
  }
  async function saveForm(evt) {
    evt.preventDefault();if(saving)return;
    const plate=txt('ruvaPlate').toLocaleUpperCase('tr-TR').replace(/\s+/g,' ');
    if(plate.length<4)return alert('Geçerli bir plaka girin.');
    const existing=jobs.find(j=>j.id===modalId);
    const id=existing?.id||uuid();
    const fields={plate,vehicle:txt('ruvaVehicle'),customer:txt('ruvaCustomer'),phone:txt('ruvaPhone'),service:txt('ruvaService'),stage:txt('ruvaStage'),worker:txt('ruvaWorker'),deliveryAt:txt('ruvaDelivery'),mileage:txt('ruvaMileage'),fuel:txt('ruvaFuel'),estimate:toMoney(txt('ruvaEstimate')),damage:txt('ruvaDamage'),belongings:txt('ruvaBelongings'),notes:txt('ruvaNotes'),qc:txt('ruvaQc'),orderId:txt('ruvaOrderRef')};
    if(!STAGES.some(([s])=>s===fields.stage))return alert('Geçerli bir aşama seçin');
    const j={...existing,id,createdAt:existing?.createdAt||Date.now(),acceptedAt:existing?.acceptedAt||new Date().toISOString(),updatedAt:Date.now(),photos:[...(existing?.photos||[])],...fields};
    saving=true;el('ruvaSave').disabled=true;el('ruvaSave').textContent='Kaydediliyor…';
    try{
      // İş kaydı önce yüklenir; fotoğraf hatası kaydı yok etmez.
      await persist(j);
      let uploadErrors=[];
      for(const item of pendingPhotoFiles){
        try{const p=await uploadPhoto(j.id,item.file,item.type);j.photos.push(p);j.updatedAt=Date.now();await persist(j);}
        catch(e){uploadErrors.push(item.file.name+': '+e.message);}
      }
      await loadJobs();
      closeModal();
      if(uploadErrors.length)alert('İş kaydı kaydedildi ancak şu fotoğraflar yüklenemedi:\n'+uploadErrors.join('\n')+'\n\nSupabase Storage ayarını kontrol et.');
      else notify('İş kaydı kaydedildi');
    }catch(e){alert('Kaydedilemedi: '+e.message);}
    finally{saving=false;el('ruvaSave').disabled=false;el('ruvaSave').textContent='İş Kaydını Kaydet';}
  }
  async function nextStage(id) {
    const j=jobs.find(x=>x.id===id);if(!j)return;
    const i=STAGES.findIndex(([x])=>x===j.stage);if(i<0||i>=STAGES.length-1)return;
    const next=STAGES[i+1][0];
    if(next==='delivered'&&!confirm('Araç teslim edildi olarak işaretlensin mi? Ciro kaydı otomatik oluşturulmaz.'))return;
    try{await persist({...j,stage:next,updatedAt:Date.now(),deliveredAt:next==='delivered'?new Date().toISOString():(j.deliveredAt||null)});notify('Durum: '+stageName(next));}
    catch(e){alert('Durum güncellenemedi: '+e.message);}
  }
  tab.addEventListener('click',async()=>{switchPage('ruvaManagementPage');await loadJobs();});
  el('ruvaNewJob').addEventListener('click',()=>showModal());
  el('ruvaRefresh').addEventListener('click',loadJobs);
  el('ruvaSearch').addEventListener('input',e=>{search=e.target.value.trim();render();});
  el('ruvaFilters').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;render();});
  el('ruvaBoard').addEventListener('click',e=>{const edit=e.target.closest('[data-edit]');if(edit)return showModal(edit.dataset.edit);const next=e.target.closest('[data-next]');if(next)nextStage(next.dataset.next);});
  el('ruvaClose').addEventListener('click',closeModal);el('ruvaCancel').addEventListener('click',closeModal);
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
  el('ruvaJobForm').addEventListener('submit',saveForm);
  el('ruvaPhotoInput').addEventListener('change',e=>{
    const list=[...e.target.files];
    const existing=jobs.find(j=>j.id===modalId)?.photos?.length||0;
    if(list.length+pendingPhotoFiles.length+existing>8){alert('Araç başına en fazla 8 fotoğraf ekleyebilirsin.');e.target.value='';return;}
    for(const file of list)pendingPhotoFiles.push({file,type:txt('ruvaPhotoType')});
    e.target.value='';renderPhotos(jobs.find(j=>j.id===modalId));
  });
  el('ruvaPhotoList').addEventListener('click',e=>{
    const a=e.target.closest('[data-open-photo]');if(a&&a.getAttribute('href')==='#')e.preventDefault();
    const remove=e.target.closest('[data-remove-photo]');if(remove)removePhoto(Number(remove.dataset.removePhoto));
    const drop=e.target.closest('[data-drop-pending]');if(drop){pendingPhotoFiles.splice(Number(drop.dataset.dropPending),1);renderPhotos(jobs.find(j=>j.id===modalId));}
  });
  // Çıkış yapıldıysa önceki müşterilerin kartlarını ekranda bırakma.
  setInterval(()=>{
    const id=owner();
    if(id!==currentUserId){jobs=[];currentUserId=id;render();if(page.classList.contains('active')&&id)loadJobs();}
  },2500);
  window.addEventListener('online',()=>{if(page.classList.contains('active'))loadJobs();});
  render();
})();
