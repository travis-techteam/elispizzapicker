import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Pizza, FileText, Check, ArrowLeft, Calendar } from 'lucide-react';
import { api } from '../../services/api';
import type { Event } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import LoadingScreen from '../../components/ui/LoadingScreen';

export default function AdminEvents() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    deadline: '',
    isActive: false,
    reminderMinutesBefore: null as number | null,
  });
  const [error, setError] = useState('');

  const { data: eventsResponse, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.getEvents(),
  });

  const createMutation = useMutation({
    mutationFn: api.createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['activeEvent'] });
      closeModal();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateEvent>[1] }) =>
      api.updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['activeEvent'] });
      closeModal();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['activeEvent'] });
    },
  });

  const openCreateModal = () => {
    setEditingEvent(null);
    // Default to tomorrow at 6 PM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);
    const deadlineStr = tomorrow.toISOString().slice(0, 16);

    setFormData({ name: '', description: '', deadline: deadlineStr, isActive: false, reminderMinutesBefore: null });
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      description: event.description || '',
      deadline: new Date(event.deadline).toISOString().slice(0, 16),
      isActive: event.isActive,
      reminderMinutesBefore: event.reminderMinutesBefore ?? null,
    });
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const deadlineDate = new Date(formData.deadline);
    if (isNaN(deadlineDate.getTime())) {
      setError('Invalid deadline date');
      return;
    }

    if (editingEvent) {
      const result = await updateMutation.mutateAsync({
        id: editingEvent.id,
        data: {
          name: formData.name,
          description: formData.description || null,
          deadline: deadlineDate.toISOString(),
          isActive: formData.isActive,
          reminderMinutesBefore: formData.reminderMinutesBefore,
        },
      });
      if (!result.success) {
        setError(result.error || 'Failed to update event');
      }
    } else {
      const result = await createMutation.mutateAsync({
        name: formData.name,
        description: formData.description || undefined,
        deadline: deadlineDate.toISOString(),
        isActive: formData.isActive,
        reminderMinutesBefore: formData.reminderMinutesBefore,
      });
      if (!result.success) {
        setError(result.error || 'Failed to create event');
      }
    }
  };

  const handleDelete = (event: Event) => {
    if (confirm(`Are you sure you want to delete "${event.name}"?`)) {
      deleteMutation.mutate(event.id);
    }
  };

  const toggleActive = async (event: Event) => {
    await updateMutation.mutateAsync({
      id: event.id,
      data: { isActive: !event.isActive },
    });
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  const events = eventsResponse?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/admin')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text">Manage Events</h1>
          <p className="text-text-muted">{events.length} events</p>
        </div>
        <Button onClick={openCreateModal} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {events.length === 0 ? (
          <Card className="text-center py-8">
            <Calendar className="w-12 h-12 text-text-muted mx-auto mb-3" />
            <p className="text-text-muted">No events yet. Create one to get started!</p>
          </Card>
        ) : (
          events.map((event) => (
            <Card key={event.id}>
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-text truncate">{event.name}</h3>
                    {event.isActive && <span className="badge-success text-xs">Active</span>}
                  </div>
                  {event.description && (
                    <p className="text-sm text-text-muted line-clamp-2 mb-2">{event.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span>Deadline: {new Date(event.deadline).toLocaleDateString()}</span>
                    <span>{event._count?.votes || 0} votes</span>
                    <span>{event._count?.pizzaOptions || 0} pizzas</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/admin/events/${event.id}/pizzas`)}
                >
                  <Pizza className="w-4 h-4 mr-1" />
                  Pizzas
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/admin/events/${event.id}/report`)}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Report
                </Button>
                <div className="flex-1" />
                <button
                  onClick={() => toggleActive(event)}
                  className={`p-2 rounded-lg transition-colors ${
                    event.isActive
                      ? 'bg-green-100 text-green-600'
                      : 'hover:bg-gray-100 text-text-muted'
                  }`}
                  title={event.isActive ? 'Currently active' : 'Set as active'}
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openEditModal(event)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Pencil className="w-4 h-4 text-text-muted" />
                </button>
                <button
                  onClick={() => handleDelete(event)}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingEvent ? 'Edit Event' : 'Create Event'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Event Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Friday Pizza Night"
            required
          />
          <div>
            <label className="block text-sm font-medium text-text mb-1">Description (optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input min-h-[80px] resize-none"
              placeholder="Add any details about this event..."
            />
          </div>
          <Input
            label="Voting Deadline"
            type="datetime-local"
            value={formData.deadline}
            onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            required
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-text">Set as active event</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-text mb-1">
              SMS Reminder (optional)
            </label>
            <select
              value={formData.reminderMinutesBefore ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  reminderMinutesBefore: e.target.value ? parseInt(e.target.value) : null,
                })
              }
              className="input"
            >
              <option value="">No reminder</option>
              <option value="30">30 minutes before deadline</option>
              <option value="60">1 hour before deadline</option>
              <option value="120">2 hours before deadline</option>
              <option value="240">4 hours before deadline</option>
              <option value="480">8 hours before deadline</option>
              <option value="1440">24 hours before deadline</option>
            </select>
            <p className="text-xs text-text-muted mt-1">
              Sends SMS reminders to users who haven't voted yet
            </p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={closeModal} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingEvent ? 'Save' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
