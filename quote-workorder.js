/* RUVA V23 - Teklif / Is Emri Modulu */
(() => {
  if (window.__ruvaQuoteWorkOrderV23) return;
  window.__ruvaQuoteWorkOrderV23 = true;

  const TYPE_QUOTE = "quote";
  const TYPE_WORK = "workorder";
  const STATUS = {
    quote: ["Taslak", "Gönderildi", "Onaylandı", "Reddedildi", "İptal"],
    workorder: ["Açık", "Tamamlandı", "İptal"]
  };

  let editId = "";
  let activeFilter = "all";
  let searchText = "";

  const byId = id => document.getElementById(id);
  const getToday = () => typeof today === "function" ? today() : new Date().toISOString().slice(0,10);

  function escapeHtml(v){
    if (typeof esc === "function") return esc(v);
    return String(v ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
    })[c]);
  }
  function norm(v){
    return String(v ?? "").toLocaleLowerCase("tr-TR").replace(/\s+/g," ").trim();
  }
  function num(v){
    if (typeof parseMoney === "function") return Math.max(0, parseMoney(v));
    const n = Number(String(v ?? "").replace(/[^\d,.-]/g,"").replace(/\./g,"").replace(",","."));
    return Number.isFinite(n) ? Math.max(0,n) : 0;
  }
  function money(v){
    if (typeof fmt === "function") return fmt(Number(v||0));
    return "₺" + Math.round(Number(v||0)).toLocaleString("tr-TR");
  }
  function dateTR(v){
    if (typeof trDate === "function") return trDate(v);
    const p=String(v||"").split("-");
    return p.length===3 ? `${p[2]}.${p[1]}.${p[0]}` : String(v||"");
  }
  function titleCaseTR(v){
    return String(v ?? "").trim().replace(/\s+/g," ").split(" ").map(word=>{
      if(!word) return "";
      if(/^[A-ZÇĞİÖŞÜ0-9&+\-/]{2,}$/.test(word)) return word;
      return word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1).toLocaleLowerCase("tr-TR");
    }).join(" ");
  }
  function phoneTR(v){
    let digits=String(v ?? "").replace(/\D/g,"");
    if(digits.startsWith("90") && digits.length===12) digits=digits.slice(2);
    if(digits.length===10 && digits.startsWith("5")) digits="0"+digits;
    if(digits.length===11 && digits.startsWith("0")){
      return `${digits.slice(0,4)} ${digits.slice(4,7)} ${digits.slice(7,9)} ${digits.slice(9,11)}`;
    }
    return String(v ?? "").trim();
  }
  function uid2(){
    return typeof uid === "function" ? uid() : (crypto?.randomUUID?.() || String(Date.now())+Math.random().toString(16).slice(2));
  }
  function docs(){
    if (!settings || typeof settings !== "object") return [];
    if (!Array.isArray(settings.quoteWorkOrders)) settings.quoteWorkOrders = [];
    return settings.quoteWorkOrders;
  }
  function setDocs(list){
    settings.quoteWorkOrders = list;
    if (typeof save === "function") save();
  }
  function totalOf(d){
    const subtotal=(d.items||[]).reduce((s,x)=>s+Math.max(0,Number(x.qty||0))*Math.max(0,Number(x.price||0)),0);
    const discount=Math.min(subtotal,Math.max(0,Number(d.discount||0)));
    return {subtotal,discount,total:Math.max(0,subtotal-discount)};
  }
  function numberFor(type){
    const year=String(getToday()).slice(0,4);
    const prefix=type===TYPE_WORK ? "İE" : "TEK";
    let max=0;
    docs().forEach(d=>{
      const m=String(d.number||"").match(new RegExp("^"+prefix+"-"+year+"-(\\d+)$"));
      if(m) max=Math.max(max,Number(m[1]||0));
    });
    return `${prefix}-${year}-${String(max+1).padStart(3,"0")}`;
  }
  function statusOptions(type, current=""){
    const list=STATUS[type]||STATUS.quote;
    const value=list.includes(current)?current:list[0];
    return list.map(x=>`<option value="${escapeHtml(x)}" ${x===value?"selected":""}>${escapeHtml(x)}</option>`).join("");
  }
  function typeLabel(t){ return t===TYPE_WORK ? "İş Emri" : "Teklif"; }
  function statusClass(s){
    if(["Onaylandı","Tamamlandı"].includes(s)) return "good";
    if(["Reddedildi","İptal"].includes(s)) return "bad";
    if(["Gönderildi","Açık"].includes(s)) return "warn";
    return "";
  }

  const style=document.createElement("style");
  style.textContent=`
    .qw-btn{border-color:rgba(185,135,57,.55)!important;background:linear-gradient(135deg,rgba(185,135,57,.10),var(--soft))!important}
    .qw-section-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin:16px 2px 9px}
    .qw-section-head h2{font-size:15px;margin:0}.qw-section-head span{color:var(--muted);font-size:11px}
    .qw-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
    .qw-metric{padding:10px 11px;border:1px solid var(--line);border-radius:12px;background:var(--soft)}
    .qw-metric small{display:block;font-size:9px;color:var(--muted);font-weight:850;margin-bottom:4px}.qw-metric b{font-size:17px}
    .qw-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px}
    .qw-filters{display:flex;gap:6px;flex-wrap:wrap}
    .qw-filter{height:34px;padding:0 10px;font-size:10px;background:var(--soft);color:var(--text);border:1px solid var(--line)}
    .qw-filter.active{background:var(--nav);color:#fff;border-color:var(--nav)}
    .qw-search{height:36px;max-width:300px}
    .qw-list{display:grid;gap:8px}
    .qw-card{padding:12px;background:var(--soft);border:1px solid var(--line);border-radius:14px}
    .qw-card-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
    .qw-card h3{font-size:13px;margin:0 0 3px}.qw-card p{font-size:10px;color:var(--muted);margin:2px 0;line-height:1.45}
    .qw-meta{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}
    .qw-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;margin-top:9px}
    .qw-actions button{height:31px;padding:0 9px;font-size:10px;border-radius:9px}
    .qw-overlay{position:fixed;inset:0;background:rgba(2,6,23,.68);backdrop-filter:blur(7px);z-index:80;display:none;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto}
    .qw-overlay.show{display:flex}
    .qw-modal{width:min(980px,100%);background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.28);padding:14px;margin:auto}
    .qw-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px}
    .qw-modal-head h2{font-size:16px;margin:0}.qw-modal-head p{font-size:10px;color:var(--muted);margin:4px 0 0}
    .qw-modal-head button{height:34px;font-size:10px}
    .qw-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
    .qw-grid .span2{grid-column:span 2}.qw-grid .wide{grid-column:1/-1}
    .qw-items{border:1px solid var(--line);border-radius:14px;background:var(--soft);padding:10px}
    .qw-items-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}
    .qw-items-head strong{font-size:11px}.qw-items-head button{height:32px;font-size:10px}
    .qw-line{display:grid;grid-template-columns:minmax(0,1fr) 85px 130px 115px 40px;gap:7px;align-items:end;margin-top:7px}
    .qw-line input{height:40px}.qw-line .qw-line-total{height:40px;display:flex;align-items:center;justify-content:flex-end;padding:0 10px;border:1px solid var(--line);border-radius:11px;background:var(--card);font-size:11px;font-weight:850}
    .qw-remove{height:40px!important;width:40px;padding:0!important;font-size:18px!important;border-radius:10px!important}
    .qw-totals{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:9px}
    .qw-total-box{padding:10px 11px;border:1px solid var(--line);border-radius:12px;background:var(--card)}
    .qw-total-box small{display:block;font-size:9px;color:var(--muted);font-weight:850;margin-bottom:4px}.qw-total-box b{font-size:15px}
    .qw-modal-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end;margin-top:12px}
    .qw-modal-actions button{height:39px;font-size:10px}
    .qw-helper{font-size:9px;color:var(--muted);line-height:1.45;margin-top:5px}
    @media(max-width:800px){.qw-summary{grid-template-columns:1fr 1fr}.qw-grid{grid-template-columns:1fr 1fr}.qw-line{grid-template-columns:1fr 70px 105px 105px 40px}}
    @media(max-width:560px){.qw-overlay{padding:8px}.qw-modal{padding:11px;border-radius:16px}.qw-grid{grid-template-columns:1fr}.qw-grid .span2,.qw-grid .wide{grid-column:auto}.qw-line{grid-template-columns:1fr 70px 1fr 40px}.qw-line .qw-line-total{grid-column:3/4}.qw-line .qw-remove{grid-column:4/5}.qw-totals{grid-template-columns:1fr}.qw-search{max-width:none;width:100%}.qw-toolbar{align-items:stretch}.qw-filters{width:100%}.qw-filter{flex:1}.qw-modal-actions button{flex:1}}
  `;
  document.head.appendChild(style);

  const quickTools=document.querySelector(".quick-tools");
  if(quickTools && !byId("quoteWorkOrderBtn")){
    const b=document.createElement("button");
    b.type="button";
    b.id="quoteWorkOrderBtn";
    b.className="secondary qw-btn";
    b.textContent="Teklif / İş Emri";
    const expense=byId("expenseOnlyBtn");
    quickTools.insertBefore(b, expense || null);
  }

  const recordsPage=byId("recordsPage");
  if(!recordsPage) return;
  const recordsCard=recordsPage.querySelector(".card");

  const sectionHead=document.createElement("div");
  sectionHead.className="qw-section-head";
  sectionHead.innerHTML='<h2>Teklif & İş Emirleri</h2><span>Kaydet · dönüştür · yazdır</span>';

  const section=document.createElement("div");
  section.className="card";
  section.id="quoteWorkOrderSection";
  section.innerHTML=`
    <div class="qw-summary">
      <div class="qw-metric"><small>AÇIK TEKLİF</small><b id="qwOpenQuotes">0</b></div>
      <div class="qw-metric"><small>ONAYLI TEKLİF</small><b id="qwApprovedQuotes">0</b></div>
      <div class="qw-metric"><small>AÇIK İŞ EMRİ</small><b id="qwOpenWorks">0</b></div>
      <div class="qw-metric"><small>AKTİF TUTAR</small><b id="qwActiveValue">₺0</b></div>
    </div>
    <div class="qw-toolbar">
      <div class="qw-filters" id="qwFilters">
        <button class="qw-filter active" data-filter="all" type="button">Tümü</button>
        <button class="qw-filter" data-filter="quote" type="button">Teklifler</button>
        <button class="qw-filter" data-filter="workorder" type="button">İş Emirleri</button>
        <button class="qw-filter" data-filter="active" type="button">Aktif</button>
      </div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <input class="qw-search" id="qwSearch" placeholder="No, plaka, müşteri veya araç ara…">
        <button class="primary" type="button" id="qwNewBtn">+ Yeni Teklif</button>
      </div>
    </div>
    <div class="qw-list" id="qwList"></div>
  `;
  if(recordsCard){
    recordsCard.insertAdjacentElement("afterend", section);
    recordsCard.insertAdjacentElement("afterend", sectionHead);
  }else{
    recordsPage.append(sectionHead,section);
  }

  const overlay=document.createElement("div");
  overlay.className="qw-overlay";
  overlay.id="qwOverlay";
  overlay.innerHTML=`
    <div class="qw-modal" role="dialog" aria-modal="true" aria-label="Teklif veya iş emri">
      <div class="qw-modal-head">
        <div><h2 id="qwModalTitle">Yeni Teklif</h2><p id="qwModalSub">Müşteri ve hizmet bilgilerini gir.</p></div>
        <button class="secondary" type="button" id="qwClose">Kapat</button>
      </div>
      <div class="qw-grid">
        <div><label>BELGE TÜRÜ</label><select id="qwType"><option value="quote">Teklif</option><option value="workorder">İş Emri</option></select></div>
        <div><label>BELGE NO</label><input id="qwNumber" readonly></div>
        <div><label>TARİH</label><input id="qwDate" type="date"></div>
        <div><label>DURUM</label><select id="qwStatus"></select></div>

        <div class="span2"><label>MÜŞTERİ ADI</label><input id="qwCustomer" placeholder="Müşteri adı"></div>
        <div><label>TELEFON</label><input id="qwPhone" placeholder="05xx..."></div>
        <div><label>PLAKA</label><input id="qwPlate" placeholder="20 ABC 123" autocomplete="off"></div>

        <div class="span2"><label>ARAÇ</label><input id="qwVehicle" placeholder="Marka / model"></div>
        <div id="qwValidityWrap"><label>TEKLİF GEÇERLİLİK</label><select id="qwValidity"><option value="3">3 gün</option><option value="7" selected>7 gün</option><option value="14">14 gün</option><option value="30">30 gün</option></select></div>
        <div><label>TAHMİNİ TESLİM</label><div style="display:grid;grid-template-columns:1.2fr .8fr;gap:6px"><input id="qwDeliveryDate" type="date"><input id="qwDeliveryTime" type="time"></div></div>

        <div class="wide qw-items">
          <div class="qw-items-head"><strong>HİZMET / İŞ KALEMLERİ</strong><button class="secondary" type="button" id="qwAddLine">+ Kalem Ekle</button></div>
          <div id="qwLines"></div>
          <div class="qw-totals">
            <div class="qw-total-box"><small>ARA TOPLAM</small><b id="qwSubtotal">₺0</b></div>
            <div class="qw-total-box"><small>İNDİRİM</small><input id="qwDiscount" inputmode="decimal" placeholder="₺0" style="height:35px;margin-top:2px"></div>
            <div class="qw-total-box"><small>GENEL TOPLAM</small><b id="qwGrandTotal">₺0</b></div>
          </div>
        </div>

        <div class="wide"><label>NOT / AÇIKLAMA</label><textarea id="qwNote" placeholder="İşlem kapsamı, müşteri talebi, özel şartlar..."></textarea></div>
        <div class="wide"><label>ŞARTLAR / HATIRLATMA</label><textarea id="qwTerms" placeholder="Örn. Teklif belirtilen süre boyunca geçerlidir. Ek işlemler müşteri onayıyla fiyatlandırılır."></textarea><div class="qw-helper">Vergi / fatura ifadesi otomatik eklenmez; ihtiyacına göre buraya kendin yazabilirsin.</div></div>
      </div>
      <div class="qw-modal-actions">
        <button class="secondary" type="button" id="qwPrintCurrent">Yazdır / PDF</button>
        <button class="primary" type="button" id="qwSave">Kaydet</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  function blankDoc(type=TYPE_QUOTE){
    return {
      id:"",type,number:numberFor(type),date:getToday(),status:(STATUS[type]||STATUS.quote)[0],
      customer:"",phone:"",plate:"",vehicle:"",
      validityDays:type===TYPE_QUOTE?7:null,
      deliveryDate:"",deliveryTime:"",
      items:[{id:uid2(),description:"",qty:1,price:0}],
      discount:0,note:"",
      terms:type===TYPE_QUOTE
        ? "Teklif belirtilen süre boyunca geçerlidir. Ek işlemler müşteri onayıyla ayrıca fiyatlandırılır."
        : "İş emrinde yer almayan ek işlemler müşteri onayı alınarak uygulanır.",
      createdAt:Date.now(),updatedAt:Date.now()
    };
  }

  function currentDraft(){
    const type=byId("qwType").value;
    const items=[...byId("qwLines").querySelectorAll(".qw-line")].map(row=>({
      id:row.dataset.id || uid2(),
      description:titleCaseTR(row.querySelector(".qw-desc").value),
      qty:Math.max(0.01,Number(row.querySelector(".qw-qty").value||1)),
      price:num(row.querySelector(".qw-price").value)
    })).filter(x=>x.description || x.price>0);
    return {
      id:editId || "",
      type,
      number:byId("qwNumber").value.trim() || numberFor(type),
      date:byId("qwDate").value || getToday(),
      status:byId("qwStatus").value || (STATUS[type]||[])[0],
      customer:titleCaseTR(byId("qwCustomer").value),
      phone:phoneTR(byId("qwPhone").value),
      plate:typeof normPlate==="function"?normPlate(byId("qwPlate").value):byId("qwPlate").value.trim().toUpperCase(),
      vehicle:byId("qwVehicle").value.trim(),
      validityDays:type===TYPE_QUOTE?Math.max(1,Number(byId("qwValidity").value||7)):null,
      deliveryDate:byId("qwDeliveryDate").value || "",
      deliveryTime:byId("qwDeliveryTime").value || "",
      items:items.length?items:[{id:uid2(),description:"",qty:1,price:0}],
      discount:num(byId("qwDiscount").value),
      note:byId("qwNote").value.trim(),
      terms:byId("qwTerms").value.trim(),
      updatedAt:Date.now()
    };
  }

  function setTypeUi(type, preserveNumber=false){
    const currentStatus=byId("qwStatus").value;
    byId("qwStatus").innerHTML=statusOptions(type,currentStatus);
    byId("qwValidityWrap").style.display=type===TYPE_QUOTE?"block":"none";
    if(!preserveNumber && !editId) byId("qwNumber").value=numberFor(type);
    byId("qwModalTitle").textContent=(editId?"Düzenle · ":"Yeni ")+typeLabel(type);
    byId("qwModalSub").textContent=type===TYPE_QUOTE?"Fiyat teklifi oluştur, kaydet ve yazdır.":"Onaylanan işi iş emri olarak kaydet ve yazdır.";
  }

  function addLine(item={id:uid2(),description:"",qty:1,price:0}){
    const row=document.createElement("div");
    row.className="qw-line";
    row.dataset.id=item.id||uid2();
    row.innerHTML=`
      <div><label>HİZMET / AÇIKLAMA</label><input class="qw-desc" placeholder="Örn. Boya düzeltme + seramik kaplama" value="${escapeHtml(item.description||"")}"></div>
      <div><label>ADET</label><input class="qw-qty" type="number" min="0.01" step="0.01" value="${Number(item.qty||1)}"></div>
      <div><label>BİRİM FİYAT</label><input class="qw-price" inputmode="decimal" placeholder="₺0" value="${Number(item.price||0)?Number(item.price).toLocaleString("tr-TR"):""}"></div>
      <div><label>TUTAR</label><div class="qw-line-total">₺0</div></div>
      <button class="danger qw-remove" type="button" title="Kalemi sil">×</button>
    `;
    row.querySelector(".qw-remove").addEventListener("click",()=>{row.remove();if(!byId("qwLines").children.length)addLine();recalc()});
    row.querySelectorAll("input").forEach(x=>x.addEventListener("input",recalc));
    row.querySelector(".qw-desc").addEventListener("blur",e=>{e.target.value=titleCaseTR(e.target.value);});
    byId("qwLines").appendChild(row);
    recalc();
  }

  function recalc(){
    let subtotal=0;
    byId("qwLines").querySelectorAll(".qw-line").forEach(row=>{
      const qty=Math.max(0,Number(row.querySelector(".qw-qty").value||0));
      const price=num(row.querySelector(".qw-price").value);
      const line=qty*price;
      subtotal+=line;
      row.querySelector(".qw-line-total").textContent=money(line);
    });
    const discount=Math.min(subtotal,num(byId("qwDiscount").value));
    byId("qwSubtotal").textContent=money(subtotal);
    byId("qwGrandTotal").textContent=money(Math.max(0,subtotal-discount));
  }

  function prefillFromEntry(){
    const plate=byId("plaka")?.value||"";
    const customer=byId("musteriAdi")?.value||"";
    const phone=byId("telefon")?.value||"";
    const vehicle=byId("arac")?.value||"";
    if(customer)byId("qwCustomer").value=customer;
    if(phone)byId("qwPhone").value=phone;
    if(plate)byId("qwPlate").value=plate;
    if(vehicle)byId("qwVehicle").value=vehicle;
  }

  function loadDoc(d){
    editId=d?.id||"";
    const type=d?.type===TYPE_WORK?TYPE_WORK:TYPE_QUOTE;
    byId("qwType").value=type;
    byId("qwNumber").value=d?.number||numberFor(type);
    byId("qwDate").value=d?.date||getToday();
    byId("qwStatus").innerHTML=statusOptions(type,d?.status||"");
    byId("qwCustomer").value=d?.customer||"";
    byId("qwPhone").value=d?.phone||"";
    byId("qwPlate").value=d?.plate||"";
    byId("qwVehicle").value=d?.vehicle||"";
    byId("qwValidity").value=String(d?.validityDays||7);
    byId("qwDeliveryDate").value=d?.deliveryDate||"";
    byId("qwDeliveryTime").value=d?.deliveryTime||"";
    byId("qwDiscount").value=Number(d?.discount||0)?Number(d.discount).toLocaleString("tr-TR"):"";
    byId("qwNote").value=d?.note||"";
    byId("qwTerms").value=d?.terms||"";
    byId("qwLines").innerHTML="";
    (Array.isArray(d?.items)&&d.items.length?d.items:[{id:uid2(),description:"",qty:1,price:0}]).forEach(addLine);
    setTypeUi(type,true);
    recalc();
  }

  function openNew(type=TYPE_QUOTE){
    editId="";
    const d=blankDoc(type);
    loadDoc(d);
    editId="";
    byId("qwNumber").value=numberFor(type);
    prefillFromEntry();
    overlay.classList.add("show");
    setTimeout(()=>byId("qwCustomer")?.focus(),60);
  }
  function openEdit(id){
    const d=docs().find(x=>String(x.id)===String(id));
    if(!d)return;
    loadDoc(d);
    overlay.classList.add("show");
  }
  function closeModal(){overlay.classList.remove("show");editId="";}

  function saveCurrent(){
    const d=currentDraft();
    const t=totalOf(d);
    if(!d.customer && !d.plate) return alert("Müşteri adı veya plaka gir.");
    if(!(d.items||[]).some(x=>x.description)) return alert("En az bir hizmet / iş kalemi gir.");
    const list=[...docs()];
    const now=Date.now();
    if(editId){
      const i=list.findIndex(x=>String(x.id)===String(editId));
      if(i<0)return;
      d.id=editId;
      d.createdAt=list[i].createdAt||now;
      d.updatedAt=now;
      d.sourceQuoteId=list[i].sourceQuoteId||"";
      d.convertedWorkOrderId=list[i].convertedWorkOrderId||"";
      list[i]=d;
    }else{
      d.id=uid2(); d.createdAt=now; d.updatedAt=now;
      list.push(d);
    }
    setDocs(list);
    editId=d.id;
    byId("qwNumber").value=d.number;
    renderDocs();
    if(typeof toast==="function")toast(`${typeLabel(d.type)} kaydedildi · ${money(t.total)}`);
  }

  function deleteDoc(id){
    const d=docs().find(x=>String(x.id)===String(id));
    if(!d)return;
    if(!confirm(`${d.number} numaralı ${typeLabel(d.type).toLocaleLowerCase("tr-TR")} silinsin mi?`))return;
    setDocs(docs().filter(x=>String(x.id)!==String(id)));
    renderDocs();
    if(typeof toast==="function")toast("Belge silindi");
  }

  function convertToWork(id){
    const list=[...docs()];
    const i=list.findIndex(x=>String(x.id)===String(id));
    if(i<0)return;
    const q=list[i];
    if(q.type!==TYPE_QUOTE)return;
    if(q.convertedWorkOrderId){
      const existing=list.find(x=>String(x.id)===String(q.convertedWorkOrderId));
      if(existing){openEdit(existing.id);return;}
    }
    if(!confirm(`${q.number} teklifini iş emrine dönüştürelim mi?`))return;
    const now=Date.now();
    const w={
      ...q,
      id:uid2(),
      type:TYPE_WORK,
      number:numberFor(TYPE_WORK),
      status:"Açık",
      validityDays:null,
      sourceQuoteId:q.id,
      convertedWorkOrderId:"",
      createdAt:now,
      updatedAt:now
    };
    q.status="Onaylandı";
    q.convertedWorkOrderId=w.id;
    q.updatedAt=now;
    list[i]=q;
    list.push(w);
    setDocs(list);
    renderDocs();
    openEdit(w.id);
    if(typeof toast==="function")toast(`${w.number} iş emri oluşturuldu`);
  }

  function printHtml(d){
    const calc=totalOf(d);
    const title=typeLabel(d.type).toLocaleUpperCase("tr-TR");
    const delivery=d.deliveryDate ? `${dateTR(d.deliveryDate)}${d.deliveryTime?" · "+d.deliveryTime:""}` : "—";
    const validity=d.type===TYPE_QUOTE ? `${Number(d.validityDays||7)} gün` : "—";
    const customer=titleCaseTR(d.customer||"");
    const phone=phoneTR(d.phone||"");
    const status=String(d.status||"").trim();
    const statusText=status && status!=="Taslak" ? ` · ${escapeHtml(status)}` : "";
    const items=(d.items||[]).map((x,i)=>`
      <tr>
        <td>${i+1}</td>
        <td>${escapeHtml(titleCaseTR(x.description||""))}</td>
        <td class="r">${Number(x.qty||0).toLocaleString("tr-TR")}</td>
        <td class="r">${money(x.price||0)}</td>
        <td class="r b">${money(Number(x.qty||0)*Number(x.price||0))}</td>
      </tr>
    `).join("");
    return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(d.number)} · ${title}</title><style>
      @page{size:A4;margin:0}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;background:#fff}
      body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#111827;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .sheet{width:210mm;min-height:297mm;margin:0 auto;padding:14mm 16mm 13mm;background:#fff}
      .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111827;padding-bottom:13px;margin-bottom:17px}
      .brandwrap{display:flex;align-items:center;gap:11px}
      .monogram{width:43px;height:43px;border:1.7px solid #b98739;border-radius:13px;display:grid;place-items:center;font-family:Georgia,"Times New Roman",serif;font-size:22px;font-weight:700;color:#9a7136;letter-spacing:.5px}
      .brand{font-size:22px;font-weight:900;letter-spacing:.1px;line-height:1.05}
      .sub{font-size:10.5px;color:#64748b;margin-top:5px}
      .doc{text-align:right}.doc h1{font-size:18px;margin:0 0 5px}.doc b{font-size:13px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px;margin-bottom:15px}
      .field{border-bottom:1px solid #e5e7eb;padding:6px 0;min-height:43px}
      .field small{display:block;color:#64748b;font-size:9px;font-weight:750;margin-bottom:3px;letter-spacing:.15px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th{background:#f3f4f6;text-align:left;font-size:10px;padding:8px;border:1px solid #e5e7eb}
      td{padding:8px;border:1px solid #e5e7eb;vertical-align:top}
      .r{text-align:right}.b{font-weight:750}
      .totals{width:310px;margin:12px 0 16px auto}
      .tr{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #e5e7eb}
      .discount{margin-top:2px;padding:7px 9px;background:#fffbeb;border:1px solid #fde68a;border-radius:7px;color:#92400e;font-weight:800}
      .grand{font-size:15px;font-weight:900;border-bottom:2px solid #111827;padding-top:9px}
      .box{border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-top:10px;white-space:pre-wrap;line-height:1.5}
      .box small{display:block;color:#64748b;font-size:9px;font-weight:700;margin-bottom:5px}
      .sign{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:40px}
      .sign div{border-top:1px solid #111827;padding-top:6px;text-align:center;font-size:10px;color:#475569}
      @media print{
        html,body{width:210mm;min-height:297mm}
        .sheet{margin:0;padding:14mm 16mm 13mm}
      }
    </style></head><body><main class="sheet">
      <div class="head">
        <div class="brandwrap">
          <div class="monogram">R</div>
          <div><div class="brand">RUVA Detailing</div><div class="sub">Profesyonel araç bakım ve detailing hizmetleri</div></div>
        </div>
        <div class="doc"><h1>${title}</h1><b>${escapeHtml(d.number)}</b><div class="sub">${dateTR(d.date)}${statusText}</div></div>
      </div>
      <div class="grid">
        <div class="field"><small>MÜŞTERİ</small><b>${escapeHtml(customer||"—")}</b></div>
        <div class="field"><small>TELEFON</small>${escapeHtml(phone||"—")}</div>
        <div class="field"><small>PLAKA</small><b>${escapeHtml(d.plate||"—")}</b></div>
        <div class="field"><small>ARAÇ</small>${escapeHtml(d.vehicle||"—")}</div>
        <div class="field"><small>TAHMİNİ TESLİM</small>${escapeHtml(delivery)}</div>
        <div class="field"><small>${d.type===TYPE_QUOTE?"TEKLİF GEÇERLİLİĞİ":"KAYNAK TEKLİF"}</small>${d.type===TYPE_QUOTE?escapeHtml(validity):escapeHtml((docs().find(x=>x.id===d.sourceQuoteId)?.number)||"—")}</div>
      </div>
      <table><thead><tr><th style="width:34px">#</th><th>Hizmet / İş Kalemi</th><th class="r" style="width:65px">Adet</th><th class="r" style="width:105px">Birim</th><th class="r" style="width:110px">Tutar</th></tr></thead><tbody>${items}</tbody></table>
      <div class="totals">
        <div class="tr"><span>Ara Toplam</span><b>${money(calc.subtotal)}</b></div>
        ${calc.discount>0?`<div class="tr discount"><span>İndirim</span><b>− ${money(calc.discount)}</b></div>`:""}
        <div class="tr grand"><span>Genel Toplam</span><span>${money(calc.total)}</span></div>
      </div>
      ${d.note?`<div class="box"><small>NOT / AÇIKLAMA</small>${escapeHtml(d.note)}</div>`:""}
      ${d.terms?`<div class="box"><small>ŞARTLAR / HATIRLATMA</small>${escapeHtml(d.terms)}</div>`:""}
      <div class="sign"><div>Yetkili / Kaşe</div><div>${d.type===TYPE_WORK?"Müşteri Onayı / İmza":"Teklif Onayı / İmza"}</div></div>
      <script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script>
    </main></body></html>`;
  }

  function printDoc(d){
    if(!d)return;
    const w=window.open("","_blank","width=900,height=1000");
    if(!w)return alert("Yazdırma penceresi engellendi. Tarayıcıda açılır pencereye izin ver.");
    w.document.open();w.document.write(printHtml(d));w.document.close();
  }

  function renderDocs(){
    const list=docs();
    const activeQuotes=list.filter(d=>d.type===TYPE_QUOTE && !["Reddedildi","İptal"].includes(d.status));
    const approved=list.filter(d=>d.type===TYPE_QUOTE && d.status==="Onaylandı");
    const openWorks=list.filter(d=>d.type===TYPE_WORK && d.status==="Açık");
    const activeValue=[...activeQuotes,...openWorks].reduce((s,d)=>s+totalOf(d).total,0);
    byId("qwOpenQuotes").textContent=activeQuotes.length;
    byId("qwApprovedQuotes").textContent=approved.length;
    byId("qwOpenWorks").textContent=openWorks.length;
    byId("qwActiveValue").textContent=money(activeValue);

    let filtered=[...list];
    if(activeFilter===TYPE_QUOTE)filtered=filtered.filter(d=>d.type===TYPE_QUOTE);
    else if(activeFilter===TYPE_WORK)filtered=filtered.filter(d=>d.type===TYPE_WORK);
    else if(activeFilter==="active")filtered=filtered.filter(d=>
      (d.type===TYPE_QUOTE && !["Reddedildi","İptal"].includes(d.status)) ||
      (d.type===TYPE_WORK && d.status==="Açık")
    );
    if(searchText)filtered=filtered.filter(d=>norm([d.number,d.customer,d.phone,d.plate,d.vehicle,d.status,(d.items||[]).map(x=>x.description).join(" ")].join(" ")).includes(searchText));
    filtered.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")) || Number(b.updatedAt||0)-Number(a.updatedAt||0));

    const box=byId("qwList");
    if(!filtered.length){box.innerHTML='<div class="empty">Henüz teklif veya iş emri yok.</div>';return;}
    box.innerHTML=filtered.slice(0,150).map(d=>{
      const t=totalOf(d);
      const converted=d.type===TYPE_QUOTE && d.convertedWorkOrderId ? docs().find(x=>x.id===d.convertedWorkOrderId) : null;
      return `<div class="qw-card">
        <div class="qw-card-head">
          <div><h3>${escapeHtml(d.number)} · ${typeLabel(d.type)}</h3><p>${dateTR(d.date)} · ${escapeHtml(d.customer||"Müşteri")} · <b>${escapeHtml(d.plate||"Plaka yok")}</b>${d.vehicle?" · "+escapeHtml(d.vehicle):""}</p><p>${(d.items||[]).slice(0,3).map(x=>escapeHtml(x.description)).join(" · ") || "İş kalemi yok"}</p></div>
          <div style="text-align:right"><span class="badge ${statusClass(d.status)}">${escapeHtml(d.status||"")}</span><div style="font-size:14px;font-weight:900;margin-top:6px">${money(t.total)}</div></div>
        </div>
        <div class="qw-meta">${d.deliveryDate?`<span class="badge">Teslim ${dateTR(d.deliveryDate)}${d.deliveryTime?" · "+escapeHtml(d.deliveryTime):""}</span>`:""}${converted?`<span class="badge good">${escapeHtml(converted.number)} oluşturuldu</span>`:""}${d.sourceQuoteId?`<span class="badge">Tekliften dönüştü</span>`:""}</div>
        <div class="qw-actions">
          <button class="secondary" type="button" onclick="qwEdit('${d.id}')">Düzenle</button>
          <button class="secondary" type="button" onclick="qwPrint('${d.id}')">Yazdır / PDF</button>
          ${d.type===TYPE_QUOTE&&!d.convertedWorkOrderId?`<button class="primary" type="button" onclick="qwConvert('${d.id}')">İş Emrine Dönüştür</button>`:""}
          <button class="danger" type="button" onclick="qwDelete('${d.id}')">Sil</button>
        </div>
      </div>`;
    }).join("");
  }

  window.qwEdit=openEdit;
  window.qwPrint=id=>printDoc(docs().find(x=>String(x.id)===String(id)));
  window.qwConvert=convertToWork;
  window.qwDelete=deleteDoc;

  byId("quoteWorkOrderBtn")?.addEventListener("click",()=>openNew(TYPE_QUOTE));
  byId("qwNewBtn").addEventListener("click",()=>openNew(TYPE_QUOTE));
  byId("qwClose").addEventListener("click",closeModal);
  overlay.addEventListener("click",e=>{if(e.target===overlay)closeModal()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&overlay.classList.contains("show"))closeModal()});
  byId("qwType").addEventListener("change",()=>{
    const type=byId("qwType").value;
    if(!editId)byId("qwNumber").value=numberFor(type);
    const currentTerms=byId("qwTerms").value.trim();
    if(!currentTerms || /Teklif belirtilen süre|İş emrinde yer almayan/.test(currentTerms)){
      byId("qwTerms").value=type===TYPE_QUOTE
        ?"Teklif belirtilen süre boyunca geçerlidir. Ek işlemler müşteri onayıyla ayrıca fiyatlandırılır."
        :"İş emrinde yer almayan ek işlemler müşteri onayı alınarak uygulanır.";
    }
    setTypeUi(type,true);
  });
  byId("qwAddLine").addEventListener("click",()=>addLine());
  byId("qwDiscount").addEventListener("input",recalc);
  byId("qwSave").addEventListener("click",saveCurrent);
  byId("qwPrintCurrent").addEventListener("click",()=>{
    const d=currentDraft();
    if(!(d.items||[]).some(x=>x.description))return alert("Yazdırmak için en az bir hizmet / iş kalemi gir.");
    printDoc(d);
  });
  byId("qwCustomer").addEventListener("blur",()=>{byId("qwCustomer").value=titleCaseTR(byId("qwCustomer").value);});
  byId("qwPhone").addEventListener("blur",()=>{byId("qwPhone").value=phoneTR(byId("qwPhone").value);});
  byId("qwPlate").addEventListener("blur",()=>{
    const p=typeof normPlate==="function"?normPlate(byId("qwPlate").value):byId("qwPlate").value.trim().toUpperCase();
    byId("qwPlate").value=p;
    if(!p || typeof latestCustomerByPlate!=="function")return;
    const r=latestCustomerByPlate(p);
    if(!r)return;
    if(!byId("qwCustomer").value)byId("qwCustomer").value=r.musteriAdi||"";
    if(!byId("qwPhone").value)byId("qwPhone").value=r.telefon||"";
    if(!byId("qwVehicle").value)byId("qwVehicle").value=r.arac||"";
  });

  byId("qwFilters").querySelectorAll(".qw-filter").forEach(btn=>btn.addEventListener("click",()=>{
    activeFilter=btn.dataset.filter||"all";
    byId("qwFilters").querySelectorAll(".qw-filter").forEach(x=>x.classList.toggle("active",x===btn));
    renderDocs();
  }));
  byId("qwSearch").addEventListener("input",e=>{searchText=norm(e.target.value);renderDocs()});

  document.querySelectorAll('.navbtn[data-page="recordsPage"]').forEach(b=>b.addEventListener("click",()=>setTimeout(renderDocs,0)));
  window.addEventListener("focus",()=>{if(recordsPage.classList.contains("active"))renderDocs()});

  const baseRenderAll=window.renderAll;
  if(typeof baseRenderAll==="function"){
    window.renderAll=function(){
      baseRenderAll();
      renderDocs();
    };
  }

  renderDocs();
})();