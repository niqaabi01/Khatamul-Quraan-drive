# Khatamul Qur’an Drive

A lightweight, mobile-first static webapp for a Khatamul Qur’an drive. It uses GitHub Pages for the website and optionally Firebase Realtime Database for shared live Juz statuses.

## Files

- `index.html` — page structure and dialogs
- `style.css` — responsive ivory, forest green, brown and gold design
- `script.js` — Juz interactions, local demo mode and Firebase sync
- `config.js` — per-drive details and Firebase web configuration
- `assets/logo-placeholder.svg` — replace this with your logo

## How the data works

- If Firebase is not configured, this runs in **local demo mode**: data is stored only in the current browser.
- Once Firebase is configured, the Juz status list is shared between visitors and updates live.
- The first visitor to an empty drive seeds the 30 Juz. Each claim uses a Firebase transaction so two people cannot successfully claim the same available Juz at once.
- Anonymous Firebase Authentication is used so each browser has an authenticated identity without asking visitors to create accounts.
- The reader who claimed a Juz can mark it completed from the same browser/device.
- The drive name, marhoom name, logo and intro remain in `config.js` and should be changed through GitHub, not through public page controls.

**Organiser dashboard note:** The dashboard currently offers a live overview and CSV/JSON export. In live mode, changing the drive settings in the browser is not a shared/admin operation. A fully secured organiser-only reset/release/edit workflow needs a separate authenticated admin account and stricter database permissions; do not rely on the public dashboard for privileged changes.

## 1. Create Firebase

1. Open the Firebase Console: https://console.firebase.google.com/
2. Create a project for the drive.
3. In Project settings, add a **Web app** and copy the Firebase configuration values.
4. Open **Build → Realtime Database** and create a database. Choose a region near your main participants.
5. Open **Build → Authentication → Sign-in method** and enable **Anonymous**.
6. In Realtime Database, open the **Rules** tab and replace the rules with the rules below, then publish them.

### Realtime Database rules

These rules allow public reading of Juz status, but require Firebase anonymous authentication for writes. They allow a visitor to claim a currently available Juz using their own Firebase UID, and to update their own claimed record. They do not give ordinary visitors a global reset or organiser override.

```json
{
  "rules": {
    "drives": {
      "$driveId": {
        "juz": {
          "$juzId": {
            ".read": true,
            ".write": "auth != null && ((!data.exists() && newData.child('status').val() == 'available') || (data.child('status').val() == 'available' && newData.child('status').val() == 'reading' && newData.child('ownerUid').val() == auth.uid) || (data.child('ownerUid').val() == auth.uid && newData.child('ownerUid').val() == auth.uid))",
            ".validate": "newData.hasChildren(['number', 'arabic', 'transliteration', 'status', 'reader', 'ownerUid']) && (newData.child('status').val() == 'available' || newData.child('status').val() == 'reading' || newData.child('status').val() == 'completed')"
          }
        }
      }
    }
  }
}
```

Important: test these rules with the Firebase Rules Playground before sharing the URL. For stronger production security, add additional field-level validation and a proper organiser authentication flow. Never use a Firebase Admin SDK/service account credential in frontend code.

## 2. Add the Firebase config

Edit `config.js` in your repository. Replace the placeholder Firebase values with the configuration from your Firebase Web App and the Realtime Database URL shown in the Firebase console.

```js
firebaseConfig: {
  apiKey: "your-web-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  databaseURL: "https://your-database-name.REGION.firebasedatabase.app",
  projectId: "your-project-id",
  appId: "your-web-app-id"
}
```

The exact `databaseURL` is displayed in the Realtime Database console. Copy it as-is; do not guess the region or hostname. Firebase web config values identify your project; database security is enforced by Authentication and Rules, not by hiding the web config.

## 3. Publish on GitHub Pages

1. Create a public GitHub repository.
2. Upload the contents of this folder to the repository root (so `index.html` is at the root).
3. Edit `config.js`: add the marhoom's name and Firebase configuration.
4. Upload your logo into `assets/` and update `logoPath`, keeping the exact case-sensitive filename.
5. Go to **Settings → Pages**, select **Deploy from a branch**, choose `main` and `/ (root)`, and save.
6. Wait for deployment, then test the public link on two different browsers or devices.

## 4. Reuse the template

For the easiest and safest reuse, make a separate GitHub repository and Firebase project per drive. Change `driveId`, `slug`, `marhoomName`, `title`, logo and intro in `config.js`. This isolates each drive's data and makes it straightforward to share a unique link.

If you later want multiple drives in one website and dashboard, expand the model to include a `drives` registry and authenticated organiser permissions.

## Hadith and Arabic text note

The displayed hadith wording is a draft commonly attributed to Jamiʿ at-Tirmidhi 2910; translations and grading notes can vary. Please verify the exact wording, reference and grading with a trusted scholar before publication. Arabic Juz names and transliterations should also be checked by someone knowledgeable before launch.

## Hosting costs

GitHub Pages and Firebase have free-tier options suitable for a small community project, subject to current usage limits, plan terms, and Firebase region availability. Check the Firebase pricing page before launch. The Firebase project must have billing and quota settings appropriate to your needs; do not assume unlimited use.


## Included logo
The current configuration uses `assets/muzdalifah-foundation-logo.jpg`, the Muzdalifah Foundation logo supplied for this project. You can replace this file later and update `logoPath` in `config.js` if needed.
