# Zero-cost production-style deployment

This profile runs the full seven-service Veridex stack plus Caddy on one Oracle
Cloud Always Free Ampere A1 VM. It uses Gemini's free API tier for chat and
embeddings, Pinecone Starter for vectors, and an `sslip.io` hostname for a
publicly trusted HTTPS URL. No custom domain or paid service is required.

This is a portfolio/demo deployment, not an SLA-backed production service.
Oracle can run out of free A1 capacity, free Gemini requests are rate-limited,
and Google states that free-tier API inputs may be used to improve its products.
Do not submit private or sensitive text to the public demo.

## 1. Create the free resources

1. Create an [Oracle Cloud Free Tier account](https://signup.cloud.oracle.com/).
   Oracle requires a real card for identity verification but says it will not
   charge it unless the account is upgraded.
2. In Google AI Studio, create a [Gemini API key](https://aistudio.google.com/app/apikey).
   Keep that project on the Free tier and do not attach billing for a hard $0
   ceiling.
3. Keep the existing Pinecone project on the Starter plan. Its `veridex-kb`
   index must use 384 dimensions and cosine similarity.

## 2. Provision the Oracle VM

In the tenancy's **home region**, create one Compute instance with:

- Image: Ubuntu 24.04 (AArch64), marked Always Free eligible
- Shape: `VM.Standard.A1.Flex`
- Size: **2 OCPUs and 12 GB RAM**
- Boot volume: 100 GB or less (the tenancy has 200 GB total Always Free block storage)
- Networking: public subnet and a reserved public IPv4 address

Add ingress rules to the subnet security list:

| Source | Protocol | Port | Purpose |
|---|---|---:|---|
| Your current public IP `/32` | TCP | 22 | SSH |
| `0.0.0.0/0` | TCP | 80 | ACME challenge + HTTPS redirect |
| `0.0.0.0/0` | TCP | 443 | HTTPS application |

Do not expose 3000, 4000, 6379, 8000, 9200, or 27017. Those services are
reachable only on the private Docker network.

If Oracle reports **out of host capacity**, try another availability domain in
the home region or retry later. This is the most common limitation of the free
A1 shape.

## 3. Install and configure Veridex

SSH into the VM, then run:

```bash
git clone https://github.com/DevaanshKathuria/Veridex.git
cd Veridex
chmod +x deploy/bootstrap-ubuntu.sh deploy/configure-env.sh
./deploy/bootstrap-ubuntu.sh
```

Log out and SSH back in so Docker group membership applies. Then:

```bash
cd Veridex
./deploy/configure-env.sh YOUR_RESERVED_PUBLIC_IP
nano .env.production
```

Replace only these placeholders:

- `AI_API_KEY` with the Gemini key
- `PINECONE_API_KEY` with the existing Pinecone Starter key
- optionally `ADMIN_EMAILS` with the email you will register in Veridex

The configuration script generates independent 256-bit JWT secrets, creates an
IP-based hostname such as `veridex.203-0-113-10.sslip.io`, and protects the env
file with mode `600`.

## 4. Start and seed

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

The first build can take 20–45 minutes on the two-core ARM VM. Wait until every
service with a health check reports `healthy`, then rebuild both vector and BM25
evidence with the same Gemini embedding model used at query time:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml \
  exec -e FORCE_REEMBED=true worker npm run seed:kb
```

The seeder retries free-tier rate limits automatically. It is safe to rerun; the
chunk IDs are deterministic.

Open the URL printed by `deploy/configure-env.sh`, register, and run a short
analysis. Caddy obtains and renews the TLS certificate automatically.

## 5. Verify and operate

```bash
# Only SSH, HTTP, and HTTPS should be public listeners
sudo ss -lntp

# Follow the stack
docker compose --env-file .env.production -f docker-compose.production.yml logs -f --tail=100

# Pull and deploy a later revision
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build

# Stop without deleting data
docker compose --env-file .env.production -f docker-compose.production.yml stop
```

Never run `down -v` unless you intentionally want to delete MongoDB,
Elasticsearch, Redis, Caddy certificate, and model-cache volumes. Keep
`.env.production` off Git; it is already ignored.

## What “completely free” means here

- Oracle: Always Free A1 compute and block storage only
- Gemini: Free API project with billing not linked
- Pinecone: Starter plan only
- DNS: free `sslip.io` IP hostname
- TLS: free automatic certificates through Caddy

A custom domain would be the only unavoidable optional purchase. The generated
`sslip.io` hostname is stable as long as the reserved Oracle IP remains assigned.
