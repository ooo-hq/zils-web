export function XProfileLink({ tone = 'light', iconSize = 16 }: { tone?: 'light' | 'dark'; iconSize?: number }) {
  return (
    <a
      href="https://x.com/zils_ai"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Zils on X (opens in a new tab)"
      title="Follow @zils_ai on X"
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${tone === 'light' ? 'text-muted hover:text-ink' : 'text-neutral-400 hover:text-white'}`}
    >
      <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill="currentColor" aria-hidden="true" focusable="false">
        <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932 6.064-6.933Zm-1.29 19.49h2.039L6.487 3.24H4.3l13.311 17.403Z" />
      </svg>
    </a>
  );
}
