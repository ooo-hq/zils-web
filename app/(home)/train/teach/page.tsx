import { redirect } from 'next/navigation';

// Teaching by example moved onto /train; old links land on it.
export default function TeachPage() {
  redirect('/train?by=examples');
}
