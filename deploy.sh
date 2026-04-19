#!/usr/bin/env bash
# BASIRET — production deploy
#
# SSHes into the Hetzner VPS, pulls latest code from GitHub, and rebuilds
# the docker-compose.prod.yml stack. Idempotent — safe to re-run.
#
# Usage (locally or from GitHub Actions):
#   ./deploy.sh
#
# Required env (override defaults via shell or CI secrets):
#   SSH_HOST   — server IP or hostname        (default: 178.104.191.148)
#   SSH_USER   — SSH user                     (default: deploy)
#   SSH_PORT   — SSH port                     (default: 22)
#   REPO_DIR   — checkout location on server  (default: /opt/basiret)
#   BRANCH     — branch to deploy             (default: main)
#
# In GitHub Actions, SSH_KEY is already loaded into ssh-agent by
# webfactory/ssh-agent — no key handling needed in this script.

set -euo pipefail

SSH_HOST="${SSH_HOST:-178.104.191.148}"
SSH_USER="${SSH_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"
REPO_DIR="${REPO_DIR:-/opt/basiret}"
BRANCH="${BRANCH:-main}"

echo "→ Deploying ${BRANCH} to ${SSH_USER}@${SSH_HOST}:${REPO_DIR}"

ssh -o StrictHostKeyChecking=accept-new \
    -o ServerAliveInterval=30 \
    -p "${SSH_PORT}" \
    "${SSH_USER}@${SSH_HOST}" \
    REPO_DIR="${REPO_DIR}" BRANCH="${BRANCH}" bash -s <<'REMOTE'
set -euo pipefail

cd "${REPO_DIR}"

echo "→ Fetching ${BRANCH} from origin"
git fetch --prune origin
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"

echo "→ Rebuilding stack with docker-compose.prod.yml"
docker compose -f docker-compose.prod.yml --env-file .env up --build -d

echo "→ Pruning dangling images"
docker image prune -f

echo "→ Container status:"
docker compose -f docker-compose.prod.yml ps
REMOTE

echo "✓ Deploy complete"
