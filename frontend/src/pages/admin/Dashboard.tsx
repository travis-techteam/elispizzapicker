import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, Calendar, Pizza, FileText, ChevronRight, History } from 'lucide-react';
import { api } from '../../services/api';
import Card, { CardContent } from '../../components/ui/Card';
import LoadingScreen from '../../components/ui/LoadingScreen';

export default function AdminDashboard() {
  const navigate = useNavigate();

  const { data: usersResponse, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
  });

  const { data: eventsResponse, isLoading: eventsLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.getEvents(),
  });

  if (usersLoading || eventsLoading) {
    return <LoadingScreen />;
  }

  const users = usersResponse?.data || [];
  const events = eventsResponse?.data || [];
  const activeEvent = events.find((e) => e.isActive);

  const menuItems = [
    {
      icon: Users,
      label: 'Manage Users',
      description: `${users.length} users`,
      onClick: () => navigate('/admin/users'),
      color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30',
    },
    {
      icon: Calendar,
      label: 'Manage Events',
      description: `${events.length} events`,
      onClick: () => navigate('/admin/events'),
      color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30',
    },
    {
      icon: History,
      label: 'Event History',
      description: 'Analytics & trends',
      onClick: () => navigate('/admin/history'),
      color: 'text-green-500 bg-green-50 dark:bg-green-900/30',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Admin Dashboard</h1>
        <p className="text-text-muted">Manage your pizza events</p>
      </div>

      {/* Active Event Summary */}
      {activeEvent && (
        <Card className="bg-gradient-to-br from-primary-50 to-accent-50 border-primary-200">
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <span className="badge-primary">Active Event</span>
            </div>
            <h3 className="text-lg font-semibold text-text mb-2">{activeEvent.name}</h3>
            <div className="flex items-center gap-4 text-sm text-text-muted mb-4">
              <span>{activeEvent._count?.votes || 0} votes</span>
              <span>{activeEvent._count?.pizzaOptions || 0} pizzas</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/admin/events/${activeEvent.id}/pizzas`)}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-gray-800 rounded-lg text-sm font-medium text-text hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Pizza className="w-4 h-4" />
                Manage Pizzas
              </button>
              <button
                onClick={() => navigate(`/admin/events/${activeEvent.id}/report`)}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-gray-800 rounded-lg text-sm font-medium text-text hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <FileText className="w-4 h-4" />
                View Report
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Menu Items */}
      <div className="space-y-3">
        {menuItems.map((item) => (
          <Card
            key={item.label}
            onClick={item.onClick}
            className="flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.color}`}>
              <item.icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-text">{item.label}</h3>
              <p className="text-sm text-text-muted">{item.description}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-text-muted" />
          </Card>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="text-center py-4">
          <div className="text-3xl font-bold text-primary">{users.length}</div>
          <div className="text-sm text-text-muted">Total Users</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-3xl font-bold text-secondary">{events.length}</div>
          <div className="text-sm text-text-muted">Total Events</div>
        </Card>
      </div>
    </div>
  );
}
