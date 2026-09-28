'use client';
import { useState } from 'react';
import { LETTERS, type ReviewQ } from '@/lib/types';

export default function ReviewList({ items }: { items: ReviewQ[] }) {
  const [onlyWrong, setOnlyWrong] = useState(true);
  const shown = onlyWrong ? items.filter((q) => !q.is_correct) : items;
  return (
    <>
      <div className="row" style={{ margin: '8px 0 12px' }}>
        <div className="seg">
          <button className={onlyWrong ? 'on' : ''} onClick={() => setOnlyWrong(true)}>Incorrect only ({items.filter((q) => !q.is_correct).length})</button>
          <button className={!onlyWrong ? 'on' : ''} onClick={() => setOnlyWrong(false)}>All questions ({items.length})</button>
        </div>
      </div>
      {shown.length === 0 && <div className="card">No incorrect answers. Excellent!</div>}
      {shown.map((q) => (
        <div key={q.pos} className="card" style={{ marginBottom: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="pill">Q{q.pos}{q.domain ? ` · Domain ${q.domain}` : ''}</span>
            <span className={`pill ${q.is_correct ? 'ok' : 'bad'}`}>{q.is_correct ? 'Correct' : q.chosen ? 'Incorrect' : 'Not answered'}</span>
          </div>
          <div className="stem">{q.stem}</div>
          {LETTERS.map((L) => (
            <div key={L} className={`opt ${L === q.answer ? 'correct' : L === q.chosen ? 'wrong' : ''}`} style={{ cursor: 'default' }}>
              <span className="L">{L}.</span><span>{q.options[L]}</span>
            </div>
          ))}
          <div className="expl">
            {q.explanation && <div><b>Explanation:</b> {q.explanation}</div>}
            <div style={{ marginTop: 6 }}><b>FPH reference:</b> page {q.fph_page}</div>
          </div>
        </div>
      ))}
    </>
  );
}
