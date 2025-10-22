#!/usr/bin/env python3
"""
Fetch MMA news RSS feeds and save as JSON for static site consumption
Run via GitHub Actions or manually
"""

import feedparser
import json
from datetime import datetime, timezone
from pathlib import Path

# RSS feeds to fetch
RSS_FEEDS = [
    {
        "name": "MMA Junkie",
        "url": "https://mmajunkie.usatoday.com/feed"
    },
    {
        "name": "Lowkick MMA",
        "url": "https://lowkickmma.com/feed"
    },
    {
        "name": "BJPENN",
        "url": "https://bjpenn.com/feed"
    },
    {
        "name": "Sherdog",
        "url": "https://sherdog.com/rss/news.xml"
    }
]

def extract_thumbnail(entry):
    """Extract thumbnail from feedparser entry"""
    # Try media_thumbnail
    if hasattr(entry, 'media_thumbnail'):
        for thumb in entry.media_thumbnail:
            if 'url' in thumb:
                return thumb['url']
    
    # Try media_content
    if hasattr(entry, 'media_content'):
        for content in entry.media_content:
            if content.get('medium') == 'image' and 'url' in content:
                return content['url']
    
    # Try links with image type
    if hasattr(entry, 'links'):
        for link in entry.links:
            if link.get('type', '').startswith('image'):
                return link.get('href')
    
    # Try image in summary
    if hasattr(entry, 'summary'):
        import re
        match = re.search(r'<img[^>]+src="([^">]+)"', entry.summary)
        if match:
            return match.group(1)
    
    return None

def clean_description(text):
    """Remove HTML tags from description"""
    import re
    # Remove script and style elements
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Decode entities
    import html
    text = html.unescape(text)
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def fetch_feeds():
    """Fetch all RSS feeds and return articles"""
    all_articles = []
    
    for feed_config in RSS_FEEDS:
        name = feed_config['name']
        url = feed_config['url']
        
        print(f"Fetching {name}...")
        try:
            feed = feedparser.parse(url)
            
            if feed.bozo:
                print(f"  ⚠ Warning parsing {name}: {feed.bozo_exception}")
            
            count = 0
            for entry in feed.entries[:10]:  # Get up to 10 per feed
                try:
                    article = {
                        "title": entry.get('title', 'No title'),
                        "link": entry.get('link', '#'),
                        "description": clean_description(entry.get('summary', '')),
                        "pubDate": entry.get('published', datetime.now(timezone.utc).isoformat()),
                        "source": name,
                        "thumbnail": extract_thumbnail(entry)
                    }
                    all_articles.append(article)
                    count += 1
                except Exception as e:
                    print(f"  Error processing entry: {e}")
                    continue
            
            print(f"  ✓ Got {count} articles from {name}")
        
        except Exception as e:
            print(f"  ✗ Error fetching {name}: {e}")
            continue
    
    return all_articles

def save_articles(articles):
    """Save articles to JSON file"""
    # Sort by date (newest first)
    articles.sort(
        key=lambda x: datetime.fromisoformat(x['pubDate']) if 'T' in x['pubDate'] else datetime.strptime(x['pubDate'], '%a, %d %b %Y %H:%M:%S %z'),
        reverse=True
    )
    
    # Keep top 30
    articles = articles[:30]
    
    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "article_count": len(articles),
        "articles": articles
    }
    
    # Save to docs directory (for GitHub Pages)
    docs_dir = Path("docs")
    docs_dir.mkdir(exist_ok=True)
    
    output_file = docs_dir / "mma-news.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Saved {len(articles)} articles to {output_file}")

if __name__ == "__main__":
    print("Fetching MMA news feeds...\n")
    articles = fetch_feeds()
    print(f"\nTotal articles: {len(articles)}")
    save_articles(articles)
    print("Done!")
