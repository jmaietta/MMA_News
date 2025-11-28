/**
 * Shoot MMA - Enhanced App.js
 * 
 * Original features preserved + new enhancements:
 * 1. Toast notifications for share feedback
 * 2. Progressive image loading (blur-up effect)
 * 3. Search UX: debounce, recent searches, result count, highlighting
 * 5. Infinite scroll with "Load More" fallback + Back to Top
 */

// =========================================================
// CONFIGURATION
// =========================================================
const CONFIG = {
    ARTICLES_PER_PAGE: 10,
    SEARCH_DEBOUNCE_MS: 250,
    MAX_RECENT_SEARCHES: 5,
    TOAST_DURATION_MS: 2500,
    BACK_TO_TOP_THRESHOLD: 600,
};

// =========================================================
// STATE
// =========================================================
let allArticles = [];
let filteredArticles = [];
let displayedCount = 0;
let isLoadingMore = false;
let currentSearchQuery = '';

// =========================================================
// 1. TOAST NOTIFICATION SYSTEM
// =========================================================
const Toast = {
    container: null,

    init() {
        this.container = document.getElementById('toast-container');
    },

    show(message, type = 'default') {
        if (!this.container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>',
            error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
            default: ''
        };

        toast.innerHTML = `${icons[type] || ''}${message}`;
        this.container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 250);
        }, CONFIG.TOAST_DURATION_MS);
    },

    success(message) { this.show(message, 'success'); },
    error(message) { this.show(message, 'error'); }
};

// =========================================================
// 2. PROGRESSIVE IMAGE LOADING
// =========================================================
const ImageLoader = {
    observer: null,

    init() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadImage(entry.target);
                    this.observer.unobserve(entry.target);
                }
            });
        }, { rootMargin: '150px' });
    },

    observe(container) {
        const images = container.querySelectorAll('.article-thumb[data-src]');
        images.forEach(img => this.observer.observe(img));
    },

    loadImage(img) {
        const thumbLink = img.closest('.thumb-link');
        const src = img.dataset.src;

        if (!src) return;

        const preload = new Image();
        preload.onload = () => {
            img.src = src;
            img.classList.add('loaded');
            thumbLink?.classList.add('loaded');
        };
        preload.onerror = () => {
            img.src = './logo-placeholder.png';
            img.classList.add('loaded');
            thumbLink?.classList.add('loaded');
        };
        preload.src = src;
    }
};

