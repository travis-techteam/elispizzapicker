import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Users,
  Pizza,
  TrendingUp,
  ChevronRight,
  Trophy,
} from 'lucide-react';
import { api } from '../../services/api';
import Card, { CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { cn } from '../../utils/cn';

export default function AdminHistory() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'history' | 'trends' | 'participation'>('history');

  const { data: historyResponse, isLoading: historyLoading } = useQuery({
    queryKey: ['analytics', 'history'],
    queryFn: () => api.getEventHistory(20, 0),
  });

  const { data: trendsResponse, isLoading: trendsLoading } = useQuery({
    queryKey: ['analytics', 'trends'],
    queryFn: () => api.getPizzaTrends(10),
  });

  const { data: participationResponse, isLoading: participationLoading } = useQuery({
    queryKey: ['analytics', 'participation'],
    queryFn: () => api.getParticipationStats(10),
  });

  const isLoading = historyLoading || trendsLoading || participationLoading;

  if (isLoading) {
    return <LoadingScreen />;
  }

  const history = historyResponse?.data || [];
  const trends = trendsResponse?.data || [];
  const participation = participationResponse?.data || [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const tabs = [
    { id: 'history' as const, label: 'Events', icon: Calendar },
    { id: 'trends' as const, label: 'Trends', icon: TrendingUp },
    { id: 'participation' as const, label: 'Stats', icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text">Event History</h1>
          <p className="text-text-muted">Analytics and past events</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-700 text-text shadow-sm'
                : 'text-text-muted hover:text-text'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-text-muted">No events yet</p>
            </Card>
          ) : (
            history.map((event) => (
              <Card
                key={event.id}
                onClick={() => navigate(`/results/${event.id}`)}
                className="cursor-pointer hover:shadow-md transition-shadow"
              >
                <CardContent className="flex items-center gap-4">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      event.isActive
                        ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    )}
                  >
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-text truncate">{event.name}</h3>
                      {event.isActive && (
                        <span className="badge-success text-xs">Active</span>
                      )}
                    </div>
                    <p className="text-sm text-text-muted">{formatDate(event.deadline)}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {event.participantCount} voters
                      </span>
                      <span className="flex items-center gap-1">
                        <Pizza className="w-3 h-3" />
                        {event.pizzaCount} pizzas
                      </span>
                    </div>
                  </div>
                  {event.topPizza && (
                    <div className="hidden sm:block text-right">
                      <div className="text-xs text-text-muted">Top Pick</div>
                      <div className="text-sm font-medium text-primary truncate max-w-[100px]">
                        {event.topPizza}
                      </div>
                    </div>
                  )}
                  <ChevronRight className="w-5 h-5 text-text-muted flex-shrink-0" />
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-accent" />
                Most Popular Pizzas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trends.length === 0 ? (
                <p className="text-text-muted text-center py-4">No vote data yet</p>
              ) : (
                <div className="space-y-3">
                  {trends.map((pizza, index) => (
                    <div key={pizza.name} className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                          index === 0
                            ? 'bg-accent-100 dark:bg-accent-900/50 text-accent-700 dark:text-accent-300'
                            : index === 1
                              ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                              : index === 2
                                ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        )}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-text truncate">{pizza.name}</div>
                        <div className="text-xs text-text-muted">
                          {pizza.firstChoiceVotes} first choice votes across {pizza.eventCount}{' '}
                          {pizza.eventCount === 1 ? 'event' : 'events'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">{pizza.totalVotes}</div>
                        <div className="text-xs text-text-muted">points</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gray-50 dark:bg-gray-800/50">
            <CardContent className="text-sm text-text-muted">
              <strong>How points work:</strong> 1st choice = 3 points, 2nd choice = 2 points, 3rd
              choice = 1 point
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'participation' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-secondary" />
                Participation Rates
              </CardTitle>
            </CardHeader>
            <CardContent>
              {participation.length === 0 ? (
                <p className="text-text-muted text-center py-4">No events yet</p>
              ) : (
                <div className="space-y-4">
                  {participation.map((stat) => (
                    <div key={stat.eventId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-medium text-text truncate">{stat.eventName}</div>
                          <div className="text-xs text-text-muted">
                            {formatDate(stat.eventDate)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-secondary">{stat.participationRate}%</div>
                          <div className="text-xs text-text-muted">
                            {stat.participantCount}/{stat.totalUsers} users
                          </div>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-secondary rounded-full transition-all"
                          style={{ width: `${Math.min(stat.participationRate, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary stats */}
          {participation.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <Card className="text-center py-4">
                <div className="text-3xl font-bold text-primary">
                  {Math.round(
                    participation.reduce((sum, p) => sum + p.participationRate, 0) /
                      participation.length
                  )}
                  %
                </div>
                <div className="text-sm text-text-muted">Avg Participation</div>
              </Card>
              <Card className="text-center py-4">
                <div className="text-3xl font-bold text-secondary">
                  {participation.reduce((sum, p) => sum + p.participantCount, 0)}
                </div>
                <div className="text-sm text-text-muted">Total Votes Cast</div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
