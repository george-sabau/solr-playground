/**
 * Writes deterministic showcase JSON for Solr `post` (array of docs).
 * Run: node scripts/generate-solr-seed.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "solr", "data");
mkdirSync(outDir, { recursive: true });

const brands = [
  "Acme",
  "Acmé",
  "Northwind",
  "Contoso",
  "Fabrikam",
  "Initech",
  "Umbrella Corp",
  "Tyrell",
  "Cyberdyne",
  "Wonka",
];

const productCategories = [
  ["electronics", "gadgets"],
  ["home", "kitchen"],
  ["outdoor", "sports"],
  ["office", "supplies"],
  ["books", "media"],
  ["toys", "kids"],
  ["music", "instruments"],
  ["garden", "tools"],
];

const productTags = [
  ["bestseller", "gift"],
  ["clearance", "limited"],
  ["new", "featured"],
  ["eco", "organic"],
  ["premium", "warranty"],
  ["starter", "budget"],
  ["pro", "studio"],
  ["portable", "travel"],
];

const products = [];
for (let i = 1; i <= 40; i++) {
  const id = `p-${String(i).padStart(3, "0")}`;
  const brand = brands[i % brands.length];
  const price = Math.round((5 + (i % 17) * 13.37 + (i % 7) * 49.99) * 100) / 100;
  const rating = Math.min(5, Math.round((3 + (i % 5) * 0.35 + (i % 3) * 0.2) * 10) / 10);
  const stock = (i * 7) % 200;
  const inStock = i % 11 !== 0;
  const year = 2019 + (i % 6);
  const month = String((i % 12) + 1).padStart(2, "0");
  const day = String((i % 27) + 1).padStart(2, "0");
  const createdAt = `${year}-${month}-${day}T10:30:00Z`;
  const cats = productCategories[i % productCategories.length];
  const tags = productTags[i % productTags.length];
  products.push({
    id,
    name: `${brand} Widget ${i} — ${i % 2 ? "Pro" : "Lite"}`,
    description: `Showcase product ${i}. Great for wildcard *widget*, fuzzy brand search, and phrase queries on "${brand}". ${
      i % 3 === 0 ? "Includes proximity-friendly phrases like solr playground near me." : ""
    }`,
    brand,
    categories: cats,
    tags,
    price,
    rating,
    stock,
    in_stock: inStock,
    created_at: createdAt,
  });
}

const firstNames = [
  "Jane",
  "John",
  "Alex",
  "Sam",
  "Riley",
  "Morgan",
  "Taylor",
  "Jordan",
  "Casey",
  "Quinn",
];
const lastNames = [
  "Doe",
  "Smith",
  "Nguyen",
  "Garcia",
  "Müller",
  "Tanaka",
  "Silva",
  "Kowalski",
  "Okafor",
  "Chen",
];
const cities = [
  "Berlin",
  "Paris",
  "Austin",
  "Toronto",
  "Sydney",
  "Lagos",
  "Mumbai",
  "Seattle",
  "Lisbon",
  "Oslo",
];
const states = ["TX", "CA", "NY", "ON", "NSW", "BE", "BY", "WA", "OR", "LN"];
const countries = ["DE", "FR", "US", "CA", "AU", "NG", "IN", "US", "PT", "NO"];
const segments = ["VIP", "regular", "churned"];
const interestPools = [
  ["search", "analytics"],
  ["music", "travel"],
  ["sports", "gadgets"],
  ["books", "coffee"],
  ["garden", "diy"],
  ["photography", "design"],
];

const customers = [];
for (let i = 1; i <= 40; i++) {
  const id = `c-${String(i).padStart(3, "0")}`;
  const fn = firstNames[i % firstNames.length];
  const ln = lastNames[i % lastNames.length];
  const full = `${fn} ${ln}`;
  const year = 2018 + (i % 7);
  const month = String((i % 12) + 1).padStart(2, "0");
  const day = String((i % 25) + 1).padStart(2, "0");
  const signup = `${year}-${month}-${day}T08:00:00Z`;
  const ltv = Math.round((120 + i * 42.5 + (i % 9) * 199.99) * 100) / 100;
  const loyalty = Math.min(5, Math.round((2.5 + (i % 6) * 0.4) * 10) / 10);
  customers.push({
    id,
    first_name: fn,
    last_name: ln,
    full_name: full,
    email: `${fn.toLowerCase()}.${ln.toLowerCase()}+${i}@example.test`,
    city: cities[i % cities.length],
    state: states[i % states.length],
    country: countries[i % countries.length],
    segment: segments[i % segments.length],
    interests: interestPools[i % interestPools.length],
    signup_date: signup,
    lifetime_value: ltv,
    loyalty_score: loyalty,
    is_active: i % 8 !== 0,
  });
}

writeFileSync(join(outDir, "products.json"), JSON.stringify(products, null, 2));
writeFileSync(join(outDir, "customers.json"), JSON.stringify(customers, null, 2));
console.log(`Wrote ${products.length} products, ${customers.length} customers -> ${outDir}`);
