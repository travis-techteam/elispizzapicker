import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Shield, User as UserIcon, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { User } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { useAuth } from '../../context/AuthContext';

// Format phone as: 1 (xxx) xxx-xxxx
function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length <= 1) return digits;
  if (digits.length <= 4) return `${digits[0]} (${digits.slice(1)}`;
  if (digits.length <= 7) return `${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4)}`;
  return `${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
}

// Get raw digits from formatted phone
function getPhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'USER' as 'ADMIN' | 'USER',
    sendInvite: true,
  });
  const [formattedPhone, setFormattedPhone] = useState('');
  const [error, setError] = useState('');

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormattedPhone(formatted);
    setFormData({ ...formData, phone: getPhoneDigits(formatted) });
  };

  const isPhoneValid = formData.phone.length === 11;

  const { data: usersResponse, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.createUser>[0]) => api.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateUser>[1] }) =>
      api.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => {
      console.error('Delete error:', err);
      alert('Failed to delete user');
    },
  });

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({ name: '', phone: '', email: '', role: 'USER', sendInvite: true });
    setFormattedPhone('');
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    const phoneDigits = getPhoneDigits(user.phone);
    setFormData({
      name: user.name,
      phone: phoneDigits,
      email: user.email || '',
      role: user.role,
      sendInvite: false,
    });
    setFormattedPhone(formatPhoneNumber(phoneDigits));
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isPhoneValid) {
      setError('Please enter a valid 11-digit phone number');
      return;
    }

    if (editingUser) {
      const result = await updateMutation.mutateAsync({
        id: editingUser.id,
        data: {
          name: formData.name,
          phone: formData.phone,
          email: formData.email || null,
          role: formData.role,
        },
      });
      if (!result.success) {
        setError(result.error || 'Failed to update user');
      }
    } else {
      const result = await createMutation.mutateAsync({
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        role: formData.role,
        sendInvite: formData.sendInvite,
      });
      if (!result.success) {
        setError(result.error || 'Failed to create user');
      }
    }
  };

  const handleDelete = (user: User) => {
    if (confirm(`Are you sure you want to delete ${user.name}?`)) {
      deleteMutation.mutate(user.id);
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  const users = usersResponse?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/admin')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text">Manage Users</h1>
          <p className="text-text-muted">{users.length} users</p>
        </div>
        <Button onClick={openCreateModal} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {users.map((user) => (
          <Card key={user.id} className="flex items-center gap-4">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                user.role === 'ADMIN' ? 'bg-primary-100' : 'bg-gray-100'
              }`}
            >
              {user.role === 'ADMIN' ? (
                <Shield className="w-5 h-5 text-primary" />
              ) : (
                <UserIcon className="w-5 h-5 text-text-muted" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-text truncate">{user.name}</h3>
                {user.role === 'ADMIN' && (
                  <span className="badge-primary text-xs">Admin</span>
                )}
              </div>
              <p className="text-sm text-text-muted truncate">{user.phone}</p>
              <p className="text-xs text-text-muted">
                Last login: {user.lastLoginAt
                  ? new Date(user.lastLoginAt).toLocaleDateString() + ' ' + new Date(user.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Never'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openEditModal(user)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Pencil className="w-4 h-4 text-text-muted" />
              </button>
              {user.id !== currentUser?.id && (
                <button
                  onClick={() => handleDelete(user)}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingUser ? 'Edit User' : 'Add User'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Phone *"
            type="tel"
            placeholder="1 (555) 555-5555"
            value={formattedPhone}
            onChange={handlePhoneChange}
            required
          />
          <Input
            label="Email (optional)"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-text mb-1">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as 'ADMIN' | 'USER' })}
              className="input"
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          {!editingUser && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.sendInvite}
                onChange={(e) => setFormData({ ...formData, sendInvite: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-text">Send invite notification</span>
            </label>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={closeModal} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              isLoading={createMutation.isPending || updateMutation.isPending}
              disabled={!formData.name || !isPhoneValid}
            >
              {editingUser ? 'Save' : 'Add User'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
