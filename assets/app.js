const state={listings:[],filtered:[],compareIds:new Set()};
const $=id=>document.getElementById(id);
const money=n=>n?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n):"Call";
const PROPERTY_ART="<div class=\"property-placeholder\" role=\"img\" aria-label=\"Illustrated River Valley homes, not a photograph of the listed rental\">\n<span class=\"property-placeholder-head\">R↗ / THE RIVER VALLEY RENTAL ATLAS</span>\n<svg viewBox=\"0 0 640 360\" preserveAspectRatio=\"xMidYMax slice\" aria-hidden=\"true\" focusable=\"false\">\n<path d=\"M0 240Q110 150 232 218T462 201T640 205V360H0Z\" fill=\"#91b9a1\"/>\n<path d=\"M0 265Q112 207 210 253T430 229T640 257V360H0Z\" fill=\"#4b8d75\"/>\n<path d=\"M0 318Q176 275 321 315T640 292V360H0Z\" fill=\"#25624d\"/>\n<path d=\"M123 220 233 134l112 86v130H123Z\" fill=\"#f6ead0\" stroke=\"#204b3d\" stroke-width=\"8\"/>\n<path d=\"m106 222 127-105 132 105\" fill=\"none\" stroke=\"#1a4a3a\" stroke-width=\"17\" stroke-linejoin=\"round\"/>\n<path d=\"M200 277h68v73h-68z\" fill=\"#517862\"/>\n<rect x=\"144\" y=\"242\" width=\"38\" height=\"38\" rx=\"4\" fill=\"#d9c18d\"/>\n<rect x=\"290\" y=\"242\" width=\"35\" height=\"38\" rx=\"4\" fill=\"#d9c18d\"/>\n<path d=\"M408 253 481 198l80 55v96H408Z\" fill=\"#e1d1ae\" stroke=\"#205141\" stroke-width=\"7\"/>\n<path d=\"m395 254 85-68 95 68\" fill=\"none\" stroke=\"#205141\" stroke-width=\"12\" stroke-linejoin=\"round\"/>\n<rect x=\"464\" y=\"280\" width=\"39\" height=\"69\" rx=\"2\" fill=\"#719982\"/>\n<path d=\"M82 338v-77m-25 34h51m-45-18h35M582 341v-92m-30 38h65m-57-20h48\" fill=\"none\" stroke=\"#164b3c\" stroke-width=\"12\" stroke-linecap=\"round\"/>\n</svg><span class=\"property-placeholder-foot\">Illustration / No verified property photo</span></div>";
const hasVerifiedPhoto=item=>Boolean(item.image_url)&&item.image_verified!==false;
function replaceFailedPhoto(img){
  const figure=img.closest("figure");
  const temp=document.createElement("div");
  temp.innerHTML=PROPERTY_ART;
  img.replaceWith(temp.firstElementChild);
  if(figure){
    const caption=figure.querySelector("figcaption");
    if(caption)caption.textContent="Image unavailable · illustrated local guide";
  }
}

