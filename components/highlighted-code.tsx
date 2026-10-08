import { useMemo, type ReactNode } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';

Prism.manual = true;

export type CodeLanguage = 'python' | 'javascript' | 'bash';

function renderTokens(tokens: string | Prism.Token | (string | Prism.Token)[]): ReactNode {
  if (typeof tokens === 'string') return tokens;
  if (Array.isArray(tokens)) return tokens.map((token, index) => <span key={index}>{renderTokens(token)}</span>);
  return <span className={`token ${tokens.type}`}>{renderTokens(tokens.content)}</span>;
}

export function HighlightedCode({ code, language }: { code: string; language: CodeLanguage }) {
  return useMemo(() => renderTokens(Prism.tokenize(code, Prism.languages[language])), [code, language]);
}
