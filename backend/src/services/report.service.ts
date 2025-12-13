import prisma from '../utils/prisma.js';
import { PizzaOrderRecommendation } from '../types/index.js';

const SLICES_PER_PIZZA = 8;
const PRIORITY_WEIGHTS = { 1: 3, 2: 2, 3: 1 };
const TOTAL_WEIGHT = 6; // 3 + 2 + 1

interface PizzaDemand {
  pizzaOptionId: string;
  name: string;
  toppingCount: number;
  totalSlices: number;
  weightedScore: number;
}

interface HalfPizzaCandidate {
  pizzaOptionId: string;
  name: string;
  toppingCount: number;
  remainingSlices: number;
  weightedScore: number;
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

    // Build voter breakdown
    const voterBreakdown = votes.map((vote) => ({
      userId: vote.userId,
      userName: vote.user.name,
      sliceCount: vote.sliceCount,
      choices: vote.choices
        .sort((a, b) => a.priority - b.priority)
        .map((choice) => ({
          pizzaName: choice.pizzaOption.name,
          priority: choice.priority,
        })),
    }));

    // Calculate demand per pizza option
    const demandMap = new Map<string, PizzaDemand>();

    // Initialize demand for all options
    pizzaOptions.forEach((option) => {
      demandMap.set(option.id, {
        pizzaOptionId: option.id,
        name: option.name,
        toppingCount: option.toppingCount,
        totalSlices: 0,
        weightedScore: 0,
      });
    });

    // Process each vote
    votes.forEach((vote) => {
      const sliceCount = vote.sliceCount;

      vote.choices.forEach((choice) => {
        const priority = choice.priority as 1 | 2 | 3;
        const weight = PRIORITY_WEIGHTS[priority];

        // Allocate slices based on priority weight
        // Priority 1 gets 3/6 = 50%, Priority 2 gets 2/6 = 33%, Priority 3 gets 1/6 = 17%
        const allocatedSlices = Math.round((sliceCount * weight) / TOTAL_WEIGHT);

        const demand = demandMap.get(choice.pizzaOptionId);
        if (demand) {
          demand.totalSlices += allocatedSlices;
          demand.weightedScore += weight;
        }
      });
    });

    // Convert to array and filter out zero-demand options
    const demands = Array.from(demandMap.values()).filter((d) => d.totalSlices > 0);

    // Sort by weighted score (highest first)
    demands.sort((a, b) => b.weightedScore - a.weightedScore);

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
      if (remainder >= 4) {
        halfCandidates.push({
          pizzaOptionId: demand.pizzaOptionId,
          name: demand.name,
          toppingCount: demand.toppingCount,
          remainingSlices: remainder,
          weightedScore: demand.weightedScore,
        });
      }
    });

    // Match half pizzas by topping count
    const halfPizzas: { half1: string; half2: string; quantity: number }[] = [];
    const droppedOptions: string[] = [];
    const usedCandidates = new Set<string>();

    // Group candidates by topping count
    const byToppingCount = new Map<number, HalfPizzaCandidate[]>();
    halfCandidates.forEach((candidate) => {
      const group = byToppingCount.get(candidate.toppingCount) || [];
      group.push(candidate);
      byToppingCount.set(candidate.toppingCount, group);
    });

    // Match pairs within each topping count group
    byToppingCount.forEach((group) => {
      // Sort by weighted score to prioritize higher-priority options
      group.sort((a, b) => b.weightedScore - a.weightedScore);

      for (let i = 0; i < group.length - 1; i += 2) {
        if (i + 1 < group.length) {
          halfPizzas.push({
            half1: group[i].name,
            half2: group[i + 1].name,
            quantity: 1,
          });
          usedCandidates.add(group[i].pizzaOptionId);
          usedCandidates.add(group[i + 1].pizzaOptionId);
        }
      }

      // Handle odd one out
      if (group.length % 2 === 1) {
        const leftover = group[group.length - 1];
        droppedOptions.push(
          `${leftover.name} (only ${leftover.remainingSlices} slices, no compatible half-pizza match)`
        );
      }
    });

    // Also track remainders that were too small (< 4 slices)
    demands.forEach((demand) => {
      const remainder = demand.totalSlices % SLICES_PER_PIZZA;
      if (remainder > 0 && remainder < 4) {
        droppedOptions.push(`${demand.name} (only ${remainder} extra slices, not enough for a half)`);
      }
    });

    // Calculate totals
    const totalFullPizzas = fullPizzas.reduce((sum, p) => sum + p.quantity, 0);
    const totalHalfPizzas = halfPizzas.length; // Each half-pizza pair is 1 whole pizza
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