const safe=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const ageLabel=item=>{
  if(!item.updated_at) return "Availability should be verified";
  const hours=Math.floor((Date.now()-new Date(item.updated_at))/36e5);
  if(hours<1)return"Source checked recently";
  if(hours<24)return`Source checked ${hours}h ago`;
  const days=Math.floor(hours/24);
  return`Source checked ${days}d ago`;
};
function card(item){
  const specs=[
    item.beds!=null?`${item.beds} bed${item.beds===1?"":"s"}`:null,
    item.baths!=null?`${item.baths} bath${item.baths===1?"":"s"}`:null,
    item.type||null
  ].filter(Boolean).map(s=>`<span>${safe(s)}</span>`).join("");
  const sms=`sms:+14799707301?&body=${encodeURIComponent("I'm interested in "+item.address+" listed on Russellville.Rent. Can you help me verify availability?")}`;
  const photoHTML=hasVerifiedPhoto(item)?`<img class="property-photo" src="${safe(item.image_url)}" alt="Listing-source photograph for ${safe(item.address)}" loading="lazy" decoding="async" width="640" height="400">`:PROPERTY_ART;
  return `<article class="card">
    <div class="property-art">${photoHTML}<span class="source-badge">${safe(item.source_name)}</span>${!hasVerifiedPhoto(item)?'<span class="photo-note">Illustration only</span>':''}</div>
    <div class="card-body">
      <div class="price">${money(item.rent)} <small>/ month</small></div>
      <div class="specs">${specs}</div>
      <h3 class="address">${safe(item.address)}</h3>
      <p class="location">Russellville, Arkansas ${safe(item.zip||"")}</p>
      <div class="manager">Listed by <strong>${safe(item.manager)}</strong><div class="freshness">${safe(ageLabel(item))}</div></div>
      <div class="card-actions">
        <a class="inquire" href="${sms}">Ask about rental</a>
        <a class="source-link" href="${safe(item.source_url)}" target="_blank" rel="noopener noreferrer">View source ↗</a>
      </div>
      <button type="button" class="compare-pick" data-compare-id="${safe(item.id)}" aria-controls="compareDesk" aria-pressed="${state.compareIds.has(String(item.id))}"><span>${state.compareIds.has(String(item.id))?"Pinned to compare":"Pin to compare"}</span><span aria-hidden="true">${state.compareIds.has(String(item.id))?"✓":"+"}</span></button>
    </div>
  </article>`;
}
function apply(){
  const q=$("q").value.toLowerCase().trim();
  const min=Number($("minRent").value)||0;
  const max=Number($("maxRent").value)||Infinity;
  const beds=Number($("beds").value)||0;
  const manager=$("manager").value;
  const type=$("type").value;
  let list=state.listings.filter(x=>{
    const hay=`${x.address} ${x.manager} ${x.type} ${x.zip}`.toLowerCase();
    return (!q||hay.includes(q)) &&
      (!x.rent||(x.rent>=min&&x.rent<=max)) &&
      (!beds||(x.beds!=null&&x.beds>=beds)) &&
      (!manager||x.manager===manager) &&
      (!type||x.type===type);
  });
  const sort=$("sort").value;
  if(sort==="rent-asc")list.sort((a,b)=>(a.rent??999999)-(b.rent??999999));
  if(sort==="rent-desc")list.sort((a,b)=>(b.rent??0)-(a.rent??0));
  if(sort==="beds")list.sort((a,b)=>(b.beds??0)-(a.beds??0));
  state.filtered=list;
  render();
  renderSearchSummary();
}

/* Public index price landscape: no availability or booking inference.
   Existing inclusive filter boundaries are reused exactly; published rent must be > 0. */
function renderRentLandscape(){
  const panel=$("rent-landscape");
  if(!panel)return;
  const priced=state.listings.map(item=>Number(item.rent)).filter(rent=>Number.isFinite(rent)&&rent>0);
  if(!priced.length){panel.hidden=true;return;}
  const bands={
    low:priced.filter(rent=>rent<=1000).length,
    mid:priced.filter(rent=>rent>=1000&&rent<=1500).length,
    high:priced.filter(rent=>rent>=1500).length
  };
  const ceiling=Math.max(1,...Object.values(bands));
  panel.querySelectorAll("[data-rent-band]").forEach(button=>{
    const count=bands[button.dataset.rentBand];
    button.querySelector(".rent-landscape-count").textContent=String(count);
    button.querySelector(".rent-landscape-bar-fill").style.width=(count/ceiling*100).toFixed(1)+"%";
    button.setAttribute("aria-label",button.querySelector(".rent-landscape-name").textContent.trim()+": "+count+" indexed rental"+(count===1?"":"s")+". Filter the listings.");
  });
  $("rent-landscape-total").textContent=priced.length+" indexed rental"+(priced.length===1?"":"s")+" with published rent";
  panel.hidden=false;
}

function render(){
  $("listings").innerHTML=state.filtered.map(card).join("");
  document.querySelectorAll(".property-photo").forEach(img=>img.addEventListener("error",()=>replaceFailedPhoto(img),{once:true}));
  $("empty").hidden=state.filtered.length!==0;
  $("resultCount").textContent=`${state.filtered.length} rental${state.filtered.length===1?"":"s"} shown`;
  const consoleMatch=$("consoleMatchCount");
  if(consoleMatch)consoleMatch.textContent=String(state.filtered.length);
  $("inventoryCount").textContent=state.listings.length;
  const managers=new Set(state.listings.map(x=>x.manager));
  $("managerCount").textContent=managers.size;
  renderRentLandscape();
  drawComparison();
}

