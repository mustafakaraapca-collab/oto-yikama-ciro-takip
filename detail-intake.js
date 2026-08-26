/* RUVA V21 - Opsiyonel detayli arac kabul + tahmini teslim */
(() => {
  if (window.__ruvaDetailIntakeV21) return;
  window.__ruvaDetailIntakeV21 = true;

  const JOBS = [
    "Pasta Cila",
    "Boya Düzeltme",
    "Seramik Kaplama",
    "İç Detaylı Temizlik",
    "PPF",
    "Cam Filmi",
    "Diğer"
  ];

  let detailDirty = false;
  let pendingSave = null;
  let loadedRowId = "";

  function byId(id){ return document.getElementById(id); }
  function isDetailMode(){
    const active = document.querySelector(".service-btn.active");
    return active && (active.dataset.service === "detail" || active.dataset.service === "both");
  }
  function nowIso(){ return new Date().toISOString(); }
  function formatAcceptedAt(iso){
    if(!iso) return "Kabul saati henüz oluşturulmadı";
    const d = new Date(iso);
    if(Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("tr-TR", {dateStyle:"short", timeStyle:"short"});
  }
  function trShortDate(iso){
    if(!iso) return "";
    const p=String(iso).split("-");
    return p.length===3?`${p[2]}.${p[1]}.${p[0]}`:iso;
  }
  function deliveryText(date,time){
    if(!date&&!time) return "Tahmini teslim seçilmedi";
    return `${date?trShortDate(date):"Tarih seçilmedi"}${time?" · "+time:""}`;
  }

  const style = document.createElement("style");
  style.textContent = `
    .detail-intake-panel{grid-column:1/-1;border:1px solid rgba(185,135,57,.45);border-radius:17px;background:linear-gradient(145deg,rgba(185,135,57,.08),var(--soft));padding:13px;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
    .detail-intake-panel.collapsed{display:none}
    .detail-intake-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:11px}
    .detail-intake-head strong{font-size:13px}.detail-intake-head p{font-size:10px;color:var(--muted);margin:4px 0 0;line-height:1.5}
    .detail-intake-head button{height:30px;font-size:10px}
    .detail-intake-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}
    .detail-intake-grid .wide{grid-column:1/-1}
    .detail-intake-jobs{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
    .detail-intake-job{display:flex;align-items:center;gap:7px;min-height:42px;padding:8px 9px;border:1px solid var(--line);border-radius:11px;background:var(--card);font-size:10px;font-weight:800;color:var(--text)}
    .detail-intake-job input{width:17px;height:17px;padding:0;box-shadow:none;flex:0 0 auto}
    .detail-intake-time{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 11px;border:1px dashed rgba(185,135,57,.55);border-radius:12px;background:var(--card)}
    .detail-intake-time small{font-size:9px;color:var(--muted);font-weight:850}.detail-intake-time b{font-size:11px}
    .detail-intake-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
    .detail-intake-actions button{height:34px;font-size:10px}
    .detail-delivery-box{padding:11px;border:1px solid rgba(185,135,57,.35);border-radius:12px;background:var(--card)}
    .detail-delivery-box small{display:block;font-size:9px;color:var(--muted);font-weight:850;margin-bottom:4px}.detail-delivery-box b{font-size:12px}
    .detail-history-line{margin-top:7px;padding:7px 9px;border-radius:10px;background:rgba(185,135,57,.09);border:1px solid rgba(185,135,57,.25);font-size:10px;color:var(--text)}
    #detailIntakeBtn.detail-ready{border-color:rgba(185,135,57,.7);background:linear-gradient(135deg,rgba(185,135,57,.14),var(--soft))}
    @media(max-width:800px){.detail-intake-jobs{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:520px){.detail-intake-grid{grid-template-columns:1fr}.detail-intake-grid .wide{grid-column:auto}.detail-intake-jobs{grid-template-columns:1fr 1fr}.detail-intake-time{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);

  const tools = document.querySelector(".quick-tools");
  const advancedPanel = byId("advancedPanel");
  if(!tools || !advancedPanel || !byId("saveBtn")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "secondary hidden-field";
  btn.id = "detailIntakeBtn";
  btn.textContent = "Detaylı Araç Kabul";
  const expenseBtn = byId("expenseOnlyBtn");
  tools.insertBefore(btn, expenseBtn || null);

  const panel = document.createElement("div");
  panel.className = "detail-intake-panel collapsed";
  panel.id = "detailIntakePanel";
  panel.innerHTML = `
    <div class="detail-intake-head">
      <div><strong>Detaylı Araç Kabul</strong><p>Yalnızca pasta cila, boya düzeltme, seramik, iç detay ve benzeri uzun işlemlerde kullan. Zorunlu değildir.</p></div>
      <button type="button" class="secondary" id="detailIntakeClose">Kapat</button>
    </div>
    <div class="detail-intake-grid">
      <div class="wide">
        <label>YAPILACAK İŞLEMLER</label>
        <div class="detail-intake-jobs" id="detailIntakeJobs">
          ${JOBS.map((job,i)=>`<label class="detail-intake-job"><input type="checkbox" value="${job}" id="detailJob_${i}"><span>${job}</span></label>`).join("")}
        </div>
      </div>
      <div><label>KİLOMETRE</label><input id="detailKm" inputmode="numeric" placeholder="Örn. 64.250"></div>
      <div><label>YAKIT SEVİYESİ</label><select id="detailFuel"><option value="">Seç</option><option value="0">Boş</option><option value="25">1/4</option><option value="50">1/2</option><option value="75">3/4</option><option value="100">Dolu</option></select></div>
      <div><label>TAHMİNİ TESLİM TARİHİ</label><input id="detailDeliveryDate" type="date"></div>
      <div><label>TAHMİNİ TESLİM SAATİ</label><input id="detailDeliveryTime" type="time"></div>
      <div class="wide detail-delivery-box"><small>TAHMİNİ TESLİM</small><b id="detailDeliveryPreview">Tahmini teslim seçilmedi</b></div>
      <div class="wide"><label>MEVCUT ÇİZİK / HASAR</label><textarea id="detailDamage" placeholder="Örn. Sağ arka kapıda çizik, ön tamponda taş izi..."></textarea></div>
      <div class="wide"><label>ARAÇTA BIRAKILAN EŞYA</label><textarea id="detailItems" placeholder="Örn. Bagajda çocuk koltuğu, torpidoda gözlük..."></textarea></div>
      <div class="wide"><label>MÜŞTERİ ÖZEL TALEBİ</label><textarea id="detailRequest" placeholder="Örn. Kaputtaki çiziklere özellikle bakılacak..."></textarea></div>
      <div class="wide"><label>TESLİM NOTU</label><textarea id="detailDeliveryNote" placeholder="Teslim sırasında hatırlanacak not..."></textarea></div>
      <div class="wide detail-intake-time"><div><small>KABUL TARİHİ / SAATİ</small><br><b id="detailAcceptedAtText">Kabul saati henüz oluşturulmadı</b></div><button type="button" class="secondary" id="detailRefreshTime">Şimdi olarak güncelle</button></div>
    </div>
    <div class="detail-intake-actions"><button type="button" class="secondary" id="detailIntakeReset">Formu Temizle</button></div>
  `;
  advancedPanel.insertAdjacentElement("afterend", panel);

  function selectedJobs(){
    return [...panel.querySelectorAll('#detailIntakeJobs input:checked')].map(x=>x.value);
  }
  function setJobs(items){
    const set = new Set(Array.isArray(items) ? items : []);
    panel.querySelectorAll('#detailIntakeJobs input').forEach(x=>x.checked=set.has(x.value));
  }
  function getAcceptedAt(){ return panel.dataset.acceptedAt || ""; }
  function setAcceptedAt(iso){
    panel.dataset.acceptedAt = iso || "";
    byId("detailAcceptedAtText").textContent = formatAcceptedAt(iso);
  }
  function parseKm(value){
    const digits = String(value||"").replace(/\D/g,"");
    return digits ? Number(digits) : null;
  }
  function fuelText(value){
    return ({"0":"Boş","25":"1/4","50":"1/2","75":"3/4","100":"Dolu"})[String(value)] || "";
  }
  function updateDeliveryPreview(){
    byId("detailDeliveryPreview").textContent=deliveryText(byId("detailDeliveryDate").value,byId("detailDeliveryTime").value);
  }
  function getDraft(){
    const fuel = byId("detailFuel").value;
    return {
      version: 2,
      acceptedAt: getAcceptedAt() || nowIso(),
      jobs: selectedJobs(),
      km: parseKm(byId("detailKm").value),
      fuel: fuel === "" ? null : Number(fuel),
      fuelText: fuelText(fuel),
      estimatedDeliveryDate: byId("detailDeliveryDate").value || "",
      estimatedDeliveryTime: byId("detailDeliveryTime").value || "",
      damage: byId("detailDamage").value.trim(),
      itemsLeft: byId("detailItems").value.trim(),
      customerRequest: byId("detailRequest").value.trim(),
      deliveryNote: byId("detailDeliveryNote").value.trim()
    };
  }
  function hasUsefulData(d){
    return !!(d && (d.acceptedAt || d.jobs?.length || d.km !== null || d.fuel !== null || d.estimatedDeliveryDate || d.estimatedDeliveryTime || d.damage || d.itemsLeft || d.customerRequest || d.deliveryNote));
  }
  function loadDraft(d, rowId=""){
    loadedRowId = rowId || "";
    setJobs(d?.jobs || []);
    byId("detailKm").value = d?.km !== null && d?.km !== undefined ? Number(d.km).toLocaleString("tr-TR") : "";
    byId("detailFuel").value = d?.fuel !== null && d?.fuel !== undefined ? String(d.fuel) : "";
    byId("detailDeliveryDate").value = d?.estimatedDeliveryDate || d?.deliveryDate || "";
    byId("detailDeliveryTime").value = d?.estimatedDeliveryTime || d?.deliveryTime || "";
    byId("detailDamage").value = d?.damage || "";
    byId("detailItems").value = d?.itemsLeft || "";
    byId("detailRequest").value = d?.customerRequest || "";
    byId("detailDeliveryNote").value = d?.deliveryNote || "";
    setAcceptedAt(d?.acceptedAt || "");
    updateDeliveryPreview();
    detailDirty = false;
    btn.classList.toggle("detail-ready", !!d);
    btn.textContent = d ? "Detaylı Araç Kabul ✓" : "Detaylı Araç Kabul";
  }
  function resetDraft(markDirty=false){
    loadedRowId = "";
    setJobs([]);
    ["detailKm","detailDeliveryDate","detailDeliveryTime","detailDamage","detailItems","detailRequest","detailDeliveryNote"].forEach(id=>byId(id).value="");
    byId("detailFuel").value = "";
    setAcceptedAt("");
    updateDeliveryPreview();
    detailDirty = !!markDirty;
    btn.classList.remove("detail-ready");
    btn.textContent = "Detaylı Araç Kabul";
  }
  function openPanel(){
    if(!isDetailMode()) return;
    panel.classList.remove("collapsed");
    if(!getAcceptedAt()){
      setAcceptedAt(nowIso());
      detailDirty = true;
    }
    btn.classList.add("detail-ready");
    btn.textContent = "Detaylı Araç Kabul ✓";
    setTimeout(()=>panel.scrollIntoView({behavior:"smooth",block:"nearest"}),20);
  }
  function closePanel(){ panel.classList.add("collapsed"); }
  function syncVisibility(){
    const show = !!isDetailMode();
    btn.classList.toggle("hidden-field", !show);
    if(!show) closePanel();
  }

  btn.addEventListener("click", openPanel);
  byId("detailIntakeClose").addEventListener("click", closePanel);
  byId("detailRefreshTime").addEventListener("click",()=>{setAcceptedAt(nowIso());detailDirty=true;});
  byId("detailIntakeReset").addEventListener("click",()=>{
    if(confirm("Araç kabul formundaki bilgiler temizlensin mi?")) resetDraft(true);
  });
  ["detailDeliveryDate","detailDeliveryTime"].forEach(id=>byId(id).addEventListener("change",updateDeliveryPreview));
  panel.addEventListener("input",()=>{detailDirty=true;});
  panel.addEventListener("change",()=>{detailDirty=true;});
  document.querySelectorAll(".service-btn").forEach(x=>x.addEventListener("click",()=>setTimeout(syncVisibility,0)));

  const baseEditRow = window.editRow;
  if(typeof baseEditRow === "function"){
    window.editRow = function(id){
      const r = rows.find(x=>String(x.id)===String(id));
      baseEditRow(id);
      loadDraft(r?.detailIntake || null, String(id));
      syncVisibility();
      closePanel();
    };
  }

  const baseShowPlateHistory = window.showPlateHistory;
  if(typeof baseShowPlateHistory === "function"){
    window.showPlateHistory = function(){
      baseShowPlateHistory();
      setTimeout(()=>{
        const plate = typeof normPlate === "function" ? normPlate(byId("plaka")?.value) : String(byId("plaka")?.value||"").trim().toUpperCase();
        const box = byId("plateHistoryBox");
        if(!plate || !box || !box.classList.contains("show")) return;
        box.querySelectorAll(".detail-history-line").forEach(x=>x.remove());
        const rec = [...rows].filter(r=>r.plaka===plate && r.detailIntake).sort((a,b)=>(b.date||"").localeCompare(a.date||"") || (b.createdAt||0)-(a.createdAt||0))[0];
        const d = rec?.detailIntake;
        if(!d) return;
        const date=d.estimatedDeliveryDate||d.deliveryDate||"", time=d.estimatedDeliveryTime||d.deliveryTime||"";
        if(!date&&!time) return;
        const line=document.createElement("div");
        line.className="detail-history-line";
        line.innerHTML=`<b>Tahmini teslim:</b> ${deliveryText(date,time)}`;
        box.appendChild(line);
      },0);
    };
  }

  const saveBtn = byId("saveBtn");
  saveBtn.addEventListener("click",()=>{
    const active = isDetailMode();
    pendingSave = {
      beforeIds: new Set(rows.map(r=>String(r.id))),
      editRowId: editId ? String(editId) : "",
      active,
      dirty: detailDirty,
      draft: active && detailDirty ? getDraft() : null,
      beforeEditUpdatedAt: editId ? Number(rows.find(r=>String(r.id)===String(editId))?.updatedAt||0) : 0
    };
  }, true);

  saveBtn.addEventListener("click",()=>setTimeout(()=>{
    const p = pendingSave; pendingSave = null;
    if(!p || !p.active || !p.dirty) return;
    let row = null;
    if(p.editRowId){
      const candidate = rows.find(r=>String(r.id)===p.editRowId);
      if(candidate && Number(candidate.updatedAt||0) > p.beforeEditUpdatedAt) row = candidate;
    }else{
      row = [...rows].reverse().find(r=>!p.beforeIds.has(String(r.id))) || null;
    }
    if(!row) return;
    if(p.draft && hasUsefulData(p.draft)) row.detailIntake = p.draft;
    else delete row.detailIntake;
    row.updatedAt = Date.now();
    save();
    renderAll();
    resetDraft(false);
    closePanel();
    syncVisibility();
    toast("Araç kabul ve teslim bilgileri kaydedildi");
  },0));

  byId("clearBtn").addEventListener("click",()=>setTimeout(()=>{resetDraft(false);closePanel();syncVisibility();},0));
  byId("expenseOnlyBtn")?.addEventListener("click",()=>setTimeout(()=>{resetDraft(false);closePanel();syncVisibility();},0));

  byId("plaka")?.addEventListener("input",()=>{
    if(!editId && loadedRowId){ resetDraft(false); closePanel(); }
  });

  syncVisibility();
})();
