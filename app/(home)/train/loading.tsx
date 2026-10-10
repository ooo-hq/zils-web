import { SiteHeader } from '@/components/site-header';
import { TrainingFooter } from '@/components/training-footer';
import { WorkspaceLoading } from '@/components/workspace-loading';
import styles from './train.module.css';

export default function Loading() {
  return <div className={`${styles.page} ${styles.workspacePage}`}><div className={`${styles.container} ${styles.workspaceContainer}`}>
    <SiteHeader tone="light" current="train" />
    <main id="main-content" tabIndex={-1} className={styles.workspaceMain}><WorkspaceLoading /></main>
    <TrainingFooter />
  </div></div>;
}
