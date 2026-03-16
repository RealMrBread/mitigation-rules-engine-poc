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
import { EvaluationFormPage } from '@/pages/evaluation/form';
import { EvaluationResultsPage } from '@/pages/evaluation/results';
import { EvaluationHistoryPage } from '@/pages/evaluation/history';
import { EvaluationDetailPage } from '@/pages/evaluation/detail';
import { RuleListPage } from '@/pages/rules/list';
import { RuleEditorPage } from '@/pages/rules/editor';

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
            element: <EvaluationFormPage />,
          },
          {
            path: 'evaluation/:id/results',
            element: <EvaluationResultsPage />,
          },
          {
            path: 'evaluations',
            element: <EvaluationHistoryPage />,
          },
          {
            path: 'evaluations/:id',
            element: <EvaluationDetailPage />,
          },
          {
            path: 'rules',
            element: <RuleListPage />,
          },
          {
            path: 'rules/new',
            element: <RuleEditorPage />,
          },
          {
            path: 'rules/:id',
            element: <RuleEditorPage />,
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
