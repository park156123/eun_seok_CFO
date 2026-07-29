import React from 'react';
import { ScreenId, Transaction } from '../types';

interface LedgerMainScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onOpenAddModal: () => void;
  transactions: Transaction[];
}

export const LedgerMainScreen: React.FC<LedgerMainScreenProps> = ({
  onNavigate,
  onOpenAddModal,
  transactions,
}) => {
  // Calculate living vs business expense dynamically from transactions state
  const livingTotal = transactions
    .filter((t) => !t.isIncome && t.type === 'living')
    .reduce((sum, t) => sum + t.amount, 0);

  const businessTotal = transactions
    .filter((t) => !t.isIncome && t.type === 'business')
    .reduce((sum, t) => sum + t.amount, 0);

  // If user hasn't added new ones, fallback to wireframe totals if empty
  const displayLiving = livingTotal > 0 ? livingTotal : 2100000;
  const displayBusiness = businessTotal > 0 ? businessTotal : 2950000;
  const totalSpending = displayLiving + displayBusiness;

  return (
    <div className="space-y-6 pb-28">
      {/* Total Expenditure Hero Card */}
      <section className="relative overflow-hidden rounded-2xl bg-[#1e3a8a] p-6 text-white shadow-lg h-44 flex flex-col justify-between">
        <div className="z-10">
          <p className="font-body-md text-sm text-white/80">이번 달 총지출</p>
          <h2 className="font-dohyeon text-3xl mt-1 text-white tracking-tight">
            {totalSpending.toLocaleString()}원
          </h2>
        </div>
        <div className="z-10 flex items-center gap-1 text-[#90a8ff] bg-white/10 w-fit px-3 py-1 rounded-full border border-white/20">
          <span className="material-symbols-outlined text-sm">trending_down</span>
          <span className="font-label-md text-xs">지난달 대비 12% 절약 중</span>
        </div>
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -right-4 bottom-0 opacity-20 transform translate-y-1/4 pointer-events-none">
          <span className="material-symbols-outlined text-[120px]">payments</span>
        </div>
      </section>

      {/* AI One-line Summary */}
      <section className="bg-[#6cf8bb]/20 border border-[#6cf8bb]/40 p-4 rounded-2xl flex items-start gap-3 shadow-xs">
        <div className="bg-[#6cf8bb] p-2 rounded-xl text-[#00714d] shrink-0">
          <span className="material-symbols-outlined text-xl">auto_awesome</span>
        </div>
        <div>
          <p className="font-body-md text-sm text-[#191c1e] leading-relaxed">
            <span className="font-bold text-[#006c49]">AI 요약:</span> 이번 달은 지난달보다 사업비 지출이 15% 줄었습니다. 아주 잘하고 계세요!
          </p>
        </div>
      </section>

      {/* Breakdown by Expense Type (Living vs Business Separation) */}
      <section className="space-y-3">
        <h3 className="font-dohyeon text-base text-[#444651] flex items-center gap-2 px-1">
          <span className="material-symbols-outlined text-lg">pie_chart</span>
          지출 유형별 현황 (생활비 / 사업비)
        </h3>

        <div className="grid grid-cols-1 gap-3">
          {/* Living Expenses */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#e0e3e5]">
            <div className="flex justify-between items-center mb-2">
              <span className="font-body-lg text-base text-[#191c1e] font-semibold">
                생활비
              </span>
              <span className="font-body-md text-[#00236f] font-bold">
                {displayLiving.toLocaleString()}원
              </span>
            </div>
            <div className="w-full bg-[#e6e8ea] h-3 rounded-full overflow-hidden">
              <div
                className="bg-[#00236f] h-full rounded-full transition-all duration-700"
                style={{ width: '65%' }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="font-label-md text-xs text-[#757682]">예산 대비 65%</span>
              <span className="font-label-md text-xs text-[#757682]">
                남은 예산 1,100,000원
              </span>
            </div>
          </div>

          {/* Business Expenses */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#e0e3e5]">
            <div className="flex justify-between items-center mb-2">
              <span className="font-body-lg text-base text-[#191c1e] font-semibold">
                사업비
              </span>
              <span className="font-body-md text-[#006c49] font-bold">
                {displayBusiness.toLocaleString()}원
              </span>
            </div>
            <div className="w-full bg-[#e6e8ea] h-3 rounded-full overflow-hidden">
              <div
                className="bg-[#006c49] h-full rounded-full transition-all duration-700"
                style={{ width: '82%' }}
              />
            </div>
            <div className="flex justify-between mt-2 items-center">
              <span className="font-label-md text-xs text-[#757682]">예산 대비 82%</span>
              <span className="font-label-md text-[10px] text-white font-bold bg-[#ba1a1a] px-2 py-0.5 rounded">
                주의
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Navigation to Detail Sub-Screens */}
      <section className="grid grid-cols-3 gap-3">
        <button
          id="ledger-nav-expense-list"
          onClick={() => onNavigate('2-1')}
          className="flex flex-col items-center justify-center bg-white p-4 rounded-2xl shadow-xs border border-[#c5c5d3]/20 hover:bg-[#f2f4f6] transition-all group active:scale-95"
        >
          <div className="w-12 h-12 rounded-full bg-[#dce1ff] flex items-center justify-center mb-2 group-active:scale-90 transition-transform">
            <span className="material-symbols-outlined text-[#00236f]">list_alt</span>
          </div>
          <span className="font-label-md text-xs text-[#444651] font-medium">지출내역</span>
        </button>

        <button
          id="ledger-nav-spending-analysis"
          onClick={() => onNavigate('2-2')}
          className="flex flex-col items-center justify-center bg-white p-4 rounded-2xl shadow-xs border border-[#c5c5d3]/20 hover:bg-[#f2f4f6] transition-all group active:scale-95"
        >
          <div className="w-12 h-12 rounded-full bg-[#ffddb8] flex items-center justify-center mb-2 group-active:scale-90 transition-transform">
            <span className="material-symbols-outlined text-[#653e00]">analytics</span>
          </div>
          <span className="font-label-md text-xs text-[#444651] font-medium">소비분석</span>
        </button>

        <button
          id="ledger-nav-monthly-settlement"
          onClick={() => onNavigate('2-3')}
          className="flex flex-col items-center justify-center bg-white p-4 rounded-2xl shadow-xs border border-[#c5c5d3]/20 hover:bg-[#f2f4f6] transition-all group active:scale-95"
        >
          <div className="w-12 h-12 rounded-full bg-[#6ffbbe] flex items-center justify-center mb-2 group-active:scale-90 transition-transform">
            <span className="material-symbols-outlined text-[#005236]">calendar_month</span>
          </div>
          <span className="font-label-md text-xs text-[#444651] font-medium">월간결산</span>
        </button>
      </section>

      {/* FAB: Add Entry */}
      <button
        id="ledger-fab-add"
        onClick={onOpenAddModal}
        className="fixed bottom-22 right-5 w-14 h-14 bg-[#00236f] text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform z-40 hover:bg-[#1e3a8a]"
        aria-label="Add transaction"
      >
        <span className="material-symbols-outlined text-[32px]">add</span>
      </button>
    </div>
  );
};
