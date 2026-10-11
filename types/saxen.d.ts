// The parser used by read-excel-file has no published TypeScript declarations.
declare module 'saxen' {
  export class Parser {
    on(event: 'openTag', handler: (name: string, attributes: () => Record<string, string>, decode: (value: string) => string) => void): void;
    on(event: 'error' | 'warn', handler: (error: Error) => void): void;
    on(event: 'text', handler: (value: string, decode: (value: string) => string) => void): void;
    on(event: 'closeTag', handler: (name: string) => void): void;
    parse(xml: string): void;
  }
}
