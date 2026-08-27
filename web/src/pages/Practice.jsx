import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/supabase.js';

export default function Practice() {
  const { slug } = useParams();
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/api/books/${slug}/practice?count=10`).then(setQuestions).catch(e => setErr(e.message));
  }, [slug]);

  function choose(qid, idx) {
    if (result) return;
    setAnswers(a => ({ ...a, [qid]: idx }));
  }

  async function submit() {
    setBusy(true); setErr('');
    try {
      const payload = {
        answers: questions.map(q => ({ question_id: q.id, selected_index: answers[q.id] ?? -1 }))
      };
      const res = await api(`/api/books/${slug}/practice/submit`,
        { method: 'POST', body: JSON.stringify(payload) });
      setResult(res);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  if (err) return <div className="container"><div className="errbox">{err}</div></div>;
  if (!questions) return <div className="container loading-block"><div className="spin"/><span>Loading practice questions…</span></div>;

  if (questions.length === 0) return (
    <div className="container">
      <h1>Practice 🎯</h1>
      <div className="infobox">No practice questions for this book yet.</div>
      <Link to={`/read/${slug}`} className="btn ghost">← Back to book</Link>
    </div>
  );

  const resultMap = result ? new Map(result.results.map(r => [r.question_id, r])) : null;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="container" style={{ maxWidth: 780 }}>
      <h1>Practice 🎯</h1>

      {result && (
        <div className={result.perfect ? 'infobox' : 'card'} style={{ marginBottom: 20, textAlign: 'center' }}>
          <h2 style={{ margin: 0 }}>{result.score} / {result.total} correct</h2>
          <p className="muted">
            +{result.points_awarded} points{result.perfect ? ' · perfect round! 🏆' : ''}
          </p>
          {result.badges_awarded.length > 0 &&
            <p>New badge{result.badges_awarded.length > 1 ? 's' : ''}: {result.badges_awarded.join(', ')}</p>}
        </div>
      )}

      {questions.map((q, i) => {
        const r = resultMap?.get(q.id);
        return (
          <div key={q.id} className="card practice-q">
            <div className="practice-q-head">
              <span className="chip">{q.difficulty}</span>
              <span className="muted fs13">Q{i + 1} of {questions.length}</span>
            </div>
            <p><b>{q.question}</b></p>
            <div className="practice-options">
              {q.options.map((opt, idx) => {
                let cls = 'practice-opt';
                if (r) {
                  if (idx === r.correct_index) cls += ' correct';
                  else if (idx === answers[q.id]) cls += ' wrong';
                } else if (answers[q.id] === idx) cls += ' selected';
                return (
                  <button key={idx} className={cls} disabled={!!result}
                          onClick={() => choose(q.id, idx)}>
                    {opt}
                  </button>
                );
              })}
            </div>
            {r && !r.correct && r.explanation && <p className="muted fs13">{r.explanation}</p>}
          </div>
        );
      })}

      {!result
        ? <button className="btn primary" disabled={busy || answeredCount === 0} onClick={submit}>
            {busy ? 'Grading…' : `Submit (${answeredCount}/${questions.length} answered)`}
          </button>
        : <Link to={`/read/${slug}`} className="btn ghost">← Back to book</Link>}
    </div>
  );
}
