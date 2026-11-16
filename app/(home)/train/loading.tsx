import { ConsoleShell } from '@/components/console-shell';
import { WorkspaceLoading } from '@/components/workspace-loading';
import styles from './train.module.css';

export default function Loading() {
  // The same edge-to-edge shell as the pages it stands in for, so their own loader takes over in place.
  return <ConsoleShell bleed className={styles.page}><WorkspaceLoading /></ConsoleShell>;
}
