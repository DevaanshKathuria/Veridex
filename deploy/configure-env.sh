#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <reserved-public-ipv4>" >&2
  exit 1
fi

if [[ -e .env.production ]]; then
  echo ".env.production already exists; refusing to overwrite it." >&2
  exit 1
fi

public_ip="$1"
if [[ ! "$public_ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  echo "Expected an IPv4 address, received: $public_ip" >&2
  exit 1
fi

IFS=. read -r octet1 octet2 octet3 octet4 <<<"$public_ip"
for octet in "$octet1" "$octet2" "$octet3" "$octet4"; do
  if ((10#$octet > 255)); then
    echo "Invalid IPv4 address: $public_ip" >&2
    exit 1
  fi
done

dashed_ip="${public_ip//./-}"
cp .env.production.example .env.production
sed -i "s/203-0-113-10/${dashed_ip}/g" .env.production
sed -i "s/replace_with_generated_access_secret/$(openssl rand -hex 32)/" .env.production
sed -i "s/replace_with_generated_refresh_secret/$(openssl rand -hex 32)/" .env.production
chmod 600 .env.production

echo "Created .env.production for https://veridex.${dashed_ip}.sslip.io"
echo "Now edit AI_API_KEY and PINECONE_API_KEY before starting the stack."
