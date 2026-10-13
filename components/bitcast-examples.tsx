'use client';

import { useState } from 'react';
import { ArrowRight, Ban, Calendar, Check, ChevronRight, Clock, Inbox, Mail, Play, RotateCcw, ShieldCheck, Trophy, UserRound } from 'lucide-react';
import s from './bitcast-examples.module.css';

type Verdict = 'pass' | 'fail';
type Example = {
  id: string; title: string; brand: string; tag: string; summary: string;
  analysis: string; brief: string; content: string; productionReasoning: string;
  decisions: { production: Verdict; base: Verdict; zils: Verdict; jev: Verdict };
};
type Reply = { id: string; content: string; previous: string | null; intent: keyof typeof routes; jev: keyof typeof routes; expected: string; before: string };
type Move = { uci: string; label: string; fromSquare: string; toSquare: string; board: string; mate: boolean };
type Position = { id: string; title: string; side: string; board: string; moves: Move[]; zils: string; jev: string; before: string };
type ExamplesData = {
  examples: Example[];
  scores: { name: string; note: string; matches: number; total: number }[];
  replies: Reply[];
  chess: { examples: Position[]; scores: { trained: number; shared: number; jev: number }; total: number };
};
type Demo = 'content' | 'inbox' | 'chess';
const demos = [
  { key: 'chess', name: 'Play a move', description: 'A mate Zils finds and JEV misses', icon: Trophy },
  { key: 'content', name: 'Review content', description: 'Approve the right posts', icon: ShieldCheck },
  { key: 'inbox', name: 'Sort an inbox', description: 'Turn replies into next steps', icon: Inbox },
] as const;
const routes = {
  meeting_acceptance: { label: 'Wants a call', action: 'Arrange a meeting', detail: 'Move to the meeting follow-up queue.', icon: Calendar, order: 0 },
  pricing_question: { label: 'Asks about pricing', action: 'Send pricing information', detail: 'Move to the sales follow-up queue.', icon: Mail, order: 1 },
  referral: { label: 'Refers a colleague', action: 'Follow up with the right person', detail: 'Create a referral handoff for the sales team.', icon: UserRound, order: 2 },
  not_now: { label: 'Not right now', action: 'Follow up later', detail: 'Keep this reply in the later follow-up queue.', icon: Clock, order: 3 },
  opt_out: { label: 'Wants contact stopped', action: 'Stop follow-ups', detail: 'Move to the do-not-contact queue.', icon: Ban, order: 4 },
  wrong_person: { label: 'Wrong person', action: 'Find the right contact', detail: 'Review the contact’s role before continuing outreach.', icon: UserRound, order: -1 },
  negative: { label: 'Not interested', action: 'Close the sales follow-up', detail: 'Mark this reply as a decline.', icon: Ban, order: 5 },
} as const;
const postNotes: Record<string, { title: string; reason: string }> = {
  T0353: { title: 'A tag isn’t a review', reason: 'A brand mention alone doesn’t describe the product.' },
  T0526: { title: 'The wrong brand gets the spotlight', reason: 'The post discusses other trading programs, even though it tags the sponsor.' },
  T0792: { title: 'A creator tries the product', reason: 'The creator uses the wallet and finishes with a positive review.' },
  T1381: { title: 'A tricky judgment call', reason: 'The reference label judged the post off-topic. A human might read it differently.' },
  T0449: { title: 'A decision Zils missed', reason: 'Zils accepted this post, but most of it is about another company.' },
};
const routeFor = (intent: keyof typeof routes) => routes[intent];
const verdictLabel = (value: Verdict) => value === 'pass' ? 'Approve' : 'Do not approve';

function ChoiceComparison({ zils, jev, zilsMatches, jevMatches, reference = 'reference label' }: { zils: string; jev: string; zilsMatches: boolean; jevMatches: boolean; reference?: string }) {
  return <div className={s.choiceComparison} aria-label="Zils and JEV on this example">
    {[{ name: 'Zils', label: zils, matches: zilsMatches }, { name: 'TypeSafe JEV', label: jev, matches: jevMatches }].map(row => <div key={row.name}><span>{row.name}</span><strong>{row.label}</strong><small className={row.matches ? s.match : s.caution}>{row.matches ? <Check size={13} /> : <FlagIcon />}{row.matches ? 'Matches' : 'Differs from'} {reference}</small></div>)}
  </div>;
}

function ContentDemo({ examples }: { examples: Example[] }) {
  const [index, setIndex] = useState(0);
  return <>
    <div className={s.appHeader}><div><ShieldCheck size={18} /><strong>Creator review</strong><span>Bitcast</span></div><span className={s.recorded}>Recorded examples</span></div>
    <ContentReview key={examples[index].id} example={examples[index]} index={index} examples={examples} onSelect={setIndex} />
  </>;
}

