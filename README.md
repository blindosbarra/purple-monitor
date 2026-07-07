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

The app is a static site in `app/dist`. Host those files on **any HTTPS
static host** (HTTPS is required for camera access), open the URL on the
phone, and use "Add to Home Screen" — it then works offline like a native
app. Nothing is ever sent back to the host after the first load, but for
maximum privacy prefer a host you control or your home network
(e.g., a small HTTPS server on your LAN).
