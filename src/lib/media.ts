/** The publisher writes this public origin beside content, so both build hosts use the same value. */
import delivery from '../../content/media-delivery.json';

const base = delivery.base_url.replace(/\/+$/, '');

const managed = /^\/(?:files\/(?:seminars|publications)|images\/(?:seminars|people|home|album|figures|notices))\//;

export function mediaUrl(path: string): string {
  if (!managed.test(path) || !base) return path;
  if (!base.startsWith('https://')) throw new Error('Public media base URL must be HTTPS');
  return `${base}/media${path.split('/').map((part) => encodeURIComponent(part)).join('/')}`;
}

/** Rewrite only quoted local media attributes in trusted, build-time Markdown output. */
export function mediaHtml(html: string): string {
  return html.replace(/\b(src|href)=(['"])(\/[^'"<>]+)\2/g,
    (match, attr: string, quote: string, url: string) => {
      const translated = mediaUrl(url);
      return translated === url ? match : `${attr}=${quote}${translated}${quote}`;
    });
}
