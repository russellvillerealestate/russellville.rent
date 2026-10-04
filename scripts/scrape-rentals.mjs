import fs from "node:fs/promises";
import * as cheerio from "cheerio";

const OUT = new URL("../data/listings.json", import.meta.url);
const UA = "Russellville.Rent listing indexer/0.1 (+https://russellville.rent; public listing pages only)";
const now = new Date().toISOString();

const managers = [
  {
    key: "rvr",
    name: "River Valley Realty Management Service",
    sourceName: "River Valley Realty",
    base: "https://www.rentrvr.com",
    kind: "appfolio"
  },
  {
    key: "natural-state",
    name: "Natural State Property Management",
    sourceName: "Natural State Property Management",
    base: "https://www.naturalstatepropertymanagement.com",
    kind: "appfolio"
  },
  {
    key: "moore",
    name: "Moore & Co. Rental",
    sourceName: "Moore & Co.",
    base: "https://www.mooreforrent.com",
    kind: "wordpress"
  }
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clean = value => String(value || "").replace(/\s+/g, " ").trim();
const slug = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);

async function get(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": UA, "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
    const text = await response.text();
    await sleep(350);
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function money(text) {
  const values = [...clean(text).matchAll(/\$\s*([0-9][0-9,]{2,5})(?:\.\d{2})?/g)]
    .map(m => Number(m[1].replace(/,/g, "")))
    .filter(v => v >= 300 && v <= 10000);
  return values[0] ?? null;
}

function count(text, label) {
  const patterns = label === "beds"
    ? [/(\d+(?:\.\d+)?)\s*(?:beds?|bedrooms?)/i, /beds?\s*(\d+(?:\.\d+)?)/i]
    : [/(\d+(?:\.\d+)?)\s*(?:baths?|bathrooms?)/i, /baths?\s*(\d+(?:\.\d+)?)/i];
  for (const re of patterns) {
    const match = clean(text).match(re);
    if (match) return Number(match[1]);
  }
  return null;
}

function inferType(text) {
  const t = clean(text).toLowerCase();
  if (t.includes("townhouse") || t.includes("townhome")) return "Townhouse";
  if (t.includes("duplex")) return "Duplex";
  if (t.includes("tiny house") || t.includes("tiny home")) return "Tiny house";
  if (t.includes("apartment") || t.includes("apt ")) return "Apartment";
  if (t.includes("commercial") || t.includes("office space") || t.includes("retail")) return "Commercial";
  if (t.includes("house") || t.includes("home")) return "House";
  return "Rental";
}

function parseAddressTitle(raw) {
  let title = clean(raw)
    .replace(/\*\*/g, "")
    .replace(/\$\s*[0-9][0-9,]*(?:\.\d+)?(?:\s*\/\s*\$?\s*[0-9][0-9,]*)?/g, "")
    .replace(/\b(?:rent|security deposit|sec deposit|per month|for rent|new listing|pet friendly|no pets allowed)\b.*$/i, "")
    .replace(/[–—-]\s*$/,"")
    .trim();
  return title || clean(raw);
}

function appfolioListing(html, url, manager) {
  const $ = cheerio.load(html);
  const h1 = clean($("h1").first().text());
  const text = clean($("main").text() || $("body").text());
  const combined = clean(h1 + " " + text);
  if (!/Russellville\s*,?\s*AR/i.test(combined)) return null;
  if (/commercial|office space|retail/i.test(combined) && !/(bed|bedroom)/i.test(combined)) return null;

  const rent = money(combined);
  const beds = count(combined, "beds");
  const baths = count(combined, "baths");
  if (!h1 || !rent) return null;

  const zipMatch = combined.match(/Russellville\s*,?\s*AR\s*(7280[12])?/i);
  const availabilityMatch = combined.match(/Available\s+(NOW|[A-Za-z]+\s+\d{1,2}(?:,\s*\d{4})?)/i);
  const rawImage = $("meta[property='og:image']").attr("content") ||
    $("img[src*='images.cdn.appfolio.com']").first().attr("src") ||
    $("img[data-src*='images.cdn.appfolio.com']").first().attr("data-src") ||
    null;
  const imageUrl = rawImage ? new URL(rawImage, manager.base).href : null;

  return {
    id: `${manager.key}-${slug(h1)}`,
    address: h1.replace(/,?\s*Russellville\s*,?\s*AR\s*7280[12]?/i, "").trim(),
    city: "Russellville",
    state: "AR",
    zip: zipMatch?.[1] || "",
    rent,
    beds,
    baths,
    type: inferType(combined),
    manager: manager.name,
    source_name: manager.sourceName,
    source_url: url,
    availability: availabilityMatch ? `Available ${availabilityMatch[1]}` : "Check source",
    image_url: imageUrl,
    image_verified: Boolean(imageUrl),
    updated_at: now,
    seeded: false
  };
}

async function discoverAppfolio(manager) {
  const listingUrls = new Set();
  const seenXml = new Set();

  async function readSitemap(url, depth = 0) {
    if (depth > 3 || seenXml.has(url)) return;
    seenXml.add(url);
    let xml;
    try { xml = await get(url); } catch { return; }
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/gsi)].map(m => m[1].replace(/&amp;/g, "&").trim());
    for (const found of urls) {
      if (/\/listings\/detail\//i.test(found)) listingUrls.add(found);
      else if (/sitemap.*\.xml/i.test(found) || /\.xml(?:\?|$)/i.test(found)) await readSitemap(found, depth + 1);
    }
  }

  await readSitemap(`${manager.base}/sitemap.xml`);
  await readSitemap(`${manager.base}/sitemap_index.xml`);

  for (const fallback of ["/all-vacancies", "/availability", "/pope-county"]) {
    try {
      const html = await get(manager.base + fallback);
      const $ = cheerio.load(html);
      $("a[href*='/listings/detail/']").each((_, a) => {
        const href = $(a).attr("href");
        if (href) listingUrls.add(new URL(href, manager.base).href);
      });
    } catch {}
  }

  const results = [];
  for (const url of [...listingUrls].slice(0, 150)) {
    try {
      const listing = appfolioListing(await get(url), url, manager);
      if (listing) results.push(listing);
    } catch (error) {
      console.warn("Listing skipped:", url, error.message);
    }
  }
  return results;
}

