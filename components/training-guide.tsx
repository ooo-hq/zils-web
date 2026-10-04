import styles from '@/app/(home)/train/train.module.css';

export function TrainingGuide() {
  return <section className={styles.guide} aria-labelledby="bring-title">
    <div>
      <h2 id="bring-title">Bring decisions you can teach from.</h2>
      <p>Think of a decision your team makes often. Bring past cases where you already know the right answer, saved in a spreadsheet.</p>
      <p>Include the information available <strong>before</strong> the decision. Have someone review the answers you want Zils to learn.</p>
      <div className={styles.actions}>
        <a className={styles.button} href="#training-workspace">Start with your data</a>
        <a className={styles.secondary} href="/training/decision-template.csv" download>Download a template</a>
      </div>
      <details className={styles.details}><summary>What if I don’t have the answers yet?</summary><p>Choose a real decision and its possible answers. Ask someone who handles it today to label past cases in the spreadsheet. A folder of documents or a list of unreviewed model predictions is not enough for this training flow.</p><p>Use only data you have permission to share. Remove unnecessary personal information before preparing your file.</p></details>
    </div>
    <div className={styles.example}>
      <div className={styles.exampleHeading}><span>Example: route a support ticket</span><span className={styles.badge}>Illustrative data</span></div>
      <table><caption>One case. One correct answer.</caption><thead><tr><th>Information available</th><th>Correct answer</th></tr></thead><tbody>
        <tr><td>“Please send last month’s invoice.”</td><td>Billing</td></tr>
        <tr><td>“The app crashes when I open it.”</td><td>Technical support</td></tr>
        <tr><td>“I need to change my account email.”</td><td>Account changes</td></tr>
      </tbody></table>
      <p>Each example pairs what your team knew with the answer they checked. You’ll show Zils which is which using a preview of your own file.</p>
      <a href="/training/support-routing-example.csv" download>Download 18 filled-in examples</a>
      <details className={styles.details}><summary>How many examples do I need?</summary><p>Include a variety of real cases for every possible answer. This setup needs at least three separate cases per answer so some can teach Zils and others can test it. That minimum lets you try the flow; it does not mean you have enough data for a useful model.</p></details>
    </div>
  </section>;
}
