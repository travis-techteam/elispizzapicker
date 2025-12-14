import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import prisma from '../utils/prisma.js';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  VoteUpdatePayload,
  VoteSubmittedPayload,
  VoteDeletedPayload,
} from '../types/socket.js';

let io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null;

export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      cors: {
        origin: config.frontendUrl,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    }
  );

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true },
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.data.userId = user.id;
      socket.data.userName = user.name;
      next();
    } catch (error) {
      logger.warn({ err: error }, 'Socket authentication failed');
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
    logger.debug({ userId: socket.data.userId, socketId: socket.id }, 'Socket connected');

    // Join event room
    socket.on('join:event', (eventId: string) => {
      const room = `event:${eventId}`;
      socket.join(room);
      logger.debug({ userId: socket.data.userId, eventId, room }, 'User joined event room');
    });

    // Leave event room
    socket.on('leave:event', (eventId: string) => {
      const room = `event:${eventId}`;
      socket.leave(room);
      logger.debug({ userId: socket.data.userId, eventId, room }, 'User left event room');
    });

    socket.on('disconnect', () => {
      logger.debug({ userId: socket.data.userId, socketId: socket.id }, 'Socket disconnected');
    });
  });

  logger.info('Socket.io server initialized');
  return io;
}

export function getIO(): Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null {
  return io;
}

// Helper functions to emit events

export async function emitVoteUpdate(eventId: string): Promise<void> {
  if (!io) return;

  try {
    // Get updated vote count
    const [voteCount, votes] = await Promise.all([
      prisma.vote.count({ where: { eventId } }),
      prisma.vote.findMany({
        where: { eventId },
        select: { userId: true },
      }),
    ]);

    const participantCount = new Set(votes.map((v) => v.userId)).size;

    const payload: VoteUpdatePayload = {
      eventId,
      voteCount,
      participantCount,
    };

    io.to(`event:${eventId}`).emit('vote:update', payload);
    logger.debug({ eventId, voteCount, participantCount }, 'Emitted vote:update');
  } catch (error) {
    logger.error({ err: error, eventId }, 'Failed to emit vote update');
  }
}

export function emitVoteSubmitted(eventId: string, userName: string): void {
  if (!io) return;

  const payload: VoteSubmittedPayload = {
    eventId,
    userName,
    timestamp: new Date().toISOString(),
  };

  io.to(`event:${eventId}`).emit('vote:submitted', payload);
  logger.debug({ eventId, userName }, 'Emitted vote:submitted');
}

export function emitVoteDeleted(eventId: string): void {
  if (!io) return;

  const payload: VoteDeletedPayload = {
    eventId,
    timestamp: new Date().toISOString(),
  };

  io.to(`event:${eventId}`).emit('vote:deleted', payload);
  logger.debug({ eventId }, 'Emitted vote:deleted');
}
