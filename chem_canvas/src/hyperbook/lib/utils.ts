import { cn } from '@/lib/utils';

export { cn };

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) return url;
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const path = urlObj.pathname;
    if (domain.length > maxLength - 3) {
      return domain.substring(0, maxLength - 3) + '...';
    }
    const remainingLength = maxLength - domain.length - 3;
    if (path.length > remainingLength) {
      return domain + path.substring(0, remainingLength) + '...';
    }
    return domain + path;
  } catch {
    return url.substring(0, maxLength - 3) + '...';
  }
}

export function normalizeUrl(url: string): string {
  if (!url) return '';
  try {
    const hasProtocol = /^https?:\/\//i.test(url);
    const normalized = new URL(hasProtocol ? url : `https://${url}`);
    normalized.hash = '';
    return normalized.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

