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
import { TestSandboxPage } from '@/pages/rules/test-sandbox';
import { ReleaseManagerPage } from '@/pages/releases/manager';
import { RuleReferencePage } from '@/pages/rule-reference';
import { AdminSettingsPage } from '@/pages/admin/settings';
import { AdminUsersPage } from '@/pages/admin/users';
import { AuditLogPage } from '@/pages/admin/audit-log';

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
            path: 'rule-reference',
            element: <RuleReferencePage />,
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
          {
            path: 'rules/test',
            element: <TestSandboxPage />,
          },
          {
            path: 'releases',
            element: <ReleaseManagerPage />,
          },
          {
            path: 'settings',
            element: <AdminSettingsPage />,
          },
          {
            path: 'users',
            element: <AdminUsersPage />,
          },
          {
            path: 'audit-log',
            element: <AuditLogPage />,
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
