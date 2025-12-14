import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../../utils/cn';

interface CountdownTimerProps {
  deadline: Date | string;
  onExpire?: () => void;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export default function CountdownTimer({
  deadline,
  onExpire,
  className,
  showIcon = true,
  size = 'md',
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [hasExpired, setHasExpired] = useState(false);
  const expiredRef = useRef(false);

  const calculateTimeRemaining = useCallback((): TimeRemaining => {
    const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
    const total = deadlineDate.getTime() - Date.now();

    if (total <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
    }

    return {
      days: Math.floor(total / (1000 * 60 * 60 * 24)),
      hours: Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((total % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((total % (1000 * 60)) / 1000),
      total,
    };
  }, [deadline]);

  useEffect(() => {
    // Reset expired state when deadline changes
    expiredRef.current = false;
    setHasExpired(false);

    // Initial calculation
    const initial = calculateTimeRemaining();
    setTimeRemaining(initial);

    if (initial.total <= 0) {
      setHasExpired(true);
      if (!expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
      }
      return;
    }

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);

      if (remaining.total <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        setHasExpired(true);
        onExpire?.();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline, calculateTimeRemaining, onExpire]);

  if (!timeRemaining) return null;

  if (hasExpired) {
    return (
      <div className={cn('flex items-center gap-1 text-red-500', className)}>
        {showIcon && <Clock className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />}
        <span
          className={cn(
            'font-medium',
            size === 'sm' && 'text-sm',
            size === 'lg' && 'text-lg'
          )}
        >
          Voting Closed
        </span>
      </div>
    );
  }

  const getDisplayText = (): string => {
    const { days, hours, minutes, seconds } = timeRemaining;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const isUrgent = timeRemaining.total < 60 * 60 * 1000; // Less than 1 hour

  return (
    <div
      className={cn(
        'flex items-center gap-1',
        isUrgent ? 'text-orange-500' : 'text-text-muted',
        className
      )}
    >
      {showIcon && (
        <Clock
          className={cn(
            size === 'sm' ? 'w-3 h-3' : 'w-4 h-4',
            isUrgent && 'animate-pulse'
          )}
        />
      )}
      <span
        className={cn(
          'font-medium tabular-nums',
          size === 'sm' && 'text-sm',
          size === 'lg' && 'text-lg'
        )}
      >
        {getDisplayText()} left
      </span>
    </div>
  );
}
