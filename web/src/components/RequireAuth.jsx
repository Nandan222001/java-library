import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RequireAuth({ children }) {
  const { session, loading } = useAuth();
  const loc = useLocation();
  if (loading)
    return <div className="loading-block"><div className="spin"/><span>Checking your session…</span></div>;
  if (!session)
    return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return children;
}