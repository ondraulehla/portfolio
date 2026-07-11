import { defaultLocale, isLocale, type Locale } from './config';
import { ui, type UIKey } from './ui';

export function getLocaleFromUrl(url: URL): Locale {
  const [, lang] = url.pathname.split('/');
  return lang && isLocale(lang) ? lang : defaultLocale;
}

export function useTranslations(locale: Locale) {
  return function t(key: UIKey): string {
    return ui[locale][key];
  };
}

/** Prefix a root-relative path with the locale: localePath('cs', '/projects/x') → '/cs/projects/x' */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${clean === '/' ? '/' : clean}`;
}

/** Map the current pathname to its sibling in the other locale. */
export function switchLocalePath(url: URL, target: Locale): string {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length > 0 && isLocale(parts[0]!)) parts.shift();
  const rest = parts.length ? `/${parts.join('/')}` : '/';
  return localePath(target, rest);
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'cs' : 'en';
}
