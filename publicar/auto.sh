#!/bin/bash
# Publica un Reel ya subido a este repo: ./publicar/auto.sh <nombre>
# (usa <nombre>-instagram.mp4 y publicar/descripcion-<nombre>.txt). El token lo pone el proxy del entorno.
set -e
cd "$(dirname "$0")"
n=$1
url="https://raw.githubusercontent.com/derek100aron-dotcom/curiosidades-md-videos/main/$n-instagram.mp4"
export NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
id=$(node publicar.mjs desde-url "$url" "$(cat descripcion-$n.txt)" | tee /dev/stderr | sed -n 's/^LISTO_PARA_PUBLICAR //p')
[ -n "$id" ] && node publicar.mjs publicar "$id"