function ContentReview({ example, index, examples, onSelect }: { example: Example; index: number; examples: Example[]; onSelect: (value: number) => void }) {
  const [revealed, setRevealed] = useState(false);
  const matches = example.decisions.zils === example.decisions.production;
  const approved = example.decisions.zils === 'pass';
  const reason = postNotes[example.id]?.reason ?? example.summary;
  const excerpt = example.id === 'T0792' ? example.content.slice(example.content.indexOf('Now that wallet')) : example.content;
  const compact = excerpt.length > 500;
  return <>
    <div className={s.demoToolbar}>
      <div><h2>Does this post earn approval?</h2><p>Read the post. See where Zils puts it.</p></div>
      <label className={s.picker}>Choose a post<select value={index} onChange={event => onSelect(Number(event.target.value))}>{examples.map((row, i) => <option key={row.id} value={i}>{postNotes[row.id]?.title ?? row.title}</option>)}</select></label>
    </div>
    <div className={s.reviewLayout}>
      <div className={s.inputColumn}>
        <div className={s.brief}><span>The campaign</span><strong>{example.brand}</strong><p>{example.brief.replace(/^Brand: .*?\. Product: /, '')}</p></div>
        <article className={s.post}>
          <div className={s.postByline}><span className={s.avatar}><UserRound size={20} /></span><div><strong>Creator post</strong><span>{excerpt !== example.content || compact ? 'Excerpt from the supplied post' : 'Original post'}</span></div></div>
          <blockquote>{compact ? `${excerpt.slice(0, 480)}…` : excerpt}</blockquote>
          {(compact || excerpt !== example.content) && <details className={s.fullPost}><summary>Read the full post</summary><p>{example.content}</p></details>}
        </article>
      </div>
      <div className={s.decisionColumn}>
        <div className={`${s.decision} ${revealed ? s.decisionRevealed : ''}`} aria-live="polite" aria-atomic="true">
          <span className={s.modelMark}>Z</span>
          {revealed ? <><span className={s.decisionEyebrow}>Zils’s decision</span><h3>{approved ? 'Approve this post' : 'Don’t approve this post'}</h3><p>{reason}</p><span className={matches ? s.match : s.caution}>{matches ? <Check size={15} /> : <FlagIcon />}{matches ? 'Matches Bitcast’s label' : 'Differs from Bitcast’s label'}</span></> : <><span className={s.decisionEyebrow}>Your rules. Zils’s decision.</span><h3>More than a<br />brand mention.</h3><p>Does the creator actually discuss the campaign’s product?</p></>}
        </div>
        {revealed && <ChoiceComparison zils={verdictLabel(example.decisions.zils)} jev={verdictLabel(example.decisions.jev)} zilsMatches={matches} jevMatches={example.decisions.jev === example.decisions.production} reference="Bitcast’s label" />}
        <div className={s.demoActions}>
          {!revealed ? <button className={s.primary} type="button" onClick={() => setRevealed(true)}>See Zils’s decision <ArrowRight size={17} /></button> : <button className={s.primary} type="button" onClick={() => onSelect((index + 1) % examples.length)}>Try another post <ArrowRight size={17} /></button>}
          {revealed && <button className={s.iconButton} type="button" aria-label="Reset this post" onClick={() => setRevealed(false)}><RotateCcw size={17} /></button>}
        </div>
        <div className={s.trays} aria-label="Example review outcome">
          {[true, false].map(pass => <div key={String(pass)} className={revealed && approved === pass ? s.activeTray : s.tray}><span>{pass ? 'Approved posts' : 'Not approved'}</span>{revealed && approved === pass ? <strong><Check size={14} />{example.brand} post</strong> : <p>No post here</p>}</div>)}
        </div>
      </div>
    </div>
    <details className={s.exampleDetails}><summary>Behind this decision</summary><div><p>{example.analysis}</p><p>Before training: <strong>{verdictLabel(example.decisions.base)}</strong>. Zils: <strong>{verdictLabel(example.decisions.zils)}</strong>. Bitcast’s label: <strong>{verdictLabel(example.decisions.production)}</strong>. Supplied JEV: <strong>{verdictLabel(example.decisions.jev)}</strong>.</p><p>Our interpretation of recorded choices. The explanation above is editorial, not generated by the model. Source record: {example.id}.</p>{example.productionReasoning && <p>Bitcast’s recorded explanation: {example.productionReasoning}</p>}</div></details>
  </>;
}

