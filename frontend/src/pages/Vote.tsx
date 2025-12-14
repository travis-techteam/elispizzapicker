import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pizza, Minus, Plus, Clock, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import type { PizzaOption, VoteInput } from '../types';
import Card, { CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingScreen from '../components/ui/LoadingScreen';
import CountdownTimer from '../components/ui/CountdownTimer';
import { cn } from '../utils/cn';

interface SelectedPizza {
  pizzaOptionId: string;
  name: string;
  priority: 1 | 2 | 3;
}

export default function Vote() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedPizzas, setSelectedPizzas] = useState<SelectedPizza[]>([]);
  const [sliceCount, setSliceCount] = useState(3);
  const [error, setError] = useState('');

  // Fetch active event or specific event
  const { data: eventResponse, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => (eventId ? api.getEvent(eventId) : api.getActiveEvent()),
  });

  const event = eventResponse?.data;

  // Fetch my existing vote
  const { data: myVoteResponse } = useQuery({
    queryKey: ['myVote', event?.id],
    queryFn: () => api.getMyVote(event?.id || ''),
    enabled: !!event?.id,
  });

  // Initialize from existing vote
  useEffect(() => {
    if (myVoteResponse?.data) {
      const vote = myVoteResponse.data;
      setSliceCount(vote.sliceCount);
      setSelectedPizzas(
        vote.choices.map((c) => ({
          pizzaOptionId: c.pizzaOptionId,
          name: c.pizzaOption?.name || '',
          priority: c.priority,
        }))
      );
    }
  }, [myVoteResponse]);

  // Submit vote mutation
  const submitMutation = useMutation({
    mutationFn: (data: VoteInput) => api.submitVote(event!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myVote', event?.id] });
      queryClient.invalidateQueries({ queryKey: ['votes', event?.id] });
      queryClient.invalidateQueries({ queryKey: ['report', event?.id] });
      queryClient.invalidateQueries({ queryKey: ['event', event?.id] });
      queryClient.invalidateQueries({ queryKey: ['activeEvent'] });
      navigate('/');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to submit vote');
    },
  });

  // useCallback must be called before any conditional returns (Rules of Hooks)
  const handleDeadlineExpired = useCallback(() => {
    if (event?.id) {
      navigate(`/results/${event.id}`);
    }
  }, [navigate, event?.id]);

  if (eventLoading) {
    return <LoadingScreen />;
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <Pizza className="w-16 h-16 text-text-muted mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-text mb-2">No Active Event</h2>
        <p className="text-text-muted">There's no event to vote on right now.</p>
        <Button onClick={() => navigate('/')} className="mt-4">
          Go Home
        </Button>
      </div>
    );
  }

  const deadline = new Date(event.deadline);
  const isDeadlinePassed = deadline < new Date();

  if (isDeadlinePassed) {
    return (
      <div className="text-center py-12">
        <Clock className="w-16 h-16 text-text-muted mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-text mb-2">Voting Closed</h2>
        <p className="text-text-muted">The deadline for this event has passed.</p>
        <Button onClick={() => navigate(`/results/${event.id}`)} className="mt-4">
          View Results
        </Button>
      </div>
    );
  }

  const pizzaOptions = event.pizzaOptions || [];
  const availablePizzas = pizzaOptions.filter(
    (p) => !selectedPizzas.some((s) => s.pizzaOptionId === p.id)
  );

  const handleSelectPizza = (pizza: PizzaOption) => {
    if (selectedPizzas.length >= 3) return;

    const nextPriority = (selectedPizzas.length + 1) as 1 | 2 | 3;
    setSelectedPizzas([
      ...selectedPizzas,
      {
        pizzaOptionId: pizza.id,
        name: pizza.name,
        priority: nextPriority,
      },
    ]);
  };

  const handleRemovePizza = (pizzaOptionId: string) => {
    const filtered = selectedPizzas.filter((p) => p.pizzaOptionId !== pizzaOptionId);
    // Re-assign priorities
    const updated = filtered.map((p, index) => ({
      ...p,
      priority: (index + 1) as 1 | 2 | 3,
    }));
    setSelectedPizzas(updated);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = selectedPizzas.findIndex((p) => p.pizzaOptionId === active.id);
    const newIndex = selectedPizzas.findIndex((p) => p.pizzaOptionId === over.id);

    const newArray = [...selectedPizzas];
    const [moved] = newArray.splice(oldIndex, 1);
    newArray.splice(newIndex, 0, moved);

    // Re-assign priorities based on new order
    const updated = newArray.map((p, index) => ({
      ...p,
      priority: (index + 1) as 1 | 2 | 3,
    }));
    setSelectedPizzas(updated);
  };

  const handleSubmit = () => {
    setError('');

    if (selectedPizzas.length !== 3) {
      setError('Please select exactly 3 pizza choices');
      return;
    }

    if (sliceCount < 1 || sliceCount > 4) {
      setError('Slice count must be between 1 and 4');
      return;
    }

    submitMutation.mutate({
      sliceCount,
      choices: selectedPizzas.map((p) => ({
        pizzaOptionId: p.pizzaOptionId,
        priority: p.priority,
      })),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">{event.name}</h1>
        <CountdownTimer
          deadline={event.deadline}
          onExpire={handleDeadlineExpired}
          className="mt-1"
        />
      </div>

      {/* Slice Count */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How many slices will you eat?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setSliceCount(Math.max(1, sliceCount - 1))}
              className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              disabled={sliceCount <= 1}
            >
              <Minus className="w-5 h-5" />
            </button>
            <span className="text-4xl font-bold text-primary w-16 text-center">{sliceCount}</span>
            <button
              onClick={() => setSliceCount(Math.min(4, sliceCount + 1))}
              className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              disabled={sliceCount >= 4}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Selected Pizzas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Top 3 Choices</CardTitle>
          <p className="text-sm text-text-muted">Drag to reorder priority (1st = highest)</p>
        </CardHeader>
        <CardContent>
          {selectedPizzas.length === 0 ? (
            <p className="text-center text-text-muted py-4">
              Select 3 pizzas from the options below
            </p>
          ) : (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={selectedPizzas.map((p) => p.pizzaOptionId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {selectedPizzas.map((pizza) => (
                    <SortablePizzaItem
                      key={pizza.pizzaOptionId}
                      pizza={pizza}
                      onRemove={() => handleRemovePizza(pizza.pizzaOptionId)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Available Pizzas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Pizzas</CardTitle>
        </CardHeader>
        <CardContent>
          {availablePizzas.length === 0 ? (
            <p className="text-center text-text-muted py-4">
              All pizzas have been selected
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {availablePizzas.map((pizza) => (
                <button
                  key={pizza.id}
                  onClick={() => handleSelectPizza(pizza)}
                  disabled={selectedPizzas.length >= 3}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-colors',
                    selectedPizzas.length >= 3
                      ? 'border-gray-200 bg-gray-50 text-text-muted cursor-not-allowed'
                      : 'border-gray-200 hover:border-primary hover:bg-primary-50'
                  )}
                >
                  <div className="font-medium text-sm">{pizza.name}</div>
                  <div className="text-xs text-text-muted mt-1">
                    {pizza.toppings.join(', ')}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        className="w-full"
        size="lg"
        disabled={selectedPizzas.length !== 3}
        isLoading={submitMutation.isPending}
      >
        {myVoteResponse?.data ? 'Update Vote' : 'Submit Vote'}
      </Button>
    </div>
  );
}

interface SortablePizzaItemProps {
  pizza: SelectedPizza;
  onRemove: () => void;
}

function SortablePizzaItem({ pizza, onRemove }: SortablePizzaItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pizza.pizzaOptionId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityColors = {
    1: 'bg-accent-500',
    2: 'bg-secondary-500',
    3: 'bg-primary-500',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 bg-gray-50 rounded-lg',
        isDragging && 'opacity-50'
      )}
    >
      <button {...attributes} {...listeners} className="touch-none cursor-grab active:cursor-grabbing">
        <GripVertical className="w-5 h-5 text-text-muted" />
      </button>
      <span
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white',
          priorityColors[pizza.priority]
        )}
      >
        {pizza.priority}
      </span>
      <span className="flex-1 font-medium">{pizza.name}</span>
      <button
        onClick={onRemove}
        className="p-1 rounded hover:bg-gray-200 transition-colors"
      >
        <Minus className="w-4 h-4 text-text-muted" />
      </button>
    </div>
  );
}
