import { Navigate, Outlet, useLocation } from 'react-router-dom';

import PageLoader from '../ui/PageLoader';
import { useAuth } from '../../store/AuthProvider';

/**
 * App ke andar ki har cheez ke liye sign in zaroori hai. Bina iske /login sirf
 * dikhawa hota — koi bhi URL type karke andar aa jata.
 *
 * `checking` ka intezaar karna zaroori hai: app khulte hi server se poocha
 * jata hai ki session hai ya nahi. Us ek pal me `isSignedIn` false hota hai —
 * agar hum turant login par bhej dein, to har refresh par login ki ek jhalak
 * dikhegi aur phir wapas aana padega. Isliye tab tak loader dikhate hain.
 */
export default function RequireAuth() {
  const { isSignedIn, checking } = useAuth();
  const location = useLocation();

  if (checking) return <PageLoader />;

  if (!isSignedIn) {
    // Jo page kholna chahte the wo yaad rakhte hain, taki sign in ke baad
    // wahin wapas bhej sakein.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
