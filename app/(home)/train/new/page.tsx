import type { Metadata } from 'next';
import { ConsoleShell } from '@/components/console-shell';
import { TrainTable } from '@/components/train-table';
import { trainingConfig } from '@/lib/training-config';

export const metadata: Metadata = {
  title: 'Train a model · Zils',
  description: 'Drop your examples, put what it should decide on the right of the line, and start a training run.',
  robots: { index: false, follow: false },
};

export default function NewTrainingPage() {
  return <ConsoleShell><TrainTable config={trainingConfig()} /></ConsoleShell>;
}