// =========================================================
// 3. SEARCH ENHANCEMENTS
// =========================================================
const Search = {
    debounceTimer: null,
    recentSearches: [],

    init() {
        // Load from localStorage
        try {
            this.recentSearches = JSON.parse(localStorage.getItem('mma-recent-searches') || '[]');
        } catch { this.recentSearches = []; }

        const input = document.getElementById('t2d-q');
        const form = document.getElementById('search-form');
        const clearBtn = document.getElementById('clear-search');
        const recentContainer = document.getElementById('recent-searches');
        const recentList = document.getElementById('recent-searches-list');
        const clearRecentBtn = document.getElementById('clear-recent');

        if (!input) return;

        // Keyboard shortcut: "/" to focus
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && document.activeElement !== input) {
                e.preventDefault();
                input.focus();
            }
            if (e.key === 'Escape' && document.activeElement === input) {
                input.blur();
                this.hideRecent();
            }
        });

        // Input handler with debounce
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            clearBtn.style.display = val ? 'block' : 'none';
            
            if (val) this.hideRecent();

            // Show spinner
            form?.classList.add('searching');

            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.performSearch(val);
                form?.classList.remove('searching');
            }, CONFIG.SEARCH_DEBOUNCE_MS);
        });

        // Focus: show recent searches
        input.addEventListener('focus', () => {
            if (!input.value && this.recentSearches.length > 0) {
                this.renderRecent();
                recentContainer?.classList.add('visible');
            }
        });

        // Blur: hide recent (with delay for clicks)
        input.addEventListener('blur', () => {
            setTimeout(() => this.hideRecent(), 150);
        });

        // Prevent form submit
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            const q = input.value.trim();
            if (q) this.saveSearch(q);
        });

        // Clear button
        clearBtn?.addEventListener('click', () => {
            input.value = '';
            clearBtn.style.display = 'none';
            this.performSearch('');
            input.focus();
        });

        // Clear recent searches
        clearRecentBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.recentSearches = [];
            localStorage.removeItem('mma-recent-searches');
            this.hideRecent();
        });

        // Click on recent search item (delegated)
        recentList?.addEventListener('click', (e) => {
            const item = e.target.closest('.recent-search-item');
            if (item) {
                const q = item.dataset.query;
                input.value = q;
                clearBtn.style.display = 'block';
                this.performSearch(q);
                this.hideRecent();
            }
        });
    },

    performSearch(query) {
        currentSearchQuery = query.trim().toLowerCase();
        displayedCount = 0;

        if (!currentSearchQuery) {
            filteredArticles = [...allArticles];
            this.updateResultsInfo(false);
        } else {
            filteredArticles = allArticles.filter(article => {
                const title = article.title.toLowerCase();
                const desc = (article.description || '').toLowerCase();
                const source = article.source.toLowerCase();
                return title.includes(currentSearchQuery) || 
                       desc.includes(currentSearchQuery) || 
                       source.includes(currentSearchQuery);
            });
            this.updateResultsInfo(true);
            
            // Save if has results
            if (filteredArticles.length > 0) {
                this.saveSearch(query.trim());
            }
        }

        renderArticles(filteredArticles.slice(0, CONFIG.ARTICLES_PER_PAGE), true);
        displayedCount = Math.min(CONFIG.ARTICLES_PER_PAGE, filteredArticles.length);
        updateLoadMoreVisibility();
    },

    updateResultsInfo(visible) {
        const info = document.getElementById('search-results-info');
        const shown = document.getElementById('results-shown');
        const total = document.getElementById('results-total');

        if (visible) {
            info?.classList.add('visible');
            if (shown) shown.textContent = Math.min(displayedCount || CONFIG.ARTICLES_PER_PAGE, filteredArticles.length);
            if (total) total.textContent = filteredArticles.length;
        } else {
            info?.classList.remove('visible');
        }
    },

    saveSearch(query) {
        if (!query || query.length < 2) return;
        
        // Remove if exists, add to front
        this.recentSearches = this.recentSearches.filter(s => s.toLowerCase() !== query.toLowerCase());
        this.recentSearches.unshift(query);
        this.recentSearches = this.recentSearches.slice(0, CONFIG.MAX_RECENT_SEARCHES);
        
        try {
            localStorage.setItem('mma-recent-searches', JSON.stringify(this.recentSearches));
        } catch {}
    },

    renderRecent() {
        const list = document.getElementById('recent-searches-list');
        if (!list) return;

        list.innerHTML = this.recentSearches.map(q => `
            <div class="recent-search-item" data-query="${q.replace(/"/g, '&quot;')}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <span>${q}</span>
            </div>
        `).join('');
    },

    hideRecent() {
        document.getElementById('recent-searches')?.classList.remove('visible');
    }
};

// =========================================================
// 5. INFINITE SCROLL & LOAD MORE
// =========================================================
const InfiniteScroll = {
    observer: null,

    init() {
        const sentinel = document.getElementById('scroll-sentinel');
        const loadMoreBtn = document.getElementById('btn-load-more');
        const backToTopBtn = document.getElementById('btn-back-to-top');

        // Intersection Observer for infinite scroll
        if (sentinel) {
            this.observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && !isLoadingMore) {
                    this.loadMore();
                }
            }, { rootMargin: '200px' });

            this.observer.observe(sentinel);
        }

        // Load More button fallback
        loadMoreBtn?.addEventListener('click', () => this.loadMore());

        // Back to Top button
        if (backToTopBtn) {
            window.addEventListener('scroll', () => {
                backToTopBtn.classList.toggle('visible', window.scrollY > CONFIG.BACK_TO_TOP_THRESHOLD);
            }, { passive: true });

            backToTopBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    },

    loadMore() {
        if (isLoadingMore || displayedCount >= filteredArticles.length) return;

        isLoadingMore = true;
        const loadMoreBtn = document.getElementById('btn-load-more');
        const loadingMore = document.getElementById('loading-more');

        loadMoreBtn?.classList.add('loading');
        if (loadingMore) loadingMore.style.display = 'flex';

        // Simulate slight delay for UX
        setTimeout(() => {
            const nextBatch = filteredArticles.slice(
                displayedCount, 
                displayedCount + CONFIG.ARTICLES_PER_PAGE
            );

            appendArticles(nextBatch);
            displayedCount += nextBatch.length;

            // Update search results count
            const shown = document.getElementById('results-shown');
            if (shown && currentSearchQuery) {
                shown.textContent = displayedCount;
            }

            loadMoreBtn?.classList.remove('loading');
            if (loadingMore) loadingMore.style.display = 'none';
            isLoadingMore = false;

            updateLoadMoreVisibility();
        }, 300);
    }
};

