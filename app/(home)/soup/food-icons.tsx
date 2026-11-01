import s from './food-icons.module.css';

// Small line icons in the bowl's style (soup/bowl.tsx): 24px grid, 1.5px stroke, ink only. Decorative; each sits
// beside text that already says what the step is.
const PATHS = {
  bowl: <><path d="M3 11h18c0 4.4-4 8-9 8s-9-3.6-9-8Z" /><path d="M9 21h6" /><path d="M9.5 3.5c-.9 1.1.9 1.9 0 3.3M13.5 3.5c-.9 1.1.9 1.9 0 3.3" /></>,
  ladle: <><path d="M3 13h9a4.5 4.5 0 0 1-9 0Z" /><path d="M12 13 19.5 3.5" /></>,
  chopsticks: <><path d="M4 21 18 3" /><path d="M8 21 21 6.5" /></>,
  spoon: <><path d="M3 13.5c0-1.6 2.5-2.5 5.5-2.5s5.5.9 5.5 2.5-2.5 3.5-5.5 3.5S3 15.1 3 13.5Z" /><path d="M13.6 12.4 21 7" /></>,
  ticket: <><path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4Z" /><path d="M9.5 6v12" strokeDasharray="1.5 2" /></>,
  flame: <path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.4-4 2.4-5 .3 1.8 1.2 2.6 2.4 3 .6-3-1-5.5.2-8Z" />,
  naruto: <><circle cx="12" cy="12" r="8.5" /><path d="M12 12c0-1.2 1.6-1.2 1.6 0 0 2.4-4.8 2.4-4.8 0 0-3.6 7.6-3.6 7.6 0" /></>,
} as const;

export type Food = keyof typeof PATHS;

export function FoodIcon({ name, className }: { name: Food; className?: string }) {
  return <svg className={className ? `${s.icon} ${className}` : s.icon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{PATHS[name]}</svg>;
}
