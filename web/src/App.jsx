import { Routes, Route } from 'react-router-dom';
import TopNav from './components/TopNav.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Library from './pages/Library.jsx';
import Reader from './pages/Reader.jsx';
import Pricing from './pages/Pricing.jsx';
import Account from './pages/Account.jsx';

export default function App() {
  return (
    <>
      {/* Reader hides global nav — its own toolbar takes over */}
      <Routes>
        <Route path="/read/:slug" element={<RequireAuth><Reader/></RequireAuth>} />
        <Route path="*" element={<>
          <TopNav/>
          <Routes>
            <Route path="/" element={<Login/>} />
            <Route path="/login" element={<Login/>} />
            <Route path="/signup" element={<Signup/>} />
            <Route path="/pricing" element={<Pricing/>} />
            <Route path="/library" element={
              <RequireAuth><Library/></RequireAuth>} />
            <Route path="/account" element={
              <RequireAuth><Account/></RequireAuth>} />
            <Route path="*" element={
              <div className="container center-x">
                <h1>404</h1><p className="muted">That page drifted away…</p>
              </div>} />
          </Routes>
        </>} />
      </Routes>
    </>
  );
}