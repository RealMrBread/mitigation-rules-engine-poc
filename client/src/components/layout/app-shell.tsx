import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';

export function AppShell() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center border-b border-gray-200 bg-white px-8">
          <h1 className="text-lg font-semibold text-gray-900">
            Mitigation Rules Engine
          </h1>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