/* Shareable, removable search criteria. The existing listing index is unchanged. */
const SEARCH_KEYS=["q","minRent","maxRent","beds","type","manager","sort"];
function restoreSharedSearch(){
  const params=new URLSearchParams(window.location.search);
  SEARCH_KEYS.forEach(id=>{
    if(!params.has(id))return;
    const field=$(id),value=params.get(id);
    if(id==="q"){field.value=value.slice(0,120);return;}
    if(Array.from(field.options).some(option=>option.value===value))field.value=value;
  });
}
function searchShareUrl(){
  const url=new URL(window.location.href);
  SEARCH_KEYS.forEach(id=>url.searchParams.delete(id));
  SEARCH_KEYS.forEach(id=>{
    const value=$(id).value.trim();
    if(value && !(id==="sort" && value==="rent-asc"))url.searchParams.set(id,value);
  });
  url.hash="main";
  return url.href;
}
function renderSearchSummary(){
  const container=$("activeFilters");
  if(!container)return;
  const chips=[];
  const q=$("q").value.trim(),min=$("minRent").value,max=$("maxRent").value;
  if(q)chips.push({label:"Search: “"+q+"”",key:"q"});
  if(min||max){
    const price=min&&max?money(Number(min))+"–"+money(Number(max))+" / month":min?"From "+money(Number(min))+" / month":"Up to "+money(Number(max))+" / month";
    chips.push({label:price,key:"rent"});
  }
  if($("beds").value)chips.push({label:$("beds").value+"+ bedrooms",key:"beds"});
  for(const id of ["type","manager"]){
    const field=$(id);
    if(field.value)chips.push({label:(id==="type"?"Type: ":"Manager: ")+field.selectedOptions[0].textContent,key:id});
  }
  if($("sort").value!=="rent-asc")chips.push({label:"Sorted: "+$("sort").selectedOptions[0].textContent,key:"sort"});
  const fragment=document.createDocumentFragment();
  if(!chips.length){
    const span=document.createElement("span");
    span.className="search-chip search-chip--default";
    span.textContent="All Russellville rentals";
    fragment.appendChild(span);
  }
  chips.forEach(({label,key})=>{
    const button=document.createElement("button");
    button.type="button";
    button.className="search-chip";
    button.dataset.clear=key;
    button.setAttribute("aria-label","Remove "+label+" filter");
    const text=document.createElement("span");
    text.textContent=label;
    const close=document.createElement("span");
    close.className="chip-close";
    close.setAttribute("aria-hidden","true");
    close.textContent="×";
    button.append(text,close);
    fragment.appendChild(button);
  });
  container.replaceChildren(fragment);
}
function bindSearchSummary(){
  const copy=$("copySearch"),status=$("shareStatus"),fallback=$("shareFallbackWrap"),input=$("shareFallback"),chips=$("activeFilters");
  if(!copy||!status||!fallback||!input||!chips)return;
  copy.hidden=false;
  chips.addEventListener("click",event=>{
    const button=event.target.closest("button[data-clear]");
    if(!button)return;
    const key=button.dataset.clear;
    if(key==="rent"){$("minRent").value="";$("maxRent").value="";}
    else if(key==="sort")$("sort").value="rent-asc";
    else if(SEARCH_KEYS.includes(key))$(key).value="";
    else return;
    const changed=key==="sort"?$("sort"):$("filters");
    changed.dispatchEvent(new Event("change",{bubbles:true}));
    status.textContent="";
    fallback.hidden=true;
  });
  copy.addEventListener("click",async()=>{
    const url=searchShareUrl();
    try{
      if(!navigator.clipboard||!navigator.clipboard.writeText)throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      status.textContent="Search link copied. Share it to reopen these filters.";
      fallback.hidden=true;
    }catch(error){
      input.value=url;
      fallback.hidden=false;
      input.focus();
      input.select();
      status.textContent="Copy the selected link manually.";
    }
  });
}


