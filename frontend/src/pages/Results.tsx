import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Pizza, Users, Clock, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Card, { CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingScreen from '../components/ui/LoadingScreen';

export default function Results() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // Fetch active event or specific event
  const { data: eventResponse, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => (eventId ? api.getEvent(eventId) : api.getActiveEvent()),
  });

  const event = eventResponse?.data;

  // Fetch votes
  const { data: votesResponse, isLoading: votesLoading } = useQuery({
    queryKey: ['votes', event?.id],
    queryFn: () => api.getVotes(event?.id || ''),
    enabled: !!event?.id,
  });

  if (eventLoading || votesLoading) {
    return <LoadingScreen />;
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <Pizza className="w-16 h-16 text-text-muted mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-text mb-2">No Event</h2>
        <p className="text-text-muted">There's no event to show results for.</p>
        <Button onClick={() => navigate('/')} className="mt-4">
          Go Home
        </Button>
      </div>
    );
  }

  const votes = votesResponse?.data || [];
  const deadline = new Date(event.deadline);
  const totalVoters = votes.length;
  const totalSlices = votes.reduce((sum, v) => sum + v.sliceCount, 0);

  // Calculate vote tallies per pizza option
  const pizzaTallies = new Map<string, { name: string; points: number; voters: string[] }>();

  event.pizzaOptions?.forEach((pizza) => {
    pizzaTallies.set(pizza.id, { name: pizza.name, points: 0, voters: [] });
  });

  votes.forEach((vote) => {
    vote.choices.forEach((choice) => {
      const tally = pizzaTallies.get(choice.pizzaOptionId);
      if (tally) {
        const weight = choice.priority === 1 ? 3 : choice.priority === 2 ? 2 : 1;
        tally.points += weight;
        if (!tally.voters.includes(vote.user?.name || 'Unknown')) {
          tally.voters.push(vote.user?.name || 'Unknown');
        }
      }
    });
  });

  // Sort by points
  const sortedTallies = Array.from(pizzaTallies.values())
    .filter((t) => t.points > 0)
    .sort((a, b) => b.points - a.points);

  const maxPoints = sortedTallies[0]?.points || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">{event.name}</h1>
        <p className="text-text-muted flex items-center gap-1 mt-1">
          <Clock className="w-4 h-4" />
          {deadline < new Date() ? 'Ended' : 'Ends'}: {deadline.toLocaleDateString()}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="text-center py-4">
          <Users className="w-8 h-8 text-primary mx-auto mb-2" />
          <div className="text-2xl font-bold text-text">{totalVoters}</div>
          <div className="text-xs text-text-muted">Voters</div>
        </Card>
        <Card className="text-center py-4">
          <Pizza className="w-8 h-8 text-secondary mx-auto mb-2" />
          <div className="text-2xl font-bold text-text">{totalSlices}</div>
          <div className="text-xs text-text-muted">Total Slices</div>
        </Card>
      </div>

      {/* Vote Tallies */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pizza Rankings</CardTitle>
          <p className="text-sm text-text-muted">
            Points: 1st choice = 3pts, 2nd = 2pts, 3rd = 1pt
          </p>
        </CardHeader>
        <CardContent>
          {sortedTallies.length === 0 ? (
            <p className="text-center text-text-muted py-4">No votes yet</p>
          ) : (
            <div className="space-y-4">
              {sortedTallies.map((tally, index) => (
                <div key={tally.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0
                            ? 'bg-accent-500 text-white'
                            : index === 1
                            ? 'bg-gray-300 dark:bg-gray-600 text-text'
                            : index === 2
                            ? 'bg-secondary-300 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-text-muted'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="font-medium">{tally.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-primary">
                      {tally.points} pts
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500"
                      style={{ width: `${(tally.points / maxPoints) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Individual Votes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Who Voted for What</CardTitle>
        </CardHeader>
        <CardContent>
          {votes.length === 0 ? (
            <p className="text-center text-text-muted py-4">No votes yet</p>
          ) : (
            <div className="space-y-4">
              {votes.map((vote) => (
                <div key={vote.id} className="border-b border-gray-100 dark:border-gray-700 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{vote.user?.name}</span>
                    <span className="text-sm text-text-muted">{vote.sliceCount} slices</span>
                  </div>
                  <div className="flex gap-2">
                    {vote.choices
                      .sort((a, b) => a.priority - b.priority)
                      .map((choice) => (
                        <span
                          key={choice.id}
                          className={`text-xs px-2 py-1 rounded-full ${
                            choice.priority === 1
                              ? 'bg-accent-100 text-accent-800'
                              : choice.priority === 2
                              ? 'bg-secondary-100 text-secondary-800'
                              : 'bg-primary-100 text-primary-800'
                          }`}
                        >
                          {choice.priority}. {choice.pizzaOption?.name}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Report Link */}
      {isAdmin && (
        <Button
          onClick={() => navigate(`/admin/events/${event.id}/report`)}
          variant="outline"
          className="w-full"
        >
          View Order Report
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      )}
    </div>
  );
}
