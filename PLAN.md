# Purple Monitor — Development Plan

A private, on-device app for parents to monitor a child's **IgA vasculitis
(IgAV, formerly Henoch-Schönlein purpura / Porpora di Schönlein-Henoch)**:
daily photos of the skin rash, automatic mapping and measurement of purpuric
spots, day-to-day comparison, and a urine-test diary for nephritis follow-up.

---

## 1. Important framing: a tracking tool, not a diagnostic device

This app **measures and tracks**; it does not diagnose. Software that claims
to diagnose or classify disease is a regulated medical device in the EU/US.
For a personal/family tool the safe and genuinely useful scope is:

- **Detect and measure** purpuric spots (count, size, area covered, color
  intensity, body distribution) — objective numbers instead of "it looks worse".
- **Compare** those measurements across days and show trends.
- **Record** urine dipstick results — the single most important follow-up for
  IgAV, because kidney involvement (IgAV nephritis) can appear weeks to months
  after the rash.
- **Surface "talk to your doctor" flags** based on well-known guidance
  (e.g., blood or protein appearing in urine, rapidly spreading rash, severe
  abdominal pain noted in the diary) — always phrased as *"contact your
  pediatrician"*, never as a diagnosis.

Every screen that shows analysis carries a persistent disclaimer, and the
detection results are always editable by the parent (add/remove missed or
false spots).

---

## 2. Platform choice

**Recommendation: an installable, offline-first PWA (Progressive Web App).**

| Option | Pros | Cons |
|---|---|---|
| **PWA (recommended)** | No app store, installs from a URL or local file, runs identically on Android + iPhone, camera access via `getUserMedia`, all data stays in the browser's storage, easy to self-host or run fully offline | Slightly less camera control than native; iOS storage can be evicted if the app is unused for months (mitigated by export/backup) |
| Expo / React Native | Full native camera control, app feels native | Requires build tooling + developer account for iPhone installs; more moving parts |
| Native (Kotlin/Swift) | Maximum control | Two codebases, highest effort |

The PWA gives the fastest path to something usable on the phone this week,
with **zero servers** — which is exactly the privacy posture requested. If we
later hit camera limitations, the codebase (React + TypeScript) ports to Expo
with most logic intact.

### Tech stack

- **UI**: React + TypeScript + Vite, `vite-plugin-pwa` for offline install.
- **Image analysis**: OpenCV.js (WASM) for classical computer vision —
  runs entirely on the device, no model downloads, no cloud.
- **Storage**: IndexedDB (via Dexie.js) for photos, detections, and diary
  entries. Optional passphrase encryption of the database (WebCrypto AES-GCM).
- **Charts**: lightweight local charting (e.g., uPlot or hand-rolled SVG).
- **No network calls at all** after first load. No analytics, no accounts,
  no third-party SDKs.

---

## 3. Feature plan

### 3.1 Guided daily photo capture

Consistency is what makes day-to-day comparison meaningful, so capture is
guided:

1. Parent picks the body region (e.g., left lower leg front / back, right leg,
   buttocks — the classic IgAV distribution).
2. The camera view shows a **ghost overlay of the previous photo** of that
   region at low opacity, so the leg is framed the same way each day.
3. Prompt to keep distance and lighting similar; optional use of a small
   **reference sticker or coin** placed on the skin for scale + color
   calibration (strongly recommended, cheap, and dramatically improves
   measurement accuracy).
4. Photo is stored locally with date, region, and lighting notes.

### 3.2 Spot mapping and measurement

Pipeline (all on-device, OpenCV.js):

1. **Color normalization** using the reference sticker (or gray-world fallback).
2. **Skin segmentation** to limit the search area.
3. **Purpura detection**: purpuric lesions are red-purple and — unlike
   erythema — this app can't blanch-test them, so detection is color +
   morphology based: threshold in a perceptual color space (Lab/HSV) for
   red-violet hues darker than surrounding skin, then blob detection with
   size/shape filters.
4. **Per-spot measurements**: centroid, diameter (mm if reference present,
   else pixels), area, mean color intensity.
