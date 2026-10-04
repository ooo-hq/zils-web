import styles from '@/app/(home)/train/train.module.css';

export function TrainingGuide() {
  return <section className={styles.guide} aria-labelledby="bring-title">
    <div>
      <h2 id="bring-title">Bring decisions you can teach from.</h2>
      <p>Start with a spreadsheet of past cases and the correct answer for each one. Export it from your support tool, review queue, or internal records.</p>
      <p>Include the information available <strong>before</strong> the decision. Have someone review the answers you want Zils to learn.</p>
      <div className={styles.actions}>
        <a className={styles.button} href="#training-workspace">Start with your data</a>
        <a className={styles.secondary} href="/training/decision-template.csv" download>Download blank CSV</a>
      </div>
      <details className={styles.details}><summary>What if I don’t have the answers yet?</summary><p>Choose a real decision and its possible answers. Ask someone who handles it today to label past cases in the spreadsheet. A folder of documents or a list of unreviewed model predictions is not enough for this training flow.</p><p>Use only data you have permission to share. Remove unnecessary personal information before preparing your file.</p></details>
    </div>
    <div className={styles.example}>
      <div className={styles.exampleHeading}><span>Example: route a support ticket</span><span className={styles.badge}>Illustrative data</span></div>
      <table><caption>One row, one reviewed decision.</caption><thead><tr><th>Information available</th><th>Correct answer</th></tr></thead><tbody>
        <tr><td>“Please send last month’s invoice.”</td><td>Billing</td></tr>
        <tr><td>“The app crashes when I open it.”</td><td>Technical support</td></tr>
        <tr><td>“I need to change my account email.”</td><td>Account changes</td></tr>
      </tbody></table>
      <p>Use this flow for a decision with a fixed set of possible answers. Each answer needs examples from at least three independent sources to prepare separate learning and evaluation sets. That is a preparation minimum, not evidence of enough data for a useful model.</p>
      <a href="/training/support-routing-example.csv" download>Download the 18-row example CSV</a>
    </div>
  </section>;
}
