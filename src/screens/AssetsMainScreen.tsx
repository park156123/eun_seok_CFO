import React, { useState, useEffect } from 'react';
import { ScreenId, Asset, Debt } from '../types';
import { GlobalMockDataStore } from '../services/dataStore';

interface AssetsMainScreenProps {
  onNavigate: (screen: ScreenId) => void;
  assets: Asset[];
  debts: Debt[];
}

export const AssetsMainScreen: React.FC<AssetsMainScreenProps> = ({
  onNavigate,
}) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return GlobalMockDataStore.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  const assetSummary = GlobalMockDataStore.getTotalAssetsSummary();
  const debtTotal = GlobalMockDataStore.getTotalDebtsSummary();
  const netWorth = GlobalMockDataStore.getNetWorth();

  const displayNetWorth = netWorth;
  const displayRE = assetSummary.realEstateTotal;
  const displayFin = assetSummary.financialTotal;
  const displayDebt = debtTotal;

  return (
    <div className="space-y-6 pb-28">
      {/* Total Net Worth Hero Section */}
      <section>
        <div
          id="assets-hero-card"
          onClick={() => onNavigate('3-1')}
          className="bg-gradient-to-br from-[#00236f] to-[#1e3a8a] p-6 rounded-2xl shadow-xl text-white cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-1.5 mb-1 opacity-90">
            <span className="font-label-md text-xs">현재 순자산</span>
            <span
              className="material-symbols-outlined text-sm text-[#6ffbbe]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              verified_user
            </span>
          </div>

          <h2 className="font-dohyeon text-2xl mb-4 tracking-tight">
            {displayNetWorth.toLocaleString()}원
          </h2>

          <div className="inline-flex items-center gap-1.5 bg-[#6cf8bb]/20 backdrop-blur-xs px-3 py-1 rounded-full border border-[#6cf8bb]/30">
            <span className="material-symbols-outlined text-[#6cf8bb] text-sm">
              auto_awesome
            </span>
            <p className="font-label-md text-xs text-[#6cf8bb]">
              순자산이 지난달보다 증가했습니다
            </p>
          </div>
        </div>
      </section>

      {/* Main Asset Grid (Bento Style) */}
      <section className="grid grid-cols-2 gap-3">
        {/* Real Estate */}
        <div
          id="asset-card-realestate"
          onClick={() => onNavigate('3-1')}
          className="col-span-2 bg-white/80 backdrop-blur-md p-5 rounded-2xl shadow-xs border border-[#c5c5d3]/30 flex items-center justify-between cursor-pointer hover:border-[#00236f]/40 transition-all"
        >
          <div>
            <p className="font-label-md text-xs text-[#444651] mb-1">부동산</p>
            <p className="font-dohyeon text-xl text-[#00236f]">
              {displayRE.toLocaleString()}원
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-[#dce1ff] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#00236f]">home_work</span>
          </div>
        </div>

        {/* Financial Assets */}
        <div
          id="asset-card-financial"
          onClick={() => onNavigate('3-1')}
          className="bg-white/80 backdrop-blur-md p-5 rounded-2xl shadow-xs border border-[#c5c5d3]/30 cursor-pointer hover:border-[#00236f]/40 transition-all"
        >
          <div className="w-10 h-10 rounded-full bg-[#6cf8bb]/30 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[#006c49]">payments</span>
          </div>
          <p className="font-label-md text-xs text-[#444651] mb-0.5">금융자산</p>
          <p className="font-body-lg text-sm font-bold text-[#191c1e]">
            {displayFin.toLocaleString()}원
          </p>
        </div>

        {/* Liabilities */}
        <div
          id="asset-card-debts"
          onClick={() => onNavigate('3-1')}
          className="bg-white/80 backdrop-blur-md p-5 rounded-2xl shadow-xs border border-[#c5c5d3]/30 cursor-pointer hover:border-[#00236f]/40 transition-all"
        >
          <div className="w-10 h-10 rounded-full bg-[#ffdad6] flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[#ba1a1a]">account_balance</span>
          </div>
          <p className="font-label-md text-xs text-[#444651] mb-0.5">부채</p>
          <p className="font-body-lg text-sm font-bold text-[#191c1e]">
            {displayDebt.toLocaleString()}원
          </p>
        </div>
      </section>

      {/* Quick Navigation Links */}
      <section className="space-y-3">
        <button
          id="nav-link-assets-debts"
          onClick={() => onNavigate('3-1')}
          className="w-full bg-white/90 p-4 rounded-2xl flex items-center justify-between shadow-xs border border-[#c5c5d3]/20 hover:bg-[#f2f4f6] transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00236f]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#00236f]">analytics</span>
            </div>
            <span className="font-body-md text-sm font-bold text-[#191c1e]">
              자산·부채 자세히 보기
            </span>
          </div>
          <span className="material-symbols-outlined text-[#757682]">chevron_right</span>
        </button>

        <button
          id="nav-link-cashflow"
          onClick={() => onNavigate('3-2')}
          className="w-full bg-white/90 p-4 rounded-2xl flex items-center justify-between shadow-xs border border-[#c5c5d3]/20 hover:bg-[#f2f4f6] transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#006c49]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#006c49]">insights</span>
            </div>
            <span className="font-body-md text-sm font-bold text-[#191c1e]">
              현금흐름 분석
            </span>
          </div>
          <span className="material-symbols-outlined text-[#757682]">chevron_right</span>
        </button>
      </section>

      {/* Empty State / Additional Assets Registration */}
      <section className="border-t border-[#c5c5d3]/30 pt-4">
        <h3 className="font-dohyeon text-base mb-3 text-[#444651]">추가 자산 등록</h3>
        <div className="grid grid-cols-2 gap-3 opacity-70">
          <div className="border-2 border-dashed border-[#c5c5d3] p-4 rounded-2xl flex flex-col items-center justify-center text-center bg-white/40">
            <span className="material-symbols-outlined text-[#757682] mb-1">add_circle</span>
            <p className="font-label-md text-xs font-bold text-[#191c1e]">보험자산</p>
            <p className="font-body-sm text-[11px] text-[#757682] italic">미입력</p>
          </div>

          <div className="border-2 border-dashed border-[#c5c5d3] p-4 rounded-2xl flex flex-col items-center justify-center text-center bg-white/40">
            <span className="material-symbols-outlined text-[#757682] mb-1">add_circle</span>
            <p className="font-label-md text-xs font-bold text-[#191c1e]">연금자산</p>
            <p className="font-body-sm text-[11px] text-[#757682] italic">미입력</p>
          </div>
        </div>
      </section>
    </div>
  );
};
