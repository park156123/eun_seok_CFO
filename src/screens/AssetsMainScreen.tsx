import React, { useState, useEffect } from 'react';
import { ScreenId, Asset, Debt } from '../types';
import { GlobalMockDataStore } from '../services/dataStore';
import { SnapshotService, subscribeSnapshots } from '../services/snapshotService';
import { useSelectedMonth } from '../context/SelectedMonthContext';
import { MonthSelector } from '../components/MonthSelector';
import { getMonthlyRecordForMonth } from '../utils/monthDataSelectors';
import { OpeningSnapshotModal } from '../components/OpeningSnapshotModal';

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
              className="bg-gradient-to-br from-[#00236f] to-[#1e3a8a] p-6 rounded-2xl shadow-xl text-white cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-1.5 mb-1 opacity-90">
                <span className="font-label-md text-xs">{formattedSelectedMonth} 순자산</span>
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
                  {formattedSelectedMonth} 확정 자산·부채 잔액 기준
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
                {displayTotalDebts.toLocaleString()}원
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
