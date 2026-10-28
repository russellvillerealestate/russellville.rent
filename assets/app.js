const state={listings:[],filtered:[]};
const $=id=>document.getElementById(id);
const money=n=>n?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n):"Call";
const FALLBACK_IMAGE="https://images.unsplash.com/photo-1768941124460-6fa7161715ff?auto=format&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=82&w=1600";
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
  return `<article class="card">
    <div class="property-art"><img class="property-photo" src="${safe(item.image_url||FALLBACK_IMAGE)}" alt="${safe(item.image_verified===false?'Generic rental home image':'Photo of '+item.address)}" loading="lazy"><span class="source-badge">${safe(item.source_name)}</span>${item.image_verified===false?'<span class="photo-note">Generic photo</span>':''}</div>
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
function render(){
  $("listings").innerHTML=state.filtered.map(card).join("");
  document.querySelectorAll(".property-photo").forEach(img=>img.addEventListener("error",()=>{if(img.src!==FALLBACK_IMAGE)img.src=FALLBACK_IMAGE;}));
  $("empty").hidden=state.filtered.length!==0;
  $("resultCount").textContent=`${state.filtered.length} rental${state.filtered.length===1?"":"s"} shown`;
  $("inventoryCount").textContent=state.listings.length;
  const managers=new Set(state.listings.map(x=>x.manager));
  $("managerCount").textContent=managers.size;
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
$("filters").addEventListener("input",apply);
$("filters").addEventListener("change",apply);
$("filters").addEventListener("reset",()=>setTimeout(apply,0));
$("sort").addEventListener("change",apply);
$("year").textContent=new Date().getFullYear();
bindSearchSummary();
load();
