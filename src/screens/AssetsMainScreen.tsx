import React, { useState, useEffect } from 'react';
import { ScreenId, Asset, Debt } from '../types';
import { GlobalMockDataStore } from '../services/dataStore';
import { SnapshotService, subscribeSnapshots, getAllMasterDebts, findMatchingMasterDebt } from '../services/snapshotService';
import { useSelectedMonth } from '../context/SelectedMonthContext';
import { MonthSelector } from '../components/MonthSelector';
import { OpeningSnapshotModal } from '../components/OpeningSnapshotModal';
import { calculateMonthlyInterest } from '../utils/financialCostCalculator';
import { formatAssetAmountKRW } from '../utils/amountUtils';
import { getAssetTypeIcon, getDebtTypeIcon } from '../utils/assetTheme';

interface AssetsMainScreenProps {
  onNavigate: (screen: ScreenId) => void;
  assets?: Asset[];
  debts?: Debt[];
}

export const AssetsMainScreen: React.FC<AssetsMainScreenProps> = () => {
  const { selectedMonth, setSelectedMonth, formattedSelectedMonth, month } = useSelectedMonth();
  const [data, setData] = useState(() => GlobalMockDataStore.getData());
  const [, setTick] = useState(0);

  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);
  const [isOpeningSnapshotModalOpen, setIsOpeningSnapshotModalOpen] = useState(false);

  // Collapse / Expand state: Asset = default collapsed (false), Debt = default expanded (true)
  const [isAssetListExpanded, setIsAssetListExpanded] = useState<boolean>(false);
  const [isDebtListExpanded, setIsDebtListExpanded] = useState<boolean>(true);

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

  const snapshotStatus = SnapshotService.getOpeningSnapshotStatus(selectedMonth);
  let openingSnapshotButtonText = `${month}월 시작 스냅샷 작성`;
  if (snapshotStatus === 'confirmed') {
    openingSnapshotButtonText = `${month}월 시작 스냅샷 보기`;
  } else if (snapshotStatus === 'draft') {
    openingSnapshotButtonText = `${month}월 시작 스냅샷 이어쓰기`;
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

  const masterDebts = getAllMasterDebts(data.debts);

  const displayDebts = confirmedDebts.map((d) => {
    const master = findMatchingMasterDebt(d, masterDebts);
    const openingPrincipal = Number(d.openingPrincipal) || 0;

    const masterRate =
      master?.interestRate !== undefined && master?.interestRate !== null
        ? Number(master.interestRate)
        : master?.annualRate !== undefined && master?.annualRate !== null
        ? Number(master.annualRate)
        : master?.rate !== undefined && master?.rate !== null
        ? Number(master.rate)
        : master?.currentRate !== undefined && master?.currentRate !== null
        ? Number(master.currentRate)
        : d.interestRate !== undefined && d.interestRate !== null
        ? Number(d.interestRate)
        : 0;

    const repaymentMethod =
      master?.repaymentMethod ||
      master?.repaymentType ||
      master?.paymentType ||
      master?.rateType ||
      master?.amortizationType ||
      d.repaymentMethod ||
      d.debtTypeSnapshot ||
      '원리금상환';

    const isInterestOnly = repaymentMethod.includes('이자만') || repaymentMethod.includes('만기일시');
    const scheduledPrincipal = isInterestOnly ? 0 : (Number(d.scheduledPrincipalRepayment) || 0);

    const hasRate = masterRate > 0;
    const estimatedInterest = hasRate ? calculateMonthlyInterest(openingPrincipal, masterRate) : 0;
    const monthlyPayment = scheduledPrincipal + estimatedInterest;

    const paymentDayVal =
      master?.paymentDay ??
      master?.dueDay ??
      master?.monthlyPaymentDay ??
      master?.interestPaymentDay ??
      d.paymentDay;

    const lenderName = master?.creditorName || master?.creditor || master?.lender || d.creditorNameSnapshot || '금융기관';

    return {
      id: d.id,
      debtName: d.debtNameSnapshot || master?.debtName || master?.name || '부채',
      debtType: d.debtTypeSnapshot || repaymentMethod,
      lender: lenderName,
      currentBalance: openingPrincipal,
      scheduledPrincipal,
      estimatedInterest,
      monthlyPayment,
      hasRate,
      interestRate: masterRate,
      repaymentMethod,
      paymentDay: paymentDayVal ? `매월 ${paymentDayVal}일` : '스냅샷 확정',
      isHistorical: Boolean(d.isHistoricalOnly),
    };
  });

  const totalAsset = displayAssets.reduce((s, a) => s + a.currentValue, 0);
  const totalDebt = displayDebts.reduce((s, d) => s + d.currentBalance, 0);
  const netWorth = totalAsset - totalDebt;
  const debtRatio = totalAsset > 0 ? ((totalDebt / totalAsset) * 100).toFixed(1) : '0.0';

  const formatKRW = (num: number) => formatAssetAmountKRW(num);

  const isRealEstateCat = (cat?: string) => {
    if (!cat) return false;
    const c = cat.toLowerCase();
    return ['부동산', '아파트', '상가', '주택', '건물', '토지', '빌라', '오피스텔', '전세', 'real_estate'].some((k) => c.includes(k.toLowerCase()));
  };

  const isFinancialCat = (cat?: string) => {
    if (!cat) return false;
    const c = cat.toLowerCase();
    return ['금융', '예적금', '예금', '적금', '주식', '펀드', '현금', '통장', '비상금', '암호화폐', '채권', 'financial'].some((k) => c.includes(k.toLowerCase()));
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

  return (
    <div className="space-y-5 pb-28">
      {/* 0. Top Header Bar with Global Month Selector & Opening Snapshot Button */}
      <section className="bg-white p-4 rounded-2xl border border-[#c5c5d3]/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-dohyeon text-lg text-[#00236f]">
            {formattedSelectedMonth} 자산·부채
          </h1>
          <p className="text-xs text-[#757682] mt-0.5 font-medium">
            기준월 순자산 및 자산·부채 현황 요약
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

      {!isConfirmedSnapshot ? (
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
      ) : (
        <>
          {/* 1. Top Summary Card (월간결산형 요약) */}
          <section className="bg-gradient-to-br from-[#00236f] via-[#00236f] to-[#1e3a8a] rounded-3xl p-6 shadow-xl text-white space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#6cf8bb]/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#6cf8bb] text-lg">diamond</span>
                </div>
                <span className="font-dohyeon text-sm text-white/90">
                  {formattedSelectedMonth} 확정 재무 상태
                </span>
              </div>
              <div className="bg-[#6cf8bb]/20 border border-[#6cf8bb]/30 text-[#6cf8bb] px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shrink-0">
                <span className="material-symbols-outlined text-sm">verified_user</span>
                확정
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/15">
              <div className="bg-white/10 p-3 rounded-2xl">
                <p className="text-xs text-white/70 font-medium mb-1">순자산</p>
                <p className="font-dohyeon text-base sm:text-lg text-[#6cf8bb] truncate">{formatKRW(netWorth)}</p>
              </div>
              <div className="bg-white/10 p-3 rounded-2xl">
                <p className="text-xs text-white/70 font-medium mb-1">총 자산</p>
                <p className="font-dohyeon text-base sm:text-lg text-white truncate">{formatKRW(totalAsset)}</p>
              </div>
              <div className="bg-white/10 p-3 rounded-2xl">
                <p className="text-xs text-white/70 font-medium mb-1">총 부채</p>
                <p className="font-dohyeon text-base sm:text-lg text-[#ff9999] truncate">{formatKRW(totalDebt)}</p>
              </div>
              <div className="bg-white/10 p-3 rounded-2xl">
                <p className="text-xs text-white/70 font-medium mb-1">부채비율</p>
                <p className="font-dohyeon text-base sm:text-lg text-white truncate">{debtRatio}%</p>
              </div>
            </div>
          </section>

          {/* 2. Asset & Debt Summary Cards Side-by-Side (자산·부채 요약 카드) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 자산 요약 카드 */}
            <div
              onClick={() => setIsAssetListExpanded(!isAssetListExpanded)}
              className={`bg-white rounded-2xl p-4.5 border transition-all cursor-pointer shadow-xs ${
                isAssetListExpanded ? 'border-[#00236f] ring-1 ring-[#00236f]/20' : 'border-[#c5c5d3]/30 hover:border-[#00236f]/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#006c49]/10 text-[#006c49] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-dohyeon text-base text-[#191c1e]">자산</span>
                      <span className="text-xs text-[#757682] font-medium">({displayAssets.length}건)</span>
                    </div>
                    <p className="font-dohyeon text-lg text-[#006c49] mt-0.5">
                      {formatKRW(totalAsset)}
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-[#f0f2f5] flex items-center justify-center text-[#757682] shrink-0">
                  <span className="material-symbols-outlined text-xl">
                    {isAssetListExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
              </div>
            </div>

            {/* 부채 요약 카드 */}
            <div
              onClick={() => setIsDebtListExpanded(!isDebtListExpanded)}
              className={`bg-white rounded-2xl p-4.5 border transition-all cursor-pointer shadow-xs ${
                isDebtListExpanded ? 'border-[#ba1a1a] ring-1 ring-[#ba1a1a]/20' : 'border-[#c5c5d3]/30 hover:border-[#ba1a1a]/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#ba1a1a]/10 text-[#ba1a1a] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-xl">account_balance</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-dohyeon text-base text-[#191c1e]">부채</span>
                      <span className="text-xs text-[#757682] font-medium">({displayDebts.length}건)</span>
                    </div>
                    <p className="font-dohyeon text-lg text-[#ba1a1a] mt-0.5">
                      {formatKRW(totalDebt)}
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-[#f0f2f5] flex items-center justify-center text-[#757682] shrink-0">
                  <span className="material-symbols-outlined text-xl">
                    {isDebtListExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Asset Details Section (자산 카드 펼침) */}
          {isAssetListExpanded && (
            <div className="space-y-3 pt-1 border-t border-[#c5c5d3]/20 animate-fadeIn">
              {/* Portfolio Allocation Bar */}
              <section className="bg-white rounded-2xl p-5 shadow-xs border border-[#c5c5d3]/20 space-y-3">
                <h3 className="font-label-md text-xs text-[#757682]">자산 포트폴리오 비중</h3>
                <div className="h-6 w-full flex rounded-full overflow-hidden">
                  <div className="h-full bg-[#00236f] transition-all" style={{ width: `${realEstatePct}%` }} />
                  <div className="h-full bg-[#006c49] transition-all" style={{ width: `${financialPct}%` }} />
                  <div className="h-full bg-[#d97706] transition-all" style={{ width: `${otherPct}%` }} />
                </div>
                <div className="flex justify-between text-[11px] font-bold text-[#191c1e]">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-[#00236f]" />
                    부동산 {realEstatePct}% ({formatKRW(realEstateTotal)})
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-[#006c49]" />
                    금융 {financialPct}% ({formatKRW(financialTotal)})
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-[#d97706]" />
                    기타 {otherPct}% ({formatKRW(otherTotal)})
                  </div>
                </div>
              </section>

              {/* Asset List */}
              <section className="space-y-3">
                <h3 className="font-dohyeon text-base text-[#00236f] px-1 flex items-center justify-between">
                  자산 상세 목록
                  <span className="text-xs font-normal text-[#757682]">{displayAssets.length}건</span>
                </h3>

                {displayAssets.length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 text-center text-[#757682] text-sm border border-[#c5c5d3]/20">
                    등록된 자산이 없습니다.
                  </div>
                ) : (
                  displayAssets.map((asset) => {
                    const assetIcon = getAssetTypeIcon(asset.assetType, asset.assetName);
                    const isRE = isRealEstateCat(asset.assetType);
                    const isFin = isFinancialCat(asset.assetType);

                    const theme = isRE
                      ? {
                          iconBg: 'bg-[#00236f]/10',
                          iconText: 'text-[#00236f]',
                          badgeBg: 'bg-[#00236f]/10 border border-[#00236f]/20',
                          badgeText: 'text-[#00236f]',
                        }
                      : isFin
                      ? {
                          iconBg: 'bg-[#006c49]/10',
                          iconText: 'text-[#006c49]',
                          badgeBg: 'bg-[#006c49]/10 border border-[#006c49]/20',
                          badgeText: 'text-[#006c49]',
                        }
                      : {
                          iconBg: 'bg-[#d97706]/10',
                          iconText: 'text-[#d97706]',
                          badgeBg: 'bg-[#d97706]/10 border border-[#d97706]/20',
                          badgeText: 'text-[#d97706]',
                        };

                    return (
                      <div
                        key={asset.id}
                        className="bg-white rounded-2xl p-4 shadow-xs border border-[#c5c5d3]/20 space-y-3 hover:border-[#00236f]/30 transition-all"
                      >
                        <div
                          onClick={() =>
                            setExpandedAssetId(expandedAssetId === asset.id ? null : asset.id)
                          }
                          className="flex justify-between items-center cursor-pointer gap-2"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-xl ${theme.iconBg} ${theme.iconText} flex items-center justify-center shrink-0`}>
                              <span className="material-symbols-outlined text-xl">{assetIcon}</span>
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-body-lg text-sm font-bold text-[#191c1e] truncate">
                                {asset.assetName}
                              </h4>
                              <span className={`text-[11px] font-bold ${theme.badgeBg} ${theme.badgeText} px-2 py-0.5 rounded mt-0.5 inline-block`}>
                                {asset.assetType}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-dohyeon text-base text-[#00236f]">
                              {formatKRW(asset.currentValue)}
                            </p>
                            {asset.memo && <p className="text-xs text-[#757682] truncate max-w-[140px]">{asset.memo}</p>}
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
                              <span className="font-dohyeon text-[#00236f]">
                                {formatKRW(asset.currentValue)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </section>
            </div>
          )}

          {/* 4. Debt Details Section (부채 카드 펼침) */}
          {isDebtListExpanded && (
            <div className="space-y-3 pt-1 border-t border-[#c5c5d3]/20 animate-fadeIn">
              <section className="space-y-3">
                <h3 className="font-dohyeon text-base text-[#ba1a1a] px-1 flex items-center justify-between">
                  부채 상세 목록
                  <span className="text-xs font-normal text-[#757682]">{displayDebts.length}건</span>
                </h3>

                {displayDebts.length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 text-center text-[#757682] text-sm border border-[#c5c5d3]/20">
                    등록된 부채가 없습니다.
                  </div>
                ) : (
                  displayDebts.map((debt) => {
                    const debtIcon = getDebtTypeIcon(debt.debtType, debt.lender, debt.debtName);
                    return (
                      <div
                        key={debt.id}
                        className="bg-white rounded-2xl p-4 shadow-xs border border-[#c5c5d3]/20 space-y-3 hover:border-[#ba1a1a]/30 transition-all"
                      >
                        <div
                          onClick={() =>
                            setExpandedDebtId(expandedDebtId === debt.id ? null : debt.id)
                          }
                          className="flex justify-between items-center cursor-pointer gap-2"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-[#ba1a1a]/10 text-[#ba1a1a] flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-xl">{debtIcon}</span>
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-body-lg text-sm font-bold text-[#191c1e] truncate">
                                {debt.debtName}
                              </h4>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-[11px] text-[#ba1a1a] font-bold bg-[#ffdad6]/50 px-2 py-0.5 rounded">
                                  {debt.debtType}
                                </span>
                                <span className="text-xs text-[#757682] font-medium truncate">{debt.lender}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-dohyeon text-base text-[#ba1a1a]">
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
                              <span className="font-dohyeon text-[#ba1a1a]">
                                {formatKRW(debt.currentBalance)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#757682]">예정 원금</span>
                              <span className="font-dohyeon text-[#00236f]">
                                {formatKRW(debt.scheduledPrincipal)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#757682]">예상 이자</span>
                              <span className="font-dohyeon text-[#ba1a1a]">
                                {debt.hasRate ? formatKRW(debt.estimatedInterest) : '금리 미등록'}
                              </span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-gray-100 font-bold">
                              <span className="text-[#191c1e]">월 예상 상환액 (원금+이자)</span>
                              <span className="font-dohyeon text-[#ba1a1a]">
                                {formatKRW(debt.monthlyPayment)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </section>
            </div>
          )}
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
