#!/usr/bin/env python3
"""
Fetch MMA news RSS feeds and save as JSON for static site consumption
Run via GitHub Actions or manually
"""

import feedparser
import json
from datetime import datetime, timezone
from pathlib import Path
import re

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

def parse_date(date_str):
    """Parse date string in any format"""
    if not date_str:
        return datetime.now(timezone.utc)
    
    try:
        # Try ISO format with Z
        if 'T' in date_str:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except:
        pass
    
    try:
        # Try RSS format: 'Wed, 22 Oct 2025 06:23:47 +0000'
        # Remove timezone offset for parsing
        date_clean = re.sub(r'\s[+-]\d{4}$', '', date_str.strip())
        return datetime.strptime(date_clean, '%a, %d %b %Y %H:%M:%S')
    except:
        pass
    
    try:
        # Try other common formats
        return datetime.strptime(date_str[:19], '%Y-%m-%d %H:%M:%S')
    except:
        pass
    
    # Fallback
    print(f"  Warning: Could not parse date '{date_str}', using current time")
    return datetime.now(timezone.utc)

def extract_thumbnail(entry):
    """Extract thumbnail from feedparser entry"""
    # Try media_thumbnail
    if hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
        for thumb in entry.media_thumbnail:
            if 'url' in thumb:
                return thumb['url']
    
    # Try media_content
    if hasattr(entry, 'media_content') and entry.media_content:
        for content in entry.media_content:
            if content.get('medium') == 'image' and 'url' in content:
                return content['url']
    
    # Try links with image type
    if hasattr(entry, 'links') and entry.links:
        for link in entry.links:
            if link.get('type', '').startswith('image'):
                return link.get('href')
    
    # Try image in summary
    if hasattr(entry, 'summary') and entry.summary:
        match = re.search(r'<img[^>]+src="([^">]+)"', entry.summary)
        if match:
            return match.group(1)
    
    return None

def clean_description(text):
    """Remove HTML tags from description"""
    if not text:
        return ""
    
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
                    # Get date
                    pub_date = None
                    if hasattr(entry, 'published'):
                        pub_date = entry.published
                    elif hasattr(entry, 'updated'):
                        pub_date = entry.updated
                    else:
                        pub_date = datetime.now(timezone.utc).isoformat()
                    
                    article = {
                        "title": entry.get('title', 'No title'),
                        "link": entry.get('link', '#'),
                        "description": clean_description(entry.get('summary', '')),
                        "pubDate": pub_date,
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
    if not articles:
        print("No articles to save!")
        return
    
    # Sort by date (newest first)
    try:
        articles.sort(key=lambda x: parse_date(x['pubDate']), reverse=True)
    except Exception as e:
        print(f"Warning: Error sorting articles: {e}")
    
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
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"\n✓ Saved {len(articles)} articles to {output_file}")
    except Exception as e:
        print(f"✗ Error saving articles: {e}")

if __name__ == "__main__":
    print("Fetching MMA news feeds...\n")
    articles = fetch_feeds()
    print(f"\nTotal articles fetched: {len(articles)}")
    save_articles(articles)
    print("Done!")
