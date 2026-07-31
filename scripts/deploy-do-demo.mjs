/**
 * Point DigitalOcean amg-com at the latest AMG4 branch and enable demo mode
 * (same experience as local `npm run dev`).
 *
 * PowerShell:
 *   $env:DIGITALOCEAN_ACCESS_TOKEN = "dop_v1_..."
 *   node scripts/deploy-do-demo.mjs
 */
import { writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP_ID = process.env.DO_APP_ID || "5614097b-94ca-4164-9bc2-59a7121026f2";
const TOKEN = process.env.DIGITALOCEAN_ACCESS_TOKEN?.trim();
const DOCTL = process.env.DOCTL_PATH || join(process.env.LOCALAPPDATA || "", "doctl", "doctl.exe");
const BRANCH = process.env.DO_BRANCH || "claude/marketplace-feature-expansion";
const SITE = "https://amg-com-2j9zz.ondigitalocean.app";

if (!TOKEN) {
  console.error("Set DIGITALOCEAN_ACCESS_TOKEN first.");
  process.exit(1);
}

function run(args, opts = {}) {
  const res = spawnSync(DOCTL, args, {
    encoding: "utf8",
    env: { ...process.env, DIGITALOCEAN_ACCESS_TOKEN: TOKEN },
    ...opts,
  });
  if (res.status !== 0) {
    throw new Error((res.stderr || res.stdout || "doctl failed").trim());
  }
  return (res.stdout || "").trim();
}

// Keep production sizing; flip source + demo mode to match local.
const yaml = `alerts:
- rule: DEPLOYMENT_FAILED
- rule: DOMAIN_FAILED
features:
- buildpack-stack=ubuntu-22
ingress:
  rules:
  - component:
      name: amg-com
    match:
      path:
        prefix: /
name: amg-com
region: fra
services:
- name: amg-com
  dockerfile_path: /Dockerfile
  source_dir: /
  github:
    repo: Topmindmobi/AMG4
    branch: ${BRANCH}
    deploy_on_push: true
  http_port: 3000
  instance_count: 2
  instance_size_slug: apps-s-1vcpu-1gb
  envs:
  - key: NODE_ENV
    scope: RUN_TIME
    value: production
  - key: NEXT_PUBLIC_SITE_URL
    scope: RUN_AND_BUILD_TIME
    value: ${SITE}
  - key: NEXT_PUBLIC_DEMO_MODE
    scope: RUN_AND_BUILD_TIME
    value: "true"
  - key: NEXT_PUBLIC_SUPABASE_URL
    scope: RUN_AND_BUILD_TIME
    type: SECRET
  - key: NEXT_PUBLIC_SUPABASE_ANON_KEY
    scope: RUN_AND_BUILD_TIME
    type: SECRET
  - key: TWILIO_ACCOUNT_SID
    scope: RUN_TIME
    type: SECRET
  - key: TWILIO_AUTH_TOKEN
    scope: RUN_TIME
    type: SECRET
  - key: TWILIO_PHONE_NUMBER
    scope: RUN_TIME
    type: SECRET
`;

const specPath = join(tmpdir(), `amg-do-spec-${Date.now()}.yaml`);
writeFileSync(specPath, yaml, "utf8");

try {
  console.log("Updating app", APP_ID, "→ demo mode +", BRANCH);
  run(["apps", "update", APP_ID, "--spec", specPath]);
  console.log("Creating force rebuild…");
  const out = run(["apps", "create-deployment", APP_ID, "--force-rebuild", "--wait=false"]);
  console.log(out);
  console.log("Deploy started. Watch:", `https://cloud.digitalocean.com/apps/${APP_ID}`);
  console.log("Live URL:", SITE);
  console.log("After ACTIVE, use demo logins (admin@amg.com / admin123, brian@amg.com / rider123, …)");
} finally {
  try {
    unlinkSync(specPath);
  } catch {
    /* ignore */
  }
}
