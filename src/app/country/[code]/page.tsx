import { notFound } from 'next/navigation';
import Home from '@/app/page';
import { getCountryByCode, getCountryName } from '@/lib/countries';

interface CountryPageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: CountryPageProps) {
  const { code } = await params;
  const normalizedCode = code.toUpperCase();
  const country = getCountryByCode(normalizedCode);

  if (!country) {
    return {
      title: 'Culturia',
    };
  }

  const countryName = getCountryName(normalizedCode);
  return {
    title: `Culturia | ${countryName}`,
    description: `Read public country impressions for ${countryName} on Culturia.`,
    alternates: {
      canonical: `https://culturia.xyz/country/${normalizedCode}`,
    },
  };
}

export default async function CountryPage({ params }: CountryPageProps) {
  const { code } = await params;
  const normalizedCode = code.toUpperCase();

  if (!getCountryByCode(normalizedCode)) {
    notFound();
  }

  return <Home initialCountryCode={normalizedCode} />;
}