/* Presentation-only comparison of indexed listings; no new provider claims. */
function compareOption(item,n){
  const photoHTML=hasVerifiedPhoto(item)?`<img loading="lazy" decoding="async" width="640" height="400" src="${safe(item.image_url)}" alt="Listing-source photograph for ${safe(item.address)}">`:PROPERTY_ART;
  const rate=item.rent?money(item.rent):"Ask source";
  const display=v=>v==null?"Ask source":String(v);
  const photoLabel=hasVerifiedPhoto(item)?"Listing-source photograph":"Illustration · no verified property photo";
  return `<article class="compare-option">
    <figure class="compare-option-visual">${photoHTML}<figcaption>${safe(photoLabel)}</figcaption></figure>
    <div class="compare-option-body">
      <span class="compare-option-index">OPTION ${n+1} / ${safe(item.type||"Rental")}</span>
      <h3>${safe(item.address)}</h3>
      <dl>
        <div><dt>Published rent</dt><dd class="compare-rent">${safe(rate)}</dd></div>
        <div><dt>Bedrooms</dt><dd>${safe(display(item.beds))}</dd></div>
        <div><dt>Bathrooms</dt><dd>${safe(display(item.baths))}</dd></div>
        <div><dt>Rental type</dt><dd>${safe(item.type||"Unspecified")}</dd></div>
        <div><dt>Manager</dt><dd>${safe(item.manager)}</dd></div>
        <div><dt>Source checked</dt><dd>${safe(ageLabel(item))}</dd></div>
      </dl>
      <div class="compare-option-actions">
        <a class="compare-visit" href="${safe(item.source_url)}" rel="noopener noreferrer" target="_blank">Check original listing ↗</a>
        <button type="button" class="compare-remove" data-compare-id="${safe(item.id)}">Remove from comparison</button>
      </div>
    </div>
  </article>`;
}
function drawComparison(){
  const selected=[...state.compareIds].map(id=>state.listings.find(item=>String(item.id)===id)).filter(Boolean);
  $("compareDesk").hidden=selected.length===0;
  $("compareJump").hidden=selected.length===0;
  $("compareCount").textContent=String(selected.length);
  // The floating shortcut only appears for a real, nonempty pinned comparison.
  const tray=$("compareTray");
  if(tray){
    tray.hidden=selected.length===0;
    $("compareTrayCount").textContent=String(selected.length);
    document.body.classList.toggle("has-comparison",selected.length>0);
  }
  $("compareChoices").innerHTML=selected.map(compareOption).join("");
  document.querySelectorAll(".compare-pick[data-compare-id]").forEach(button=>{
    const on=state.compareIds.has(button.dataset.compareId);
    button.setAttribute("aria-pressed",String(on));
    button.firstElementChild.textContent=on?"Pinned to compare":"Pin to compare";
    button.lastElementChild.textContent=on?"✓":"+";
  });
  $("compareChoices").querySelectorAll(".compare-option-visual img").forEach(img=>img.addEventListener("error",()=>replaceFailedPhoto(img),{once:true}));
}
function onCompareClick(event){
  const button=event.target.closest("button[data-compare-id]");
  if(!button)return;
  const id=button.dataset.compareId,item=state.listings.find(x=>String(x.id)===id);
  if(!item)return;
  const removing=state.compareIds.has(id);
  if(removing)state.compareIds.delete(id);
  else if(state.compareIds.size>=3){$("compareStatus").textContent="Compare up to three rentals; remove one before adding another.";return;}
  else state.compareIds.add(id);
  drawComparison();
  $("compareStatus").textContent=item.address+(removing?" removed from":" added to")+" your comparison.";
  if(button.classList.contains("compare-remove")){
    const original=[...document.querySelectorAll(".compare-pick")].find(x=>x.dataset.compareId===id);
    if(original)original.focus();
    else if(state.compareIds.size)$("compareClear").focus();
    else $("compareIntro").scrollIntoView({block:"nearest"});
  }
}
$("listings").addEventListener("click",onCompareClick);
$("compareChoices").addEventListener("click",onCompareClick);
$("compareClear").addEventListener("click",()=>{
  state.compareIds.clear();
  drawComparison();
  $("compareStatus").textContent="Your rental comparison is cleared.";
  $("compareIntro").scrollIntoView({block:"nearest"});
});

async function load(){
  try{
    const res=await fetch("data/listings.json",{cache:"no-store"});
    if(!res.ok)throw new Error("Could not load listings");
    state.listings=await res.json();
    const managerSel=$("manager"), typeSel=$("type");
    [...new Set(state.listings.map(x=>x.manager))].sort().forEach(v=>managerSel.insertAdjacentHTML("beforeend",`<option value="${safe(v)}">${safe(v)}</option>`));
    [...new Set(state.listings.map(x=>x.type).filter(Boolean))].sort().forEach(v=>typeSel.insertAdjacentHTML("beforeend",`<option value="${safe(v)}">${safe(v)}</option>`));
    restoreSharedSearch();
    state.filtered=[...state.listings];
    render();
    apply();
  }catch(error){
    $("listings").innerHTML="";
    $("empty").hidden=false;
    $("empty").querySelector("h3").textContent="Listings are temporarily unavailable.";
    $("empty").querySelector("p").textContent="Use the source links below or contact Russellville.Rent.";
  }
}
/* Budget bands use the existing search inputs; other active filters remain intact. */
const rentLandscape=$("rent-landscape");
if(rentLandscape)rentLandscape.addEventListener("click",event=>{
  const button=event.target.closest("button[data-rent-band]");
  if(!button)return;
  const selected={
    low:["","1000"],
    mid:["1000","1500"],
    high:["1500",""]
  }[button.dataset.rentBand];
  if(!selected)return;
  $("minRent").value=selected[0];
  $("maxRent").value=selected[1];
  $("filters").dispatchEvent(new Event("change",{bubbles:true}));
  const count=$("resultCount");
  count.tabIndex=-1;
  count.focus({preventScroll:true});
  count.scrollIntoView({block:"start",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
});

$("filters").addEventListener("input",apply);
$("filters").addEventListener("change",apply);
$("filters").addEventListener("reset",()=>setTimeout(apply,0));
$("sort").addEventListener("change",apply);
$("year").textContent=new Date().getFullYear();
bindSearchSummary();
load();