5. **Descriptive classification** (not diagnostic): each spot is labeled by
   size class using standard dermatology terms —
   *petechiae* (<2 mm), *purpura* (2 mm–1 cm), *ecchymosis* (>1 cm) — plus
   "raised/palpable" as a manual toggle (palpable purpura is the IgAV
   hallmark, but elevation can't be judged from a single photo).
6. **Manual correction UI**: tap to add a missed spot, tap a detection to
   delete or resize it. Corrections are saved and could later train a small
   personalized model, but the MVP stays classical-CV only.

Output per photo: an annotated overlay + summary numbers (spot count, total
affected area %, size histogram, mean intensity).

### 3.3 Day-to-day comparison

1. **Image registration**: align today's photo to the previous one
   (feature matching + homography via OpenCV), possible because capture is
   guided and the region is fixed.
2. **Spot matching** across days by position: classify each spot as
   *new*, *persisting* (grew / shrank / faded), or *resolved*.
3. **Views**:
   - Side-by-side and swipe/slider "before–after" of any two dates.
   - Difference heatmap (where things got better / worse).
   - Trend charts over time: spot count, affected area, new-spot rate.
4. Weekly summary: "compared with 7 days ago: −12 spots, affected area
   3.1% → 1.8%".

### 3.4 Urine test diary

Designed around home dipstick testing, the standard IgAV follow-up:

- Quick entry form: date/time, **blood (hemoglobin)** and **protein** on the
  dipstick scale (negative / trace / + / ++ / +++), optionally leukocytes,
  nitrites, specific gravity; free-text notes.
- Optional **photo of the dipstick** attached to the entry (auto-reading the
  strip colors is a Phase 3 feature; manual entry is the reliable MVP).
- **Symptom log** in the same entry: abdominal pain, joint pain/swelling,
  new rash flare, fever, medications given (e.g., paracetamol dose).
- **Reminders**: local notifications for the testing schedule (IgAV follow-up
  protocols typically test urine weekly-to-monthly for ~6–12 months —
  the schedule is configurable to whatever the pediatrician prescribed).
- **Attention flags** (informational, conservative): any new blood/protein,
  worsening from the previous test, or persistent proteinuria ⇒ banner
  saying *"Share this result with your pediatrician."*

### 3.5 Doctor report export

One-tap **PDF report** generated locally: rash trend charts, selected
annotated photos, and the full urine/symptom diary table — so visits to the
pediatrician or nephrologist come with objective data. Shared only by
explicit user action (system share sheet / file save).

---

## 4. Privacy design ("very private" requirements)

- **100% on-device.** No server, no account, no sync, no telemetry. The app
  makes zero network requests after installation (enforced by a strict
  Content-Security-Policy and verified in tests).
- **Encryption at rest**: photos and diary encrypted with AES-GCM; key
  derived from a parent passphrase (Argon2/PBKDF2) or held in the platform
  keystore. App lock with passphrase/biometric on open.
- **Encrypted backup/export**: single encrypted archive the parent can copy
  to a computer or personal drive — because phone loss must not mean losing
  months of medical history. Restore = import + passphrase.
- **Data minimization**: no name required; photos are of a body region only;
  EXIF GPS is stripped on capture/import.
- **Panic-simple deletion**: one screen to wipe everything.
- Fully **open source in this repo**, so the privacy claims are auditable.

---

## 5. Roadmap

### Phase 1 — MVP (usable immediately)
- PWA shell, installable, offline, app lock.
- Guided photo capture with ghost overlay, per-region photo timeline.
- Manual side-by-side / slider comparison of any two dates.
- Urine + symptom diary with manual dipstick entry, trends table, reminders.
- Encrypted local storage, export/import backup, wipe.

### Phase 2 — Automatic analysis
- OpenCV.js spot detection + measurement with manual correction.
- Image registration and automatic day-to-day spot matching.
- Trend charts (spot count, area, new/resolved) and weekly summaries.
- Reference-sticker scale + color calibration.

### Phase 3 — Comfort features
- Dipstick photo auto-reading (color-patch matching against the strip
  brand's reference chart).
- PDF doctor report.
- Optional personalized detection tuning from the parent's corrections.

Each phase is independently shippable; Phase 1 alone already replaces the
paper diary and camera-roll chaos.

---

## 6. Proposed repository structure

```
purple-monitor/
├── PLAN.md                  ← this document
├── app/                     ← PWA (React + TS + Vite)
│   ├── src/
│   │   ├── capture/         ← camera, ghost overlay, EXIF stripping
│   │   ├── analysis/        ← OpenCV.js pipeline (Phase 2)
│   │   ├── compare/         ← registration, matching, charts
│   │   ├── diary/           ← urine + symptom entries, reminders
│   │   ├── storage/         ← Dexie schema, encryption, backup
│   │   └── report/          ← PDF export (Phase 3)
│   └── tests/
└── docs/                    ← usage guide, privacy notes
```

---

## 7. Open questions for you

1. **Phone type?** Android, iPhone, or both? (The PWA covers both; it only
   changes which install instructions and notification quirks we document.)
2. **Dipstick brand** you use — needed later for Phase 3 auto-reading, and
   useful now to match the entry form to the strip's exact scale.
3. Is the **reference sticker/coin** during photos acceptable? It's optional
   but makes millimeter measurements and color comparison much more reliable.
4. Preferred language for the UI — **Italian**, English, or both?

---

*This app supports, but never replaces, medical care. IgA vasculitis in
children needs pediatric follow-up, particularly urine monitoring for kidney
involvement — the app's job is to make that follow-up easier and the data
you bring to the doctor better.*
