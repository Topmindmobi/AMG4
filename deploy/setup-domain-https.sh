#!/usr/bin/env bash
# Install host nginx + Let's Encrypt for amgstores.ai → AMG.COM on :8090
set -euo pipefail

DOMAIN="${DOMAIN:-amgstores.ai}"
WWW="www.${DOMAIN}"
EMAIL="${CERTBOT_EMAIL:-info@amgstores.ai}"
APP_ROOT="${APP_ROOT:-/opt/amg-com}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx

install -d -m 755 /var/www/html
install -m 644 "${APP_ROOT}/deploy/nginx-amg-com.conf" /etc/nginx/sites-available/amg-com
ln -sfn /etc/nginx/sites-available/amg-com /etc/nginx/sites-enabled/amg-com
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl reload nginx

# Wait briefly for DNS if just updated
echo "Checking DNS for ${DOMAIN}..."
for i in $(seq 1 30); do
  ip=$(getent ahostsv4 "${DOMAIN}" | awk '{print $1; exit}' || true)
  if [[ -n "${ip}" ]]; then
    echo "Resolved ${DOMAIN} → ${ip}"
    break
  fi
  sleep 5
done

certbot --nginx -d "${DOMAIN}" -d "${WWW}" \
  --non-interactive --agree-tos -m "${EMAIL}" \
  --redirect

# Point app at HTTPS origin (NEXT_PUBLIC_* is baked in at build time — rebuild after this)
ENV_FILE="${APP_ROOT}/.env"
if [[ -f "${ENV_FILE}" ]]; then
  sed -i "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=https://${DOMAIN}|" "${ENV_FILE}" || true
  cd "${APP_ROOT}"
  docker compose -p amg-com -f docker-compose.droplet.yml --env-file .env up -d --build web
fi

echo "Done. Open https://${DOMAIN}"
