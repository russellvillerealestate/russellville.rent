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
async function load(){
  try{
    const res=await fetch("data/listings.json",{cache:"no-store"});
    if(!res.ok)throw new Error("Could not load listings");
    state.listings=await res.json();
    const managerSel=$("manager"), typeSel=$("type");
    [...new Set(state.listings.map(x=>x.manager))].sort().forEach(v=>managerSel.insertAdjacentHTML("beforeend",`<option value="${safe(v)}">${safe(v)}</option>`));
    [...new Set(state.listings.map(x=>x.type).filter(Boolean))].sort().forEach(v=>typeSel.insertAdjacentHTML("beforeend",`<option value="${safe(v)}">${safe(v)}</option>`));
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
load();
