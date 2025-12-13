import { Role } from '@prisma/client';
import { Request } from 'express';

export interface JwtPayload {
  userId: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Vote types
export interface VoteInput {
  sliceCount: number;
  choices: {
    pizzaOptionId: string;
    priority: 1 | 2 | 3;
  }[];
}

// Report types
export interface PizzaOrderRecommendation {
  fullPizzas: {
    name: string;
    quantity: number;
    slices: number;
  }[];
  halfPizzas: {
    half1: string;
    half2: string;
    quantity: number;
  }[];
  totalPizzas: number;
  totalSlices: number;
  droppedOptions: string[];
  voterBreakdown: {
    userId: string;
    userName: string;
    sliceCount: number;
    choices: {
      pizzaName: string;
      priority: number;
    }[];
  }[];
  summary: {
    totalVoters: number;
    totalSlicesRequested: number;
  };
}
