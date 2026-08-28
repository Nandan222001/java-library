import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Signup() {
  const { signUp } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  function validate() {
    if (name.trim().length < 2) return 'Display name must be at least 2 characters';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Enter a valid email address';
    if (p1.length < 8) return 'Password must be at least 8 characters';
    if (p1 !== p2) return 'Passwords do not match';
    return '';
  }

  async function submit(e) {
    e.preventDefault();
    const v = validate();
    if (v) { setErr(v); return; }
    setErr(''); setBusy(true);
    try {
      const { data, error } = await signUp(email.trim(), p1, name.trim());
      if (error) throw error;
      if (data.session) nav('/dashboard', { replace: true });   // confirm-off projects
      else setInfo('✅ Account created! Check your inbox for a confirmation link, then sign in.');
    } catch (ex) {
      setErr(ex.message || 'Signup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <form className="card" style={{ maxWidth: 440, margin: '60px auto' }} onSubmit={submit}>
        <h2>Create your account 📚</h2>
        <p className="muted">Free forever plan · upgrade anytime.</p>
        {err && <div className="errbox">{err}</div>}
        {info && <div className="infobox">{info}</div>}
        {!info && <>
          <label className="field"><span>Display name</span>
            <input value={name} maxLength={60} onChange={e => setName(e.target.value)} autoFocus/>
          </label>
          <label className="field"><span>Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}/>
          </label>
          <label className="field"><span>Password (min 8 chars)</span>
            <input type="password" minLength={8} value={p1} onChange={e => setP1(e.target.value)}/>
          </label>
          <label className="field"><span>Confirm password</span>
            <input type="password" value={p2} onChange={e => setP2(e.target.value)}/>
          </label>
          <button className="btn primary" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </>}
        <p className="muted" style={{ marginTop: 16 }}>
          Already registered? <Link to="/login" style={{ color: 'var(--accent)' }}>Sign in →</Link>
        </p>
      </form>
    </div>
  );
}