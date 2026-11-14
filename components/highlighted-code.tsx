import { useMemo, type ReactNode } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';

Prism.manual = true;

export type CodeLanguage = 'python' | 'javascript' | 'bash';

function renderTokens(tokens: string | Prism.Token | (string | Prism.Token)[], mark?: string): ReactNode {
  if (typeof tokens === 'string') {
    if (!mark || !tokens.includes(mark)) return tokens;
    return tokens.split(mark).map((piece, index) => <span key={index}>{index > 0 && <mark>{mark}</mark>}{piece}</span>);
  }
  if (Array.isArray(tokens)) return tokens.map((token, index) => <span key={index}>{renderTokens(token, mark)}</span>);
  return <span className={`token ${tokens.type}`}>{renderTokens(tokens.content, mark)}</span>;
}

/** `mark` wraps each occurrence of that exact text in a <mark>, when it falls inside one token. */
export function HighlightedCode({ code, language, mark }: { code: string; language: CodeLanguage; mark?: string }) {
  return useMemo(() => renderTokens(Prism.tokenize(code, Prism.languages[language]), mark), [code, language, mark]);
}