// =========================================================
// HELPER FUNCTIONS (Original + Enhanced)
// =========================================================

function isYoutubeContent(url, thumbUrl) {
    if (!url) return false;
    const ytRegex = /(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/i;
    const thumbRegex = /ytimg\.com/i;
    return ytRegex.test(url) || (thumbUrl && thumbRegex.test(thumbUrl));
}

function cleanDescription(text) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    return tempDiv.textContent || tempDiv.innerText || '';
}

function formatDate(date) {
    const now = new Date();
    const dateObj = new Date(date);
    const diffMs = now - dateObj;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return dateObj.toLocaleDateString();
}

// Highlight search matches in text
function highlightMatches(text, query) {
    if (!query || !text) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
}

// Create article card HTML (enhanced with progressive loading)
function createArticleCard(article, highlight = false) {
    const rawImage = article.thumbnail || '';
    const imageUrl = rawImage 
        ? `https://images.weserv.nl/?url=${encodeURIComponent(rawImage)}`
        : './logo-placeholder.png';
    
    let descriptionText = article.description ? cleanDescription(article.description) : '';
    let titleText = article.title;

    // Apply highlighting if searching
    if (highlight && currentSearchQuery) {
        titleText = highlightMatches(titleText, currentSearchQuery);
        descriptionText = highlightMatches(descriptionText, currentSearchQuery);
    }

    const isVideo = isYoutubeContent(article.link, rawImage);
    const wrapperClass = isVideo ? 'thumb-link is-video' : 'thumb-link';
    const safeTitle = article.title.replace(/"/g, '&quot;');

    // Use data-src for lazy loading
    return `
        <article class="fade-in" data-share-url="${article.link}" data-share-title="${safeTitle}">
            <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="${wrapperClass}">
                <img 
                    data-src="${imageUrl}" 
                    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3C/svg%3E"
                    alt="" 
                    class="article-thumb"
                >
            </a>
            <div class="article-content">
                <div class="article-source">${article.source}</div>
                <h2 class="article-title">
                    <a href="${article.link}" target="_blank" rel="noopener noreferrer">${titleText}</a>
                </h2>
                ${descriptionText ? `<p class="article-description">${descriptionText}</p>` : ''}
                
                <div class="article-footer">
                    <span class="article-date">${formatDate(article.pubDate)}</span>
                    <div class="article-actions">
                        <button class="btn-share btn-ripple" type="button" aria-label="Share this article">
                            <svg viewBox="0 0 24 24">
                                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </article>
    `;
}

// Render articles (replace container content)
function renderArticles(articles, highlight = false) {
    const container = document.getElementById('articles-container');
    const emptyMsg = document.getElementById('search-empty');

    if (articles.length === 0) {
        container.innerHTML = '';
        if (emptyMsg) emptyMsg.style.display = 'block';
    } else {
        if (emptyMsg) emptyMsg.style.display = 'none';
        container.innerHTML = articles.map(a => createArticleCard(a, highlight)).join('');
        
        // Start observing new images
        ImageLoader.observe(container);
    }
}

// Append articles (for infinite scroll)
function appendArticles(articles) {
    const container = document.getElementById('articles-container');
    const highlight = !!currentSearchQuery;
    
    const fragment = document.createElement('div');
    fragment.innerHTML = articles.map(a => createArticleCard(a, highlight)).join('');
    
    // Add staggered animation delay for new items
    const newArticles = fragment.querySelectorAll('article');
    newArticles.forEach((article, i) => {
        article.style.animationDelay = `${i * 50}ms`;
    });

    while (fragment.firstChild) {
        container.appendChild(fragment.firstChild);
    }

    // Observe new images
    ImageLoader.observe(container);
}

// Update Load More / End of Results visibility
function updateLoadMoreVisibility() {
    const loadMoreContainer = document.getElementById('load-more-container');
    const endOfResults = document.getElementById('end-of-results');

    const hasMore = displayedCount < filteredArticles.length;

    if (loadMoreContainer) {
        loadMoreContainer.style.display = hasMore ? 'flex' : 'none';
    }
    if (endOfResults) {
        endOfResults.style.display = (!hasMore && filteredArticles.length > CONFIG.ARTICLES_PER_PAGE) ? 'block' : 'none';
    }
}

// =========================================================
// SHARE FUNCTIONALITY (Enhanced with Toast)
// =========================================================
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-share');
    if (!btn) return;

    const article = btn.closest('article');
    const url = article.dataset.shareUrl;
    const title = article.dataset.shareTitle;

    // Native Share API
    if (navigator.share) {
        try {
            await navigator.share({ title, text: title, url });
            Toast.success('Shared successfully!');
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.log('Share failed:', err);
            }
        }
    } 
    // Fallback: Copy to clipboard
    else {
        try {
            await navigator.clipboard.writeText(url);
            Toast.success('Link copied to clipboard!');
            
            // Visual feedback on button
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/></svg>`;
            setTimeout(() => btn.innerHTML = originalHTML, 1500);
        } catch (err) {
            Toast.error('Could not copy link');
        }
    }
});

// =========================================================
// HEADER FUNCTIONALITY
// =========================================================
function setupHeaderScroll() {
    const header = document.querySelector('header.site');
    if (!header) return;

    window.addEventListener('scroll', () => {
        header.classList.toggle('shadow', window.scrollY > 8);
    }, { passive: true });
}

function initHeaderDate() {
    const el = document.getElementById('hdr-date');
    if (!el) return;
    
    const now = new Date();
    el.textContent = now.toLocaleDateString('en-US', { 
        month: 'short', day: 'numeric', year: 'numeric' 
    }).toUpperCase();
}

// =========================================================
// LOAD ARTICLES
// =========================================================
async function loadArticlesFromJSON() {
    try {
        const VERSION = new Date().toISOString().slice(0, 10);
        const response = await fetch(`./mma-news.json?v=${VERSION}`, { cache: 'no-store' });
        
        if (!response.ok) {
            console.warn('JSON file not found.');
            return null;
        }
        
        const data = await response.json();
        console.log(`✓ Loaded ${data.articles.length} articles`);
        return data.articles;
    } catch (error) {
        console.warn('Could not load JSON:', error.message);
        return null;
    }
}

async function loadArticles() {
    const skeletonEl = document.getElementById('loading-skeleton');
    const containerEl = document.getElementById('articles-container');
    
    if (skeletonEl) skeletonEl.style.display = 'grid';

    try {
        const articles = await loadArticlesFromJSON();
        
        if (!articles) {
            if (skeletonEl) skeletonEl.style.display = 'none';
            containerEl.innerHTML = '<p style="text-align:center; padding:2rem; color:#888;">No articles available.</p>';
            return;
        }

        allArticles = articles;
        filteredArticles = [...allArticles];

        if (skeletonEl) skeletonEl.style.display = 'none';

        // Render first batch
        const initialBatch = filteredArticles.slice(0, CONFIG.ARTICLES_PER_PAGE);
        renderArticles(initialBatch);
        displayedCount = initialBatch.length;

        updateLoadMoreVisibility();

        // Update timestamp
        const lastUpdated = document.getElementById('last-updated');
        if (lastUpdated) {
            lastUpdated.textContent = new Date().toLocaleTimeString();
        }
    } catch (error) {
        console.error('Fatal error:', error);
        if (skeletonEl) skeletonEl.style.display = 'none';
        containerEl.innerHTML = '<p style="text-align:center; padding:2rem; color:#888;">Error loading articles.</p>';
    }
}

// =========================================================
// INITIALIZATION
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all modules
    Toast.init();
    ImageLoader.init();
    Search.init();
    InfiniteScroll.init();
    
    // Setup header
    setupHeaderScroll();
    initHeaderDate();
    
    // Load content
    loadArticles();
});
