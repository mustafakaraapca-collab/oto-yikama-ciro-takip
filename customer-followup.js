/* RUVA V22 - Musteri geri cagirma / takip sistemi */
(() => {
  if (window.__ruvaCustomerFollowupV22) return;
  window.__ruvaCustomerFollowupV22 = true;

  const FOLLOWUP_KINDS = {
    all: "Tümü",
    inactive30: "30+ Gün",
    inactive60: "60+ Gün",
    care: "Bakım",
    contacted: "Takip Edildi"
  };
  let activeFilter = "all";
  let followupSearch = "";

  const byId = id => document.getElementById(id);

  function normText(v){
    return String(v ?? "")
      .toLocaleLowerCase("tr-TR")
      .replace(/\s+/g, " ")
      .trim();
  }
  function esc2(v){
    if (typeof esc === "function") return esc(v);
    return String(v ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
    })[c]);
  }
  function money(v){
    if (typeof fmt === "function") return fmt(v);
    return "₺" + Math.round(Number(v||0)).toLocaleString("tr-TR");
  }
  function dateTR(v){
    if (typeof trDate === "function") return trDate(v);
    if(!v) return "";
    const [y,m,d]=String(v).split("-");
    return y&&m&&d ? `${d}.${m}.${y}` : String(v);
  }
  function dayStart(dateStr){
    const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  function daysSince(dateStr){
    if(!dateStr) return 0;
    const diff = dayStart(typeof today === "function" ? today() : "") - dayStart(dateStr);
    return Math.max(0, Math.floor(diff / 86400000));
  }
  function rowStamp(r){
    return `${r?.date||""}-${String(Number(r?.createdAt||0)).padStart(16,"0")}`;
  }
  function newest(list){
    return [...(list||[])].sort((a,b)=>rowStamp(b).localeCompare(rowStamp(a)))[0] || null;
  }
  function rowJobs(r){
    const jobs = Array.isArray(r?.detailIntake?.jobs) ? r.detailIntake.jobs : [];
    const extra = [r?.not, r?.appointmentService].filter(Boolean).join(" ");
    return {jobs, text:normText(jobs.join(" ")+" "+extra)};
  }
  function hasJob(r, terms){
    const info=rowJobs(r);
    return terms.some(t => info.text.includes(normText(t)));
  }
  function latestByJob(list, terms){
    return newest((list||[]).filter(r=>hasJob(r,terms)));
  }
  function serviceLabel(r){
    if(!r) return "—";
    const jobs=Array.isArray(r?.detailIntake?.jobs)?r.detailIntake.jobs.filter(Boolean):[];
    if(jobs.length) return jobs.slice(0,3).join(" + ") + (jobs.length>3 ? ` +${jobs.length-3}` : "");
    if(r.packageUsage) return "Paket Yıkama";
    if(r.sadakatKullanildi) return "Sadakat Yıkama";
    if(Number(r.detay||0)>0 && Number(r.aracYikama||0)>0) return "Yıkama + Detay";
    if(Number(r.detay||0)>0) return r.not?.trim() || "Detay İşlemi";
    if(Number(r.aracYikama||0)>0) return "Araç Yıkama";
    return r.not?.trim() || "İşlem";
  }
  function contactKey(c){
    return c?.plaka ? "p:"+c.plaka : c?.telefon ? "t:"+String(c.telefon).replace(/\D/g,"") : "n:"+normText(c?.musteriAdi);
  }
  function contactedMap(){
    settings.followupContacts = settings.followupContacts && typeof settings.followupContacts==="object" ? settings.followupContacts : {};
    return settings.followupContacts;
  }
  function contactedDate(c){
    return contactedMap()[contactKey(c)] || "";
  }
  function isContactedToday(c){
    const d=contactedDate(c);
    return !!d && d === (typeof today === "function" ? today() : "");
  }

  function buildFollowups(){
    const customers = typeof customerSummaries === "function" ? customerSummaries() : [];
    return customers.map(c=>{
      const visits=(c.rows||[]).filter(r=>typeof isVehicleVisit==="function"?isVehicleVisit(r):true);
      const last=newest(visits.length?visits:c.rows||[]);
      if(!last) return null;
      const lastDate=last.date || c.lastDate || "";
      const inactiveDays=daysSince(lastDate);

      const ceramic=latestByJob(c.rows,["Seramik Kaplama","seramik"]);
      const ppf=latestByJob(c.rows,["PPF"]);
      const interior=latestByJob(c.rows,["İç Detaylı Temizlik","detaylı temizlik","ic detayli temizlik"]);

      const ceramicDays=ceramic?daysSince(ceramic.date):null;
      const ppfDays=ppf?daysSince(ppf.date):null;
      const interiorDays=interior?daysSince(interior.date):null;

      const reasons=[];
      let priority=0;
      if(inactiveDays>=60){reasons.push({kind:"inactive60",label:`${inactiveDays} gündür gelmedi`,tone:"bad"});priority=Math.max(priority,4)}
      else if(inactiveDays>=30){reasons.push({kind:"inactive30",label:`${inactiveDays} gündür gelmedi`,tone:"warn"});priority=Math.max(priority,3)}

      if(ceramicDays!==null && ceramicDays>=90){
        reasons.push({kind:"care",label:`Seramik bakım · ${ceramicDays} gün`,tone:"care"});priority=Math.max(priority,3)
      }
      if(ppfDays!==null && ppfDays>=180){
        reasons.push({kind:"care",label:`PPF kontrol · ${ppfDays} gün`,tone:"care"});priority=Math.max(priority,2)
      }
      if(interiorDays!==null && interiorDays>=180){
        reasons.push({kind:"care",label:`İç detay öner · ${interiorDays} gün`,tone:"care"});priority=Math.max(priority,2)
      }

      const contacted=contactedDate(c);
      return {
        ...c,last,lastDate,inactiveDays,reasons,priority,
        contacted,contactedToday:isContactedToday(c),
        lastService:serviceLabel(last)
      };
    }).filter(Boolean);
  }

  const style=document.createElement("style");
  style.textContent=`
    .followup-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:10px}
    .followup-metric{padding:11px 12px;border:1px solid var(--line);border-radius:13px;background:var(--soft)}
    .followup-metric small{display:block;color:var(--muted);font-size:9px;font-weight:850;margin-bottom:5px}
    .followup-metric b{font-size:18px;letter-spacing:-.3px}
    .followup-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px}
    .followup-filters{display:flex;gap:6px;flex-wrap:wrap}
    .followup-filter{height:34px;padding:0 10px;font-size:10px;background:var(--soft);color:var(--text);border:1px solid var(--line)}
    .followup-filter.active{background:var(--nav);color:#fff;border-color:var(--nav)}
    .followup-search{height:36px;max-width:290px}
    .followup-list{display:grid;gap:8px}
    .followup-card{padding:12px;background:var(--soft);border:1px solid var(--line);border-radius:14px}
    .followup-card.priority-high{border-color:#fecaca}
    .followup-card.priority-mid{border-color:#fde68a}
    .followup-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
    .followup-head h3{font-size:13px;margin:0 0 3px}.followup-head p{font-size:10px;color:var(--muted);margin:2px 0;line-height:1.45}
    .followup-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}
    .followup-tag{display:inline-flex;align-items:center;border-radius:999px;padding:4px 7px;font-size:9px;font-weight:850;background:var(--card);border:1px solid var(--line);color:var(--muted)}
    .followup-tag.bad{background:#fee2e2;color:#991b1b;border-color:#fecaca}
    .followup-tag.warn{background:#fef3c7;color:#92400e;border-color:#fde68a}
    .followup-tag.care{background:#e0f2fe;color:#075985;border-color:#bae6fd}
    .followup-tag.done{background:#d1fae5;color:#065f46;border-color:#a7f3d0}
    .followup-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;margin-top:9px}
    .followup-actions button{height:31px;padding:0 9px;font-size:10px;border-radius:9px}
    .followup-note{font-size:9.5px;color:var(--muted);line-height:1.5;margin:8px 2px 0}
    @media(max-width:800px){.followup-summary{grid-template-columns:1fr 1fr}}
    @media(max-width:520px){.followup-head{align-items:flex-start}.followup-search{max-width:none;width:100%}.followup-toolbar{align-items:stretch}.followup-filters{width:100%}.followup-filter{flex:1}.followup-actions button{flex:1}}
  `;
  document.head.appendChild(style);

  const trackingPage=byId("trackingPage");
  const customerList=byId("customerList");
  if(!trackingPage || !customerList) return;

  const customerCard=customerList.closest(".card");
  if(!customerCard) return;

  const title=document.createElement("div");
  title.className="section-title";
  title.id="followupSectionTitle";
  title.innerHTML='<h2>Müşteri Geri Çağırma</h2><span>Otomatik takip önerileri</span>';

  const card=document.createElement("div");
  card.className="card";
  card.id="followupCard";
  card.innerHTML=`
    <div class="followup-summary">
      <div class="followup-metric"><small>30+ GÜN</small><b id="fu30">0</b></div>
      <div class="followup-metric"><small>60+ GÜN</small><b id="fu60">0</b></div>
      <div class="followup-metric"><small>BAKIM ÖNERİSİ</small><b id="fuCare">0</b></div>
      <div class="followup-metric"><small>BUGÜN TAKİP EDİLEN</small><b id="fuDone">0</b></div>
    </div>
    <div class="followup-toolbar">
      <div class="followup-filters" id="followupFilters"></div>
      <input class="followup-search" id="followupSearch" placeholder="Plaka, müşteri veya araç ara…">
    </div>
    <div class="followup-list" id="followupList"></div>
    <p class="followup-note">Bakım önerileri otomatik hesaplanır: seramik için 90 gün, PPF kontrolü ve iç detay tekrar önerisi için 180 gün. “Takip Yapıldı” dediğin müşteri o gün tamamlandı olarak işaretlenir; ertesi gün tekrar takip listesinde görünebilir.</p>
  `;
  customerCard.insertAdjacentElement("afterend", card);
  customerCard.insertAdjacentElement("afterend", title);

  const filters=byId("followupFilters");
  filters.innerHTML=Object.entries(FOLLOWUP_KINDS).map(([k,v])=>`<button type="button" class="followup-filter ${k==="all"?"active":""}" data-filter="${k}">${v}</button>`).join("");
  filters.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
    activeFilter=b.dataset.filter;
    filters.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));
    renderFollowups();
  }));
  byId("followupSearch").addEventListener("input",e=>{followupSearch=normText(e.target.value);renderFollowups()});

  function qualifies(x){
    if(activeFilter==="contacted") return x.contactedToday;
    if(!x.reasons.length) return false;
    if(activeFilter==="inactive60") return x.inactiveDays>=60;
    if(activeFilter==="inactive30") return x.inactiveDays>=30;
    if(activeFilter==="care") return x.reasons.some(r=>r.kind==="care");
    return true;
  }

  function renderFollowups(){
    const data=buildFollowups();
    const actionable=data.filter(x=>x.reasons.length);
    byId("fu30").textContent=actionable.filter(x=>x.inactiveDays>=30).length;
    byId("fu60").textContent=actionable.filter(x=>x.inactiveDays>=60).length;
    byId("fuCare").textContent=actionable.filter(x=>x.reasons.some(r=>r.kind==="care")).length;
    byId("fuDone").textContent=data.filter(x=>x.contactedToday).length;

    let list=data.filter(qualifies);
    if(followupSearch){
      list=list.filter(x=>normText([x.musteriAdi,x.telefon,x.plaka,x.arac,x.lastService].join(" ")).includes(followupSearch));
    }
    list.sort((a,b)=>{
      if(a.contactedToday!==b.contactedToday) return a.contactedToday?1:-1;
      return b.priority-a.priority || b.inactiveDays-a.inactiveDays || String(b.lastDate).localeCompare(String(a.lastDate));
    });

    const box=byId("followupList");
    if(!list.length){
      box.innerHTML='<div class="empty">Bu filtrede takip önerisi yok.</div>';
      return;
    }
    box.innerHTML=list.slice(0,120).map(x=>{
      const who=esc2(x.musteriAdi||x.plaka||"Müşteri");
      const plate=esc2(x.plaka||"Plaka yok");
      const car=x.arac?` · ${esc2(x.arac)}`:"";
      const phone=x.telefon?` · ${esc2(x.telefon)}`:"";
      const total=money(x.totalSpend||0);
      const pr=x.priority>=4?" priority-high":x.priority>=3?" priority-mid":"";
      const reasonTags=x.reasons.map(r=>`<span class="followup-tag ${r.tone}">${esc2(r.label)}</span>`).join("");
      const done=x.contactedToday?`<span class="followup-tag done">Bugün takip edildi</span>`:"";
      return `<div class="followup-card${pr}">
        <div class="followup-head">
          <div>
            <h3>${who}</h3>
            <p>${plate}${car}${phone}</p>
            <p>Son geliş: <b>${dateTR(x.lastDate)}</b> · Son işlem: <b>${esc2(x.lastService)}</b> · Toplam: <b>${total}</b></p>
          </div>
          ${x.inactiveDays>=60?'<span class="badge bad">Takip öneriliyor</span>':x.reasons.length?'<span class="badge warn">Takip öneriliyor</span>':'<span class="badge">Takip edildi</span>'}
        </div>
        <div class="followup-tags">${reasonTags}${done}</div>
        <div class="followup-actions">
          <button class="secondary" type="button" onclick="followupOpenHistory('${esc2(String(x.plaka||x.telefon||x.musteriAdi).replace(/'/g,""))}')">Geçmişi Aç</button>
          ${!x.contactedToday?`<button class="primary" type="button" onclick="followupMarkDone('${esc2(contactKey(x).replace(/'/g,""))}')">Takip Yapıldı</button>`:`<button class="secondary" type="button" onclick="followupUndo('${esc2(contactKey(x).replace(/'/g,""))}')">Geri Al</button>`}
        </div>
      </div>`;
    }).join("");
  }

  window.followupMarkDone=function(key){
    if(!key) return;
    const map=contactedMap();
    map[key]=typeof today==="function"?today():new Date().toISOString().slice(0,10);
    settings.followupContacts=map;
    if(typeof save==="function") save();
    renderFollowups();
    if(typeof toast==="function") toast("Müşteri takip edildi olarak işaretlendi");
  };
  window.followupUndo=function(key){
    const map=contactedMap();
    delete map[key];
    settings.followupContacts=map;
    if(typeof save==="function") save();
    renderFollowups();
    if(typeof toast==="function") toast("Takip işareti geri alındı");
  };
  window.followupOpenHistory=function(q){
    if(typeof filterCustomer==="function") filterCustomer(q);
  };

  const baseRenderTracking=window.renderTracking;
  if(typeof baseRenderTracking==="function"){
    window.renderTracking=function(){
      baseRenderTracking();
      renderFollowups();
    };
  }

  document.querySelectorAll('.navbtn[data-page="trackingPage"]').forEach(b=>b.addEventListener("click",()=>setTimeout(renderFollowups,0)));
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible" && trackingPage.classList.contains("active"))renderFollowups()});
  window.addEventListener("focus",()=>{if(trackingPage.classList.contains("active"))renderFollowups()});

  renderFollowups();
})();
