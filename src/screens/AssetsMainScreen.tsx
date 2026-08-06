import React, { useState, useEffect } from 'react';
import { ScreenId, Asset, Debt } from '../types';
import { GlobalMockDataStore } from '../services/dataStore';
import { SnapshotService, subscribeSnapshots } from '../services/snapshotService';
import { useSelectedMonth } from '../context/SelectedMonthContext';
import { MonthSelector } from '../components/MonthSelector';
import { getMonthlyRecordForMonth } from '../utils/monthDataSelectors';
import { OpeningSnapshotModal } from '../components/OpeningSnapshotModal';
import { formatAssetAmountKRW } from '../utils/amountUtils';

interface AssetsMainScreenProps {
  onNavigate: (screen: ScreenId) => void;
  assets?: Asset[];
  debts?: Debt[];
}

export const AssetsMainScreen: React.FC<AssetsMainScreenProps> = ({
  onNavigate,
}) => {
  const { selectedMonth, setSelectedMonth, formattedSelectedMonth, year, month } = useSelectedMonth();
  const [, setTick] = useState(0);
  const [isOpeningSnapshotModalOpen, setIsOpeningSnapshotModalOpen] = useState(false);

  useEffect(() => {
    const unsubStore = GlobalMockDataStore.subscribe(() => {
      setTick((t) => t + 1);
    });
    const unsubSnapshots = subscribeSnapshots(() => {
      setTick((t) => t + 1);
    });
    return () => {
      unsubStore();
      unsubSnapshots();
    };
  }, []);

  const snapshotStatus = SnapshotService.getOpeningSnapshotStatus(selectedMonth);
  let openingSnapshotButtonText = `${month}월 시작 스냅샷 작성`;
  if (snapshotStatus === 'confirmed') {
    openingSnapshotButtonText = `${month}월 시작 스냅샷 보기`;
  } else if (snapshotStatus === 'draft') {
    openingSnapshotButtonText = `${month}월 시작 스냅샷 이어쓰기`;
  }

  const isConfirmedOpening = snapshotStatus === 'confirmed';

  const confirmedAssets = isConfirmedOpening
    ? SnapshotService.getAssetSnapshotsByMonth(selectedMonth).filter((a) => a.isIncluded !== false)
    : [];
  const confirmedDebts = isConfirmedOpening
    ? SnapshotService.getDebtSnapshotsByMonth(selectedMonth).filter((d) => d.isIncluded !== false)
    : [];

  const displayTotalAssets = confirmedAssets.reduce((sum, a) => sum + (Number(a.value) || 0), 0);
  const displayTotalDebts = confirmedDebts.reduce((sum, d) => sum + (Number(d.openingPrincipal) || 0), 0);
  const displayNetWorth = displayTotalAssets - displayTotalDebts;

  const isRealEstateCat = (cat?: string) => {
    if (!cat) return false;
    return ['부동산', '아파트', '상가', '주택', '건물', '토지', '빌라', '오피스텔'].some((k) => cat.includes(k));
  };

  const isFinancialCat = (cat?: string) => {
    if (!cat) return false;
    return ['금융', '예적금', '예금', '적금', '주식', '펀드', '현금', '통장', '비상금', '암호화폐', '채권'].some((k) => cat.includes(k));
  };

  let displayRE = 0;
  let displayFin = 0;
  confirmedAssets.forEach((a) => {
    const val = Number(a.value) || 0;
    const cat = a.assetTypeSnapshot || '';
    if (isRealEstateCat(cat)) {
      displayRE += val;
    } else if (isFinancialCat(cat)) {
      displayFin += val;
    }
  });

  return (
    <div className="space-y-5 pb-28">
      {/* 0. Top Header Bar with Global Month Selector & Opening Snapshot Button */}
      <section className="bg-white p-4 rounded-2xl border border-[#c5c5d3]/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-dohyeon text-lg text-[#00236f]">
            {formattedSelectedMonth} 자산·부채
          </h1>
          <p className="text-xs text-[#757682] mt-0.5 font-medium">
            기준월 순자산 및 자산 구성 현황
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOpeningSnapshotModalOpen(true)}
            className="px-3.5 py-1.5 bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs font-dohyeon rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
          >
            <span className="material-symbols-outlined text-sm">flag</span>
            {openingSnapshotButtonText}
          </button>
          <MonthSelector
            selectedMonth={selectedMonth}
            onChangeMonth={setSelectedMonth}
          />
        </div>
      </section>

      {isConfirmedOpening ? (
        <>
          {/* Total Net Worth Hero Section */}
          <section>
            <div
              id="assets-hero-card"
              onClick={() => onNavigate('3-1')}
              className="bg-gradient-to-br from-[#00236f] via-[#00236f] to-[#1e3a8a] p-6 rounded-2xl shadow-xl text-white cursor-pointer active:scale-[0.98] transition-transform relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#6cf8bb]/20 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[#6cf8bb] text-lg">
                      diamond
                    </span>
                  </div>
                  <span className="font-dohyeon text-base text-white/90">순자산</span>
                </div>
                <span className="text-[11px] text-[#6cf8bb] font-bold bg-[#6cf8bb]/15 px-2.5 py-1 rounded-full border border-[#6cf8bb]/30 shrink-0">
                  {formattedSelectedMonth} 확정
                </span>
              </div>

              <div className="mt-3 text-right">
                <h2 className="font-dohyeon text-3xl sm:text-4xl text-[#6cf8bb] tracking-tight drop-shadow-xs">
                  {formatAssetAmountKRW(displayNetWorth)}
                </h2>
              </div>
            </div>
          </section>

          {/* Main Asset Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Real Estate */}
            <div
              id="asset-card-realestate"
              onClick={() => onNavigate('3-1')}
              className="bg-white/90 backdrop-blur-md p-4.5 rounded-2xl shadow-xs border border-[#c5c5d3]/30 cursor-pointer hover:border-[#00236f]/40 transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-xs text-[#444651]">부동산</span>
                <div className="w-9 h-9 rounded-xl bg-[#00236f]/10 text-[#00236f] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lg">home</span>
                </div>
              </div>
              <p className="font-dohyeon text-lg text-[#00236f] text-right truncate">
                {formatAssetAmountKRW(displayRE)}
              </p>
            </div>

            {/* Financial Assets */}
            <div
              id="asset-card-financial"
              onClick={() => onNavigate('3-1')}
              className="bg-white/90 backdrop-blur-md p-4.5 rounded-2xl shadow-xs border border-[#c5c5d3]/30 cursor-pointer hover:border-[#00236f]/40 transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-xs text-[#444651]">금융자산</span>
                <div className="w-9 h-9 rounded-xl bg-[#006c49]/10 text-[#006c49] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                </div>
              </div>
              <p className="font-dohyeon text-lg text-[#006c49] text-right truncate">
                {formatAssetAmountKRW(displayFin)}
              </p>
            </div>

            {/* Liabilities */}
            <div
              id="asset-card-debts"
              onClick={() => onNavigate('3-1')}
              className="bg-white/90 backdrop-blur-md p-4.5 rounded-2xl shadow-xs border border-[#c5c5d3]/30 cursor-pointer hover:border-[#00236f]/40 transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-xs text-[#444651]">부채</span>
                <div className="w-9 h-9 rounded-xl bg-[#ba1a1a]/10 text-[#ba1a1a] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lg">account_balance</span>
                </div>
              </div>
              <p className="font-dohyeon text-lg text-[#ba1a1a] text-right truncate">
                {formatAssetAmountKRW(displayTotalDebts)}
              </p>
            </div>
          </section>
        </>
      ) : (
        /* Empty State Card */
        <section className="bg-white rounded-2xl p-8 text-center border border-[#c5c5d3]/30 shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#00236f]/10 text-[#00236f] flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
          </div>
          <div>
            <h2 className="font-dohyeon text-lg text-[#191c1e]">
              {formattedSelectedMonth} 자산·부채 스냅샷이 아직 없습니다
            </h2>
            <p className="text-xs text-[#757682] mt-1 max-w-sm mx-auto leading-relaxed">
              월별 스냅샷이 생성되면 {formattedSelectedMonth}의 정확한 순자산, 부동산, 금융자산 및 부채 잔액을 확인할 수 있습니다.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            <button
              onClick={() => setIsOpeningSnapshotModalOpen(true)}
              className="px-4 py-2 bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs font-dohyeon rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">flag</span>
              {openingSnapshotButtonText}
            </button>
          </div>
        </section>
      )}

      {/* Opening Snapshot Modal */}
      <OpeningSnapshotModal
        isOpen={isOpeningSnapshotModalOpen}
        onClose={() => setIsOpeningSnapshotModalOpen(false)}
        selectedMonth={formattedSelectedMonth}
        onConfirmed={() => {
          setTick((t) => t + 1);
        }}
      />

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
              {month}월 자산·부채 상세보기
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
              {month}월 현금흐름 분석
            </span>
          </div>
          <span className="material-symbols-outlined text-[#757682]">chevron_right</span>
        </button>
      </section>
    </div>
  );
};
