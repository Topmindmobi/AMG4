# Deploy AMG.COM to DigitalOcean

Supabase (Auth, Postgres, Storage) stays **external**. Run migrations and seed in your Supabase project before going live — see [README](README.md#supabase-setup-production).

`doctl` is optional. If it is not installed, use the App Platform UI below.

## Environment variables (App Platform / Docker)

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (prod) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (prod) | Supabase anon (public) key |
| `NEXT_PUBLIC_DEMO_MODE` | Yes | Set to `false` in production |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Optional; server/admin helpers only — never expose to the client |
| `TWILIO_ACCOUNT_SID` | No* | Twilio Account SID — SMS on order confirmed / dispatched |
| `TWILIO_AUTH_TOKEN` | No* | Twilio Auth Token (**Run time** only — never bake into client) |
| `TWILIO_PHONE_NUMBER` | No* | Twilio sender number in E.164 (e.g. `+254…`), **or** set Messaging Service SID |
| `TWILIO_MESSAGING_SERVICE_SID` | No | Optional alternative to `TWILIO_PHONE_NUMBER` |

\*SMS is soft-fail: if Twilio vars are missing or send fails, order status updates still succeed.

`NEXT_PUBLIC_*` values are baked into the client at **build** time. Set them as build-time (or run-and-build-time) env vars on App Platform, or as Docker `--build-arg`s.

Do not put secrets in git, `Dockerfile`, or `.do/app.yaml`.

HTTP port: **3000**.

---

## Option A — App Platform (recommended)

### UI (shortest path)

1. Push this repo to GitHub (include `Dockerfile` and `.do/app.yaml`).
2. In [DigitalOcean Apps](https://cloud.digitalocean.com/apps) → **Create App** → connect **GitHub** → select the repo and branch (`main`).
3. App Platform should detect the **Dockerfile**. Confirm **HTTP port `3000`**.
4. Under **Environment Variables**, add:

   - `NEXT_PUBLIC_SUPABASE_URL` — secret, scope **Run and build time**
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — secret, scope **Run and build time**
   - `NEXT_PUBLIC_DEMO_MODE` = `false` — run and build time
   - `SUPABASE_SERVICE_ROLE_KEY` — optional secret, **Run time** only
   - `TWILIO_ACCOUNT_SID` — secret, **Run time** only (order SMS)
   - `TWILIO_AUTH_TOKEN` — secret, **Run time** only
   - `TWILIO_PHONE_NUMBER` — secret, **Run time** only (or `TWILIO_MESSAGING_SERVICE_SID`)

5. Pick a region (spec default: `fra`) and plan → **Create Resources**.
6. After deploy, open the live URL. In Supabase Auth → URL configuration, add your DO app URL to redirect/allow lists.
7. **Domain / SSL**: App Settings → Domains → add a custom domain. App Platform provisions TLS automatically once DNS points at the app.

Edit `.do/app.yaml` and set `github.repo` to your `org/repo` if you deploy from the CLI.

### CLI (`doctl`) — when installed and authenticated

```bash
# Install: https://docs.digitalocean.com/reference/doctl/how-to/install/
doctl auth init
# Edit .do/app.yaml → set github.repo, then:
doctl apps create --spec .do/app.yaml
# Set secret values in the control panel (Settings → App-Level Environment Variables),
# or update the app after create:
# doctl apps update <APP_ID> --spec .do/app.yaml
```

---

## Option B — Droplet + Docker

1. Create a Droplet (Ubuntu) with Docker installed.
2. On the Droplet (or in CI), build with your public Supabase values:

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  --build-arg NEXT_PUBLIC_DEMO_MODE=false \
  -t amg-com .
```

3. Run:

```bash
docker run -d --name amg-com -p 3000:3000 \
  -e NEXT_PUBLIC_DEMO_MODE=false \
  amg-com
```

4. Put **nginx** (or Caddy) in front: proxy `https://your-domain` → `http://127.0.0.1:3000`. Use Certbot or Caddy for SSL.
5. Open firewall for 80/443; keep 3000 bound to localhost if only nginx should reach it.

---

## After deploy checklist

- [ ] Supabase migrations + seed applied
- [ ] Admin user created and role set in `profiles`
- [ ] `NEXT_PUBLIC_DEMO_MODE=false` and real Supabase URL/anon key at build time
- [ ] Auth redirect URLs include the production domain
- [ ] Custom domain + SSL (App Platform: Domains tab; Droplet: nginx/Caddy + Certbot)
- [ ] Twilio SMS (optional): set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` (or Messaging Service SID) as **Run time** secrets so buyers get SMS on confirm and dispatch

## Local Docker smoke test

```bash
docker build \
  --build-arg NEXT_PUBLIC_DEMO_MODE=true \
  -t amg-com .
docker run --rm -p 3000:3000 -e NEXT_PUBLIC_DEMO_MODE=true amg-com
```
