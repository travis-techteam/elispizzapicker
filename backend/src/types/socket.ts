export interface ServerToClientEvents {
  'vote:update': (data: VoteUpdatePayload) => void;
  'vote:submitted': (data: VoteSubmittedPayload) => void;
  'vote:deleted': (data: VoteDeletedPayload) => void;
}

export interface ClientToServerEvents {
  'join:event': (eventId: string) => void;
  'leave:event': (eventId: string) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  userName: string;
}

export interface VoteUpdatePayload {
  eventId: string;
  voteCount: number;
  participantCount: number;
}

export interface VoteSubmittedPayload {
  eventId: string;
  userName: string;
  timestamp: string;
}

export interface VoteDeletedPayload {
  eventId: string;
  timestamp: string;
}
