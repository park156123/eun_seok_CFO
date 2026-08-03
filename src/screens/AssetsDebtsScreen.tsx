import React, { useState, useEffect } from 'react';
import { ScreenId, Asset, Debt } from '../types';
import { GlobalMockDataStore } from '../services/dataStore';
import { SnapshotService, subscribeSnapshots } from '../services/snapshotService';
import { useSelectedMonth } from '../context/SelectedMonthContext';
import { OpeningSnapshotModal } from '../components/OpeningSnapshotModal';
import { MonthSelector } from '../components/MonthSelector';
import { calculateMonthlyInterest } from '../utils/financialCostCalculator';

interface AssetsDebtsScreenProps {
  onNavigate: (screen: ScreenId) => void;
  assets: Asset[];
  debts: Debt[];
}

export const AssetsDebtsScreen: React.FC<AssetsDebtsScreenProps> = ({
  onNavigate,
}) => {
  const { selectedMonth, formattedSelectedMonth } = useSelectedMonth();
  const [data, setData] = useState(() => GlobalMockDataStore.getData());
  const [, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | 'asset' | 'debt'>('all');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);
  const [isOpeningSnapshotModalOpen, setIsOpeningSnapshotModalOpen] = useState(false);

  useEffect(() => {
    const unsubStore = GlobalMockDataStore.subscribe((newData) => {
      setData(newData);
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

  const [yearStr, monthStr] = selectedMonth.split('-');
  const monthNum = parseInt(monthStr, 10);

  const snapshotStatus = SnapshotService.getOpeningSnapshotStatus(selectedMonth);
  let openingSnapshotButtonText = `${monthNum}월 시작 스냅샷 작성`;
  if (snapshotStatus === 'confirmed') {
    openingSnapshotButtonText = `${monthNum}월 시작 스냅샷 보기`;
  } else if (snapshotStatus === 'draft') {
    openingSnapshotButtonText = `${monthNum}월 시작 스냅샷 이어쓰기`;
  }

  const isConfirmedSnapshot = snapshotStatus === 'confirmed';

  const confirmedAssets = isConfirmedSnapshot
    ? SnapshotService.getAssetSnapshotsByMonth(selectedMonth).filter((a) => a.isIncluded !== false)
    : [];

  const confirmedDebts = isConfirmedSnapshot
    ? SnapshotService.getDebtSnapshotsByMonth(selectedMonth).filter((d) => d.isIncluded !== false)
    : [];

  const displayAssets = confirmedAssets.map((a) => ({
    id: a.id,
    assetName: a.assetNameSnapshot || '자산',
    assetType: a.assetTypeSnapshot || '기타자산',
    currentValue: Number(a.value) || 0,
    memo: a.memo || '',
    isHistorical: Boolean(a.isHistoricalOnly),
  }));

  const displayDebts = confirmedDebts.map((d) => {
    const master = data.debts.onboardingDebts?.find(
      (m) => m.id === (d as any).linkedDebtId || m.id === d.debtId || m.debtName === d.debtNameSnapshot
    );
    const openingPrincipal = Number(d.openingPrincipal) || 0;
    const repaymentMethod = master?.repaymentMethod || master?.repaymentType || d.debtTypeSnapshot || '원리금상환';
    const isInterestOnly = repaymentMethod.includes('이자만') || repaymentMethod.includes('만기일시');
    const scheduledPrincipal = isInterestOnly ? 0 : (Number(d.scheduledPrincipalRepayment) || 0);

    const masterRate = master?.interestRate !== undefined && master?.interestRate !== null
      ? Number(master.interestRate)
      : master?.annualRate !== undefined && master?.annualRate !== null
      ? Number(master.annualRate)
      : d.interestRate !== undefined && d.interestRate !== null
      ? Number(d.interestRate)
      : 0;

    const hasRate = masterRate > 0;
    const estimatedInterest = hasRate ? calculateMonthlyInterest(openingPrincipal, masterRate) : 0;
    const monthlyPayment = scheduledPrincipal + estimatedInterest;

    return {
      id: d.id,
      debtName: d.debtNameSnapshot || '부채',
      debtType: d.debtTypeSnapshot || '원리금상환',
      lender: d.creditorNameSnapshot || '금융기관',
      currentBalance: openingPrincipal,
      scheduledPrincipal,
      estimatedInterest,
      monthlyPayment,
      hasRate,
      interestRate: masterRate,
      repaymentMethod,
      paymentDay: master?.paymentDay ? `매월 ${master.paymentDay}일` : '스냅샷 확정',
      isHistorical: Boolean(d.isHistoricalOnly),
    };
  });

  const totalAsset = displayAssets.reduce((s, a) => s + a.currentValue, 0);
  const totalDebt = displayDebts.reduce((s, d) => s + d.currentBalance, 0);
  const netWorth = totalAsset - totalDebt;
  const debtRatio = totalAsset > 0 ? ((totalDebt / totalAsset) * 100).toFixed(1) : '0.0';

  const formatKRW = (num: number) => {
    if (Math.abs(num) >= 100000000) {
      const eok = Math.floor(Math.abs(num) / 100000000);
      const man = Math.round((Math.abs(num) % 100000000) / 10000);
      const prefix = num < 0 ? '-' : '';
      return man > 0 ? `${prefix}${eok}억 ${man.toLocaleString()}만원` : `${prefix}${eok}억원`;
    }
    if (Math.abs(num) >= 10000) {
      return `${(num / 10000).toLocaleString()}만원`;
    }
    return `${num.toLocaleString()}원`;
  };

  const isRealEstateCat = (cat?: string) => {
    if (!cat) return false;
    return ['부동산', '아파트', '상가', '주택', '건물', '토지', '빌라', '오피스텔'].some((k) => cat.includes(k));
  };

  const isFinancialCat = (cat?: string) => {
    if (!cat) return false;
    return ['금융', '예적금', '예금', '적금', '주식', '펀드', '현금', '통장', '비상금', '암호화폐', '채권'].some((k) => cat.includes(k));
  };

  let realEstateTotal = 0;
  let financialTotal = 0;
  let otherTotal = 0;

  displayAssets.forEach((a) => {
    const val = a.currentValue;
    const cat = a.assetType;
    if (isRealEstateCat(cat)) {
      realEstateTotal += val;
    } else if (isFinancialCat(cat)) {
      financialTotal += val;
    } else {
      otherTotal += val;
    }
  });

  const realEstatePct = totalAsset > 0 ? Math.round((realEstateTotal / totalAsset) * 100) : 0;
  const financialPct = totalAsset > 0 ? Math.round((financialTotal / totalAsset) * 100) : 0;
  const otherPct = Math.max(0, 100 - realEstatePct - financialPct);

  const filteredAssets = displayAssets.filter((a) => {
    if (selectedCat === 'all') return true;
    if (selectedCat === '부동산') return isRealEstateCat(a.assetType);
    if (selectedCat === '금융자산') return isFinancialCat(a.assetType);
    if (selectedCat === '기타') return !isRealEstateCat(a.assetType) && !isFinancialCat(a.assetType);
    return a.assetType.includes(selectedCat);
  });

  const filteredDebts = displayDebts.filter((d) => {
    if (selectedCat === 'all' || selectedCat === '대출') return true;
    if (selectedCat === '기타') return d.debtType.includes('차입') || d.isHistorical;
    return d.debtType.includes(selectedCat);
  });

  return (
    <div className="space-y-6 pb-28">
      {/* 0. Top Header Bar */}
      <section className="bg-white p-4 rounded-2xl border border-[#c5c5d3]/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-dohyeon text-lg text-[#00236f]">
            {formattedSelectedMonth} 자산·부채 상세보기
          </h1>
          <p className="text-xs text-[#757682] mt-0.5 font-medium">
            기준월 확정 스냅샷 기반 상세 항목
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
        </div>
      </section>

      {!isConfirmedSnapshot ? (
        /* Empty State Card when month has no confirmed snapshot */
        <section className="bg-white rounded-2xl p-8 text-center border border-[#c5c5d3]/30 shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#00236f]/10 text-[#00236f] flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
          </div>
          <div>
            <h2 className="font-dohyeon text-lg text-[#191c1e]">
              {formattedSelectedMonth} 자산·부채 스냅샷이 아직 없습니다
            </h2>
            <p className="text-xs text-[#757682] mt-1 max-w-sm mx-auto leading-relaxed">
              {formattedSelectedMonth}의 자산·부채 스냅샷을 작성하면 확정된 순자산 및 세부 자산·부채 목록을 확인할 수 있습니다.
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
      ) : (
        <>
          {/* 1. Net Worth Summary Card */}
          <section className="bg-[#f2f4f6] rounded-3xl p-5 shadow-[0_4px_12px_rgba(0,35,111,0.05)] border border-white/60 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-label-md text-xs text-[#757682] mb-1 block">
                  {formattedSelectedMonth} 확정 순자산
                </span>
                <h2 className="font-dohyeon text-2xl text-[#00236f] font-bold">
                  {formatKRW(netWorth)}
                </h2>
              </div>
              <div className="bg-[#6cf8bb] text-[#00714d] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-xs">
                <span className="material-symbols-outlined text-sm">verified_user</span>
                스냅샷 확정
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#c5c5d3]/30">
              <div>
                <span className="font-label-md text-xs text-[#757682] block">총자산</span>
                <p className="font-body-md text-sm font-bold text-[#191c1e]">{formatKRW(totalAsset)}</p>
              </div>
              <div>
                <span className="font-label-md text-xs text-[#757682] block text-right">총부채</span>
                <p className="font-body-md text-sm font-bold text-[#ba1a1a] text-right">{formatKRW(totalDebt)}</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#c5c5d3]/30 text-xs">
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[#757682] text-sm">percent</span>
                <span className="text-[#757682]">부채비율</span>
                <span className="font-bold text-[#191c1e]">{debtRatio}%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[#757682] text-sm">payments</span>
                <span className="text-[#757682]">금융자산</span>
                <span className="font-bold text-[#191c1e]">{formatKRW(financialTotal)}</span>
              </div>
            </div>
          </section>

          {/* 2. Tabs & Category Filters */}
          <div className="space-y-3">
            <div className="flex bg-[#e6e8ea] rounded-xl p-1">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'all'
                    ? 'bg-white text-[#00236f] shadow-xs'
                    : 'text-[#757682]'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setActiveTab('asset')}
                className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'asset'
                    ? 'bg-white text-[#00236f] shadow-xs'
                    : 'text-[#757682]'
                }`}
              >
                자산 ({displayAssets.length})
              </button>
              <button
                onClick={() => setActiveTab('debt')}
                className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'debt'
                    ? 'bg-white text-[#00236f] shadow-xs'
                    : 'text-[#757682]'
                }`}
              >
                부채 ({displayDebts.length})
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {['부동산', '금융자산', '대출', '기타'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCat(selectedCat === cat ? 'all' : cat)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    selectedCat === cat
                      ? 'bg-[#00236f] text-white shadow-xs'
                      : 'bg-[#e0e3e5] text-[#444651] hover:bg-[#d8dadc]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Portfolio Allocation Bar */}
          <section className="bg-white rounded-2xl p-5 shadow-xs border border-[#c5c5d3]/20 space-y-3">
            <h3 className="font-label-md text-xs text-[#757682]">자산 포트폴리오 비중</h3>
            <div className="h-6 w-full flex rounded-full overflow-hidden">
              <div className="h-full bg-[#00236f] transition-all" style={{ width: `${realEstatePct}%` }} />
              <div className="h-full bg-[#006c49] transition-all" style={{ width: `${financialPct}%` }} />
              <div className="h-full bg-[#5c3800] transition-all" style={{ width: `${otherPct}%` }} />
            </div>
            <div className="flex justify-between text-[11px] font-bold text-[#191c1e]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#00236f]" />
                부동산 {realEstatePct}%
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#006c49]" />
                금융 {financialPct}%
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#5c3800]" />
                기타 {otherPct}%
              </div>
            </div>
          </section>

          {/* 4. Asset List */}
          {(activeTab === 'all' || activeTab === 'asset') && (
            <section className="space-y-3">
              <h3 className="font-dohyeon text-lg text-[#00236f] flex items-center justify-between px-1">
                자산 목록{' '}
                <span className="text-xs font-normal text-[#757682]">
                  {filteredAssets.length}건
                </span>
              </h3>

              {filteredAssets.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 text-center text-[#757682] text-sm border border-[#c5c5d3]/20">
                  해당 조건의 자산이 없습니다.
                </div>
              ) : (
                filteredAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="bg-white rounded-2xl p-4 shadow-xs border border-[#c5c5d3]/20 space-y-3"
                  >
                    <div
                      onClick={() =>
                        setExpandedAssetId(expandedAssetId === asset.id ? null : asset.id)
                      }
                      className="flex justify-between items-start cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-body-lg text-base font-bold text-[#191c1e]">
                            [{asset.assetName}]
                          </h4>
                        </div>
                        <span className="text-[11px] text-[#006c49] font-bold bg-[#6cf8bb]/30 px-2 py-0.5 rounded mt-1 inline-block">
                          {asset.assetType}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-base text-[#00236f]">
                          {formatKRW(asset.currentValue)}
                        </p>
                        {asset.memo && <p className="text-xs text-[#757682]">{asset.memo}</p>}
                      </div>
                    </div>

                    {expandedAssetId === asset.id && (
                      <div className="pt-2 border-t border-[#c5c5d3]/20 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-[#757682]">자산 유형</span>
                          <span className="font-bold text-[#191c1e]">{asset.assetType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#757682]">스냅샷 평가 금액</span>
                          <span className="font-bold text-[#00236f]">
                            {formatKRW(asset.currentValue)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>
          )}

          {/* 5. Debt List */}
          {(activeTab === 'all' || activeTab === 'debt') && (
            <section className="space-y-3">
              <h3 className="font-dohyeon text-lg text-[#ba1a1a] flex items-center justify-between px-1">
                부채 목록{' '}
                <span className="text-xs font-normal text-[#757682]">
                  {filteredDebts.length}건
                </span>
              </h3>

              {filteredDebts.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 text-center text-[#757682] text-sm border border-[#c5c5d3]/20">
                  해당 조건의 부채가 없습니다.
                </div>
              ) : (
                filteredDebts.map((debt) => (
                  <div
                    key={debt.id}
                    className="bg-white rounded-2xl p-4 shadow-xs border border-[#c5c5d3]/20 space-y-3"
                  >
                    <div
                      onClick={() =>
                        setExpandedDebtId(expandedDebtId === debt.id ? null : debt.id)
                      }
                      className="flex justify-between items-start cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-body-lg text-base font-bold text-[#191c1e]">
                            [{debt.debtName}]
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-[#ba1a1a] font-bold bg-[#ffdad6]/50 px-2 py-0.5 rounded">
                            {debt.debtType}
                          </span>
                          <span className="text-xs text-[#757682] font-medium">{debt.lender}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-base text-[#ba1a1a]">
                          {formatKRW(debt.currentBalance)}
                        </p>
                        <p className="text-xs text-[#757682]">월 예상 상환: {formatKRW(debt.monthlyPayment)}</p>
                      </div>
                    </div>

                    {expandedDebtId === debt.id && (
                      <div className="pt-2 border-t border-[#c5c5d3]/20 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-[#757682]">채권자 / 금융기관</span>
                          <span className="font-bold text-[#191c1e]">{debt.lender}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#757682]">상환방식 / 금리</span>
                          <span className="font-bold text-[#191c1e]">
                            {debt.repaymentMethod} {debt.hasRate ? `(${debt.interestRate}%)` : ''}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#757682]">시작 원금잔액</span>
                          <span className="font-bold text-[#ba1a1a]">
                            {formatKRW(debt.currentBalance)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#757682]">예정 원금</span>
                          <span className="font-bold text-[#00236f]">
                            {formatKRW(debt.scheduledPrincipal)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#757682]">예상 이자</span>
                          <span className="font-bold text-[#ba1a1a]">
                            {debt.hasRate ? formatKRW(debt.estimatedInterest) : '금리 미등록'}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-gray-100 font-bold">
                          <span className="text-[#191c1e]">월 예상 상환액 (원금+이자)</span>
                          <span className="text-[#ba1a1a]">
                            {formatKRW(debt.monthlyPayment)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>
          )}

          {/* 6. AI CFO Asset Diagnosis Card */}
          <section className="bg-[#00236f] rounded-3xl p-6 text-white shadow-lg space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-2xl text-[#6cf8bb]">insights</span>
              <h3 className="font-dohyeon text-lg text-white">AI CFO 자산 진단</h3>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <span
                  className="material-symbols-outlined text-[#6cf8bb]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
                <div>
                  <p className="font-bold text-white">현재 강점</p>
                  <p className="text-white/80 text-xs">
                    대출원금 상환으로 순자산이 증가하고 있습니다.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span
                  className="material-symbols-outlined text-[#ffddb8]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  warning
                </span>
                <div>
                  <p className="font-bold text-white">확인할 점</p>
                  <p className="text-white/80 text-xs">
                    부동산 비중이 높고 가용현금 비중이 낮습니다.
                  </p>
                </div>
              </div>
            </div>

            <button
              id="btn-set-goal-from-assets"
              onClick={() => onNavigate('4-2')}
              className="w-full py-3.5 bg-[#6cf8bb] text-[#00714d] rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">event_note</span>
              올해 금융자산 목표 설정하기
            </button>
          </section>
        </>
      )}

      {/* Opening Snapshot Modal */}
      <OpeningSnapshotModal
        isOpen={isOpeningSnapshotModalOpen}
        onClose={() => setIsOpeningSnapshotModalOpen(false)}
        selectedMonth={formattedSelectedMonth}
        onConfirmed={() => {
          setData(GlobalMockDataStore.getData());
          setTick((t) => t + 1);
        }}
      />
    </div>
  );
};
