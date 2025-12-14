import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Vote, BarChart3, Settings, LogOut, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../utils/cn';
import OfflineIndicator from '../ui/OfflineIndicator';
import NotificationBell from '../ui/NotificationBell';

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Offline indicator */}
      <OfflineIndicator />

      {/* Header */}
      <header className="bg-primary text-white safe-area-inset-top">
        <div className="max-w-lg mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Eli's Pizza Picker" className="h-10 w-auto" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm opacity-90 hidden sm:inline">{user?.name}</span>
            <NotificationBell />
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-white/20 transition-colors"
              title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-full hover:bg-white/20 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 pb-24">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-200 safe-area-inset-bottom">
        <div className="max-w-lg mx-auto flex justify-around">
          <NavItem to="/" icon={Home} label="Home" />
          <NavItem to="/vote" icon={Vote} label="Vote" />
          <NavItem to="/results" icon={BarChart3} label="Results" />
          {isAdmin && <NavItem to="/admin" icon={Settings} label="Admin" />}
        </div>
      </nav>
    </div>
  );
}

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
}

function NavItem({ to, icon: Icon, label }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center py-2 px-4 text-xs transition-colors',
          isActive ? 'text-primary' : 'text-text-muted hover:text-text'
        )
      }
    >
      <Icon className="w-6 h-6 mb-1" />
      <span>{label}</span>
    </NavLink>
  );
}