function mooreArticle(article, $, pageUrl, manager) {
  const text = clean($(article).text());
  if (!text || !/For Rent|available soon|rent/i.test(text)) return null;
  const heading = $(article).find("h1,h2,h3,h4").first();
  const rawTitle = clean(heading.text()) || clean($(article).find("a").first().text());
  if (!rawTitle) return null;

  const href = heading.find("a").attr("href") || $(article).find("a").first().attr("href") || pageUrl;
  const sourceUrl = new URL(href, manager.base).href;
  const rent = money(rawTitle + " " + text);
  if (!rent) return null;
  const rawImage = $(article).find("img").first().attr("data-src") || $(article).find("img").first().attr("src") || null;
  const imageUrl = rawImage ? new URL(rawImage, manager.base).href : null;

  const address = parseAddressTitle(rawTitle);
  if (!address || /calling all property owners|rental resources|meet the team/i.test(address)) return null;

  return {
    id: `${manager.key}-${slug(address)}`,
    address,
    city: "Russellville",
    state: "AR",
    zip: "",
    rent,
    beds: count(text, "beds"),
    baths: count(text, "baths"),
    type: inferType(text),
    manager: manager.name,
    source_name: manager.sourceName,
    source_url: sourceUrl,
    availability: /available soon/i.test(text) ? "Available soon" : "Check source",
    image_url: imageUrl,
    image_verified: Boolean(imageUrl),
    updated_at: now,
    seeded: false
  };
}

async function discoverMoore(manager) {
  const results = [];
  const seen = new Set();
  for (let page = 1; page <= 5; page++) {
    const url = page === 1
      ? `${manager.base}/rental-properties/russellville/`
      : `${manager.base}/rental-properties/russellville/page/${page}/`;
    let html;
    try { html = await get(url); } catch { continue; }
    const $ = cheerio.load(html);

    let nodes = $("article").toArray();
    if (!nodes.length) nodes = $(".property, .listing, .property-item, .property-listing").toArray();

    for (const node of nodes) {
      const listing = mooreArticle(node, $, url, manager);
      if (listing && !seen.has(listing.source_url + listing.address)) {
        seen.add(listing.source_url + listing.address);
        results.push(listing);
      }
    }
  }
  return results;
}

function dedupe(listings) {
  const map = new Map();
  for (const item of listings) {
    const key = `${slug(item.manager)}|${slug(item.address)}`;
    const existing = map.get(key);
    if (!existing || (!existing.updated_at && item.updated_at)) map.set(key, item);
  }
  return [...map.values()].sort((a, b) =>
    (a.rent ?? 999999) - (b.rent ?? 999999) || a.address.localeCompare(b.address)
  );
}

const current = JSON.parse(await fs.readFile(OUT, "utf8"));
let live = [];

for (const manager of managers) {
  try {
    const found = manager.kind === "appfolio"
      ? await discoverAppfolio(manager)
      : await discoverMoore(manager);
    console.log(`${manager.name}: ${found.length} Russellville listings found`);
    if (found.length) {
      const enriched = found.map(item => {
        const previous = current.find(x => slug(x.manager) === slug(item.manager) && slug(x.address) === slug(item.address));
        if (!item.image_url && previous?.image_url) {
          item.image_url = previous.image_url;
          item.image_verified = previous.image_verified ?? false;
        }
        return item;
      });
      live.push(...enriched);
    } else {
      live.push(...current.filter(x => x.manager === manager.name));
    }
  } catch (error) {
    console.warn(`${manager.name} failed: ${error.message}`);
    live.push(...current.filter(x => x.manager === manager.name));
  }
}

live = dedupe(live).filter(x => x.city === "Russellville");
if (!live.length) throw new Error("No listings collected; refusing to overwrite existing data.");

await fs.writeFile(OUT, JSON.stringify(live, null, 2) + "\n");
console.log(`Wrote ${live.length} listings to data/listings.json`);
