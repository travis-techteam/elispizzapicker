import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, Pizza, Vote, ChevronRight, Clock } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Card, { CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingScreen from '../components/ui/LoadingScreen';

export default function Home() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const { data: activeEventResponse, isLoading } = useQuery({
    queryKey: ['activeEvent'],
    queryFn: () => api.getActiveEvent(),
  });

  const { data: myVoteResponse } = useQuery({
    queryKey: ['myVote', activeEventResponse?.data?.id],
    queryFn: () => api.getMyVote(activeEventResponse?.data?.id || ''),
    enabled: !!activeEventResponse?.data?.id,
  });

  if (isLoading) {
    return <LoadingScreen />;
  }

  const event = activeEventResponse?.data;
  const myVote = myVoteResponse?.data;
  const hasVoted = !!myVote;
  const deadline = event ? new Date(event.deadline) : null;
  const isDeadlinePassed = deadline ? deadline < new Date() : false;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-text">Hey, {user?.name?.split(' ')[0]}!</h1>
        <p className="text-text-muted">Ready to pick some pizza?</p>
      </div>

      {/* Active Event Card */}
      {event ? (
        <Card className="bg-gradient-to-br from-primary-50 to-accent-50 border-primary-200">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-primary">{event.name}</CardTitle>
                {event.description && (
                  <p className="text-sm text-text-muted mt-1">{event.description}</p>
                )}
              </div>
              {hasVoted && (
                <span className="badge-success flex items-center gap-1">
                  <Vote className="w-3 h-3" />
                  Voted
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-text-muted mb-4">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>
                  {isDeadlinePassed ? 'Ended ' : 'Ends '}
                  {formatDeadline(deadline!)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{event._count?.votes || 0} votes</span>
              </div>
              <div className="flex items-center gap-1">
                <Pizza className="w-4 h-4" />
                <span>{event._count?.pizzaOptions || 0} options</span>
              </div>
            </div>

            {!isDeadlinePassed ? (
              <Button
                onClick={() => navigate(`/vote/${event.id}`)}
                className="w-full"
                size="lg"
              >
                {hasVoted ? 'Update Your Vote' : 'Cast Your Vote'}
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={() => navigate(`/results/${event.id}`)}
                className="w-full"
                variant="secondary"
                size="lg"
              >
                View Results
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <Calendar className="w-8 h-8 text-text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-text mb-2">No Active Event</h3>
          <p className="text-text-muted">
            {isAdmin
              ? 'Create a new event to start collecting votes.'
              : 'Check back later for the next pizza event!'}
          </p>
          {isAdmin && (
            <Button onClick={() => navigate('/admin/events')} className="mt-4">
              Create Event
            </Button>
          )}
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Card onClick={() => navigate('/vote')} className="text-center py-6">
          <Vote className="w-8 h-8 text-primary mx-auto mb-2" />
          <h3 className="font-semibold text-text">Vote</h3>
          <p className="text-xs text-text-muted">Pick your pizzas</p>
        </Card>
        <Card onClick={() => navigate('/results')} className="text-center py-6">
          <Pizza className="w-8 h-8 text-secondary mx-auto mb-2" />
          <h3 className="font-semibold text-text">Results</h3>
          <p className="text-xs text-text-muted">See what others chose</p>
        </Card>
      </div>

      {/* My Vote Summary */}
      {hasVoted && myVote && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Vote</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Slices:</span>
              <span className="font-semibold">{myVote.sliceCount}</span>
            </div>
            {myVote.choices
              .sort((a, b) => a.priority - b.priority)
              .map((choice) => (
                <div key={choice.id} className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      choice.priority === 1
                        ? 'bg-accent-500'
                        : choice.priority === 2
                        ? 'bg-secondary-500'
                        : 'bg-primary-500'
                    }`}
                  >
                    {choice.priority}
                  </span>
                  <span className="text-text">{choice.pizzaOption?.name}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatDeadline(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const absDiff = Math.abs(diff);

  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 1) {
    return `${days} days ${diff > 0 ? 'left' : 'ago'}`;
  } else if (hours > 1) {
    return `${hours} hours ${diff > 0 ? 'left' : 'ago'}`;
  } else {
    const minutes = Math.floor(absDiff / (1000 * 60));
    return `${minutes} minutes ${diff > 0 ? 'left' : 'ago'}`;
  }
}
