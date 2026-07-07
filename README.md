# Purple Monitor

A **private, on-device** app for parents following up a child's **IgA
vasculitis** (Porpora di Schönlein-Henoch): daily photos of the skin rash
with guided framing, day-to-day comparison, and a urine-test & symptom diary.

**🇮🇹 App privata per il monitoraggio della vasculite da IgA:** foto
quotidiane dell'eruzione con inquadratura guidata, confronto tra i giorni e
diario dei test delle urine e dei sintomi. Interfaccia in italiano e inglese.

> This app supports, but never replaces, medical care. It tracks and
> measures; it does not diagnose. Always follow your pediatrician's advice.

See [PLAN.md](PLAN.md) for the full feature plan and roadmap.

## Privacy

- Works **100% on the device**: no account, no cloud, no network requests
  after load (enforced by a strict Content-Security-Policy).
- Photos and diary entries are **encrypted at rest** (AES-GCM, key derived
  from your passphrase with PBKDF2). Locking the app drops the key from
  memory.
- Photos are re-encoded on capture/import, which **strips EXIF metadata**
  (including GPS).
- Encrypted **backup export/import** so a lost phone doesn't mean lost
  history. The backup file stays encrypted with your passphrase.
- One-tap **delete everything**.

## Current features (Phase 1)

- Installable PWA (Android + iPhone), Italian/English UI, app lock.
- Guided photo capture per body region with a **ghost overlay** of the
  previous photo for consistent framing; camera or photo import.
- Photo timeline filtered by region.
- **Compare** any two dates: swipe slider or side-by-side.
- **Urine & symptom diary**: dipstick values (blood, protein, leukocytes,
  nitrites), symptoms, medications, notes; a conservative *"share this with
  your pediatrician"* flag whenever blood or protein is present; a
  configurable test-due reminder banner.

Planned next (see PLAN.md): automatic spot detection and measurement,
image registration and per-spot day-to-day matching, trend charts.

## Development

```bash
cd app
npm install
npm run build     # type-check + production build into app/dist
npm run preview   # serve the built app locally
npm run dev       # dev server (note: the CSP in index.html is strict;
                  # use build+preview if the dev overlay misbehaves)
```

## Putting it on your phone

Deployment is automated with GitHub Pages: the workflow in
`.github/workflows/deploy.yml` builds and publishes the app on every push.

One-time setup (GitHub's free plan only offers Pages on public repos):

1. Make the repository public: **Settings → General → Danger Zone →
   Change visibility → Make public**. This publishes only the app's code —
   never any photos or diary data, which exist solely on your phone.
2. Open the **Actions** tab and wait for the "Deploy to GitHub Pages" run
   to turn green (re-run it if it failed while the repo was still private).
3. On the phone, open **https://blindosbarra.github.io/purple-monitor/**
   - iPhone (Safari): Share button → **Add to Home Screen**
   - Android (Chrome): ⋮ menu → **Add to Home screen / Install app**

After that it opens full-screen from its own icon and works offline.
Nothing is ever sent back to the host after the page loads (a strict
Content-Security-Policy forbids it).

Prefer to keep the repository private? Any static host works instead —
e.g. Cloudflare Pages or Netlify connected to this repo (build command
`npm run build` in `app/`, publish directory `app/dist`) — HTTPS is
required for camera access.
