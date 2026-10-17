import { ConsoleShell } from '@/components/console-shell';
import { WorkspaceLoading } from '@/components/workspace-loading';
import styles from './train.module.css';

export default function Loading() {
  return <ConsoleShell className={styles.page}><WorkspaceLoading /></ConsoleShell>;
}
