import React, { useState, useEffect } from 'react';
import { ScreenId, Asset, Debt } from '../types';
import { GlobalMockDataStore } from '../services/dataStore';

interface AssetsDebtsScreenProps {
  onNavigate: (screen: ScreenId) => void;
  assets: Asset[];
  debts: Debt[];
}

export const AssetsDebtsScreen: React.FC<AssetsDebtsScreenProps> = ({
  onNavigate,
}) => {
  const [data, setData] = useState(() => GlobalMockDataStore.getData());
  const [activeTab, setActiveTab] = useState<'all' | 'asset' | 'debt'>('all');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>('asset-1');
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>('debt-1');

  useEffect(() => {
    return GlobalMockDataStore.subscribe((newData) => {
      setData(newData);
    });
  }, []);

  const assetSummary = GlobalMockDataStore.getTotalAssetsSummary();
  const totalDebt = GlobalMockDataStore.getTotalDebtsSummary();
  const totalAsset = assetSummary.total;
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

  const realEstatePct = totalAsset > 0 ? Math.round((assetSummary.realEstateTotal / totalAsset) * 100) : 0;
  const financialPct = totalAsset > 0 ? Math.round((assetSummary.financialTotal / totalAsset) * 100) : 0;
  const otherPct = Math.max(0, 100 - realEstatePct - financialPct);

  return (
    <div className="space-y-6 pb-28">
      {/* 1. Net Worth Summary Card */}
      <section className="bg-[#f2f4f6] rounded-3xl p-5 shadow-[0_4px_12px_rgba(0,35,111,0.05)] border border-white/60 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <span className="font-label-md text-xs text-[#757682] mb-1 block">순자산</span>
            <h2 className="font-dohyeon text-2xl text-[#00236f] font-bold">
              {formatKRW(netWorth)}
            </h2>
          </div>
          <div className="bg-[#6cf8bb] text-[#00714d] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-xs">
            <span className="material-symbols-outlined text-sm">account_balance</span>
            {data.userInfo.householdName || '자산 현황'}
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
            <span className="font-bold text-[#191c1e]">{formatKRW(assetSummary.financialTotal)}</span>
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
            자산
          </button>
          <button
            onClick={() => setActiveTab('debt')}
            className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all ${
              activeTab === 'debt'
                ? 'bg-white text-[#00236f] shadow-xs'
                : 'text-[#757682]'
            }`}
          >
            부채
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {['부동산', '금융자산', '사업자산', '대출', '기타'].map((cat) => (
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

        <div className="bg-[#f2f4f6] rounded-xl p-3 flex gap-2.5 items-start mt-2">
          <div className="bg-[#1e3a8a] p-1 rounded-lg text-[#90a8ff] shrink-0">
            <span className="material-symbols-outlined text-sm">smart_toy</span>
          </div>
          <p className="text-xs text-[#444651] leading-relaxed">
            자산 대부분이 부동산에 집중되어 있어{' '}
            <span className="font-bold text-[#00236f]">가용현금</span>도 함께 관리할 필요가 있습니다.
          </p>
        </div>
      </section>

      {/* 4. Asset List */}
      {(activeTab === 'all' || activeTab === 'asset') && (
        <section className="space-y-3">
          <h3 className="font-dohyeon text-lg text-[#00236f] flex items-center justify-between px-1">
            자산 목록{' '}
            <span className="text-xs font-normal text-[#757682]">
              {data.assets.onboardingAssets.length}건
            </span>
          </h3>

          {data.assets.onboardingAssets.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center text-[#757682] text-sm border border-[#c5c5d3]/20">
              등록된 자산이 없습니다. (최초설정에서 추가해보세요)
            </div>
          ) : (
            data.assets.onboardingAssets.map((asset) => (
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
                    <h4 className="font-body-lg text-base font-bold text-[#191c1e]">
                      [{asset.assetName}]
                    </h4>
                    <span className="text-[11px] text-[#006c49] font-bold bg-[#6cf8bb]/30 px-2 py-0.5 rounded mt-1 inline-block">
                      {asset.assetType}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-base text-[#00236f]">
                      {formatKRW(Number(asset.currentValue) || 0)}
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
                      <span className="text-[#757682]">평가 금액</span>
                      <span className="font-bold text-[#00236f]">
                        {formatKRW(Number(asset.currentValue) || 0)}
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
              {data.debts.onboardingDebts.length}건
            </span>
          </h3>

          {data.debts.onboardingDebts.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center text-[#757682] text-sm border border-[#c5c5d3]/20">
              등록된 부채가 없습니다.
            </div>
          ) : (
            data.debts.onboardingDebts.map((debt) => (
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
                    <h4 className="font-body-lg text-base font-bold text-[#191c1e]">
                      [{debt.debtName}]
                    </h4>
                    <div className="flex gap-1.5 mt-1">
                      <span className="text-[10px] text-[#00236f] font-bold bg-[#1e3a8a]/10 px-2 py-0.5 rounded">
                        {debt.debtType || '대출'}
                      </span>
                      {debt.lender && (
                        <span className="text-[10px] text-[#444651] font-bold bg-[#e6e8ea] px-2 py-0.5 rounded">
                          {debt.lender}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-base text-[#ba1a1a]">
                      {formatKRW(Number(debt.currentBalance) || 0)}
                    </p>
                    <p className="text-xs font-bold text-[#006c49]">
                      금리 {debt.interestRate ?? 0}%
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-end pt-2 border-t border-dashed border-[#c5c5d3]/40">
                  <div className="bg-[#ffdad6]/20 px-3 py-1.5 rounded-lg">
                    <span className="text-[10px] text-[#757682] block">월 상환액</span>
                    <p className="font-bold text-sm text-[#ba1a1a]">
                      {formatKRW(Number(debt.monthlyPayment) || 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#00236f] text-sm">
                      {debt.paymentDay || '매월 정산'}
                    </span>
                  </div>
                </div>
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
          className="w-full py-3.5 bg-[#6cf8bb] text-[#00714d] rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-sm"
        >
          <span className="material-symbols-outlined text-base">event_note</span>
          올해 금융자산 목표 설정하기
        </button>
      </section>
    </div>
  );
};
