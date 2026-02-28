# OMC Friends

A Chrome extension for [Online Math Contest (OMC)](https://onlinemathcontest.com) that lets you track your friends on the standings leaderboard.

---

## Features

- ⭐ **Star any user** directly from the standings table to add them as a friend
- 👥 **Friends-Only Mode** — hide all other participants and show only your friends, sorted by rank
- 📋 **Manual friend list** — manage your friend list directly from the extension popup

---

## Installation

> This extension is not yet published on the Chrome Web Store. Install it manually:

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the `OMC_Friends` folder

---

## Usage

### Adding Friends

**Method 1 — Star button:**
Navigate to any contest standings page on `onlinemathcontest.com`. Click the ☆ icon next to any username to add them as a friend (turns ⭐).

**Method 2 — Popup list:**
Click the extension icon in the Chrome toolbar. Enter friend usernames (one per line) and click **Save and refresh**.

### Friends-Only Mode

Click the **"Show friends only"** button that appears at the top center of the standings page.

- All non-friend rows are hidden
- The extension automatically fetches the full standings via the OMC API and injects your friends sorted by rank
- A loading indicator appears while searching; turns green when complete
- Click **"Show all users"** to return to the normal view

---

## File Structure

```
OMC_Friends/
├── manifest.json   # Chrome extension manifest (MV3)
├── content.js      # Main content script — filtering, fetching, UI
├── popup.html      # Extension popup UI
└── popup.js        # Popup logic — load/save friend list
```

---

## Requirements

- Google Chrome (or any Chromium-based browser, e.g Brave)

---

## License

MIT
