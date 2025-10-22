#!/usr/bin/env python3
"""
Fetch MMA news RSS feeds (including YouTube) and save as JSON
Pulls up to 5 days of history
"""

import feedparser
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
import re

RSS_FEEDS = [
    {"name": "Lowkick MMA", "url": "https://lowkickmma.com/feed"},
    {"name": "BJPENN", "url": "https://bjpenn.com/feed"},
    {"name": "Sherdog", "url": "https://sherdog.com/rss/news.xml"},
    {"name": "UFC Official YouTube", "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCPQDDlGe7lbgmEJ0ge7a_JA"},
    {"name": "ESPN MMA YouTube", "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCiWLfSweyRNmLpgEHekhoAg"}
]

def parse_date(date_str):
    """Parse date string in any format"""
    if not date_str:
        return datetime.now(timezone.utc)
    
    try:
        if 'T' in date_str:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except:
        pass
    
    try:
        date_clean = re.sub(r'\s[+-]\d{4}$', '', date_str.strip())
        return datetime.strptime(date_clean, '%a, %d %b %Y %H:%M:%S')
    except:
        pass
    
    try:
        return datetime.strptime(date_str[:19], '%Y-%m-%d %H:%M:%S')
    except:
        pass
    
    return datetime.now(timezone.utc)

def extract_thumbnail(entry):
    """Extract thumbnail URL from feedparser entry"""
    if hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
        for thumb in entry.media_thumbnail:
            if 'url' in thumb:
                return thumb['url']
    
    if hasattr(entry, 'media_content') and entry.media_content:
        for content in entry.media_content:
            if content.get('medium') == 'image' and 'url' in content:
                return content['url']
    
    if hasattr(entry, 'links') and entry.links:
        for link in entry.links:
            if link.get('type', '').startswith('image'):
                return link.get('href')
    
    if hasattr(entry, 'summary') and entry.summary:
        match = re.search(r'<img[^>]+src="([^">]+)"', entry.summary)
        if match:
            return match.group(1)
    
    return None

def clean_description(text):
    """Remove HTML tags from description"""
    if not text:
        return ""
    
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', '', text)
    
    import html
    text = html.unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def fetch_feeds():
    """Fetch all RSS feeds and return articles from last 5 days"""
    all_articles = []
    five_days_ago = datetime.now(timezone.utc) - timedelta(days=5)
    
    for feed_config in RSS_FEEDS:
        name = feed_config['name']
        url = feed_config['url']
        
        print(f"Fetching {name}...")
        try:
            feed = feedparser.parse(url)
            
            if feed.bozo:
                print(f"  ⚠ Warning: {feed.bozo_exception}")
            
            count = 0
            for entry in feed.entries:
                try:
                    pub_date_str = entry.get('published') or entry.get('updated') or datetime.now(timezone.utc).isoformat()
                    pub_date = parse_date(pub_date_str)
                    
                    # Only include articles from last 5 days
                    if pub_date < five_days_ago:
                        continue
                    
                    image_url = extract_thumbnail(entry)
                    
                    article = {
                        "title": entry.get('title', 'No title'),
                        "link": entry.get('link', '#'),
                        "description": clean_description(entry.get('summary', '')),
                        "pubDate": pub_date_str,
                        "source": name,
                        "thumbnail": image_url
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
    
    try:
        articles.sort(key=lambda x: parse_date(x['pubDate']), reverse=True)
    except Exception as e:
        print(f"Warning: Error sorting articles: {e}")
    
    # Keep top 50 (instead of 30, since we're pulling 5 days)
    articles = articles[:50]
    
    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "article_count": len(articles),
        "articles": articles
    }
    
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
    print("Fetching MMA news feeds (last 5 days)...\n")
    articles = fetch_feeds()
    print(f"\nTotal articles fetched: {len(articles)}")
    save_articles(articles)
    print("Done!")
