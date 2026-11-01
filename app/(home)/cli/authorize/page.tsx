import type { Metadata } from 'next';
import { CliAuthorization } from '@/components/cli-authorization';

export const metadata: Metadata = {
  title: 'Connect the Zils CLI',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function CliAuthorizePage({ searchParams }: { searchParams: Promise<{ authorization_id?: string | string[] }> }) {
  const { authorization_id } = await searchParams;
  return <CliAuthorization authorizationId={typeof authorization_id === 'string' ? authorization_id : null} />;
}
