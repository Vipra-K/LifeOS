# LIFE.OS

A cinematic, local-first Chrome new-tab experience for focus, life planning, and developer workflows.

## Current build
- Manifest V3 Chrome extension
- Cinematic time-of-day backgrounds
- Custom background upload
- Configurable widget dashboard
- Focus profiles with website allowlists
- Persistent focus sessions and local history
- Browser-level focus blocking using Declarative Net Request
- Extension popup with active-session status
- Public GitHub contribution activity by username
- Public LeetCode stats by username (best-effort public endpoint)
- Google Calendar OAuth scaffold (read-only)

## Load locally
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder.
5. Open a new tab.

Calendar OAuth needs a Google Cloud OAuth client ID configured in `manifest.json`; see `docs/SETUP.md`.
