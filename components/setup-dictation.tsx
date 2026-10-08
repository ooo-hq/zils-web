'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Mic, Square } from 'lucide-react';
import s from './guided-playground.module.css';

type Speech = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Speech; webkitSpeechRecognition?: new () => Speech };
const subscribe = () => () => {};
const supported = () => Boolean((window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition);

export function SetupDictation({ onText, disabled }: { onText: (text: string) => void; disabled: boolean }) {
  const available = useSyncExternalStore(subscribe, supported, () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognition = useRef<Speech | null>(null);
  useEffect(() => () => {
    const current = recognition.current;
    if (current) { current.onend = null; current.onresult = null; current.onerror = null; current.abort(); }
  }, []);
  useEffect(() => { if (disabled) recognition.current?.abort(); }, [disabled]);
  function toggle() {
    if (recognition.current) { recognition.current.stop(); return; }
    const Constructor = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor) return;
    const speech = new Constructor();
    speech.lang = 'en-US'; speech.interimResults = false; speech.continuous = false;
    speech.onresult = event => onText(event.results[0][0].transcript);
    speech.onerror = event => setError(event.error === 'not-allowed' ? 'Microphone permission was declined. You can keep typing.' : 'Could not capture speech. Try again or type your goal.');
    speech.onend = () => { recognition.current = null; setListening(false); };
    setError(''); recognition.current = speech;
    try { speech.start(); setListening(true); }
    catch { recognition.current = null; setListening(false); setError('Voice input is unavailable. Type your goal instead.'); }
  }
  if (!available) return <span className={s.helper}>You can also use your keyboard’s dictation.</span>;
  return <div className={s.voice}>
    <button type="button" className={s.quietButton} disabled={disabled} onClick={toggle} aria-pressed={listening}>{listening ? <Square size={15} /> : <Mic size={16} />}{listening ? 'Stop listening' : 'Speak your goal'}</button>
    <span className={s.helper}>{listening ? 'Listening…' : 'Voice uses your browser’s speech service.'}</span>
    {error && <p role="alert" className={s.helper}>{error}</p>}
  </div>;
}
