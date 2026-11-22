/* A directory search can land directly on contacts for the requested item. */
document.addEventListener("DOMContentLoaded", () => {
  const query = (new URLSearchParams(location.search).get("q") || "").trim().slice(0,160);
  const main = document.querySelector("main");
  if (!query || !main) return;

  const normalize = text => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return;
  const cards = main.querySelectorAll("article, .shop-arrival, .student-checkout");
  const results = [];
  const seen = new Set();
  for (const card of cards) {
    const heading = card.querySelector("h2,h3,h4");
    const name = heading?.textContent.trim();
    const call = card.querySelector('a[href^="tel:"]');
    const website = card.querySelector('a[href^="https://"]');
    if (!name || (!call && !website) || seen.has(name)) continue;
    const text = normalize(card.textContent);
    if (!terms.every(term => text.includes(term) || (term.length > 3 && term.endsWith("s") && text.includes(term.slice(0,-1))))) continue;
    const address = card.querySelector("address,.address,.location,.detail")?.textContent || "";
    const local = card.dataset.equipmentArea === "street" || /\bRussellville,\s*(?:AR|Arkansas)\b/i.test(address);
    if (!card.id) card.id = "supplier-" + Array.prototype.indexOf.call(cards,card);
    results.push({ card,name,call,website,local });
    seen.add(name);
  }
  results.sort((a,b)=>Number(b.local)-Number(a.local));

  const input = main.querySelector('input[type="search"]');
  if (input) {
    input.value=query;
    input.dispatchEvent(new Event("input",{bubbles:true}));
  }

  const panel = document.createElement("section");
  panel.className="provider-matches";
  panel.id="provider-matches";
  const title = document.createElement("h2");
  title.textContent = "Results for “" + query + "”";
  const summary=document.createElement("p");
  summary.textContent = results.length ? results.length + (results.length===1?" provider mentions":" providers mention") + " this search. Contact the provider for availability." : "No provider description directly matches this search.";
  panel.append(title,summary);
  const list=document.createElement("ul");
  for (const {card,name,call,website} of results) {
    const row=document.createElement("li");
    const details=document.createElement("a");
    details.href="#"+card.id;
    details.className="result-name";
    details.textContent=name;
    details.addEventListener("click",()=>{
      if (input && card.hidden) {input.value="";input.dispatchEvent(new Event("input",{bubbles:true}));}
      for (let n = card.parentElement; n; n = n.parentElement) if (n.tagName==="DETAILS") n.open=true;
    });
    row.append(details);
    if (call) {
      const number=call.getAttribute("href");
      const action=document.createElement("a");
      action.className="result-call";
      action.href=number;
      const digits=number.replace(/\D/g,"").replace(/^1(?=\d{10}$)/,"");
      const label=digits.length===10?"("+digits.slice(0,3)+") "+digits.slice(3,6)+"-"+digits.slice(6):call.textContent.trim();
      action.textContent="Call "+label;
      action.setAttribute("aria-label","Call "+name+" at "+label);
      row.append(action);
    } else if (website) {
      const action=document.createElement("a");
      action.className="result-call";
      action.href=website.href;
      action.textContent="Visit website";
      action.setAttribute("aria-label","Visit the website for "+name);
      row.append(action);
    }
    list.append(row);
  }
  if(results.length) panel.append(list);
  const all=document.createElement("a");
  all.className="result-all";
  all.href=location.pathname;
  all.textContent="Browse the full category";
  panel.append(all);
  main.prepend(panel);
  if(location.hash==="#provider-matches") panel.scrollIntoView({block:"start"});
  if (input) input.addEventListener("input",()=>{panel.hidden=input.value.trim()!==query;});
});
