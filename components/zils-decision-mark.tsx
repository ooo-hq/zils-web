/** The wordmark's crooked path becomes a decision that branches, then resolves. */
export function ZilsDecisionMark({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 150 96" fill="none" aria-hidden="true" focusable="false">
    <path d="m16 30 91-15-47 51 70-12-20 30-94-4 39-40Z" fill="currentColor" opacity=".12" />
    <path d="m15 48 56-13-24 34 48-12m-24-22 30-20m-6 42 35 18m-35-18 32-23" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="15" cy="48" r="5" fill="currentColor" />
    <circle cx="105" cy="12" r="6" fill="currentColor" />
    <path d="m129 23 10 11-11 11-10-11Z" fill="currentColor" />
    <path d="m127 61 3 8 9-3-4 8 8 5-10 1-1 9-6-7-8 5 2-10-9-4 10-3Z" fill="#E2CA56" />
  </svg>;
}
