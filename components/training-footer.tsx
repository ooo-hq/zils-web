import Link from 'next/link';
import { discordUrl, docsUrl } from '@/lib/shared';
import { ZilsWordmark } from '@/components/zils-wordmark';
import styles from '@/app/(home)/train/train.module.css';

export function TrainingFooter() {
  return <footer className={styles.footer}>
    <Link href="/" aria-label="Zils home"><ZilsWordmark className="text-2xl" /></Link>
    <span>Training workspace</span>
    <nav aria-label="Workspace resources and policies">
      <a href={docsUrl}>Docs</a><a href={discordUrl}>Discord</a><a href="https://x.com/zils_ai">X</a><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link>
    </nav>
  </footer>;
}
