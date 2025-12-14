import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ToastProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'info', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const typeStyles = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  };

  return (
    <div
      className={cn(
        'fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-white shadow-lg animate-slide-up',
        typeStyles[type]
      )}
    >
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="p-0.5 rounded hover:bg-white/20 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
