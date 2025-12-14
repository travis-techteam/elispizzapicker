import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import {
  isPushSupported,
  isSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
  getPermissionStatus,
} from '../../utils/pushNotifications';
import { cn } from '../../utils/cn';

export default function NotificationBell() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    const checkStatus = async () => {
      const isSupported = await isPushSupported();
      setSupported(isSupported);

      if (isSupported) {
        const perm = await getPermissionStatus();
        setPermission(perm);

        const isSub = await isSubscribed();
        setSubscribed(isSub);
      }

      setLoading(false);
    };

    checkStatus();
  }, []);

  const handleToggle = async () => {
    if (loading) return;

    setLoading(true);
    try {
      if (subscribed) {
        const success = await unsubscribeFromPush();
        if (success) {
          setSubscribed(false);
        }
      } else {
        const success = await subscribeToPush();
        if (success) {
          setSubscribed(true);
          setPermission('granted');
        } else {
          // Check if permission was denied
          const perm = await getPermissionStatus();
          setPermission(perm);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Don't render if not supported
  if (!supported) {
    return null;
  }

  // Don't render if permission was denied
  if (permission === 'denied') {
    return (
      <button
        disabled
        className="p-2 rounded-full opacity-50 cursor-not-allowed"
        title="Notifications blocked - enable in browser settings"
      >
        <BellOff className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={cn(
        'p-2 rounded-full transition-colors',
        subscribed
          ? 'hover:bg-white/20'
          : 'hover:bg-white/20 animate-pulse'
      )}
      title={subscribed ? 'Disable notifications' : 'Enable notifications'}
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : subscribed ? (
        <Bell className="w-5 h-5" />
      ) : (
        <BellOff className="w-5 h-5 opacity-70" />
      )}
    </button>
  );
}
