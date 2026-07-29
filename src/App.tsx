import React, { useState, useEffect } from 'react';
import {
  ScreenId,
  Transaction,
  Asset,
  Debt,
  Goal,
  ScheduleEvent,
  SettlementData,
  AppData,
} from './types';

import { TopAppBar } from './components/TopAppBar';
import { BottomNav } from './components/BottomNav';
import { AddTransactionModal } from './components/AddTransactionModal';

import { OnboardingScreen } from './screens/OnboardingScreen';
import { HomeScreen } from './screens/HomeScreen';
import { AIBriefingScreen } from './screens/AIBriefingScreen';
import { AIQuestionScreen } from './screens/AIQuestionScreen';

import { LedgerMainScreen } from './screens/LedgerMainScreen';
import { ExpenseListScreen } from './screens/ExpenseListScreen';
import { SpendingAnalysisScreen } from './screens/SpendingAnalysisScreen';
import { MonthlySettlementScreen } from './screens/MonthlySettlementScreen';

import { AssetsMainScreen } from './screens/AssetsMainScreen';
import { AssetsDebtsScreen } from './screens/AssetsDebtsScreen';
import { CashflowScreen } from './screens/CashflowScreen';

import { PlannerMainScreen } from './screens/PlannerMainScreen';
import { FutureScheduleScreen } from './screens/FutureScheduleScreen';
import { GoalsSimulationScreen } from './screens/GoalsSimulationScreen';

import { GlobalMockDataStore } from './services/dataStore';

