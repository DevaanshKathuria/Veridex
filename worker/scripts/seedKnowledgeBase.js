"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const elasticsearch_1 = require("@elastic/elasticsearch");
const pinecone_1 = require("@pinecone-database/pinecone");
const axios_1 = __importDefault(require("axios"));
const ioredis_1 = __importDefault(require("ioredis"));
const mongoose_1 = __importDefault(require("mongoose"));
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
const redis = new ioredis_1.default(REDIS_URL, { maxRetriesPerRequest: null });
const es = new elasticsearch_1.Client({ node: ELASTICSEARCH_URL });
const pinecone = PINECONE_API_KEY ? new pinecone_1.Pinecone({ apiKey: PINECONE_API_KEY }) : null;
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
function chunkText(text, maxLength = 900) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
    const chunks = [];
    let current = "";
    for (const sentence of sentences) {
        if ((current + sentence).length > maxLength && current.trim()) {
            chunks.push(current.trim());
            current = sentence;
        }
        else {
            current += ` ${sentence}`;
        }
    }
    if (current.trim())
        chunks.push(current.trim());
    return chunks;
}
function deterministicEmbedding(text) {
    const vector = new Array(EMBEDDING_DIMENSIONS).fill(0);
    const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    for (const token of tokens) {
        const digest = node_crypto_1.default.createHash("sha256").update(token).digest();
        for (let i = 0; i < digest.length; i += 1) {
            const index = digest[i] % EMBEDDING_DIMENSIONS;
            vector[index] += digest[(i + 1) % digest.length] > 127 ? 1 : -1;
        }
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => value / norm);
}
async function getEmbedding(text) {
    const cacheKey = `embedding:${EMBEDDING_MODEL}:${node_crypto_1.default.createHash("sha256").update(text).digest("hex")}`;
    const cached = await redis.get(cacheKey);
    if (cached)
        return JSON.parse(cached);
    let embedding = deterministicEmbedding(text);
    if (OPENAI_API_KEY) {
        const response = await axios_1.default.post("https://api.openai.com/v1/embeddings", { model: EMBEDDING_MODEL, input: text, dimensions: EMBEDDING_DIMENSIONS }, { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, timeout: 30000 });
        embedding = response.data.data[0].embedding;
    }
    await redis.set(cacheKey, JSON.stringify(embedding), "EX", 60 * 60 * 24 * 30);
    return embedding;
}
async function ensureElasticsearchIndex() {
    const exists = await es.indices.exists({ index: EVIDENCE_INDEX });
    if (exists)
        return;
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
async function pineconeExists(chunkId) {
    if (!pinecone)
        return false;
    const index = pinecone.index(PINECONE_INDEX_NAME);
    try {
        const result = await index.namespace(PINECONE_NAMESPACE).fetch([chunkId]);
        return Boolean(result.records?.[chunkId]);
    }
    catch {
        return false;
    }
}
async function upsertChunk(chunk) {
    const exists = await pineconeExists(chunk.chunkId);
    const embedding = exists ? [] : await getEmbedding(chunk.chunkText);
    if (!exists && pinecone) {
        const index = pinecone.index(PINECONE_INDEX_NAME);
        await index.namespace(PINECONE_NAMESPACE).upsert([
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
        ]);
    }
    await es.index({
        index: EVIDENCE_INDEX,
        id: chunk.chunkId,
        document: chunk,
    });
    return exists ? "skipped" : "inserted";
}
async function wikipediaChunks() {
    const topics = Array.from(new Set(wikipediaTopics)).slice(0, 500);
    const chunks = [];
    for (const title of topics) {
        try {
            const slug = encodeURIComponent(title.replace(/ /g, "_"));
            const response = await axios_1.default.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`, { timeout: 10000 });
            const extract = String(response.data.extract ?? "");
            if (!extract)
                continue;
            chunkText(extract).forEach((text, index) => {
                chunks.push({
                    chunkId: `wiki-${node_crypto_1.default.createHash("sha1").update(`${title}-${index}`).digest("hex")}`,
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
        }
        catch {
            console.warn(`Wikipedia fetch skipped: ${title}`);
        }
    }
    return chunks;
}
async function worldBankChunks() {
    const chunks = [];
    for (const code of countryCodes) {
        try {
            const url = `https://api.worldbank.org/v2/country/${code}/indicator/NY.GDP.MKTP.CD?format=json&per_page=5`;
            const response = await axios_1.default.get(url, { timeout: 10000 });
            const rows = Array.isArray(response.data?.[1]) ? response.data[1] : [];
            const latest = rows.find((row) => row.value);
            if (!latest)
                continue;
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
        }
        catch {
            console.warn(`World Bank fetch skipped: ${code}`);
        }
    }
    return chunks;
}
async function rssChunks(feedUrl, source, limit) {
    try {
        const response = await axios_1.default.get(feedUrl, { timeout: 10000 });
        const items = [...String(response.data).matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit);
        return items.map((match, index) => {
            const item = match[1];
            const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/)?.[1] ?? item.match(/<title>(.*?)<\/title>/)?.[1] ?? "";
            const description = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ??
                item.match(/<description>(.*?)<\/description>/)?.[1] ??
                "";
            const link = item.match(/<link>(.*?)<\/link>/)?.[1] ?? feedUrl;
            const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1];
            return {
                chunkId: `${source.toLowerCase().replace(/\W+/g, "-")}-${node_crypto_1.default.createHash("sha1").update(`${title}-${index}`).digest("hex")}`,
                chunkText: `${title}. ${description.replace(/<[^>]+>/g, "")}`.trim(),
                source,
                sourceType: "news",
                sourceUrl: link,
                reliabilityTier: 2,
                publicationDate: pubDate ? new Date(pubDate).toISOString() : null,
                topicTags: ["news", source.toLowerCase()],
                language: "en",
            };
        }).filter((chunk) => chunk.chunkText.length > 20);
    }
    catch {
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
async function loadJson(filename) {
    const file = await promises_1.default.readFile(node_path_1.default.join(__dirname, "..", "data", filename), "utf8");
    return JSON.parse(file);
}
async function localDataChunks() {
    const [facts, falsehoods, whoFacts] = await Promise.all([
        loadJson("fact-seeds.json"),
        loadJson("known-falsehoods.json"),
        loadJson("who-facts.json"),
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
    }));
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
    }));
    return [...factChunks, ...falsehoodChunks];
}
async function main() {
    await mongoose_1.default.connect(MONGODB_URI);
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
        if (result === "inserted")
            inserted += 1;
        else
            skipped += 1;
        if ((index + 1) % 25 === 0) {
            console.log(`Seeded ${index + 1}/${chunks.length} chunks...`);
        }
    }
    await es.indices.refresh({ index: EVIDENCE_INDEX });
    console.log(`Knowledge base seed complete. Inserted ${inserted}, skipped ${skipped}.`);
    await redis.quit();
    await mongoose_1.default.disconnect();
}
main().catch(async (error) => {
    console.error("Knowledge base seed failed", error);
    await redis.quit().catch(() => undefined);
    await mongoose_1.default.disconnect().catch(() => undefined);
    process.exit(1);
});
