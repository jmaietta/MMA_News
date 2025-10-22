# MMA News Hub

A mobile-first RSS feed aggregator for MMA news from top sources (MMA Junkie, Lowkick MMA, BJPENN, Sherdog).

## Setup Instructions

### Option 1: GitHub Actions (Recommended - Zero Maintenance)

This is the best approach because it eliminates CORS issues completely.

1. **Create the workflow directory:**
   ```bash
   mkdir -p .github/workflows
   ```

2. **Move the workflow file:**
   ```bash
   mv .github-workflows-fetch-feeds.yml .github/workflows/fetch-feeds.yml
   ```

3. **Create the `docs` directory** (for GitHub Pages):
   ```bash
   mkdir -p docs
   ```

4. **Enable GitHub Pages:**
   - Go to Settings → Pages
   - Source: Deploy from a branch
   - Branch: `main` (or your default branch)
   - Folder: `/docs`

5. **Run the workflow manually first:**
   - Go to Actions → "Fetch MMA News Feeds"
   - Click "Run workflow"
   - Wait for it to complete and commit `mma-news.json`

6. **Deploy:**
   - Copy `index.html`, `styles.css`, `app.js` to the `docs/` directory
   - Commit and push
   - Your site will be live at `https://username.github.io/repo-name/`

The workflow runs automatically every 6 hours and updates `docs/mma-news.json`.

### Option 2: Manual - Run Locally

If you don't want GitHub Actions, you can run the fetcher manually:

1. **Install dependencies:**
   ```bash
   pip install feedparser python-dateutil
   ```

2. **Run the script:**
   ```bash
   python fetch_feeds.py
   ```

3. **Commit the generated `docs/mma-news.json`:**
   ```bash
   git add docs/mma-news.json
   git commit -m "Update MMA news"
   git push
   ```

## How It Works

1. **GitHub Actions** (or manual script) fetches RSS feeds server-side
2. Results are saved as `docs/mma-news.json`
3. Website loads the JSON and displays articles
4. Search happens client-side on already-loaded articles

This avoids CORS issues completely and is much faster than fetching live.

## Files

- `index.html` - Mobile-first HTML template
- `styles.css` - T2D Pulse-inspired styling
- `app.js` - Article loading and search
- `fetch_feeds.py` - RSS feed fetcher (runs in GitHub Actions)
- `.github/workflows/fetch-feeds.yml` - GitHub Actions workflow
- `config_mma.yaml` - Configuration (for reference/Python version)

## RSS Feeds

- MMA Junkie (USA Today) - `https://mmajunkie.usatoday.com/feed`
- Lowkick MMA - `https://lowkickmma.com/feed`
- BJPENN - `https://bjpenn.com/feed`
- Sherdog - `https://sherdog.com/rss/news.xml`

## Features

✓ Mobile-first responsive design
✓ Thumbnail images from articles
✓ Real-time search
✓ Sticky header with search bar
✓ No JavaScript frameworks needed
✓ Fast loading (pre-generated JSON)
✓ SEO friendly

## Troubleshooting

**Articles not showing?**
- Check that `docs/mma-news.json` exists
- Run `fetch_feeds.py` manually to generate it
- Check browser console (F12) for errors

**GitHub Actions not running?**
- Go to Settings → Actions → General
- Ensure "Allow all actions and reusable workflows" is selected

**Old articles persisting?**
- The workflow only keeps the 30 most recent articles
- GitHub Actions runs every 6 hours by default (edit `.github/workflows/fetch-feeds.yml` to change)
