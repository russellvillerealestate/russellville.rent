/* A directory search can land directly on contacts for the requested item. */
document.addEventListener("DOMContentLoaded", () => {
  const menu = document.querySelector(".equipment-menu-toggle");
  if (menu) {
    const links = document.getElementById(menu.getAttribute("aria-controls"));
    const phone = window.matchMedia("(max-width:600px)");
    function setMenu(open) {
      menu.hidden = !phone.matches;
      menu.setAttribute("aria-expanded", String(open));
      links.hidden = phone.matches && !open;
    }
    setMenu(false);
    phone.addEventListener("change", () => setMenu(false));
    menu.addEventListener("click", () => setMenu(menu.getAttribute("aria-expanded") !== "true"));
    links.addEventListener("click", event => {if (event.target.closest("a")) setMenu(false);});
    document.addEventListener("pointerdown", event => {
      if (menu.getAttribute("aria-expanded") === "true" && !menu.parentElement.contains(event.target)) setMenu(false);
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        menu.focus();
      }
    });
  }
  const directory = document.querySelector(".directory-intro[data-provider-cards]");
  if (directory) {
    setupProviderDirectory(directory);
    return;
  }
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
      const numberInButton=document.createElement("span");
      numberInButton.className="call-button-number";
      numberInButton.textContent=" "+label;
      action.append("Call",numberInButton);
      action.setAttribute("aria-label","Call "+name+" at "+label);
      const mobileNumber=document.createElement("span");
      mobileNumber.className="provider-phone-number";
      mobileNumber.setAttribute("aria-hidden","true");
      mobileNumber.textContent=label;
      row.append(mobileNumber,action);
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

function setupProviderDirectory(intro) {
  const form = intro.querySelector("form");
  const search = form.querySelector("input");
  const count = intro.querySelector("[role=status]");
  const clear = intro.querySelector("#directory-clear");
  const extras = document.querySelector("#directory-extras");
  const clean = text => text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
  const ignored = new Set(["a", "an", "and", "the", "for", "in", "near", "me", "rental", "rentals", "rent"]);
  const termsFor = text => clean(text).split(/\s+/).filter(term => term && !ignored.has(term));
  const rows = [];

  function shortLocation(card) {
    const block = card.querySelector("address, .address, .location, .detail, .details p, .meta, .card-content p:last-child");
    if (!block) return "";
    const copy = block.cloneNode(true);
    copy.querySelectorAll("a,strong,.label,svg,script").forEach(node => node.remove());
    copy.querySelectorAll("br").forEach(br => br.replaceWith(", "));
    const text = copy.textContent.replace(/\s+/g, " ").replace(/^[\s,·]+|[\s,·]+$/g, "");
    const part = text.split(/\s*[·|]\s*/)[0].replace(/[\s,]+$/, "").trim();
    return part.length <= 112 ? part : "";
  }

  function expand(row, open) {
    row.card.classList.toggle("record-open", open);
    row.toggle.setAttribute("aria-expanded", String(open));
  }

  for (const card of document.querySelectorAll(intro.dataset.providerCards)) {
    const title = card.querySelector("h2,h3,h4");
    if (!title) continue;
    const name = title.textContent.trim();
    const call = card.querySelector('a[href^="tel:"]');
    const sites = [...card.querySelectorAll('a[href^="https://"],a[href^="http://"]')];
    const site = sites.find(a => /website|official operator|official rental|official site/i.test(a.textContent)) ||
      sites.find(a => !/maps\.|google\.[^/]+\/maps|maps\.app|goo\.gl\/maps/i.test(a.href));
    const hubContact = !call && !site && /contact the Russellville\.Rent hub/i.test(card.textContent);
    const status = card.querySelector(".rate-badge strong")?.textContent.trim() || "";
    const restriction = card.dataset.paddleKind === "campus" ? "Restricted campus equipment loans" :
      (/current operations unconfirmed/i.test(status) ? "Current operations unconfirmed" : "");
    const locationText = shortLocation(card);
    const searchable = clean([name, card.textContent, locationText].join(" "));
    if (!card.id) card.id = "provider-record-" + (rows.length + 1);
    const parts = [...card.children];
    const ids = parts.map((part, index) => part.id || (part.id = card.id + "-part-" + (index + 1)));
    const head = document.createElement("div");
    head.className = "directory-contact-head";
    const identity = document.createElement("div");
    identity.className = "record-identity";
    const heading = document.createElement("div");
    heading.setAttribute("role", "heading");
    heading.setAttribute("aria-level", "2");
    const toggle = document.createElement("button");
    toggle.className = "record-toggle";
    toggle.type = "button";
    toggle.textContent = name;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", ids.join(" "));
    heading.append(toggle);
    identity.append(heading);
    if (locationText) {
      const locationLine = document.createElement("p");
      locationLine.className = "record-location";
      locationLine.textContent = locationText;
      identity.append(locationLine);
    }
    if (restriction) {
      const note = document.createElement("p");
      note.className = "record-location";
      note.textContent = restriction;
      identity.append(note);
    }
    head.append(identity);
    if (call || site || hubContact) {
      const action = document.createElement("a");
      action.className = "record-action";
      action.href = hubContact ? "/#contact" : (call || site).getAttribute("href");
      if (call) {
        const digits = action.href.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
        const label = digits.length === 10 ? "(" + digits.slice(0,3) + ") " + digits.slice(3,6) + "-" + digits.slice(6) : call.textContent.trim();
        const number = document.createElement("span");
        number.textContent = label;
        action.textContent = "Call";
        action.setAttribute("aria-label", "Call " + name + " at " + label);
        action.append(number);
        const smallNumber = document.createElement("span");
        smallNumber.className = "record-mobile-number";
        smallNumber.textContent = label;
        identity.append(smallNumber);
      } else {
        action.textContent = hubContact ? "Ask directory" : "Website";
        action.setAttribute("aria-label", hubContact ? "Contact Russellville.Rent about " + name : "Visit website for " + name);
      }
      head.append(action);
    }
    const row = { card, toggle, searchable };
    toggle.addEventListener("click", () => expand(row, !card.classList.contains("record-open")));
    card.prepend(head);
    card.classList.add("directory-record");
    card.parentElement.classList.add("directory-records");
    rows.push(row);
  }

  function updateCount() {
    const number = rows.filter(({card}) => !card.hidden && !card.classList.contains("directory-no-match")).length;
    const query = search.value.trim();
    const noun = number === 1 ? "provider" : "providers";
    let label = number + " " + noun;
    if (query) label += (number === 1 ? " matches " : " match ") + "“" + query + "”";
    if (!number) label += ". Try a different item or clear your filters.";
    if (count.textContent !== label) count.textContent = label;
    clear.hidden = !query;
  }
  function filter(updateURL) {
    const query = search.value.trim();
    const terms = termsFor(query);
    for (const {card, searchable} of rows) {
      const match = terms.every(term => searchable.includes(term) ||
        (term.length > 3 && term.endsWith("s") && searchable.includes(term.slice(0,-1))));
      card.classList.toggle("directory-no-match", !match);
    }
    if (updateURL) {
      const url = new URL(location.href);
      if (query) url.searchParams.set("q", query); else url.searchParams.delete("q");
      if (url.href !== location.href) history.replaceState(null, "", url);
    }
    updateCount();
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    filter(true);
    const first = rows.find(({card}) => !card.hidden && !card.classList.contains("directory-no-match"));
    if (first) first.toggle.focus();
  });
  search.addEventListener("input", () => filter(true));
  clear.addEventListener("click", () => { search.value = ""; filter(true); search.focus(); });
  const observer = new MutationObserver(updateCount);
  rows.forEach(({card}) => observer.observe(card, { attributes: true, attributeFilter: ["hidden"] }));
  const views = "[data-equipment-view],[data-storage-view],[data-paddle-view-choice],#party-view-details,#party-view-scan";
  extras?.addEventListener("click", event => {
    const button = event.target.closest(views);
    if (button) {
      const open = button.matches('[data-equipment-view="full"],[data-storage-view="cards"],[data-paddle-view-choice="scenic"],#party-view-details');
      rows.forEach(row => expand(row, open));
    }
  });
  function revealFragment() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    if (extras?.contains(target)) extras.open = true;
    const row = rows.find(({card}) => card === target || card.contains(target));
    if (row) expand(row, true);
    if (row || extras?.contains(target)) target.scrollIntoView({block:"start"});
  }
  window.addEventListener("hashchange", revealFragment);
  document.addEventListener("click", event => {
    const link = event.target.closest('a[href="#directory-extras"]');
    if (link && extras) extras.open = true;
  });
  document.body.classList.add("directory-ready");
  form.hidden = false;
  search.value = (new URLSearchParams(location.search).get("q") || "").slice(0,160);
  filter(false);
  revealFragment();
}
