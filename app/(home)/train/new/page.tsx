import { redirect } from 'next/navigation';

// Training starts on /train itself; old links keep their gateway question or teaching choice.
export default async function NewTrainingPage({ searchParams }: { searchParams: Promise<{ gateway?: string | string[]; by?: string | string[] }> }) {
  const { gateway, by } = await searchParams;
  const query = new URLSearchParams();
  if (typeof gateway === 'string') query.set('gateway', gateway);
  if (typeof by === 'string') query.set('by', by);
  redirect(query.size ? `/train?${query}` : '/train');
}
