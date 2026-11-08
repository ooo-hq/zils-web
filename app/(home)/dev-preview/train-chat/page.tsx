import { notFound } from 'next/navigation';
import { ConsoleShell } from '@/components/console-shell';
import { TrainChat } from './train-chat';

// Dev-only prototype: train a model by talking to the setup assistant, inside the signed-in workspace.
// Nothing is uploaded or trained.
export default function Page() {
  if (process.env.ZILS_DEV_PREVIEW !== '1') notFound();
  return <ConsoleShell><TrainChat /></ConsoleShell>;
}
