#!/bin/bash
# PhotoQuote v2 — túnel persistente via cloudflared (porta 8082) na VPS de extração.
# Usa cloudflared (NÃO o ngrok da Expo) pra evitar conflito com o ngrok do BolsaTCG (porta 4040).
# Roda dentro do tmux (session "pquote").
cd /root/PhotoQuote-NOVO || exit 1

# 1) cloudflared expõe o Metro local (8082) numa URL pública https
pkill -f "cloudflared tunnel --url http://localhost:8082" 2>/dev/null
sleep 1
cloudflared tunnel --url http://localhost:8082 --no-autoupdate > /root/pquote-cf.log 2>&1 &

# 2) espera a URL trycloudflare aparecer
URL=""
for i in $(seq 1 40); do
  URL=$(grep -oE 'https://[a-z0-9.-]+\.trycloudflare\.com' /root/pquote-cf.log | head -1)
  [ -n "$URL" ] && break
  sleep 2
done
echo "CF_URL=$URL"

# 3) Metro em modo LAN, mas anunciando a URL pública do cloudflared (Expo Go acessa por ela)
export EXPO_GO_DEV=1
export EXPO_OFFLINE=1
export EXPO_PACKAGER_PROXY_URL="$URL"
exec npx expo start --port 8082 --lan
