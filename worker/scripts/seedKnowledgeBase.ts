import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { Client as ElasticsearchClient } from "@elastic/elasticsearch";
import { Pinecone } from "@pinecone-database/pinecone";
import axios from "axios";
import IORedis from "ioredis";
import mongoose from "mongoose";

function loadEnv(): void {
  const candidates = [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "..", ".env")];
  for (const filePath of candidates) {
    try {
      const contents = require("node:fs").readFileSync(filePath, "utf8") as string;
      for (const line of contents.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [key, ...parts] = trimmed.split("=");
        if (process.env[key] === undefined) process.env[key] = parts.join("=").replace(/^['"]|['"]$/g, "");
      }
    } catch {
      // Ignore missing .env files; Docker Compose injects env directly.
    }
  }
  if (!require("node:fs").existsSync("/.dockerenv")) {
    const replacements: Record<string, [string, string]> = {
      MONGODB_URI: ["mongodb://mongodb:", "mongodb://127.0.0.1:"],
      REDIS_URL: ["redis://redis:", "redis://127.0.0.1:"],
      ML_SERVICE_URL: ["http://ml:", "http://127.0.0.1:"],
      ELASTICSEARCH_URL: ["http://elasticsearch:", "http://127.0.0.1:"],
    };
    for (const [key, [from, to]] of Object.entries(replacements)) {
      const value = process.env[key];
      if (value?.startsWith(from)) process.env[key] = value.replace(from, to);
    }
  }
}

loadEnv();

type SeedChunk = {
  chunkId: string;
  chunkText: string;
  source: string;
  sourceType: "encyclopedia" | "official" | "news" | "curated" | "debunk";
  sourceUrl: string;
  reliabilityTier: 1 | 2 | 3;
  publicationDate: string | null;
  topicTags: string[];
  language: string;
};

type FactSeed = { id: string; text: string; source: string; url: string };
type FalsehoodSeed = {
  id: string;
  claim: string;
  verdict: string;
  debunkSource: string;
  debunkUrl: string;
  explanation: string;
};

const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/veridex";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL ?? "http://127.0.0.1:9200";
const PINECONE_API_KEY = process.env.PINECONE_API_KEY ?? "";
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME ?? "veridex-kb";
const PINECONE_NAMESPACE = "kb-v1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS ?? 384);
const EVIDENCE_INDEX = "veridex-evidence";

const redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const es = new ElasticsearchClient({ node: ELASTICSEARCH_URL });
const pinecone = PINECONE_API_KEY ? new Pinecone({ apiKey: PINECONE_API_KEY }) : null;

const wikipediaTopics = [
  "Joe Biden", "Vladimir Putin", "Narendra Modi", "Xi Jinping", "Emmanuel Macron", "Olaf Scholz", "Giorgia Meloni",
  "Fumio Kishida", "Luiz Inacio Lula da Silva", "Justin Trudeau", "Volodymyr Zelenskyy", "Recep Tayyip Erdogan",
  "Mohammed bin Salman", "United States", "India", "China", "Russia", "Germany", "France", "Brazil", "Japan",
  "United Kingdom", "Australia", "Canada", "South Korea", "Mexico", "Indonesia", "South Africa", "Nigeria",
  "Apple Inc.", "Google", "Microsoft", "Amazon (company)", "Tesla, Inc.", "SpaceX", "OpenAI", "Meta Platforms",
  "Nvidia", "TSMC", "Climate change", "COVID-19", "MRNA vaccine", "CRISPR", "Quantum computing", "Nuclear fusion",
  "World War II", "Cold War", "2008 financial crisis", "September 11 attacks", "French Revolution",
  "Industrial Revolution", "Gross domestic product", "Inflation", "Interest rate", "Federal Reserve", "International Monetary Fund",
  "World Bank", "World Health Organization", "Cancer", "Diabetes", "Malaria", "HIV/AIDS", "Antibiotic", "Internet",
  "Artificial intelligence", "Blockchain", "Semiconductor", "Olympic Games", "FIFA World Cup", "United Nations",
  "European Union", "NATO", "Solar System", "Earth", "Moon", "Mars", "Photosynthesis", "DNA", "Evolution",
  "Plate tectonics", "Gravity", "General relativity", "Periodic table", "Water", "Carbon dioxide", "Ozone layer",
  "Renewable energy", "Nuclear power", "Electric vehicle", "World Trade Organization", "Paris Agreement",
  "Bretton Woods system", "Treaty of Versailles", "Magna Carta", "American Civil War", "Roman Empire",
  "Ancient Egypt", "Mughal Empire", "Ottoman Empire", "Silk Road", "Black Death", "Green Revolution",
  "Human Genome Project", "Large Hadron Collider", "International Space Station", "Hubble Space Telescope",
  "James Webb Space Telescope", "Mount Everest", "Amazon River", "Nile", "Sahara", "Pacific Ocean", "Atlantic Ocean",
  "Arctic Ocean", "Antarctica", "Greenland", "Tokyo", "Delhi", "Paris", "London", "Washington, D.C.", "Berlin",
  "Canberra", "Ottawa", "Seoul", "Brasilia", "Beijing", "Moscow", "New York City", "Los Angeles", "Mumbai",
  "Euro", "United States dollar", "Japanese yen", "Pound sterling", "Renminbi", "Bitcoin", "Ethereum",
  "Machine learning", "Deep learning", "Neural network", "Computer virus", "World Wide Web", "Linux", "Android (operating system)",
  "IOS", "Cloud computing", "5G", "Wi-Fi", "GPS", "Bluetooth", "USB", "HTML", "JavaScript", "Python (programming language)",
  "C (programming language)", "TypeScript", "PostgreSQL", "MongoDB", "Redis", "Elasticsearch", "Pinecone (vector database)",
  "Tuberculosis", "Measles", "Polio", "Smallpox", "Vaccination", "Insulin", "Penicillin", "Aspirin", "Hypertension",
  "Alzheimer's disease", "Parkinson's disease", "Cholera", "Ebola", "Zika fever", "SARS-CoV-2", "UNESCO",
  "UNICEF", "Red Cross", "OPEC", "G7", "G20", "ASEAN", "African Union", "Mercosur", "NAFTA", "USMCA",
  "Apollo 11", "Artemis program", "Sputnik 1", "Yuri Gagarin", "Neil Armstrong", "Marie Curie", "Albert Einstein",
  "Isaac Newton", "Charles Darwin", "Ada Lovelace", "Alan Turing", "Rosalind Franklin", "Nelson Mandela",
  "Mahatma Gandhi", "Martin Luther King Jr.", "Abraham Lincoln", "George Washington", "Winston Churchill",
  "Florence Nightingale", "Mother Teresa", "Malala Yousafzai", "Rosa Parks", "Katherine Johnson",
];

const countryCodes = [
  "US", "CN", "JP", "DE", "IN", "GB", "FR", "IT", "CA", "BR", "RU", "KR", "AU", "ES", "MX", "ID", "NL", "SA", "TR",
  "CH", "PL", "SE", "BE", "TH", "IE", "AR", "NO", "IL", "SG", "AE", "ZA", "MY", "PH", "VN", "BD", "PK", "EG", "NG",
  "KE", "ET", "GH", "CL", "CO", "PE", "NZ", "DK", "FI", "PT", "GR", "CZ",
];

function chunkText(text: string, maxLength = 900): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + sentence).length > maxLength && current.trim()) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += ` ${sentence}`;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function deterministicEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const token of tokens) {
    const digest = crypto.createHash("sha256").update(token).digest();
    for (let i = 0; i < digest.length; i += 1) {
      const index = digest[i] % EMBEDDING_DIMENSIONS;
      vector[index] += digest[(i + 1) % digest.length] > 127 ? 1 : -1;
    }
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

async function getEmbedding(text: string): Promise<number[]> {
  const cacheKey = `embedding:${EMBEDDING_MODEL}:${crypto.createHash("sha256").update(text).digest("hex")}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as number[];

  let embedding = deterministicEmbedding(text);
  if (OPENAI_API_KEY) {
    const response = await axios.post(
      "https://api.openai.com/v1/embeddings",
      { model: EMBEDDING_MODEL, input: text, dimensions: EMBEDDING_DIMENSIONS },
      { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, timeout: 30_000 },
    );
    embedding = response.data.data[0].embedding;
  }
  await redis.set(cacheKey, JSON.stringify(embedding), "EX", 60 * 60 * 24 * 30);
  return embedding;
}

async function ensureElasticsearchIndex(): Promise<void> {
  const exists = await es.indices.exists({ index: EVIDENCE_INDEX });
  if (exists) return;
  await es.indices.create({
    index: EVIDENCE_INDEX,
    mappings: {
      properties: {
        chunkId: { type: "keyword" },
        chunkText: { type: "text", analyzer: "english" },
        source: { type: "keyword" },
        sourceType: { type: "keyword" },
        sourceUrl: { type: "keyword" },
        reliabilityTier: { type: "integer" },
        publicationDate: { type: "date" },
        topicTags: { type: "keyword" },
        language: { type: "keyword" },
      },
    },
  });
}

async function pineconeExists(chunkId: string): Promise<boolean> {
  if (!pinecone) return false;
  const index = pinecone.index(PINECONE_INDEX_NAME);
  try {
    const result = await (index.namespace(PINECONE_NAMESPACE) as any).fetch([chunkId]);
    return Boolean(result.records?.[chunkId]);
  } catch {
    return false;
  }
}

async function upsertChunk(chunk: SeedChunk): Promise<"inserted" | "skipped"> {
  const exists = await pineconeExists(chunk.chunkId);
  const embedding = exists ? [] : await getEmbedding(chunk.chunkText);

  if (!exists && pinecone) {
    const index = pinecone.index(PINECONE_INDEX_NAME);
    await index.namespace(PINECONE_NAMESPACE).upsert({
      records: [
        {
          id: chunk.chunkId,
          values: embedding,
          metadata: {
            chunkText: chunk.chunkText,
            source: chunk.source,
            sourceType: chunk.sourceType,
            sourceUrl: chunk.sourceUrl,
            reliabilityTier: chunk.reliabilityTier,
            publicationDate: chunk.publicationDate ?? "",
            topicTags: chunk.topicTags,
            language: chunk.language,
          },
        },
      ],
    });
  }

  await es.index({
    index: EVIDENCE_INDEX,
    id: chunk.chunkId,
    document: chunk,
  });
  return exists ? "skipped" : "inserted";
}

async function wikipediaChunks(): Promise<SeedChunk[]> {
  const topics = Array.from(new Set(wikipediaTopics)).slice(0, 500);
  const chunks: SeedChunk[] = [];
  for (const title of topics) {
    try {
      const slug = encodeURIComponent(title.replace(/ /g, "_"));
      const response = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`, { timeout: 3_000 });
      const extract = String(response.data.extract ?? "");
      if (!extract) continue;
      chunkText(extract).forEach((text, index) => {
        chunks.push({
          chunkId: `wiki-${crypto.createHash("sha1").update(`${title}-${index}`).digest("hex")}`,
          chunkText: text,
          source: "Wikipedia",
          sourceType: "encyclopedia",
          sourceUrl: response.data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${slug}`,
          reliabilityTier: 1,
          publicationDate: null,
          topicTags: ["wikipedia", title.toLowerCase()],
          language: "en",
        });
      });
    } catch {
      console.warn(`Wikipedia fetch skipped: ${title}`);
    }
  }
  return chunks;
}

async function worldBankChunks(): Promise<SeedChunk[]> {
  const chunks: SeedChunk[] = [];
  for (const code of countryCodes) {
    try {
      const url = `https://api.worldbank.org/v2/country/${code}/indicator/NY.GDP.MKTP.CD?format=json&per_page=5`;
      const response = await axios.get(url, { timeout: 3_000 });
      const rows = Array.isArray(response.data?.[1]) ? response.data[1] : [];
      const latest = rows.find((row: any) => row.value);
      if (!latest) continue;
      chunks.push({
        chunkId: `worldbank-gdp-${code}-${latest.date}`,
        chunkText: `According to the World Bank, ${latest.country.value} had a GDP of ${latest.value} current US dollars in ${latest.date}.`,
        source: "World Bank",
        sourceType: "official",
        sourceUrl: url,
        reliabilityTier: 1,
        publicationDate: `${latest.date}-01-01`,
        topicTags: ["world-bank", "gdp", code.toLowerCase()],
        language: "en",
      });
    } catch {
      console.warn(`World Bank fetch skipped: ${code}`);
    }
  }
  return chunks;
}

async function rssChunks(feedUrl: string, source: string, limit: number): Promise<SeedChunk[]> {
  try {
    const response = await axios.get(feedUrl, { timeout: 10_000 });
    const items = [...String(response.data).matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit);
    return items.map((match, index) => {
      const item = match[1];
      const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/)?.[1] ?? item.match(/<title>(.*?)<\/title>/)?.[1] ?? "";
      const description =
        item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ??
        item.match(/<description>(.*?)<\/description>/)?.[1] ??
        "";
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] ?? feedUrl;
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1];
      return {
        chunkId: `${source.toLowerCase().replace(/\W+/g, "-")}-${crypto.createHash("sha1").update(`${title}-${index}`).digest("hex")}`,
        chunkText: `${title}. ${description.replace(/<[^>]+>/g, "")}`.trim(),
        source,
        sourceType: "news",
        sourceUrl: link,
        reliabilityTier: 2,
        publicationDate: pubDate ? new Date(pubDate).toISOString() : null,
        topicTags: ["news", source.toLowerCase()],
        language: "en",
      } satisfies SeedChunk;
    }).filter((chunk) => chunk.chunkText.length > 20);
  } catch {
    console.warn(`${source} RSS blocked; using static placeholders.`);
    return [
      {
        chunkId: `${source.toLowerCase()}-placeholder-001`,
        chunkText: `${source} publishes international, political, business, and public-interest news reports with editorial review.`,
        source,
        sourceType: "news",
        sourceUrl: feedUrl,
        reliabilityTier: 2,
        publicationDate: null,
        topicTags: ["news", source.toLowerCase()],
        language: "en",
      },
    ];
  }
}

