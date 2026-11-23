export function normalizeReutersArticleUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^(?:https?:\/\/|\/)/i.test(value.trim())) {
    return undefined;
  }

  try {
    const url = new URL(value.trim(), 'https://www.reuters.com');
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !['www.reuters.com', 'reuters.com'].includes(url.hostname) ||
      url.username || url.password || url.port || url.pathname === '/'
    ) {
      return undefined;
    }

    url.protocol = 'https:';
    url.hash = '';
    return url.href;
  } catch {
    return undefined;
  }
}

export function normalizeReutersNewsUrl(value: unknown): string | undefined {
  const reutersUrl = normalizeReutersArticleUrl(value);
  if (reutersUrl) return reutersUrl;
  if (typeof value !== 'string') return undefined;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'news.google.com' || url.username || url.password || url.port || !/^\/(?:rss\/articles|articles|read)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return undefined;
    url.hash = '';
    return url.href;
  } catch {
    return undefined;
  }
}
