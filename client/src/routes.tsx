import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
} from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { AuthLayout } from '@/components/auth-layout';
import { LoginPage } from '@/pages/login';
import { NotFoundPage } from '@/pages/not-found';
import { ProtectedRoute } from '@/components/protected-route';

function EvaluationNewPlaceholder() {
  return (
    <div className="flex items-center justify-center py-24">
      <p className="text-lg text-gray-500">Evaluation Form coming soon</p>
    </div>
  );
}

function EvaluationResultsPlaceholder() {
  return (
    <div className="flex items-center justify-center py-24">
      <p className="text-lg text-gray-500">Results coming soon</p>
    </div>
  );
}

const routes: RouteObject[] = [
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        element: (
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <Navigate to="/evaluation/new" replace />,
          },
          {
            path: 'evaluation/new',
            element: <EvaluationNewPlaceholder />,
          },
          {
            path: 'evaluation/:id/results',
            element: <EvaluationResultsPlaceholder />,
          },
        ],
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
