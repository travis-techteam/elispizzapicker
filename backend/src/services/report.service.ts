import prisma from '../utils/prisma.js';
import { PizzaOrderRecommendation } from '../types/index.js';

const SLICES_PER_PIZZA = 8;
const MIN_SLICES_FOR_HALF = 4;

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

interface HalfPizzaCandidate {
  pizzaOptionId: string;
  name: string;
  toppingCount: number;
  remainingSlices: number;
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

      // Find options that don't have enough demand (< MIN_SLICES_FOR_HALF)
      const unviableOptions = new Set<string>();
      demandMap.forEach((slices, pizzaId) => {
        if (slices > 0 && slices < MIN_SLICES_FOR_HALF) {
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

    // Calculate full pizzas and remainders
    const fullPizzas: { name: string; quantity: number; slices: number }[] = [];
    const halfCandidates: HalfPizzaCandidate[] = [];

    demands.forEach((demand) => {
      const fullCount = Math.floor(demand.totalSlices / SLICES_PER_PIZZA);
      const remainder = demand.totalSlices % SLICES_PER_PIZZA;

      if (fullCount > 0) {
        fullPizzas.push({
          name: demand.name,
          quantity: fullCount,
          slices: fullCount * SLICES_PER_PIZZA,
        });
      }

      // Only consider remainders of 4+ slices as viable half-pizza candidates
      if (remainder >= MIN_SLICES_FOR_HALF) {
        halfCandidates.push({
          pizzaOptionId: demand.pizzaOptionId,
          name: demand.name,
          toppingCount: demand.toppingCount,
          remainingSlices: remainder,
        });
      }
    });

    // Match half pizzas by topping count
    const halfPizzas: { half1: string; half2: string; quantity: number }[] = [];
    const droppedOptions: string[] = [];

    // Group candidates by topping count
    const byToppingCount = new Map<number, HalfPizzaCandidate[]>();
    halfCandidates.forEach((candidate) => {
      const group = byToppingCount.get(candidate.toppingCount) || [];
      group.push(candidate);
      byToppingCount.set(candidate.toppingCount, group);
    });

    // Match pairs within each topping count group
    byToppingCount.forEach((group) => {
      // Sort by remaining slices (highest first)
      group.sort((a, b) => b.remainingSlices - a.remainingSlices);

      for (let i = 0; i < group.length - 1; i += 2) {
        if (i + 1 < group.length) {
          halfPizzas.push({
            half1: group[i].name,
            half2: group[i + 1].name,
            quantity: 1,
          });
        }
      }

      // Handle odd one out
      if (group.length % 2 === 1) {
        const leftover = group[group.length - 1];
        droppedOptions.push(
          `${leftover.name} (${leftover.remainingSlices} slices, no compatible half-pizza match)`
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
    const totalFullPizzas = fullPizzas.reduce((sum, p) => sum + p.quantity, 0);
    const totalHalfPizzas = halfPizzas.length;
    const totalPizzas = totalFullPizzas + totalHalfPizzas;
    const totalSlices = totalPizzas * SLICES_PER_PIZZA;

    return {
      fullPizzas,
      halfPizzas,
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