function FlagIcon() { return <span aria-hidden="true">!</span>; }

function InboxDemo({ replies }: { replies: Reply[] }) {
  const [sorted, setSorted] = useState(false);
  const [selected, setSelected] = useState(replies[0].id);
  const reply = replies.find(row => row.id === selected) ?? replies[0];
  const route = routeFor(reply.intent);
  const Icon = route.icon;
  const ordered = sorted ? [...replies].sort((a, b) => routeFor(a.intent).order - routeFor(b.intent).order) : replies;
  return <>
    <div className={s.appHeader}><div><Inbox size={18} /><strong>Reply desk</strong><span>Leadpoet examples</span></div><span className={s.recorded}>Recorded examples</span></div>
    <div className={s.demoToolbar}><div><h2>Every reply has a next step.</h2><p>Five replies. Let Zils find what each person wants.</p></div><button className={sorted ? s.secondary : s.primary} type="button" onClick={() => setSorted(!sorted)}>{sorted ? <><RotateCcw size={16} />Reset inbox</> : <>Sort with Zils <ArrowRight size={17} /></>}</button></div>
    <div className={s.inboxLayout}>
      <nav className={s.replyList} aria-label="Choose a sales reply"><div className={s.listHeading}><strong>{sorted ? 'Sorted by next step' : 'New replies'}</strong><span>{replies.length}</span></div>{ordered.map((row, index) => <button type="button" key={row.id} aria-pressed={row.id === selected} onClick={() => setSelected(row.id)} className={s.replyRow}><span className={s.replyAvatar}><Mail size={16} /></span><span><strong>{sorted ? routeFor(row.intent).label : `Reply ${index + 1}`}</strong><span>{row.content}</span></span><ChevronRight size={15} /></button>)}</nav>
      <div className={s.replyPreview}>
        <span className={s.messageLabel}>The reply</span><blockquote>“{reply.content}”</blockquote>{reply.previous && <p className={s.previous}>In reply to: {reply.previous}</p>}
        <div className={`${s.routeCard} ${sorted ? s.routeReady : ''}`} aria-live="polite" aria-atomic="true">{sorted ? <><span className={s.routeIcon}><Icon size={24} /></span><div><span>Zils recognized: {route.label.toLowerCase()}</span><h3>{route.action}</h3><p>{route.detail}</p><span className={s.match}><Check size={14} />Matches the expected intent</span></div></> : <><Inbox size={26} /><div><h3>Ready to sort</h3><p>Zils will identify the intent so your app can choose the next step.</p></div></>}</div>
        {sorted && <ChoiceComparison zils={route.label} jev={routeFor(reply.jev).label} zilsMatches={reply.intent === reply.expected} jevMatches={reply.jev === reply.expected} reference="expected intent" />}
        <p className={s.caption}>{sorted ? 'Suggested workflow shown for illustration. No messages are sent and no contacts are changed.' : 'Choose a reply, or sort all five at once.'}</p>
      </div>
    </div>
    <details className={s.exampleDetails}><summary>Behind these replies</summary><div><p>These are five selected synthetic examples from the 100-reply Leadpoet test. The intent labels are actual recorded Zils choices. The queues and follow-up actions illustrate how an app could use them.</p><p>The full test includes seven mistakes; all seven had high confidence. One pricing reply containing a misleading instruction was incorrectly marked as an opt-out. These selected examples do not measure production reliability.</p></div></details>
  </>;
}

