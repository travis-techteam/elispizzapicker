import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface VoteUpdatePayload {
  eventId: string;
  voteCount: number;
  participantCount: number;
}

interface VoteSubmittedPayload {
  eventId: string;
  userName: string;
  timestamp: string;
}

interface VoteDeletedPayload {
  eventId: string;
  timestamp: string;
}

interface ServerToClientEvents {
  'vote:update': (data: VoteUpdatePayload) => void;
  'vote:submitted': (data: VoteSubmittedPayload) => void;
  'vote:deleted': (data: VoteDeletedPayload) => void;
}

interface ClientToServerEvents {
  'join:event': (eventId: string) => void;
  'leave:event': (eventId: string) => void;
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContextType {
  socket: TypedSocket | null;
  isConnected: boolean;
  joinEvent: (eventId: string) => void;
  leaveEvent: (eventId: string) => void;
  onVoteUpdate: (callback: (data: VoteUpdatePayload) => void) => () => void;
  onVoteSubmitted: (callback: (data: VoteSubmittedPayload) => void) => () => void;
  onVoteDeleted: (callback: (data: VoteDeletedPayload) => void) => () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // Create socket connection
    const newSocket: TypedSocket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated]);

  const joinEvent = useCallback(
    (eventId: string) => {
      if (socket && isConnected) {
        socket.emit('join:event', eventId);
      }
    },
    [socket, isConnected]
  );

  const leaveEvent = useCallback(
    (eventId: string) => {
      if (socket && isConnected) {
        socket.emit('leave:event', eventId);
      }
    },
    [socket, isConnected]
  );

  const onVoteUpdate = useCallback(
    (callback: (data: VoteUpdatePayload) => void) => {
      if (!socket) return () => {};
      socket.on('vote:update', callback);
      return () => {
        socket.off('vote:update', callback);
      };
    },
    [socket]
  );

  const onVoteSubmitted = useCallback(
    (callback: (data: VoteSubmittedPayload) => void) => {
      if (!socket) return () => {};
      socket.on('vote:submitted', callback);
      return () => {
        socket.off('vote:submitted', callback);
      };
    },
    [socket]
  );

  const onVoteDeleted = useCallback(
    (callback: (data: VoteDeletedPayload) => void) => {
      if (!socket) return () => {};
      socket.on('vote:deleted', callback);
      return () => {
        socket.off('vote:deleted', callback);
      };
    },
    [socket]
  );

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinEvent,
        leaveEvent,
        onVoteUpdate,
        onVoteSubmitted,
        onVoteDeleted,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
