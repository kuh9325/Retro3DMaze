# Retro3DMaze — Rat Escape v8

A playable browser tribute to the classic Windows 3D Maze screensaver, rebuilt using graphic assets extracted from a user-supplied `3Dmaze.scr`. **This is an independent recreation, not the original Windows screensaver engine.** All original imagery is presented without AI upscaling, with nearest-neighbour pixel rendering available.

## Play

Open `public/index.html` in a browser for **offline play and local records**. To test the global scoreboard, use the Cloudflare Pages + D1 setup below.

- Arrow keys / W S: forward/back and turn; A / D: strafe; Shift: sprint
- O: toggle wall-following autopilot; Tab or map buttons: map (**makes current run ineligible for rankings**); N: new game; T: settings
- `Classic`: mice are harmless; `Rat Escape`: mice deal damage unless the scene has been flipped upside-down by a spinning solid
- Chase rats see you only within two tiles in straight visible corridors, keep chasing until beyond four tiles, and lose you immediately when you duck around a corner
- Mouse sprite, four cycling fractal textures, bricks, ceiling, floor, and other original art assets are preserved
- Start and finish animations, scores, stage progression and mouse AI remain from the earlier v7 browser game

## Leaderboards

The display shows **online Top 20** alongside **your local browser records**. Rankings sort by score (descending), then stage reached (descending), then total recorded completion time (ascending).

Only completed stages in the default Rat Escape difficulty qualify **if no map view (Tab, desktop map button, or touch map button) and no autopilot was used anywhere in the run**. Opening and then closing the map does not restore eligibility; start a new game (`N`) to try again. Map-assisted clears still earn in-game points and advance stages, but are not saved in the local ranking or sent to the online leaderboard. Local results are stored automatically. **Online submission is opt-in**, with a chosen nickname, and requires Cloudflare Pages Functions + D1. Until the backend is configured, the interface explicitly reports that world rankings are offline; GitHub Pages serves the playable game and local records but does not provide server-backed global scores.

### Saving and recovering ranked results

For online submission, enter a nickname (2–16 characters) and clear at least one **Rat Escape** stage without opening the map or activating autopilot, at the default difficulty. Local scores from this run are saved, and the last **verified eligible** high score is kept separately so you can manually submit it even after refreshing, opening a new game, or experiencing a temporary D1/network error. Click **내 최고 기록 등록** to submit; the automatic submission checkbox is optional and only activates when deliberately selected. The checkbox choice persists on the same browser. Earlier scores saved before the map-assist eligibility rule cannot be retrospectively certified, so those scores remain visible locally but cannot be newly uploaded from the old local history.

A successful POST shows an explicit confirmation with the score and completed stage. The online table displays only **Top 20**; a saved result outside that group will not appear in the table. If the page reports a 503 or database connection error, check Cloudflare Pages → Settings → Bindings → `RANKINGS_DB`, D1 schema migration and the latest Production deployment. Offline saves remain retryable. Opening the map (including the Tab key and touch map button) or using autopilot disqualifies that current run for both local and global ranked records.

This is a *casual, trust-based community leaderboard*. The backend validates ranges and submission rate but **cannot verify that game clients were not modified**. To run prizes or competitive seasons, implement server-side gameplay/replay verification, account authentication, and Cloudflare Turnstile / abuse controls first. Browser player ID and nickname are stored in localStorage; the server stores only browser ID, nickname, score, stage, completion time and update timestamp.

## Cloudflare Pages + D1 deployment (global leaderboard)

1. Create a **Cloudflare Pages** project from this GitHub repository, using production branch `main`, framework `None`, build command empty, and **output directory `public`**. Cloudflare discovers Functions under `/functions`.
2. Create a Cloudflare **D1 database** named `retro3dmaze-leaderboard`.
3. Run `migrations/0001_leaderboard.sql` on the D1 database (Cloudflare dashboard → D1 → Console), or with Wrangler (`npx wrangler d1 execute retro3dmaze-leaderboard --remote --file=migrations/0001_leaderboard.sql`).
4. In Pages → Settings → Bindings, add a **D1 database binding** with variable name `RANKINGS_DB`, selecting this database. Redeploy the Pages project.
5. Open your `*.pages.dev` URL. The online Top 20 and opt-in submissions should work; check `/api/leaderboard` responds with JSON `{"entries":[]}`.
6. Review Cloudflare WAF rate limiting/Turnstile before publicly promoting the leaderboard.

No Cloudflare credentials are stored in GitHub.

## GitHub Pages (static-only alternative)

A workflow at `.github/workflows/pages.yml` publishes the `public/` folder upon push to `main`. To enable it, open **Settings → Pages → Build and deployment → Source: GitHub Actions**. The resulting site is expected at `https://kuh9325.github.io/Retro3DMaze/` *once GitHub Pages shows a successful deployment*. GitHub Pages has no D1 backend, so only local results work there.

## Files

- `public/index.html`: single-page game with original inlined imagery
- `public/leaderboard.js` and `leaderboard.css`: leaderboard UI and client integration
- `functions/api/leaderboard.js`: Cloudflare Pages Function for online entries
- `migrations/0001_leaderboard.sql`: D1 schema
- `tests/backend.mjs`: simple backend-validation smoke tests

## Attribution

Original Windows 3D Maze artwork and concepts belong to their respective owners. This project is a fan recreation, not affiliated with or endorsed by Microsoft. Do not assume the original artwork is available under an open-source licence.
