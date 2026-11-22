import fs from "node:fs/promises";
import { load } from "cheerio";

const output = new URL("../data/listings.json", import.meta.url);
const checkedAt = new Date().toISOString();
const managers = [
  { key: "natural-state", name: "Natural State Property Management", label: "Natural State Property Management", phone: "4799685158", url: "https://nspm.appfolio.com/listings/listings?filters%5Bcities%5D%5B%5D=Russellville", kind: "appfolio" },
  { key: "rvr", name: "River Valley Realty Management Service", label: "River Valley Realty", phone: "4799688800", url: "https://rivervalley.appfolio.com/listings/listings?filters%5Bcities%5D%5B%5D=Russellville", kind: "appfolio" },
  { key: "moore", name: "Moore & Co. Rental", label: "Moore & Co.", phone: "4799683300", url: "https://mooreforrent.managebuilding.com/Resident/Public/Rentals", kind: "buildium" }
];

const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();

function propertyLink(href, manager) {
  if (!href) return null;
  const url = new URL(href, manager.url);
  const detail = manager.kind === "appfolio"
    ? /^\/listings\/detail\/[a-f0-9-]+\/?$/i
    : /^\/resident\/public\/rentals\/\d+\/?$/i;
  return url.origin === new URL(manager.url).origin && detail.test(url.pathname) ? url.href : null;
}

function publishedAmount(value) {
  const text = clean(value);
  if (!/^\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) return null;
  const amount = Number(text.replace(/[$,]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function publicPhoto(src, base) {
  if (!src) return null;
  const photo = new URL(src, base);
  return photo.protocol === "https:" ? photo.href : null;
}

function explicitType(title, description, address) {
  const text = title + " " + description;
  if (/\b(?:townhome|townhouse)\b/i.test(text)) return "Townhouse";
  if (/\bduplex\b/i.test(text)) return "Duplex";
  if (/\b(?:tiny house|tiny home)\b/i.test(text)) return "Tiny house";
  if (/\b(?:single[- ]family|manufactured home|mobile home)\b/i.test(text)) return "House";
  if (/\bapartment\b/i.test(text) || /\bapt\.?\s+\w/i.test(address)) return "Apartment";
  if (/\b(?:condo|condominium)\b/i.test(text)) return "Condo";
  return null;
}

function appfolioRecords($, manager) {
  const cards = $(".js-listing-item");
  if (!cards.length && !/no (?:matching |available )?(?:listings|units|rentals)|no vacancies/i.test($("body").text())) {
    throw new Error("Unrecognized listings page");
  }
  const records = [];
  for (const element of cards) {
    const card = $(element);
    const location = clean(card.find(".js-listing-address").text()).match(/^(.+?),\s*Russellville,\s*AR\s+(\d{5})(?:-\d{4})?$/i);
    const title = clean(card.find(".js-listing-title").text());
    const description = clean(card.find(".js-listing-description").text());
    const specs = clean(card.find(".js-listing-blurb-bed-bath").first().text());
    const layout = specs.match(/^(?:(\d+)\s*(?:bd|beds?)|studio)\s*\/\s*(\d+(?:\.\d+)?)\s*(?:ba|baths?)\b/i);
    const commercial = card.find(".js-listing-commercial-category").length ||
      /\b(?:commercial (?:space|property|building|lease)|office space|retail space|restaurant (?:space|for lease))\b/i.test(title + " " + description);
    if (!location || !layout || commercial) continue;
    const rent = publishedAmount(card.find(".js-listing-blurb-rent").first().text());
    const source = propertyLink(card.find(".js-link-to-detail").attr("href"), manager);
    if (!source || !rent) continue;
    records.push({
      address: clean(location[1]), zip: location[2], rent, beds: Number(layout[1] || 0), baths: Number(layout[2]),
      type: explicitType(title, description, location[1]), source_url: source,
      image_url: publicPhoto(card.find("img.js-listing-image").attr("data-original"), manager.url)
    });
  }
  return records;
}

const buildiumTypes = { SingleFamily: "House", MultiFamily: "Apartment", CondoTownhome: null };
function buildiumRecords($, manager) {
  const cards = $("a.featured-listing");
  if (!cards.length && !/no matching results|no rentals available/i.test($("body").text())) {
    throw new Error("Unrecognized listings page");
  }
  const records = [];
  for (const element of cards) {
    const card = $(element);
    const location = clean(card.attr("data-location")).match(/^Russellville,\s*AR\|(\d{5})$/i);
    const kind = card.attr("data-type");
    const rent = publishedAmount(card.attr("data-rent"));
    const source = propertyLink(card.attr("href"), manager);
    const address = clean(card.find(".featured-listing__title").text());
    if (!location || !Object.hasOwn(buildiumTypes, kind) || !rent || !source || !address) continue;
    const layoutNumber = key => {
      const value = clean(card.attr(key));
      return /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : null;
    };
    records.push({
      address, zip: location[1], rent, beds: layoutNumber("data-bedrooms"), baths: layoutNumber("data-bathrooms"),
      type: buildiumTypes[kind] || explicitType(address, clean(card.find(".featured-listing__description").text()), address),
      source_url: source, image_url: publicPhoto(card.find(".featured-listing__image").attr("src"), manager.url)
    });
  }
  return records;
}

async function readManager(manager) {
  const records = new Map();
  const pages = new Set();
  let url = manager.url;
  while (url && !pages.has(url)) {
    pages.add(url);
    const response = await fetch(url, { headers: { "User-Agent": "Russellville.Rent public listing index (+https://russellville.rent)" }, signal: AbortSignal.timeout(25000) });
    if (!response.ok || new URL(response.url).origin !== new URL(manager.url).origin) {
      throw new Error("Could not read listings (" + response.status + ")");
    }
    const $ = load(await response.text());
    const found = manager.kind === "appfolio" ? appfolioRecords($, manager) : buildiumRecords($, manager);
    for (const item of found) {
      records.set(item.source_url, {
        id: manager.key + "-" + new URL(item.source_url).pathname.split("/").filter(Boolean).at(-1),
        ...item, city: "Russellville", state: "AR", manager: manager.name, source_name: manager.label,
        phone: manager.phone, image_verified: Boolean(item.image_url), updated_at: checkedAt
      });
    }
    const next = $("a[rel=next], .pagination a.next, .pagination .next a").first().attr("href");
    url = next ? new URL(next, response.url) : null;
    if (url && url.origin !== new URL(manager.url).origin) throw new Error("Unexpected pagination link");
    url = url?.href;
  }
  return Array.from(records.values());
}

const current = JSON.parse(await fs.readFile(output, "utf8"));
const results = await Promise.allSettled(managers.map(readManager));
if (results.every(result => result.status === "rejected")) throw new Error("All manager feeds failed; keeping the last published index.");
const listings = results.flatMap((result, index) => {
  const manager = managers[index];
  if (result.status === "fulfilled") {
    console.log(manager.label + ": " + result.value.length + " local residential listings");
    return result.value;
  }
  console.warn(manager.label + ": " + result.reason.message + ". Keeping previously sourced records with their original check dates.");
  return current.filter(item => item.manager === manager.name && item.updated_at && !item.seeded && propertyLink(item.source_url, manager));
});
listings.sort((a, b) => a.rent - b.rent || a.address.localeCompare(b.address));
const temporary = new URL("listings-" + process.pid + ".tmp", output);
await fs.writeFile(temporary, JSON.stringify(listings, null, 2) + "\n");
await fs.rename(temporary, output);
