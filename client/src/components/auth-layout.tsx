import { Outlet } from 'react-router-dom';
import { AuthProvider } from '@/contexts/auth.context';

export function AuthLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