async function loadJson<T>(filename: string): Promise<T[]> {
  const file = await fs.readFile(path.join(__dirname, "..", "data", filename), "utf8");
  return JSON.parse(file) as T[];
}

async function localDataChunks(): Promise<SeedChunk[]> {
  const [facts, falsehoods, whoFacts] = await Promise.all([
    loadJson<FactSeed>("fact-seeds.json"),
    loadJson<FalsehoodSeed>("known-falsehoods.json"),
    loadJson<FactSeed>("who-facts.json"),
  ]);

  const factChunks = [...facts, ...whoFacts].map((fact) => ({
    chunkId: fact.id,
    chunkText: fact.text,
    source: fact.source,
    sourceType: fact.source === "WHO" ? "official" : "curated",
    sourceUrl: fact.url,
    reliabilityTier: fact.source === "WHO" ? 1 : 3,
    publicationDate: null,
    topicTags: ["curated-fact"],
    language: "en",
  })) satisfies SeedChunk[];

  const falsehoodChunks = falsehoods.map((item) => ({
    chunkId: item.id,
    chunkText: `False claim: ${item.claim} Debunk: ${item.explanation}`,
    source: item.debunkSource,
    sourceType: "debunk",
    sourceUrl: item.debunkUrl,
    reliabilityTier: 3,
    publicationDate: null,
    topicTags: ["known-falsehood", item.verdict.toLowerCase()],
    language: "en",
  })) satisfies SeedChunk[];

  return [...factChunks, ...falsehoodChunks];
}

