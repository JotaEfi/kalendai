import { prisma } from './src/lib/prisma.js';
import { getTodayInConfiguredTz } from './src/lib/timeUtils.js';

async function check() {
  const today = getTodayInConfiguredTz();
  console.log(`Hoje: ${today.toISOString()}`);

  const cards = await prisma.kanbanCard.findMany({
    include: { images: true }
  });

  console.log(`\n=== ALL CARDS IN DATABASE (${cards.length}) ===`);
  for (const card of cards) {
    console.log({
      id: card.id,
      title: card.title,
      status: card.status,
      dayDate: card.dayDate.toISOString(),
      isSnapshot: card.isSnapshot,
      isRolledOver: card.isRolledOver,
      originalDayDate: card.originalDayDate?.toISOString()
    });
  }
}

check().catch(console.error);
