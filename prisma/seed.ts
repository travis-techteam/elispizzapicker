import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { phone: '+18162444141' },
    update: {},
    create: {
      name: 'Travis Hawkins',
      phone: '+18162444141',
      email: 'travis@hawkinsfam.net',
      role: 'ADMIN',
    },
  });

  console.log('Created admin user:', admin.name);

  // Create a sample event
  const event = await prisma.event.upsert({
    where: { id: 'seed-event-1' },
    update: {},
    create: {
      id: 'seed-event-1',
      name: 'Friday Night Pizza',
      description: 'Vote for your favorite pizzas for this Friday!',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      isActive: true,
      createdById: admin.id,
    },
  });

  console.log('Created event:', event.name);

  // Create sample pizza options
  const pizzas = [
    { name: 'Cheese', toppings: ['cheese'] },
    { name: 'Pepperoni', toppings: ['pepperoni'] },
    { name: 'Sausage', toppings: ['sausage'] },
    { name: 'Mushroom', toppings: ['mushrooms'] },
    { name: 'Supreme', toppings: ['pepperoni', 'sausage', 'bell peppers', 'onions', 'olives'] },
    { name: 'Meat Lovers', toppings: ['pepperoni', 'sausage', 'bacon', 'ham'] },
    { name: 'Veggie', toppings: ['mushrooms', 'bell peppers', 'onions', 'olives', 'tomatoes'] },
    { name: 'Hawaiian', toppings: ['ham', 'pineapple'] },
    { name: 'BBQ Chicken', toppings: ['chicken', 'bbq sauce', 'onions'] },
    { name: 'Buffalo Chicken', toppings: ['chicken', 'buffalo sauce', 'ranch'] },
  ];

  for (const pizza of pizzas) {
    await prisma.pizzaOption.upsert({
      where: {
        id: `seed-pizza-${pizza.name.toLowerCase().replace(/\s+/g, '-')}`,
      },
      update: {},
      create: {
        id: `seed-pizza-${pizza.name.toLowerCase().replace(/\s+/g, '-')}`,
        eventId: event.id,
        name: pizza.name,
        toppings: pizza.toppings,
        toppingCount: pizza.toppings.length,
      },
    });
  }

  console.log('Created pizza options:', pizzas.length);

  // Create sample users
  const sampleUsers = [
    { name: 'John Doe', phone: '5559876543' },
    { name: 'Jane Smith', phone: '5551112222' },
    { name: 'Bob Wilson', phone: '5553334444' },
  ];

  for (const userData of sampleUsers) {
    const user = await prisma.user.upsert({
      where: { phone: userData.phone },
      update: {},
      create: {
        name: userData.name,
        phone: userData.phone,
        role: 'USER',
      },
    });
    console.log('Created user:', user.name);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
