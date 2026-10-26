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
