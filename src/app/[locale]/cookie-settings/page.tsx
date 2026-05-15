import { setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import CookieSettingsClient from './CookieSettingsClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const baseUrl = 'https://stegastein.com';
  const enUrl = `${baseUrl}/cookie-settings`;
  const zhUrl = `${baseUrl}/zh/cookie-settings`;

  return {
    alternates: {
      canonical: enUrl,
      languages: {
        'en': enUrl,
        'zh': zhUrl,
        'x-default': enUrl,
      },
    },
  };
}

export default async function CookiePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CookieSettingsClient />;
}
