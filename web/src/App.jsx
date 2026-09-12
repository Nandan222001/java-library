import { Link, Routes, Route } from 'react-router-dom';
import TopNav from './components/TopNav.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import RequireAdmin from './components/RequireAdmin.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Library from './pages/Library.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Reader from './pages/Reader.jsx';
import Pricing from './pages/Pricing.jsx';
import Account from './pages/Account.jsx';
import Admin from './pages/Admin.jsx';
import Practice from './pages/Practice.jsx';
import Leaderboard from './pages/Leaderboard.jsx';

export default function App() {
  return (
    <>
      {/* Reader hides global nav — its own toolbar takes over */}
      <Routes>
        <Route path="/read/:slug" element={<RequireAuth><Reader/></RequireAuth>} />
        <Route path="*" element={<>
          <TopNav/>
          <Routes>
            {/* Public marketing page — signed-in visitors get app CTAs, not a
                dead end (see Landing.jsx → useAuth). */}
            <Route path="/" element={<Landing/>} />
            <Route path="/login" element={<Login/>} />
            <Route path="/signup" element={<Signup/>} />
            <Route path="/pricing" element={<Pricing/>} />
            <Route path="/library" element={
              <RequireAuth><Library/></RequireAuth>} />
            <Route path="/account" element={
              <RequireAuth><Account/></RequireAuth>} />
            <Route path="/dashboard" element={
              <RequireAuth><Dashboard/></RequireAuth>} />
            <Route path="/leaderboard" element={
              <RequireAuth><Leaderboard/></RequireAuth>} />
            <Route path="/books/:slug/practice" element={
              <RequireAuth><Practice/></RequireAuth>} />
            <Route path="/admin" element={
              <RequireAuth><RequireAdmin><Admin/></RequireAdmin></RequireAuth>} />
            <Route path="*" element={
              <div className="container center-x">
                <h1>404</h1><p className="muted">That page drifted away…</p>
                <Link to="/" className="btn ghost" style={{ marginTop: 'var(--space-md)' }}>
                  Back to the library
                </Link>
              </div>} />
          </Routes>
        </>} />
      </Routes>
    </>
  );
}
