/* Convert everyday searches into the same filters renters can change on the results page. */
const RentalQuery = (() => {
  const numberWords = { zero:0, one:1, two:2, three:3, four:4, five:5, six:6 };
  const types = [
    [/\btiny (?:home|house)s?\b/i, 'Tiny house'], [/\btown(?:house|home)s?\b/i, 'Townhouse'],
    [/\b(?:apartments?|apts?)\b/i, 'Apartment'], [/\bduplex(?:es)?\b/i, 'Duplex'],
    [/\bcondos?\b/i, 'Condo'], [/\b(?:houses?|single[- ]family)\b/i, 'House']
  ];
  function words(text) {
    return text.toLowerCase().replace(/\b(?:for rent|near me|in russellville|around russellville)\b/gi,' ')
      .replace(/\b(?:find|looking for|rentals?|rent|please|a|an|the|to|me)\b/gi,' ')
      .replace(/\s+/g,' ').trim();
  }
  const addressWords = {
    north: 'n', south: 's', east: 'e', west: 'w', street: 'st', avenue: 'ave',
    road: 'rd', drive: 'dr', cove: 'cv', court: 'ct', lane: 'ln', boulevard: 'blvd',
    apartment: 'apt', apartments: 'apt', suite: 'ste'
  };
  function terms(text) {
    return (text.toLowerCase().match(/[a-z0-9]+/g) || []).map(word => addressWords[word] || word);
  }
  function listingWords(item) {
    return terms([item.address, item.manager, item.source_name, item.type, item.zip].filter(Boolean).join(' '));
  }
  function matchesListing(needle, record) {
    return needle.every(word => record.some(value => value === word || (word.length > 2 && value.startsWith(word))));
  }
  function housing(text, force = false) {
    let query = text.trim().slice(0,160);
    if (/\b(?:cabins?|vacation|hotels?|campers?|short[- ]term|weekend|airbnb|tools?|equipment|party|events?|home depot|storage|motorhomes?)\b/i.test(query)) return null;
    const beds = /\b([0-9]+|zero|one|two|three|four|five|six)\s*(\+)?[\s-]*(?:bedrooms?|beds?|bds?|br)\b(?:\s+(or more|and up))?/i;
    const homeWords = /\b(?:housing|apartments?|apts?|houses?|homes?|townhouses?|townhomes?|duplex(?:es)?|condos?|studio|long[- ]term)\b/i;
    if (!force && !homeWords.test(query) && !beds.test(query)) return null;
    const params = new URLSearchParams();
    query=query.replace(beds,(_,n,plus,more)=>{
      const amount=numberWords[n.toLowerCase()] ?? Number(n);
      params.set('beds',(plus || more ? '' : 'eq') + amount);
      return ' ';
    });
    if (/\bstudio\b/i.test(query)) {params.set('beds','eq0'); query=query.replace(/\bstudio\b/i,' ');}
    query=query.replace(/\b(under|below|less than|up to|at most|max(?:imum)?(?: rent)?(?: of)?|over|above|at least|min(?:imum)?(?: rent)?(?: of)?)\s*\$?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(k\b)?/ig,(_,condition,n,k)=>{
      const amount=Number(n.replaceAll(',',''))*(k?1000:1);
      const minimum=/^(over|above|at least|min)/i.test(condition);
      params.set(minimum?'minRent':'maxRent',String(amount));
      if (/^(under|below|less than)$/i.test(condition)) params.set('below','1');
      if (/^(over|above)$/i.test(condition)) params.set('above','1');
      return ' ';
    });
    const type=types.find(([pattern])=>pattern.test(query));
    if(type){params.set('type',type[1]);query=query.replace(type[0],' ');}
    query=words(query.replace(/\b(?:long[- ]term|housing|homes?|for|under|with|monthly|per month|dollars?)\b/gi,' '));
    if(query && query!=='russellville')params.set('q',query);
    const suffix=params.toString();
    return 'long-term.html'+(suffix?'?'+suffix:'')+'#listings';
  }
  return { words, housing, terms, listingWords, matchesListing };
})();
