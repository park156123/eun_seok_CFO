// Set up globals BEFORE any app imports run
const storage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => storage[k] || null,
  setItem: (k: string, v: string) => { storage[k] = v; },
  removeItem: (k: string) => { delete storage[k]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
  length: 0,
  key: (i: number) => null,
};

(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).window = {
  localStorage: mockLocalStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
};

async function runAudit() {
  const { GlobalMockDataStore } = await import('./src/services/dataStore.js');
  const { 
    getTransactionsForMonth, 
    getMonthlyRecordForMonth, 
    getExpenseSummaryForMonth, 
    getMonthlySettlementSummary 
  } = await import('./src/utils/monthDataSelectors.js');
  const { 
    isConsumerTransaction, 
    isTaxTransaction 
  } = await import('./src/utils/consumerExpenseUtils.js');

  const month = '2026-07';
  const liveTxs = getTransactionsForMonth(month);
  const rec = getMonthlyRecordForMonth(month);
  const expenseSummary = getExpenseSummaryForMonth(month);
  const settlementSummary = getMonthlySettlementSummary(month);

  console.log('================ STEP 10CT AUDIT REPORT ================');
  console.log('Record Status:', rec?.status);
  console.log('Record livingExpense:', rec?.livingExpense);
  console.log('Live Expense Summary Total:', expenseSummary.totalExpense);
  console.log('Settlement Summary livingExpense:', settlementSummary.livingExpense);
  console.log('Difference:', (rec?.livingExpense || 0) - expenseSummary.totalExpense);

  if (!rec || !rec.transactions) {
    console.log('ERROR: rec or rec.transactions is empty!');
    return;
  }

  console.log('\n--- Record Transactions Count:', rec.transactions.length);
  console.log('--- Live Transactions Count:', liveTxs.length);

  const recConsumerTxs = rec.transactions.filter(isConsumerTransaction);
  const liveConsumerTxs = liveTxs.filter(isConsumerTransaction);

  const recConsumerSum = recConsumerTxs.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
  const liveConsumerSum = liveConsumerTxs.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);

  console.log('\nRec Consumer Txs Count:', recConsumerTxs.length, 'Sum:', recConsumerSum);
  console.log('Live Consumer Txs Count:', liveConsumerTxs.length, 'Sum:', liveConsumerSum);
  console.log('rec.livingExpense stored value:', rec.livingExpense);

  // Map by transaction ID / unique key
  const getKey = (t: any) => t.id || `${t.date}_${t.merchant}_${t.amount}`;

  const liveMap = new Map<string, any>();
  liveTxs.forEach((t: any) => liveMap.set(getKey(t), t));

  const recMap = new Map<string, any>();
  rec.transactions.forEach((t: any) => recMap.set(getKey(t), t));

  // Find transactions in rec that are in recConsumerTxs but NOT in liveConsumerTxs
  const recConsumerKeys = new Set(recConsumerTxs.map(getKey));
  const liveConsumerKeys = new Set(liveConsumerTxs.map(getKey));

  console.log('\n======================================================');
  console.log('ITEM 2: In Locked Record livingExpense BUT NOT in Current Live isConsumerTransaction');
  console.log('======================================================');
  let sumRecOnly = 0;
  rec.transactions.forEach((recTx: any) => {
    const key = getKey(recTx);
    const inRecConsumer = recConsumerKeys.has(key);
    const inLiveConsumer = liveConsumerKeys.has(key);
    const liveTx = liveMap.get(key);

    if (inRecConsumer && !inLiveConsumer) {
      sumRecOnly += Number(recTx.amount) || 0;
      console.log('\n[REMOVED FROM CONSUMER]');
      console.log('  거래명 (merchant):', recTx.merchant);
      console.log('  날짜 (date):', recTx.date);
      console.log('  금액 (amount):', recTx.amount);
      console.log('  transactionType:', recTx.transactionType);
      console.log('  category (rec -> live):', recTx.category, '->', liveTx?.category);
      console.log('  classificationType (rec -> live):', recTx.classification?.classificationType, '->', liveTx?.classification?.classificationType);
      console.log('  majorCategory (rec -> live):', recTx.classification?.majorCategory, '->', liveTx?.classification?.majorCategory);
      console.log('  minorCategory (rec -> live):', recTx.classification?.minorCategory, '->', liveTx?.classification?.minorCategory);
      console.log('  included (rec -> live):', recTx.included, '->', liveTx?.included);
      console.log('  현재 소비지출 포함 여부: FALSE (isConsumerTransaction in Live:', isConsumerTransaction(liveTx || recTx), ')');
    }
  });
  console.log('\n[과거 포함 → 현재 제외 합계]:', sumRecOnly);

  console.log('\n======================================================');
  console.log('ITEM 3: NOT in Locked Record livingExpense BUT IN Current Live isConsumerTransaction');
  console.log('======================================================');
  let sumLiveOnly = 0;
  liveTxs.forEach((liveTx: any) => {
    const key = getKey(liveTx);
    const inRecConsumer = recConsumerKeys.has(key);
    const inLiveConsumer = liveConsumerKeys.has(key);
    const recTx = recMap.get(key);

    if (!inRecConsumer && inLiveConsumer) {
      sumLiveOnly += Number(liveTx.amount) || 0;
      console.log('\n[ADDED TO CONSUMER]');
      console.log('  거래명 (merchant):', liveTx.merchant);
      console.log('  날짜 (date):', liveTx.date);
      console.log('  금액 (amount):', liveTx.amount);
      console.log('  transactionType:', liveTx.transactionType);
      console.log('  category (rec -> live):', recTx?.category, '->', liveTx.category);
      console.log('  classificationType (rec -> live):', recTx?.classification?.classificationType, '->', liveTx.classification?.classificationType);
      console.log('  majorCategory (rec -> live):', recTx?.classification?.majorCategory, '->', liveTx.classification?.majorCategory);
      console.log('  minorCategory (rec -> live):', recTx?.classification?.minorCategory, '->', liveTx.classification?.minorCategory);
      console.log('  included (rec -> live):', recTx?.included, '->', liveTx.included);
      console.log('  현재 소비지출 포함 여부: TRUE');
    }
  });
  console.log('\n[과거 제외 → 현재 포함 합계]:', sumLiveOnly);

  const netDelta = sumRecOnly - sumLiveOnly;
  console.log('\n======================================================');
  console.log('ITEM 4: NET DELTA CALCULATIONS');
  console.log('======================================================');
  console.log('[과거 포함 → 현재 제외 합계]:', sumRecOnly, '원');
  console.log('[과거 제외 → 현재 포함 합계]:', sumLiveOnly, '원');
  console.log('[순차액 (Net Delta)]:', netDelta, '원');
  console.log('Expected Stale Delta (11,237,492 - 10,976,792):', 11237492 - 10976792, '원');
  console.log('Is Net Delta === 260,700원 ?', netDelta === 260700 ? 'YES - MATCH!' : 'NO - MISMATCH!');

  // Item 6: Compare 5 cash outflow items & net cash flow
  console.log('\n======================================================');
  console.log('ITEM 6: COMPARING LIVE VS LOCKED RECORD 5 CASH OUTFLOW ITEMS');
  console.log('======================================================');
  
  // Calculate Live outflow items:
  // Living expense: liveConsumerSum
  // Financial cost (interest):
  // Let's check how getMonthlySettlementSummary calculates each category from transactions/records
  
  console.log('Settlement Summary Result:', JSON.stringify(settlementSummary, null, 2));
  console.log('Locked Record Stored Values:', {
    livingExpense: rec.livingExpense,
    financialCost: rec.financialCost,
    principalRepayment: rec.principalRepayment,
    savingsInvestment: rec.savingsInvestment,
    taxAndPublicCharges: rec.taxAndPublicCharges,
    totalCashOutflow: rec.totalCashOutflow,
    netCashFlow: (rec as any).netCashFlow ?? ((rec as any).totalIncome ? (rec as any).totalIncome - (rec.totalCashOutflow || 0) : undefined)
  });

}

runAudit().catch(err => {
  console.error('Audit execution error:', err);
});
