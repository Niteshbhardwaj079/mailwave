import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../store/AuthProvider';

/**
 * Everything inside the app shell needs a signed-in user. Without this the
 * /login screen is decoration — you could type any URL and walk straight in.
 * The page the visitor wanted is remembered so sign-in can send them there.
 */
export default function RequireAuth() {
  const { isSignedIn } = useAuth();
  const location = useLocation();

  if (!isSignedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
