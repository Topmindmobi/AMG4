# AMG Online Store Android app

A Trusted Web Activity (TWA) — a thin native shell that loads `https://amgstores.ai`
full-screen via Chrome, with no URL bar. There is no separate UI to maintain: whatever
is live on the website is what the app shows, instantly, with no app-store update
needed for content or feature changes. App-store updates are only needed for native
shell changes (icon, package id, permissions).

Offline browsing and background order sync come from the website itself being a PWA
(see `public/sw.js`, `public/manifest.json`, `src/lib/offline/`) — the app inherits
that for free since it's just Chrome loading the same site.

## One-time setup

1. **Generate the release signing key.** In GitHub → Actions →
   **Generate Android signing keystore (run once)** → Run workflow, typing `GENERATE`
   to confirm. **Only do this once, ever** — re-running it creates a different key,
   which orphans any build already on the Play Store (Play Store requires the same
   signing key for every update to an app).

   Download the `amg-com-release-keystore-DELETE-AFTER-USE` artifact from the
   finished run. It contains `keystore-info.txt` with everything below.

2. **Add repo secrets** (Settings → Secrets and variables → Actions):
   - `ANDROID_KEYSTORE_BASE64` — contents of `keystore-base64.txt`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS` (`amg-com`)
   - `ANDROID_KEY_PASSWORD`

3. **Publish the Digital Asset Link.** `keystore-info.txt` also prints the SHA256
   certificate fingerprint. Replace `PLACEHOLDER_SHA256_FINGERPRINT` with it in both:
   - [`public/.well-known/assetlinks.json`](../public/.well-known/assetlinks.json)
   - [`app/src/main/res/values/strings.xml`](app/src/main/res/values/strings.xml)

   Then redeploy the website (see root [`DEPLOY.md`](../DEPLOY.md)) so
   `https://amgstores.ai/.well-known/assetlinks.json` serves the real fingerprint.
   **Until this is done, the app opens the site in a normal Chrome Custom Tab (with a
   URL bar)** instead of a chromeless Trusted Web Activity — it still works, just not
   full-screen.

4. **Delete the keystore workflow run + artifact** from GitHub once you've copied the
   secrets out — it contains your private key and passwords in plaintext.

## Building

Every push touching `android/**` runs **Build Android app**
(`.github/workflows/build-android.yml`) on GitHub's hosted runners — no local Android
SDK/Java install needed. Download the signed `.apk` (sideload/testing) or `.aab` (Play
Store upload) from the workflow run's **Artifacts**.

You can also trigger it manually: Actions → Build Android app → Run workflow.

## Verifying the Trusted Web Activity is working

Install the APK on a device, open the app, and check there's **no URL bar** at the
top. If there is one, asset-link verification failed — usually because step 3 above
hasn't been redeployed yet, or the fingerprint doesn't match. Check with:

```bash
curl https://amgstores.ai/.well-known/assetlinks.json
```

## Publishing to the Play Store

Not automated — requires a Google Play Developer account (one-time $25 fee) that only
you can create. Upload the `.aab` from the build artifact under **Release → Production
→ Create new release**. Package name is `ai.amgstores.app`.