async function main(): Promise<void> {
  await mongoose.connect(MONGODB_URI);
  await ensureElasticsearchIndex();

  console.log("Loading seed sources...");
  const sourceSets = await Promise.all([
    wikipediaChunks(),
    worldBankChunks(),
    rssChunks("https://feeds.reuters.com/reuters/topNews", "Reuters", 100),
    rssChunks("https://rss.ap.org/feed", "AP News", 50),
    localDataChunks(),
  ]);
  const chunks = sourceSets.flat();

  console.log(`Prepared ${chunks.length} chunks. Pinecone ${pinecone ? "enabled" : "skipped (missing PINECONE_API_KEY)"}.`);
  let inserted = 0;
  let skipped = 0;
  for (const [index, chunk] of chunks.entries()) {
    const result = await upsertChunk(chunk);
    if (result === "inserted") inserted += 1;
    else skipped += 1;
    if ((index + 1) % 25 === 0) {
      console.log(`Seeded ${index + 1}/${chunks.length} chunks...`);
    }
  }

  await es.indices.refresh({ index: EVIDENCE_INDEX });
  console.log(`Knowledge base seed complete. Inserted ${inserted}, skipped ${skipped}.`);
  await redis.quit();
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Knowledge base seed failed", error);
  await redis.quit().catch(() => undefined);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
