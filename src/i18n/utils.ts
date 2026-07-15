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

/** Single-locale site: paths are served unprefixed. */
export function localePath(_locale: Locale, path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/** Single-locale site: the canonical path is the path itself. */
export function switchLocalePath(url: URL, target: Locale): string {
  return localePath(target, url.pathname || '/');
}

