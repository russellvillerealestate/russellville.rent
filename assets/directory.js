(() => {
  const byId = id => document.getElementById(id);
  const input = byId('hero-query');
  const directory = byId('rental-results');
  const results = byId('search-results');
  const select = byId('category');
  const params = new URLSearchParams(location.search);
  const clean = text => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
  const stem = word => word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0,-1) : word;
  const tokens = text => clean(RentalQuery.words(text)).split(/\s+/).filter(word => word && !['in','and','or','of','near','around','arkansas','russellville','ar'].includes(word)).map(stem);
  const cards = [...directory.querySelectorAll('.rental-card')].map(element => {
    const link = element.querySelector('.card-link');
    const name = link.querySelector('.category-name').textContent;
    const key = element.dataset.category;
    return {
      element, link, key, name, href: link.getAttribute('href'), group: element.closest('[data-chapter]').dataset.chapter,
      titleWords: tokens(name), words: new Set(tokens([name, key, element.dataset.search, element.querySelector('.category-notes').textContent].join(' ')))
    };
  });
  const byKey = new Map(cards.map(card => [card.key,card]));
  const groups = [...directory.querySelectorAll('[data-chapter]')];
  const groupNames = new Map(groups.map(group => [group.dataset.chapter,group.querySelector('h3').textContent]));
  const savedKey = 'russellville-rent-saved-categories-v1';
  const recentKey = 'russellville-tab-recent-v1';
  const historicGroups = {
    space: ['homes','stays','storage','household-rentals','medical-equipment-rentals','medical-equipment-loans','baby-gear','other'],
    projects: ['tools','trailers','mobile-storage','dumpsters','moving','restrooms','temporary-fencing','commercial','sheds'],
    outdoors: ['paddling','bicycles','atv-utv','rvs','rv-rentals','cars','boats','camping','golf-carts','golf-simulators'],
    events: ['party','venues','photo-booths','formalwear','audio-visual','instruments','yard-signs','stages']
  };
  function readStore(storage, key) {
    try {
      const items = JSON.parse(window[storage].getItem(key) || '[]');
      return Array.isArray(items) ? [...new Set(items.filter(item => typeof item === 'string'))] : [];
    } catch { return []; }
  }
  function writeStore(storage, key, value) {
    try { window[storage].setItem(key,JSON.stringify(value)); } catch { /* In-memory controls still work. */ }
  }
  let saved = readStore('localStorage',savedKey).filter(key=>byKey.has(key)).slice(0,8);
  const byPath = new Map(cards.filter(card=>card.href.endsWith('.html')).map(card=>[new URL(card.href,location.href).pathname,card]));
  let recent = readStore('sessionStorage',recentKey).filter(path=>byPath.has(path)).slice(0,3);
  function categoryLink(card) {
    const link = card.link.cloneNode(false);
    link.removeAttribute('class');
    link.href = new URL(card.href, location.href).href;
    link.textContent = card.name;
    link.dataset.destination = card.key;
    return link;
  }
  function renderRecent() {
    const area = byId('recent-trail');
    area.hidden = recent.length === 0;
    const list = area.querySelector('ul');
    list.replaceChildren();
    for(const path of recent) {
      const row = document.createElement('li'), link = categoryLink(byPath.get(path));
      link.className = 'recent-link'; row.append(link); list.append(row);
    }
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    const key = link?.dataset.destination || link?.closest('.rental-card')?.dataset.category;
    const card = byKey.get(key);
    if (!card || !card.href.endsWith('.html')) return;
    const path = new URL(card.href,location.href).pathname;
    recent = [path,...recent.filter(item=>item!==path)].slice(0,3);
    writeStore('sessionStorage',recentKey,recent);
    renderRecent();
  });
  byId('clear-recent').addEventListener('click',()=>{recent=[];writeStore('sessionStorage',recentKey,recent);renderRecent();});
  function renderSaved() {
    byId('saved-total').textContent = saved.length ? String(saved.length) : '';
    byId('saved-empty').hidden = saved.length > 0;
    byId('saved-actions').hidden = saved.length === 0;
    for(const card of cards) {
      const button = card.element.querySelector('.save-category');
      const active = saved.includes(card.key);
      button.disabled = false;
      button.setAttribute('aria-pressed',String(active));
      button.setAttribute('aria-label',(active ? 'Remove from saved: ' : 'Save ')+card.name);
    }
    const list = byId('saved-links'); list.replaceChildren();
    for(const key of saved) {
      const card = byKey.get(key), row = document.createElement('li');
      const remove = card.element.querySelector('.save-category').cloneNode(true);
      remove.dataset.remove = key;
      row.append(categoryLink(card),remove); list.append(row);
    }
  }
  function toggleSaved(key) {
    if(saved.includes(key)) saved = saved.filter(item=>item!==key);
    else if(saved.length<8) saved.push(key);
    else {report('You can save eight categories. Remove one to add another.'); return;}
    writeStore('localStorage',savedKey,saved);renderSaved();
    report(byKey.get(key).name+(saved.includes(key)?' saved.':' removed from saved categories.'));
  }
  directory.addEventListener('click',event=>{
    const button=event.target.closest('.save-category');
    if(button) toggleSaved(button.closest('.rental-card').dataset.category);
  });
  byId('saved-links').addEventListener('click',event=>{
    const button=event.target.closest('[data-remove]');
    if(button){toggleSaved(button.dataset.remove);(byId('saved-links').querySelector('button')||byId('close-saved')).focus();}
  });
  byId('clear-saved').addEventListener('click',()=>{saved=[];writeStore('localStorage',savedKey,saved);renderSaved();byId('close-saved').focus();});
  const savedButton = byId('saved-toggle');
  function displaySaved(open,focus=true) {
    byId('saved-panel').hidden=!open;
    savedButton.setAttribute('aria-expanded',String(open));
    if(focus) {if(open)byId('saved-title').focus();else savedButton.focus();}
  }
  savedButton.hidden=false;
  savedButton.addEventListener('click',()=>displaySaved(byId('saved-panel').hidden));
  byId('close-saved').addEventListener('click',()=>displaySaved(false));
  window.addEventListener('storage',event=>{
    if(event.key===savedKey){saved=readStore('localStorage',savedKey).filter(k=>byKey.has(k)).slice(0,8);renderSaved();}
  });
  const forcedRoutes = [
    [/\b(?:bounce|bouncy|jump)\s+(?:house|houses|castle|castles)\b/i,'party','bounce house'],
    [/^(?:kayaks?|canoes?|paddle ?boards?)$/i,'paddling'],
    [/^(?:self[- ]storage|storage(?: units?)?)$/i,'storage',''],
    [/^(?:tools?(?: and equipment)?|equipment)$/i,'tools',''],
    [/^(?:cars?|car rentals?)$/i,'cars',''],
    [/^(?:open house|yard|lawn) signs?$/i,'yard-signs','sign'],
    [/^(?:portable toilets?|porta[- ]pott(?:y|ies))$/i,'restrooms','portable']
  ];
  const genericNames={homes:['housing','homes apartments'],storage:['self storage'],tools:['tools equipment'],cars:['vehicles'],party:['events parties','party supplies'],stays:['short stays']};
  let housingIndex=[], housingRecords=[], housingRequest, pendingLookup;
  function loadHousing() {
    if(!housingRequest)housingRequest=fetch('data/listings.json').then(r=>r.ok?r.json():[]).then(items=>{
      housingRecords=Array.isArray(items)?items.filter(item=>item && typeof item==='object'):[];
      housingIndex=housingRecords.map(RentalQuery.listingWords);
    }).catch(()=>{housingRequest=null;});
    return housingRequest;
  }
  function homeMatches(text) {
    const route=RentalQuery.housing(text,true);
    if(!route)return [];
    const filters=new URL(route,location.href).searchParams;
    const query=RentalQuery.terms(filters.get('q')||'');
    const type=filters.get('type'),beds=filters.get('beds');
    const minRent=filters.has('minRent')?Number(filters.get('minRent')):null;
    const maxRent=filters.has('maxRent')?Number(filters.get('maxRent')):null;
    return housingRecords.filter(item=>{
      try {if(new URL(item.source_url).protocol!=='https:')return false;}catch{return false;}
      if(type && String(item.type||'').toLowerCase()!==type.toLowerCase())return false;
      if(beds){
        if(!Number.isFinite(Number(item.beds)))return false;
        const amount=Number(beds.replace(/^eq/,'')),actual=Number(item.beds);
        if(beds.startsWith('eq') ? actual!==amount : actual<amount)return false;
      }
      if(minRent!==null && (!Number.isFinite(Number(item.rent)) || (filters.has('above') ? Number(item.rent)<=minRent : Number(item.rent)<minRent)))return false;
      if(maxRent!==null && (!Number.isFinite(Number(item.rent)) || (filters.has('below') ? Number(item.rent)>=maxRent : Number(item.rent)>maxRent)))return false;
      return RentalQuery.matchesListing(query,RentalQuery.listingWords(item).concat(RentalQuery.terms([item.city,item.state].filter(Boolean).join(' '))));
    }).sort((left,right)=>(Number(left.rent)||Infinity)-(Number(right.rent)||Infinity));
  }
  function renderHomePreview(text) {
    const panel=byId('home-preview'),list=byId('home-preview-list');
    const housingResult=lastResults.some(({card})=>card.key==='homes');
    if(!text || !housingResult || !housingRecords.length){panel.hidden=true;list.replaceChildren();return 0;}
    const matches=homeMatches(text);
    if(!matches.length){panel.hidden=true;list.replaceChildren();return 0;}
    list.replaceChildren();
    for(const item of matches.slice(0,3)){
      const article=document.createElement('article'),link=document.createElement('a');
      article.className='home-result-card';link.className='home-result-link';
      link.href=item.source_url;link.target='_blank';link.rel='noopener noreferrer';
      const photo=document.createElement('div');photo.className='home-result-photo';
      if(item.image_verified && String(item.image_url||'').startsWith('https://')){
        const img=document.createElement('img');img.src=item.image_url;img.alt='';
        img.loading='lazy';img.decoding='async';img.width=420;img.height=264;photo.append(img);
      }else photo.textContent='River Valley rental';
      const body=document.createElement('div');body.className='home-result-info';
      const price=document.createElement('strong');price.className='home-result-price';
      if(Number(item.rent)>0){price.textContent=Number(item.rent).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});const per=document.createElement('small');per.textContent=' / month';price.append(per);}
      else price.textContent='Ask for price';
      const address=document.createElement('span');address.className='home-result-address';address.textContent=item.address||'View rental details';
      const facts=document.createElement('span');facts.className='home-result-facts';
      facts.textContent=[item.beds!=null?(item.beds+' bed'):'',item.baths!=null?(item.baths+' bath'):'',item.city||''].filter(Boolean).join(' · ');
      const manager=document.createElement('span');manager.className='home-result-manager';manager.textContent=item.source_name||item.manager||'Property manager';
      body.append(price,address,facts,manager);link.append(photo,body);article.append(link);
      const phone=String(item.phone||'').replace(/\D/g,'');
      if(phone.length===10 || (phone.length===11&&phone.startsWith('1'))){
        const call=document.createElement('a');call.className='home-result-call';call.href='tel:+'+(phone.length===10?'1':'')+phone;
        call.textContent='Call property manager';call.setAttribute('aria-label','Call '+(item.source_name||item.manager||'property manager')+' about '+(item.address||'this rental'));
        article.append(call);
      }
      list.append(article);
    }
    byId('home-preview-note').textContent='Showing '+Math.min(3,matches.length)+' of '+matches.length+' provider-posted listings. Confirm current availability.';
    byId('home-preview-all').href=RentalQuery.housing(text,true)||'long-term.html#listings';
    panel.hidden=false;return matches.length;
  }
  function inGroup(card) {
    const value = select.value;
    if(value==='all')return true;
    if(value.startsWith('intent-'))return historicGroups[value.slice(7)]?.includes(card.key);
    if(value.startsWith('item-'))return card.key===value.slice(5);
    return card.group===value;
  }
  function destination(card,search,forceCategory=false) {
    if(forceCategory || !search || !card.href.endsWith('.html') || card.key==='boats')return card.href;
    if(card.key==='homes')return RentalQuery.housing(search,true)||card.href;
    return card.href+'?'+new URLSearchParams({q:search})+'#provider-matches';
  }
  function matches(text) {
    const query=RentalQuery.words(text), terms=tokens(text);
    if(!terms.length)return [];
    const result=(card,href,rank)=>inGroup(card)?[{card,href,rank}]:[];
    const route=forcedRoutes.find(([pattern])=>pattern.test(query));
    if(route){const card=byKey.get(route[1]);return result(card,destination(card,route[2]??query),110);}
    const housing=RentalQuery.housing(text);
    if(housing)return result(byKey.get('homes'),housing,110);
    const address=RentalQuery.terms(query);
    const foundProperty=address.some(word=>word.length>=3)&&housingIndex.some(record=>RentalQuery.matchesListing(address,record));
    return cards.filter(inGroup).flatMap(card=>{
      if(card.key==='homes'&&foundProperty)return [{card,href:destination(card,query),rank:95}];
      if(!terms.every(word=>card.words.has(word)))return [];
      const title=card.titleWords.join(' '),needle=terms.join(' ');
      const exact=title===needle || card.key===query || (genericNames[card.key]||[]).includes(needle);
      const rank=exact?100:terms.every(w=>card.titleWords.includes(w))?60:35;
      return [{card,href:destination(card,query,exact),rank}];
    }).sort((a,b)=>b.rank-a.rank);
  }
  let lastResults=[];
  function render({groupChanged=false}={}) {
    const text=input.value.trim(), active=Boolean(text);
    lastResults=active?matches(text):[];
    byId('browse-title').textContent=active?'Search results':'Rental categories';
    results.hidden=!active;directory.hidden=active;
    if(active){
      const list=results.querySelector('ul'); list.replaceChildren();
      for(const {card,href} of lastResults){
        const row=document.createElement('li'),link=categoryLink(card);
        row.className='search-row';link.href=href;
        const detail=document.createElement('small');detail.textContent=groupNames.get(card.group);
        link.append(detail);row.append(link);list.append(row);
      }
      const propertyCount=renderHomePreview(text);
      results.querySelector('.no-results').hidden=lastResults.length>0;
      byId('result-count').textContent=(propertyCount?propertyCount+' matching homes · ':'')+lastResults.length+' matching '+(lastResults.length===1?'category':'categories');
    }else {
      byId('home-preview').hidden=true;byId('home-preview-list').replaceChildren();
      let total=0;
      for(const group of groups) {
        const groupCards=cards.filter(card=>card.group===group.dataset.chapter);
        const visible=groupCards.filter(inGroup);
        group.hidden=!visible.length;total+=visible.length;
        groupCards.forEach(card=>{card.element.hidden=!inGroup(card);});
        const more=group.querySelector('.more-categories');
        more.hidden=![...more.querySelectorAll('.rental-card')].some(el=>!el.hidden);
        if(select.value!=='all')more.open=true;else if(groupChanged)more.open=false;
      }
      byId('result-count').textContent=select.value==='all'?'':total+' '+(total===1?'category':'categories');
    }
  }
  input.addEventListener('input',()=>{
    clearTimeout(pendingLookup);render();
    const value=input.value.trim();
    if(value.length>=3&&!housingRequest&&(RentalQuery.housing(value)||lastResults.some(({card})=>card.key==='homes')||!lastResults.length||/\d+\s+\D/.test(value)))
      pendingLookup=setTimeout(async()=>{await loadHousing();if(input.value.trim()===value)render();},180);
  });
  input.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'&&lastResults.length){event.preventDefault();results.querySelector('a')?.focus();}
    if(event.key==='Escape'&&input.value){input.value='';render();}
  });
  byId('search').addEventListener('submit',async event=>{
    event.preventDefault();
    const query=input.value.trim();
    if(query&&query.length>=3&&(!lastResults.length||lastResults.some(({card})=>card.key==='homes')||RentalQuery.housing(query))){await loadHousing();if(input.value.trim()!==query)return;render();}
    if(!byId('home-preview').hidden){
      byId('browse').scrollIntoView({block:'start'});
      byId('home-preview-list').querySelector('a')?.focus({preventScroll:true});
      return;
    }
    if(lastResults.length===1 || (lastResults[0]?.rank>=95 && lastResults[0].rank>lastResults[1]?.rank)) {
      const {card,href}=lastResults[0];
      if(card.href.endsWith('.html')){
        const path=new URL(card.href,location.href).pathname;
        recent=[path,...recent.filter(p=>p!==path)].slice(0,3);writeStore('sessionStorage',recentKey,recent);
      }
      location.assign(href);return;
    }
    const target=query?(results.querySelector('a')||byId('clear-search')):directory.querySelector('.card-link');
    target?.focus({preventScroll:true});byId('browse').scrollIntoView({block:'start'});
  });
  byId('clear-search').addEventListener('click',()=>{input.value='';select.value='all';render({groupChanged:true});input.focus();});
  select.closest('label').hidden=false;
  select.addEventListener('change',()=>render({groupChanged:true}));
  const layout=byId('layout');
  function applyLayout(){directory.classList.toggle('single-list',layout.value==='list');}
  layout.addEventListener('change',applyLayout);
  byId('show-notes').addEventListener('change',event=>{directory.classList.toggle('with-notes',event.target.checked);});
  function shareURL(){
    const url=new URL(location.pathname,location.origin);
    if(input.value.trim())url.searchParams.set('q',input.value.trim());
    if(select.value.startsWith('item-'))url.searchParams.set('category',select.value.slice(5));
    else if(select.value.startsWith('intent-'))url.searchParams.set('intent',select.value.slice(7));
    else if(select.value!=='all')url.searchParams.set('group',select.value);
    if(layout.value==='list')url.searchParams.set('view','list');
    url.hash='browse';return url.href;
  }
  let feedbackTimer;
  function report(text){
    const feedback=byId('feedback');feedback.textContent=text;feedback.classList.remove('sr-only');
    clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>feedback.classList.add('sr-only'),2500);
  }
  async function copy(text){
    const fallback=byId('copy-fallback');
    try{await navigator.clipboard.writeText(text);fallback.hidden=true;report('Link'+(text.includes('\n')?'s':'')+' copied.');}
    catch {fallback.hidden=false;const field=fallback.querySelector('input');field.value=text;field.focus();field.select();}
  }
  byId('share-view').addEventListener('click',()=>copy(shareURL()));
  byId('copy-saved').addEventListener('click',()=>copy(saved.map(k=>{const c=byKey.get(k);return c.name+' — '+new URL(c.href,location.href).href;}).join('\n')));
  byId('print-saved').addEventListener('click',()=>{document.body.classList.add('print-saved');window.print();});
  window.addEventListener('afterprint',()=>document.body.classList.remove('print-saved'));
  function selectLegacy(value,label){select.add(new Option(label,value));select.value=value;}
  if(groupNames.has(params.get('group')))select.value=params.get('group');
  else if(byKey.has(params.get('category')))selectLegacy('item-'+params.get('category'),byKey.get(params.get('category')).name);
  else if(Object.hasOwn(historicGroups,params.get('intent')))selectLegacy('intent-'+params.get('intent'),({space:'Settle & stay',projects:'Build & move',outdoors:'Explore & travel',events:'Celebrate & create'})[params.get('intent')]);
  input.value=(params.get('q')||'').slice(0,160);
  if(params.get('view')==='list')layout.value='list';
  renderSaved();renderRecent();applyLayout();render();
  if(input.value&&(RentalQuery.housing(input.value)||lastResults.some(({card})=>card.key==='homes')||!lastResults.length))loadHousing().then(()=>render());
  const headerSearch=document.querySelector('.header-search');
  if('IntersectionObserver' in window)new IntersectionObserver(([entry])=>{headerSearch.hidden=entry.isIntersecting;},{rootMargin:'-55px 0px 0px'}).observe(byId('search'));
  headerSearch.addEventListener('click',event=>{event.preventDefault();input.focus();input.scrollIntoView({block:'center'});});
  function restoreAnchor(){
    if(['#saved-panel','#return-trail'].includes(location.hash))displaySaved(true);
    else if(location.hash==='#recent-trail')byId('directory-options').open=true;
    else if(['#atlas','#atlas-modal'].includes(location.hash)){input.focus();}
    else if(['#moving-field-guide','#event-field-guide'].includes(location.hash))document.querySelector(location.hash).open=true;
  }
  window.addEventListener('hashchange',restoreAnchor);restoreAnchor();
})();
