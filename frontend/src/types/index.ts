export type Role = 'ADMIN' | 'USER';

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: Role;
  createdAt: string;
}

export interface Event {
  id: string;
  name: string;
  description: string | null;
  deadline: string;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: { name: string };
  pizzaOptions?: PizzaOption[];
  _count?: {
    votes: number;
    pizzaOptions: number;
  };
}

export interface PizzaOption {
  id: string;
  eventId: string;
  name: string;
  toppings: string[];
  toppingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VoteChoice {
  id: string;
  voteId: string;
  pizzaOptionId: string;
  priority: 1 | 2 | 3;
  pizzaOption?: {
    id: string;
    name: string;
  };
}

export interface Vote {
  id: string;
  userId: string;
  eventId: string;
  sliceCount: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
  };
  choices: VoteChoice[];
}

export interface VoteInput {
  sliceCount: number;
  choices: {
    pizzaOptionId: string;
    priority: 1 | 2 | 3;
  }[];
}

export interface PizzaOrderReport {
  event: {
    id: string;
    name: string;
    deadline: string;
  };
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

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  warning?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}