export function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('1-0');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Subscribe to central GlobalMockDataStore
  const [storeData, setStoreData] = useState<AppData>(() => GlobalMockDataStore.getData());

  useEffect(() => {
    const unsubscribe = GlobalMockDataStore.subscribe((newData) => {
      setStoreData(newData);
    });
    return unsubscribe;
  }, []);

  const settlementData = storeData.otherSettings.settlementData;
  const transactions = storeData.otherSettings.transactions;
  const assets = storeData.assets.mainAssets;
  const debts = storeData.debts.mainDebts;
  const goals = storeData.goals.mainGoals;
  const schedules = storeData.otherSettings.schedules;

  const handleToggleDataState = async () => {
    const currentStatus = settlementData.status || '미결산';
    const nextStatus: '미결산' | '진행중' | '완료' =
      currentStatus === '미결산'
        ? '진행중'
        : currentStatus === '진행중'
        ? '완료'
        : '미결산';
    await GlobalMockDataStore.updateSettlementData({ status: nextStatus });
  };

  const handleUpdateSettlement = async (newSettle: Partial<SettlementData>) => {
    await GlobalMockDataStore.updateSettlementData(newSettle);
  };

  // Handlers for Transactions
  const handleAddTransaction = async (newTx: Transaction) => {
    await GlobalMockDataStore.addTransaction(newTx);
  };

  const handleUpdateTransaction = async (updatedTx: Transaction) => {
    await GlobalMockDataStore.updateTransaction(updatedTx);
  };

  const handleDeleteTransaction = async (id: string) => {
    await GlobalMockDataStore.deleteTransaction(id);
  };

  // Handlers for Goals & Schedules
  const handleAddGoal = async (newGoal: Goal) => {
    await GlobalMockDataStore.saveGoal(newGoal);
  };

  const handleAddSchedule = async (newSch: ScheduleEvent) => {
    await GlobalMockDataStore.addSchedule(newSch);
  };

  // CSV Import Parser Demo
  const handleImportCSV = async (csvText: string) => {
    const lines = csvText.split('\n');
    const newItems: Transaction[] = [];

    lines.forEach((line, idx) => {
      if (idx === 0 || !line.trim()) return;
      const parts = line.split(',');
      if (parts.length >= 3) {
        newItems.push({
          id: `csv-${Date.now()}-${idx}`,
          date: parts[0]?.trim() || '7월 24일',
          time: '오후 12:00',
          merchant: parts[1]?.trim() || 'CSV 결제건',
          amount: Math.abs(Number(parts[2]) || 10000),
          type: 'living',
          category: '생활비',
          icon: 'receipt',
          isIncome: false,
        });
      }
    });

    if (newItems.length > 0) {
      for (const item of newItems) {
        await GlobalMockDataStore.addTransaction(item);
      }
    }
  };

  // Calculate high-level summary metrics
  const totalSpending = transactions
    .filter((t) => !t.isIncome)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = transactions
    .filter((t) => t.isIncome)
    .reduce((sum, t) => sum + t.amount, 0);

  const incomeSources = storeData.monthlyIncome.incomeSources || [];
  const fixedExpenses = storeData.fixedExpenses || [];
  const totalInflow = incomeSources.reduce((sum, i) => sum + (i.monthlyIncome || 0), 0);
  const totalOutflow = fixedExpenses.reduce((sum, e) => sum + (e.monthlyAmount || 0), 0);
  const onboardingNetFlow = totalInflow - totalOutflow;

  const netCashflow = totalIncome > 0 ? totalIncome - totalSpending : onboardingNetFlow;

  const isOnboarding = currentScreen === '0-0';

  // Screen rendering router
  const renderScreen = () => {
    switch (currentScreen) {
      // 0. Onboarding Initial Setup
      case '0-0':
        return (
          <OnboardingScreen
            onNavigate={setCurrentScreen}
            onFinishOnboarding={() => setCurrentScreen('1-0')}
          />
        );

      // 1. Home Tab
      case '1-0':
        return (
          <HomeScreen
            onNavigate={setCurrentScreen}
            transactions={transactions}
            schedules={schedules}
            netCashflow={netCashflow}
            totalSpending={totalSpending}
            settlementData={settlementData}
            onToggleDataState={handleToggleDataState}
          />
        );
      case '1-1':
        return <AIBriefingScreen onNavigate={setCurrentScreen} />;
      case '1-2':
        return <AIQuestionScreen />;

      // 2. Ledger Tab
      case '2-0':
        return (
          <LedgerMainScreen
            onNavigate={setCurrentScreen}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            transactions={transactions}
          />
        );
      case '2-1':
        return (
          <ExpenseListScreen
            transactions={transactions}
            onUpdateTransaction={handleUpdateTransaction}
            onDeleteTransaction={handleDeleteTransaction}
          />
        );
      case '2-2':
        return <SpendingAnalysisScreen />;
      case '2-3':
        return (
          <MonthlySettlementScreen
            onImportCSV={handleImportCSV}
            settlementData={settlementData}
            onUpdateSettlement={handleUpdateSettlement}
          />
        );

      // 3. Assets Tab
      case '3-0':
        return (
          <AssetsMainScreen
            onNavigate={setCurrentScreen}
            assets={assets}
            debts={debts}
          />
        );
      case '3-1':
        return (
          <AssetsDebtsScreen
            onNavigate={setCurrentScreen}
            assets={assets}
            debts={debts}
          />
        );
      case '3-2':
        return <CashflowScreen />;

      // 4. Planner Tab
      case '4-0':
        return (
          <PlannerMainScreen
            onNavigate={setCurrentScreen}
            goals={goals}
            schedules={schedules}
          />
        );
      case '4-1':
        return (
          <FutureScheduleScreen
            schedules={schedules}
            onAddSchedule={handleAddSchedule}
          />
        );
      case '4-2':
        return (
          <GoalsSimulationScreen goals={goals} onAddGoal={handleAddGoal} />
        );

      default:
        return (
          <HomeScreen
            onNavigate={setCurrentScreen}
            transactions={transactions}
            schedules={schedules}
            netCashflow={netCashflow}
            totalSpending={totalSpending}
            settlementData={settlementData}
            onToggleDataState={handleToggleDataState}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] antialiased selection:bg-[#6cf8bb] selection:text-[#00714d] font-pretendard">
      <div className="max-w-2xl mx-auto min-h-screen flex flex-col relative bg-[#f7f9fb] shadow-xl">
        {/* Sticky Header - Hidden during Onboarding */}
        {!isOnboarding && (
          <TopAppBar
            currentScreen={currentScreen}
            onNavigate={setCurrentScreen}
            showProfile={currentScreen === '1-0'}
            actions={
              currentScreen === '1-0' ? (
                <button
                  onClick={() => setCurrentScreen('0-0')}
                  className="px-2.5 py-1 text-xs font-bold bg-[#00236f]/10 text-[#00236f] rounded-lg hover:bg-[#00236f]/20 transition-colors flex items-center gap-1 cursor-pointer"
                  title="기본정보관리 (0-0) 이동"
                >
                  <span className="material-symbols-outlined text-sm">tune</span>
                  기본정보관리
                </button>
              ) : undefined
            }
          />
        )}

        {/* Main Content Area */}
        <main className={`flex-1 ${isOnboarding ? 'p-0' : 'px-5 pt-4'}`}>
          {renderScreen()}
        </main>

        {/* Bottom Navigation Bar - Hidden during Onboarding */}
        {!isOnboarding && (
          <BottomNav
            currentScreen={currentScreen}
            onNavigate={setCurrentScreen}
          />
        )}

        {/* Global Modal for Adding Income/Expense */}
        <AddTransactionModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAddTransaction={handleAddTransaction}
        />
      </div>
    </div>
  );
}

export default App;
