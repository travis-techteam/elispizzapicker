import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ArrowLeft, Pizza, X } from 'lucide-react';
import { api } from '../../services/api';
import type { PizzaOption } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import LoadingScreen from '../../components/ui/LoadingScreen';

export default function AdminPizzaOptions() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPizza, setEditingPizza] = useState<PizzaOption | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    toppings: [] as string[],
  });
  const [toppingInput, setToppingInput] = useState('');
  const [error, setError] = useState('');

  const { data: eventResponse, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.getEvent(eventId!),
    enabled: !!eventId,
  });

  const { data: pizzasResponse, isLoading: pizzasLoading } = useQuery({
    queryKey: ['pizzas', eventId],
    queryFn: () => api.getPizzaOptions(eventId!),
    enabled: !!eventId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; toppings: string[] }) =>
      api.createPizzaOption(eventId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pizzas', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      closeModal();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; toppings?: string[] } }) =>
      api.updatePizzaOption(eventId!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pizzas', eventId] });
      closeModal();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePizzaOption(eventId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pizzas', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    },
  });

  const openCreateModal = () => {
    setEditingPizza(null);
    setFormData({ name: '', toppings: [] });
    setToppingInput('');
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (pizza: PizzaOption) => {
    setEditingPizza(pizza);
    setFormData({
      name: pizza.name,
      toppings: [...pizza.toppings],
    });
    setToppingInput('');
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPizza(null);
    setError('');
  };

  const addTopping = () => {
    const topping = toppingInput.trim().toLowerCase();
    if (topping && !formData.toppings.includes(topping)) {
      setFormData({ ...formData, toppings: [...formData.toppings, topping] });
      setToppingInput('');
    }
  };

  const removeTopping = (topping: string) => {
    setFormData({
      ...formData,
      toppings: formData.toppings.filter((t) => t !== topping),
    });
  };

  const handleToppingKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTopping();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.toppings.length === 0) {
      setError('Please add at least one topping');
      return;
    }

    if (editingPizza) {
      const result = await updateMutation.mutateAsync({
        id: editingPizza.id,
        data: {
          name: formData.name,
          toppings: formData.toppings,
        },
      });
      if (!result.success) {
        setError(result.error || 'Failed to update pizza');
      }
    } else {
      const result = await createMutation.mutateAsync({
        name: formData.name,
        toppings: formData.toppings,
      });
      if (!result.success) {
        setError(result.error || 'Failed to create pizza');
      }
    }
  };

  const handleDelete = (pizza: PizzaOption) => {
    if (confirm(`Are you sure you want to delete "${pizza.name}"?`)) {
      deleteMutation.mutate(pizza.id);
    }
  };

  if (eventLoading || pizzasLoading) {
    return <LoadingScreen />;
  }

  const event = eventResponse?.data;
  const pizzas = pizzasResponse?.data || [];

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted">Event not found</p>
        <Button onClick={() => navigate('/admin/events')} className="mt-4">
          Back to Events
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/admin/events')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text">Pizza Options</h1>
          <p className="text-text-muted">{event.name}</p>
        </div>
        <Button onClick={openCreateModal} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Pizzas List */}
      <div className="space-y-3">
        {pizzas.length === 0 ? (
          <Card className="text-center py-8">
            <Pizza className="w-12 h-12 text-text-muted mx-auto mb-3" />
            <p className="text-text-muted">No pizza options yet. Add some to let users vote!</p>
          </Card>
        ) : (
          pizzas.map((pizza) => (
            <Card key={pizza.id} className="flex items-center gap-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  pizza.toppingCount === 1 ? 'bg-accent-100' : 'bg-secondary-100'
                }`}
              >
                <span className="text-sm font-bold text-text">{pizza.toppingCount}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-text">{pizza.name}</h3>
                <p className="text-sm text-text-muted truncate">
                  {pizza.toppings.join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(pizza)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Pencil className="w-4 h-4 text-text-muted" />
                </button>
                <button
                  onClick={() => handleDelete(pizza)}
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

      {/* Quick Add Common Pizzas */}
      {pizzas.length === 0 && (
        <Card>
          <h3 className="font-semibold text-text mb-3">Quick Add Common Pizzas</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { name: 'Cheese', toppings: ['cheese'] },
              { name: 'Pepperoni', toppings: ['pepperoni'] },
              { name: 'Sausage', toppings: ['sausage'] },
              { name: 'Supreme', toppings: ['pepperoni', 'sausage', 'bell peppers', 'onions', 'olives'] },
              { name: 'Veggie', toppings: ['mushrooms', 'bell peppers', 'onions', 'olives'] },
            ].map((pizza) => (
              <Button
                key={pizza.name}
                variant="outline"
                size="sm"
                onClick={() => createMutation.mutate(pizza)}
                disabled={createMutation.isPending}
              >
                + {pizza.name}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingPizza ? 'Edit Pizza' : 'Add Pizza'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Pizza Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Pepperoni"
            required
          />

          <div>
            <label className="block text-sm font-medium text-text mb-1">Toppings</label>
            <div className="flex gap-2">
              <Input
                value={toppingInput}
                onChange={(e) => setToppingInput(e.target.value)}
                onKeyDown={handleToppingKeyDown}
                placeholder="Add a topping..."
              />
              <Button type="button" onClick={addTopping} size="md">
                Add
              </Button>
            </div>
          </div>

          {formData.toppings.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.toppings.map((topping) => (
                <span
                  key={topping}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm"
                >
                  {topping}
                  <button
                    type="button"
                    onClick={() => removeTopping(topping)}
                    className="p-0.5 hover:bg-gray-200 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <p className="text-xs text-text-muted">
            Topping count: {formData.toppings.length} (used for half-pizza matching)
          </p>

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
              {editingPizza ? 'Save' : 'Add Pizza'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
