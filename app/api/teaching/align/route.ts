import { handleTeachingAlignment } from '@/lib/teaching-alignment-server';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const GET = handleTeachingAlignment;
export const POST = handleTeachingAlignment;
