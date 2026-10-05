'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import styles from './sheet.module.css';

// shadcn/ui Sheet, adapted to Zils' existing styles.
export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;
export const SheetTitle = Dialog.Title;
export const SheetDescription = Dialog.Description;

export function SheetContent({ className, children, closeLabel = 'Close training setup', closeDisabled = false, ...props }: ComponentProps<typeof Dialog.Content> & { closeLabel?: string; closeDisabled?: boolean }) {
  return <Dialog.Portal>
    <Dialog.Overlay className={styles.overlay} />
    <Dialog.Content className={cn(styles.content, className)} {...props}>
      {children}
      <Dialog.Close className={styles.close} aria-label={closeLabel} disabled={closeDisabled}><X size={20} aria-hidden="true" /></Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>;
}
