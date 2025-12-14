import prisma from '../utils/prisma.js';

export interface EventHistory {
  id: string;
  name: string;
  description: string | null;
  deadline: Date;
  isActive: boolean;
  createdAt: Date;
  voteCount: number;
  participantCount: number;
  pizzaCount: number;
  topPizza: string | null;
}

export interface PizzaTrend {
  name: string;
  totalVotes: number;
  firstChoiceVotes: number;
  eventCount: number;
}

export interface ParticipationStats {
  eventId: string;
  eventName: string;
  eventDate: Date;
  totalUsers: number;
  participantCount: number;
  participationRate: number;
}

export async function getEventHistory(limit = 20, offset = 0): Promise<EventHistory[]> {
  const events = await prisma.event.findMany({
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit,
    include: {
      _count: {
        select: {
          votes: true,
          pizzaOptions: true,
        },
      },
      votes: {
        select: {
          userId: true,
          firstChoice: {
            select: { name: true },
          },
        },
      },
    },
  });

  return events.map((event) => {
    // Count unique participants
    const uniqueParticipants = new Set(event.votes.map((v) => v.userId)).size;

    // Find most voted pizza
    const pizzaVotes: Record<string, number> = {};
    for (const vote of event.votes) {
      if (vote.firstChoice) {
        const name = vote.firstChoice.name;
        pizzaVotes[name] = (pizzaVotes[name] || 0) + 1;
      }
    }

    const topPizza = Object.entries(pizzaVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return {
      id: event.id,
      name: event.name,
      description: event.description,
      deadline: event.deadline,
      isActive: event.isActive,
      createdAt: event.createdAt,
      voteCount: event._count.votes,
      participantCount: uniqueParticipants,
      pizzaCount: event._count.pizzaOptions,
      topPizza,
    };
  });
}

export async function getPizzaTrends(limit = 10): Promise<PizzaTrend[]> {
  // Get all votes with pizza info
  const votes = await prisma.vote.findMany({
    include: {
      firstChoice: {
        select: { name: true },
      },
      secondChoice: {
        select: { name: true },
      },
      thirdChoice: {
        select: { name: true },
      },
    },
  });

  // Aggregate pizza statistics
  const pizzaStats: Record<
    string,
    {
      totalVotes: number;
      firstChoiceVotes: number;
      events: Set<string>;
    }
  > = {};

  for (const vote of votes) {
    // Track first choice votes (weighted more heavily)
    if (vote.firstChoice) {
      const name = vote.firstChoice.name;
      if (!pizzaStats[name]) {
        pizzaStats[name] = { totalVotes: 0, firstChoiceVotes: 0, events: new Set() };
      }
      pizzaStats[name].totalVotes += 3;
      pizzaStats[name].firstChoiceVotes += 1;
      pizzaStats[name].events.add(vote.eventId);
    }

    // Track second choice votes
    if (vote.secondChoice) {
      const name = vote.secondChoice.name;
      if (!pizzaStats[name]) {
        pizzaStats[name] = { totalVotes: 0, firstChoiceVotes: 0, events: new Set() };
      }
      pizzaStats[name].totalVotes += 2;
      pizzaStats[name].events.add(vote.eventId);
    }

    // Track third choice votes
    if (vote.thirdChoice) {
      const name = vote.thirdChoice.name;
      if (!pizzaStats[name]) {
        pizzaStats[name] = { totalVotes: 0, firstChoiceVotes: 0, events: new Set() };
      }
      pizzaStats[name].totalVotes += 1;
      pizzaStats[name].events.add(vote.eventId);
    }
  }

  // Convert to array and sort by total votes
  const trends: PizzaTrend[] = Object.entries(pizzaStats)
    .map(([name, stats]) => ({
      name,
      totalVotes: stats.totalVotes,
      firstChoiceVotes: stats.firstChoiceVotes,
      eventCount: stats.events.size,
    }))
    .sort((a, b) => b.totalVotes - a.totalVotes)
    .slice(0, limit);

  return trends;
}

export async function getParticipationStats(limit = 10): Promise<ParticipationStats[]> {
  // Get recent events with vote counts
  const events = await prisma.event.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      votes: {
        select: { userId: true },
      },
    },
  });

  // Get total user count at each event time (approximation using current count)
  const totalUsers = await prisma.user.count();

  return events.map((event) => {
    const uniqueParticipants = new Set(event.votes.map((v) => v.userId)).size;
    const participationRate = totalUsers > 0 ? (uniqueParticipants / totalUsers) * 100 : 0;

    return {
      eventId: event.id,
      eventName: event.name,
      eventDate: event.createdAt,
      totalUsers,
      participantCount: uniqueParticipants,
      participationRate: Math.round(participationRate * 10) / 10,
    };
  });
}

export async function getEventHistoryCount(): Promise<number> {
  return prisma.event.count();
}
