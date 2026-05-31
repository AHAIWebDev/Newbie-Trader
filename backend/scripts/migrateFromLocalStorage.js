/**
 * One-time migration: import a localStorage JSON export into the database.
 *
 * Usage:
 *   node scripts/migrateFromLocalStorage.js <path-to-export.json>
 *
 * How to get the export:
 *   1. Open the app in Chrome
 *   2. DevTools → Console
 *   3. Paste: copy(localStorage.getItem('newbie-trader-portfolio'))
 *   4. Save the clipboard content to a file (e.g. export.json)
 *   5. Run this script
 */
require('dotenv').config();

const fs          = require('fs');
const path        = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PORTFOLIO_ID = 1;

async function main() {
  const exportPath = process.argv[2];
  if (!exportPath) {
    console.error('Usage: node scripts/migrateFromLocalStorage.js <export.json>');
    process.exit(1);
  }

  const raw = fs.readFileSync(path.resolve(exportPath), 'utf8');
  const data = JSON.parse(raw);

  const { cash, startingCash, positions = [], trades = [] } = data;

  console.log(`Importing: $${cash} cash, ${positions.length} positions, ${trades.length} trades`);

  // Upsert the portfolio row
  await prisma.portfolio.upsert({
    where:  { id: PORTFOLIO_ID },
    update: { cash, startingCash },
    create: { id: PORTFOLIO_ID, cash, startingCash },
  });

  // Positions
  for (const pos of positions) {
    await prisma.position.upsert({
      where:  { portfolioId_symbol: { portfolioId: PORTFOLIO_ID, symbol: pos.symbol } },
      update: { shares: pos.shares, avgCost: pos.avgCost, lastPrice: pos.lastPrice ?? pos.avgCost },
      create: {
        portfolioId: PORTFOLIO_ID,
        symbol:      pos.symbol,
        shares:      pos.shares,
        avgCost:     pos.avgCost,
        lastPrice:   pos.lastPrice ?? pos.avgCost,
        addedAt:     pos.addedAt ? new Date(pos.addedAt) : new Date(),
      },
    });
    console.log(`  Position: ${pos.symbol} ${pos.shares} shares`);
  }

  // Trades — localStorage uses numeric ids; we create fresh DB ids
  let imported = 0;
  for (const t of trades) {
    const mc = t.marketContext ?? {};
    await prisma.trade.create({
      data: {
        portfolioId:  PORTFOLIO_ID,
        type:         t.type,
        symbol:       t.symbol,
        shares:       t.shares,
        price:        t.price,
        total:        t.total,
        date:         t.date ? new Date(t.date) : new Date(),
        reasoning:    t.reasoning ?? '',
        outcomeNotes: t.outcomeNotes ?? '',
        pnl:          t.pnl   ?? null,
        pnlPct:       t.pnlPct ?? null,
        rsiValue:     mc.rsiValue     ?? null,
        rsiSignal:    mc.rsiSignal    ?? null,
        sma20Signal:  mc.sma20Signal  ?? null,
        sma50Signal:  mc.sma50Signal  ?? null,
        aiConfidence: mc.aiConfidence ?? null,
        aiAnalyzedAt: mc.aiAnalyzedAt ?? null,
      },
    });
    imported++;
  }

  console.log(`\nDone. Imported ${imported} trades.`);
  console.log('Verify in the app before removing localStorage data.');
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