const pieces: Record<string, string> = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const pieceNames: Record<string, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
function ChessDemo({ positions }: { positions: Position[] }) {
  const [index, setIndex] = useState(0);
  return <><div className={s.appHeader}><div><Trophy size={18} /><strong>One move to win</strong><span>Chess study</span></div><span className={s.recorded}>Recorded examples</span></div><ChessPosition key={positions[index].id} position={positions[index]} index={index} total={positions.length} onNext={() => setIndex((index + 1) % positions.length)} /></>;
}
function ChessPosition({ position, index, total, onNext }: { position: Position; index: number; total: number; onNext: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [playedBy, setPlayedBy] = useState<'Zils' | 'JEV' | null>(null);
  const move = position.moves.find(row => row.uci === selected);
  const zilsMove = position.moves.find(row => row.uci === position.zils)!;
  const jevMove = position.moves.find(row => row.uci === position.jev)!;
  const board = move?.board ?? position.board;
  const boardDescription = [...board].flatMap((piece, i) => piece === '.' ? [] : [`${piece === piece.toUpperCase() ? 'White' : 'Black'} ${pieceNames[piece.toLowerCase()]} on ${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}`]).join(', ');
  return <>
    <div className={s.demoToolbar}><div><h2>Zils finds the mate. JEV misses it.</h2><p>{position.side === 'white' ? 'White' : 'Black'} to move. Play each recorded choice to compare.</p></div><span className={s.puzzleCount}>Position {index + 1} of {total}</span></div>
    <div className={s.chessLayout}>
      <div className={s.boardWrap}><div className={s.board} role="img" aria-label={`Chessboard. ${boardDescription}`}>{[...board].map((piece, i) => { const square = `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}`; return <div key={square} className={`${(Math.floor(i / 8) + i % 8) % 2 ? s.darkSquare : s.lightSquare} ${move && [move.fromSquare, move.toSquare].includes(square) ? s.moveSquare : ''}`}><span className={piece === piece.toUpperCase() ? s.whitePiece : s.blackPiece} aria-hidden="true">{pieces[piece]}</span>{i % 8 === 0 && <small className={s.rank}>{8 - Math.floor(i / 8)}</small>}{i >= 56 && <small className={s.file}>{'abcdefgh'[i % 8]}</small>}</div>; })}</div><p className={s.boardCaption}>{position.title}</p></div>
      <div className={s.chessControls}><span className={s.messageLabel}>Your move</span><div className={s.moveOptions}>{position.moves.map(option => <button className={s.moveButton} type="button" key={option.uci} aria-pressed={selected === option.uci} onClick={() => { setSelected(option.uci); setPlayedBy(null); }}>{option.label}<ChevronRight size={17} /></button>)}</div>
        <div className={s.chessFeedback} aria-live="polite" aria-atomic="true">{move ? <><span className={move.mate ? s.match : s.caution}>{move.mate ? <Trophy size={18} /> : <FlagIcon />}{move.mate ? 'Checkmate.' : 'Check, but not checkmate.'}</span><p>{playedBy ? `${playedBy} chose this ${move.mate ? 'winning' : 'non-winning'} move in the recorded test.` : move.mate ? 'You found a move that leaves the king no legal escape.' : 'The king still has a legal response. Try another move.'}</p></> : <><strong>A check isn’t always a win.</strong><p>Every move here gives check. Only a checkmate ends the game.</p></>}</div>
        <div className={s.playButtons}><button className={s.primary} type="button" onClick={() => { setSelected(zilsMove.uci); setPlayedBy('Zils'); }}><Play size={16} />Play Zils’s move</button><button className={s.secondary} type="button" onClick={() => { setSelected(jevMove.uci); setPlayedBy('JEV'); }}><Play size={16} />Play JEV’s move</button></div>
        {move && <ChoiceComparison zils={`${zilsMove.fromSquare} → ${zilsMove.toSquare}`} jev={`${jevMove.fromSquare} → ${jevMove.toSquare}`} zilsMatches={zilsMove.mate} jevMatches={jevMove.mate} reference="winning move" />}
        <button className={s.nextButton} type="button" onClick={onNext}>Try another position <ArrowRight size={16} /></button>
      </div>
    </div>
    <details className={s.exampleDetails}><summary>Behind this move</summary><div><p>These are three selected examples from the 111 positions in the October 7 chess study where Zils found checkmate and JEV did not. The board replays recorded legal moves; it does not run a live chess model.</p><p>Zils was choosing among supplied checking moves, not playing a full game. A deterministic chess engine solves all positions in this test. Results below include all 512 positions, including Zils’s mistakes.</p><a href="/model/chess-study">Read the full chess study</a></div></details>
  </>;
}

export function BitcastExamples({ data }: { data: ExamplesData }) {
  const [demo, setDemo] = useState<Demo>('chess');
  const result = demo === 'content'
    ? { correct: 139, jev: 132, before: 116, total: 155, title: 'label matches', unit: 'posts', caveat: 'Agreement with Bitcast’s automated labels on reused development posts.', scores: data.scores }
    : demo === 'inbox'
      ? { correct: 93, jev: 96, before: 86, total: 100, title: 'correct replies', unit: 'replies', caveat: 'Against the supplied labels on a reused synthetic test. All 15 opt-outs recognized; one false opt-out.', scores: [{ name: 'Zils', note: 'After task training', matches: 93, total: 100 }, { name: 'TypeSafe JEV', note: 'Supplied results', matches: 96, total: 100 }, { name: 'Luna 6', note: 'Supplied results', matches: 89, total: 100 }, { name: 'Zils before training', note: 'Without task training', matches: 86, total: 100 }] }
      : { correct: data.chess.scores.trained, jev: data.chess.scores.jev, before: data.chess.scores.shared, total: data.chess.total, title: 'winning moves', unit: 'positions', caveat: 'One-move selection among legal checks. This measures a narrow puzzle task, not full-game playing strength.', scores: [{ name: 'Zils', note: 'Chess adapter from October 7', matches: data.chess.scores.trained, total: data.chess.total }, { name: 'TypeSafe JEV', note: 'Recorded study results', matches: data.chess.scores.jev, total: data.chess.total }, { name: 'Zils before training', note: 'Without chess training', matches: data.chess.scores.shared, total: data.chess.total }] };
  return <main id="main-content" tabIndex={-1} className={s.page}>
    <header className={s.intro}><div><h1>See what Zils decides.</h1><p>Find a winning move. Review a post. Sort a reply.<br className={s.desktopBreak} /> Small models, trained for the decisions your app makes.</p></div><span className={s.preview}>Recorded results</span></header>
    <nav className={s.demoTabs} aria-label="Choose a demo">{demos.map(({ key, name, description, icon: Icon }) => <button type="button" key={key} aria-pressed={demo === key} aria-controls="decision-demo" onClick={() => setDemo(key)}><Icon size={22} /><span><strong>{name}</strong><span>{description}</span></span><ChevronRight size={17} /></button>)}</nav>
    <section id="decision-demo" aria-label={`${demos.find(row => row.key === demo)!.name} example`} className={s.demo} key={demo}>
      {demo === 'content' ? <ContentDemo examples={data.examples} /> : demo === 'inbox' ? <InboxDemo replies={data.replies} /> : <ChessDemo positions={data.chess.examples} />}
    </section>
    <p className={s.replayNote}>Recorded decisions, with selected Zils wins first. The results below cover the full test, including mistakes.</p>
    <section className={s.results} aria-labelledby="results-heading">
      <div className={s.resultsHeading}><h2 id="results-heading">Zils and JEV, across the full test.</h2><p>{result.caveat}</p></div>
      <div className={s.scoreStrip}>
        <div><span className={s.scoreLabel}>Zils</span><strong>{(100 * result.correct / result.total).toFixed(1)}<span>%</span></strong><p>{result.correct}/{result.total} {result.title}</p></div>
        <div><span className={s.scoreLabel}>TypeSafe JEV</span><strong>{(100 * result.jev / result.total).toFixed(1)}<span>%</span></strong><p>{result.jev}/{result.total} {result.title}</p></div>
        <div><span className={s.scoreLabel}>The difference</span><strong>+{Math.abs(result.correct - result.jev)}</strong><p>More {result.title} for {result.correct >= result.jev ? 'Zils' : 'JEV'}</p></div>
      </div>
      <p className={s.trainingGain}>Training improved Zils from {result.before}/{result.total} to {result.correct}/{result.total} on this test.</p>
      <details className={s.studyDetails} key={demo}><summary>Compare scores and read study details</summary><div className={s.studyBody}><table className={s.scoreTable}><caption>All {result.total} {result.unit} in this test</caption><thead><tr><th scope="col">Model</th><th scope="col">Matches</th><th scope="col">{demo === 'content' ? 'Agreement' : 'Accuracy'}</th></tr></thead><tbody>{result.scores.map(row => <tr key={row.name}><th scope="row">{row.name}<span>{row.note}</span></th><td>{row.matches}/{row.total}</td><td>{(100 * row.matches / row.total).toFixed(1)}%</td></tr>)}</tbody></table>
        {demo === 'content' ? <p>486 training posts, 159 calibration posts and 155 development posts, with campaign groups kept separate. Reference labels came from Qwen3-32B and can be wrong. This pilot used an 80% campaign-relevance rule; the development set had been used before. Private holdout testing and human review remain needed. Zils minus JEV: +4.52 percentage points, descriptive 95% interval +0.72 to +8.97. JEV verdicts were supplied, with no exact model version or fresh API run.</p> : demo === 'inbox' ? <p>294 authored training examples, 60 separate calibration cases, and 100 synthetic reserve replies. This set had been evaluated before. Zils scored 93/100 on all three passes. JEV and Luna results were supplied; JEV scored three cases higher. Zils’s seven errors all had high confidence. The dataset’s labels have not been independently reviewed.</p> : <p>2,048 training positions and 512 test positions from separate source games. One chess adapter, one training seed. All legal checking moves were offered; any immediate mate received credit. Full-game strength was not tested. An exact chess-rules engine solves 100% of these positions.</p>}
        <p>Each example uses its task-specific Zils adapter. These studies do not establish production reliability. The research adapters shown here have not been deployed.</p></div></details>
    </section>
    <a className={s.researchLink} href="/model">Explore the research <ArrowRight size={16} /></a>
  </main>;
}
