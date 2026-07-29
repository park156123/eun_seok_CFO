import React, { useState, useEffect } from 'react';
import { ScreenId, Transaction } from '../types';
import { getCategoryGroup } from '../data/consumerCategories';
import { GlobalMockDataStore, ConsumerSpendingSummary } from '../services/dataStore';
import { ActiveSessionBanner } from '../components/ActiveSessionBanner';

interface LedgerMainScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onOpenAddModal: () => void;
  transactions: Transaction[];
}

export const LedgerMainScreen: React.FC<LedgerMainScreenProps> = ({
  onNavigate,
  onOpenAddModal,
}) => {
  const [summary, setSummary] = useState<ConsumerSpendingSummary>(() =>
    GlobalMockDataStore.getConsumerSpendingSummary()
  );

  useEffect(() => {
    const updateSummary = () => {
      setSummary(GlobalMockDataStore.getConsumerSpendingSummary());
    };
    updateSummary();
    return GlobalMockDataStore.subscribe(() => {
      updateSummary();
    });
  }, []);

  const totalLivingExpense = summary.totalExpense;
  const categoryList = summary.categoryBreakdown.map((item) => ({
    name: item.category,
    amount: item.amount,
    count: item.count,
    group: getCategoryGroup(item.category),
  }));

  return (
    <div className="space-y-6 pb-28">
      {/* Active Session Info Banner (Requirement 3) */}
      <ActiveSessionBanner
        showActions={true}
        onNavigateToSettlement={() => onNavigate('2-3')}
      />

      {/* Total Expenditure Hero Card */}
      <section className="relative overflow-hidden rounded-2xl bg-[#00236f] p-6 text-white shadow-lg flex flex-col justify-between min-h-40">
        <div className="z-10">
          <div className="flex justify-between items-center">
            <p className="font-body-md text-xs text-white/80">현재 세션 총 소비지출</p>
            <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded text-white">
              개인 CFO 분석
            </span>
          </div>
          <h2 className="font-dohyeon text-3xl mt-2 text-white tracking-tight">
            -{totalLivingExpense.toLocaleString()}원
          </h2>
        </div>
        <div className="z-10 flex items-center gap-1.5 text-[#6ffbbe] bg-white/10 w-fit px-3 py-1 rounded-full border border-white/20 mt-3">
          <span className="material-symbols-outlined text-sm">auto_awesome</span>
          <span className="font-label-md text-xs">
            {summary.totalCount > 0
              ? `소비 포함 총 ${summary.totalCount}건의 거래가 집계되었습니다`
              : 'CSV 업로드 후 자동 분류를 확인하세요'}
          </span>
        </div>
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
      </section>

      {/* Quick Navigation Cards */}
      <section className="grid grid-cols-3 gap-3">
        <button
          id="ledger-nav-expense-list"
          onClick={() => onNavigate('2-1')}
          className="flex flex-col items-center justify-center bg-white p-4 rounded-2xl shadow-xs border border-[#c5c5d3]/20 hover:bg-[#f2f4f6] transition-all group active:scale-95 cursor-pointer"
        >
          <div className="w-11 h-11 rounded-full bg-[#dce1ff] flex items-center justify-center mb-2 group-active:scale-90 transition-transform">
            <span className="material-symbols-outlined text-[#00236f]">receipt_long</span>
          </div>
          <span className="font-label-md text-xs text-[#191c1e] font-bold">지출내역</span>
          <span className="text-[10px] text-[#757682] mt-0.5">{summary.totalCount}건</span>
        </button>

        <button
          id="ledger-nav-spending-analysis"
          onClick={() => onNavigate('2-2')}
          className="flex flex-col items-center justify-center bg-white p-4 rounded-2xl shadow-xs border border-[#c5c5d3]/20 hover:bg-[#f2f4f6] transition-all group active:scale-95 cursor-pointer"
        >
          <div className="w-11 h-11 rounded-full bg-[#ffddb8] flex items-center justify-center mb-2 group-active:scale-90 transition-transform">
            <span className="material-symbols-outlined text-[#653e00]">analytics</span>
          </div>
          <span className="font-label-md text-xs text-[#191c1e] font-bold">소비분석</span>
          <span className="text-[10px] text-[#757682] mt-0.5">TOP 5 & 비율</span>
        </button>

        <button
          id="ledger-nav-monthly-settlement"
          onClick={() => onNavigate('2-3')}
          className="flex flex-col items-center justify-center bg-white p-4 rounded-2xl shadow-xs border border-[#c5c5d3]/20 hover:bg-[#f2f4f6] transition-all group active:scale-95 cursor-pointer"
        >
          <div className="w-11 h-11 rounded-full bg-[#6ffbbe] flex items-center justify-center mb-2 group-active:scale-90 transition-transform">
            <span className="material-symbols-outlined text-[#005236]">calendar_month</span>
          </div>
          <span className="font-label-md text-xs text-[#191c1e] font-bold">월간결산</span>
          <span className="text-[10px] text-[#757682] mt-0.5">CSV 업로드</span>
        </button>
      </section>

      {/* Category Breakdown Overview */}
      <section className="bg-white p-5 rounded-2xl shadow-xs border border-[#c5c5d3]/20 space-y-4">
        <div className="flex justify-between items-center border-b border-[#c5c5d3]/20 pb-3">
          <h3 className="font-dohyeon text-base text-[#00236f] flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">pie_chart</span>
            카테고리별 지출 요약
          </h3>
          <button
            onClick={() => onNavigate('2-2')}
            className="text-xs text-[#00236f] font-bold flex items-center hover:underline cursor-pointer"
          >
            상세분석
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>

        {categoryList.length === 0 ? (
          <div className="py-6 text-center text-[#757682] text-xs">
            지출 내역이 없습니다. CSV 업로드 후 확인할 수 있습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {categoryList.map((item) => {
              const pct = totalLivingExpense > 0 ? Math.round((item.amount / totalLivingExpense) * 100) : 0;
              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-[#191c1e]">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm" style={{ color: item.group.color }}>
                        {item.group.icon}
                      </span>
                      {item.name}
                    </span>
                    <span className="font-dohyeon text-sm text-[#00236f]">
                      {item.amount.toLocaleString()}원 ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#e6e8ea] h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: item.group.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* FAB: Add Entry */}
      <button
        id="ledger-fab-add"
        onClick={onOpenAddModal}
        className="fixed bottom-22 right-5 w-14 h-14 bg-[#00236f] text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform z-40 hover:bg-[#1e3a8a] cursor-pointer"
        aria-label="Add transaction"
      >
        <span className="material-symbols-outlined text-[32px]">add</span>
      </button>
    </div>
  );
};
