import prisma from '../utils/prisma.js';
import { PizzaOrderRecommendation } from '../types/index.js';

const SLICES_PER_PIZZA = 8;
const MIN_SLICES_TO_ROUND_UP = 4; // 4+ slices rounds up to next pizza

interface VoterAllocation {
  oderId: string;  // kept for internal tracking (vote's userId)
  userName: string;
  sliceCount: number;
  choices: { pizzaOptionId: string; pizzaName: string; priority: number }[];
  allocatedTo: string | null; // pizzaOptionId where slices are allocated
}

interface PizzaDemand {
  pizzaOptionId: string;
  name: string;
  toppingCount: number;
  totalSlices: number;
  voterCount: number;
}

export class ReportService {
  async generateReport(eventId: string): Promise<PizzaOrderRecommendation> {
    // Fetch all votes with choices and pizza options
    const votes = await prisma.vote.findMany({
      where: { eventId },
      include: {
        user: true,
        choices: {
          include: {
            pizzaOption: true,
          },
        },
      },
    });

    // Fetch all pizza options for the event
    const pizzaOptions = await prisma.pizzaOption.findMany({
      where: { eventId },
    });

    // Create a map of pizza options for quick lookup
    type PizzaOption = typeof pizzaOptions[number];
    const pizzaMap = new Map<string, PizzaOption>(pizzaOptions.map((p) => [p.id, p]));

    // Initialize voter allocations - everyone starts allocated to their 1st choice
    const voterAllocations: VoterAllocation[] = votes.map((vote) => {
      const sortedChoices = vote.choices
        .sort((a, b) => a.priority - b.priority)
        .map((c) => ({
          pizzaOptionId: c.pizzaOptionId,
          pizzaName: c.pizzaOption.name,
          priority: c.priority,
        }));

      return {
        oderId: vote.userId,
        userName: vote.user.name,
        sliceCount: vote.sliceCount,
        choices: sortedChoices,
        allocatedTo: sortedChoices[0]?.pizzaOptionId || null, // Start with 1st choice
      };
    });

    // Waterfall allocation: iterate until stable
    let changed = true;
    let iterations = 0;
    const maxIterations = 10; // Prevent infinite loops

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      // Calculate current demand per pizza
      const demandMap = new Map<string, number>();
      pizzaOptions.forEach((p) => demandMap.set(p.id, 0));

      voterAllocations.forEach((voter) => {
        if (voter.allocatedTo) {
          demandMap.set(
            voter.allocatedTo,
            (demandMap.get(voter.allocatedTo) || 0) + voter.sliceCount
          );
        }
      });

      // Find options that don't have enough demand (< MIN_SLICES_TO_ROUND_UP)
      const unviableOptions = new Set<string>();
      demandMap.forEach((slices, pizzaId) => {
        if (slices > 0 && slices < MIN_SLICES_TO_ROUND_UP) {
          unviableOptions.add(pizzaId);
        }
      });

      // Move voters from unviable options to their next choice
      voterAllocations.forEach((voter) => {
        if (voter.allocatedTo && unviableOptions.has(voter.allocatedTo)) {
          // Find current priority
          const currentChoice = voter.choices.find(
            (c) => c.pizzaOptionId === voter.allocatedTo
          );
          if (currentChoice) {
            // Find next priority choice
            const nextChoice = voter.choices.find(
              (c) => c.priority > currentChoice.priority
            );
            if (nextChoice) {
              voter.allocatedTo = nextChoice.pizzaOptionId;
              changed = true;
            } else {
              // No more choices - mark as unallocated
              voter.allocatedTo = null;
              changed = true;
            }
          }
        }
      });
    }

    // Calculate final demand
    const finalDemandMap = new Map<string, PizzaDemand>();
    pizzaOptions.forEach((option) => {
      finalDemandMap.set(option.id, {
        pizzaOptionId: option.id,
        name: option.name,
        toppingCount: option.toppingCount,
        totalSlices: 0,
        voterCount: 0,
      });
    });

    voterAllocations.forEach((voter) => {
      if (voter.allocatedTo) {
        const demand = finalDemandMap.get(voter.allocatedTo);
        if (demand) {
          demand.totalSlices += voter.sliceCount;
          demand.voterCount++;
        }
      }
    });

    // Convert to array and filter out zero-demand options
    const demands = Array.from(finalDemandMap.values()).filter(
      (d) => d.totalSlices > 0
    );

    // Sort by total slices (highest first)
    demands.sort((a, b) => b.totalSlices - a.totalSlices);

    // Calculate pizzas using rounding: 4+ slices remainder rounds up, 0-3 rounds down
    const pizzaOrders: { name: string; quantity: number; slicesRequested: number }[] = [];
    const droppedOptions: string[] = [];

    demands.forEach((demand) => {
      const fullCount = Math.floor(demand.totalSlices / SLICES_PER_PIZZA);
      const remainder = demand.totalSlices % SLICES_PER_PIZZA;

      // Round up if remainder is 4+ slices (50% or more of a pizza)
      const roundUp = remainder >= MIN_SLICES_TO_ROUND_UP ? 1 : 0;
      const totalPizzas = fullCount + roundUp;

      if (totalPizzas > 0) {
        pizzaOrders.push({
          name: demand.name,
          quantity: totalPizzas,
          slicesRequested: demand.totalSlices,
        });
      }

      // Track dropped slices (remainder that didn't round up)
      if (remainder > 0 && remainder < MIN_SLICES_TO_ROUND_UP) {
        droppedOptions.push(
          `${demand.name}: ${remainder} slices dropped (below ${MIN_SLICES_TO_ROUND_UP}-slice minimum for rounding)`
        );
      }
    });

    // Track voters who couldn't be allocated anywhere
    const unallocatedVoters = voterAllocations.filter((v) => !v.allocatedTo);
    if (unallocatedVoters.length > 0) {
      unallocatedVoters.forEach((v) => {
        droppedOptions.push(
          `${v.userName}'s ${v.sliceCount} slices couldn't be allocated (no viable options)`
        );
      });
    }

    // Build voter breakdown showing where their slices actually went
    const voterBreakdown = voterAllocations.map((voter) => {
      const allocatedPizza = voter.allocatedTo ? pizzaMap.get(voter.allocatedTo) : null;
      return {
        userId: voter.oderId,
        userName: voter.userName,
        sliceCount: voter.sliceCount,
        choices: voter.choices.map((c) => ({
          pizzaName: c.pizzaName,
          priority: c.priority,
        })),
        allocatedTo: allocatedPizza ? allocatedPizza.name : 'Not allocated',
      };
    });

    // Calculate totals
    const totalPizzas = pizzaOrders.reduce((sum, p) => sum + p.quantity, 0);
    const totalSlices = totalPizzas * SLICES_PER_PIZZA;

    return {
      pizzaOrders,
      totalPizzas,
      totalSlices,
      droppedOptions,
      voterBreakdown,
      summary: {
        totalVoters: votes.length,
        totalSlicesRequested: votes.reduce((sum, v) => sum + v.sliceCount, 0),
      },
    };
  }
}

export const reportService = new ReportService();
