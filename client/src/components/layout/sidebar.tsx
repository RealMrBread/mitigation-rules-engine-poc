import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/auth.context';
import type { Role } from '@shared/types/user.js';

interface NavItem {
  label: string;
  path: string;
  roles: Role[];
}

const navItems: NavItem[] = [
  {
    label: 'New Evaluation',
    path: '/evaluation/new',
    roles: ['underwriter', 'admin'],
  },
  {
    label: 'Evaluation History',
    path: '/evaluations',
    roles: ['underwriter', 'admin'],
  },
  {
    label: 'Rules',
    path: '/rules',
    roles: ['applied_science', 'admin'],
  },
  {
    label: 'Releases',
    path: '/releases',
    roles: ['applied_science', 'admin'],
  },
  {
    label: 'Settings',
    path: '/settings',
    roles: ['admin'],
  },
  {
    label: 'Users',
    path: '/users',
    roles: ['admin'],
  },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(user.role),
  );

  const initials = user.email
    .split('@')[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center border-b border-gray-200 px-6">
        <span className="text-lg font-semibold text-gray-900">MRE</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Info + Logout */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-700">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">
              {user.email}
            </p>
            <p className="text-xs text-gray-500 capitalize">
              {user.role.replace('_', ' ')}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-3 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
