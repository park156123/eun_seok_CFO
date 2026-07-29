import React, { useState, useEffect } from 'react';
import { GlobalMockDataStore } from '../services/dataStore';

export const CashflowScreen: React.FC = () => {
  const [data, setData] = useState(() => GlobalMockDataStore.getData());

  useEffect(() => {
    return GlobalMockDataStore.subscribe((newData) => {
      setData(newData);
    });
  }, []);

  // Compute inflow from GlobalMockDataStore income sources
  const incomeSources = data.monthlyIncome.incomeSources || [];
  const totalInflow = incomeSources.reduce(
    (sum, inc) => sum + (Number(inc.monthlyIncome) || 0),
    0
  );

  // Compute fixed outflow from fixed expenses
  const fixedExpenses = data.fixedExpenses || [];
  const totalOutflow = fixedExpenses.reduce(
    (sum, exp) => sum + (Number(exp.monthlyAmount) || 0),
    0
  );

  const netFlow = totalInflow - totalOutflow;
  const outflowRatio =
    totalInflow > 0 ? Math.min(100, Math.round((totalOutflow / totalInflow) * 100)) : 0;

  const financialTotal = GlobalMockDataStore.getTotalAssetsSummary().financialTotal;

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

  return (
    <div className="space-y-6 pb-28">
      {/* 1. Summary Overview Header */}
      <section className="bg-white rounded-3xl p-6 shadow-xs border border-[#c5c5d3]/20 space-y-4">
        <span className="font-label-md text-xs text-[#757682]">순현금흐름 (NET FLOW)</span>
        <h2
          className={`font-dohyeon text-3xl font-bold ${
            netFlow >= 0 ? 'text-[#006c49]' : 'text-[#ba1a1a]'
          }`}
        >
          {netFlow >= 0 ? `+${netFlow.toLocaleString()}원` : `${netFlow.toLocaleString()}원`}
        </h2>

        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#c5c5d3]/30 text-center">
          <div className="p-2 bg-[#6cf8bb]/20 rounded-xl">
            <span className="text-[10px] text-[#757682] block">총 유입</span>
            <span className="font-bold text-xs text-[#006c49]">
              +{formatKRW(totalInflow)}
            </span>
          </div>
          <div className="p-2 bg-[#ffdad6]/30 rounded-xl">
            <span className="text-[10px] text-[#757682] block">총 유출</span>
            <span className="font-bold text-xs text-[#ba1a1a]">
              -{formatKRW(totalOutflow)}
            </span>
          </div>
          <div className="p-2 bg-[#dce1ff]/40 rounded-xl">
            <span className="text-[10px] text-[#757682] block">금융자산</span>
            <span className="font-bold text-xs text-[#00236f]">{formatKRW(financialTotal)}</span>
          </div>
        </div>
      </section>

      {/* 2. Visual Bar Comparison Chart */}
      <section className="bg-white rounded-2xl p-5 shadow-xs border border-[#c5c5d3]/20 space-y-4">
        <h3 className="font-dohyeon text-base text-[#00236f]">유입 vs 유출 비교</h3>

        <div className="space-y-3 pt-2">
          {/* Inflow Bar */}
          <div>
            <div className="flex justify-between text-xs font-bold mb-1">
              <span className="text-[#006c49]">
                총 유입 (+{formatKRW(totalInflow)})
              </span>
              <span className="text-[#006c49]">{totalInflow > 0 ? '100%' : '0%'}</span>
            </div>
            <div className="w-full bg-[#e6e8ea] h-4 rounded-full overflow-hidden">
              <div
                className="bg-[#006c49] h-full rounded-full transition-all"
                style={{ width: totalInflow > 0 ? '100%' : '0%' }}
              />
            </div>
          </div>

          {/* Outflow Bar */}
          <div>
            <div className="flex justify-between text-xs font-bold mb-1">
              <span className="text-[#ba1a1a]">
                총 유출 (-{formatKRW(totalOutflow)})
              </span>
              <span className="text-[#ba1a1a]">{outflowRatio}%</span>
            </div>
            <div className="w-full bg-[#e6e8ea] h-4 rounded-full overflow-hidden">
              <div
                className="bg-[#ba1a1a] h-full rounded-full transition-all"
                style={{ width: `${outflowRatio}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Inflow Breakdown */}
      <section className="space-y-3">
        <h3 className="font-dohyeon text-base text-[#006c49] flex items-center gap-2 px-1">
          <span className="material-symbols-outlined text-lg">arrow_downward</span>
          유입 상세 ({incomeSources.length}건)
        </h3>

        <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#c5c5d3]/20 space-y-3">
          {incomeSources.length === 0 ? (
            <p className="text-center text-[#757682] text-xs py-2">
              등록된 수입원이 없습니다. (0원)
            </p>
          ) : (
            incomeSources.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center text-sm py-1 border-b border-[#c5c5d3]/10 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006c49] text-base">
                    payments
                  </span>
                  <div>
                    <span className="font-bold text-[#191c1e] block">{item.incomeName}</span>
                    <span className="text-[10px] text-[#757682]">{item.incomeType}</span>
                  </div>
                </div>
                <span className="font-bold text-[#006c49]">
                  +{(Number(item.monthlyIncome) || 0).toLocaleString()}원
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 4. Outflow Breakdown */}
      <section className="space-y-3">
        <h3 className="font-dohyeon text-base text-[#ba1a1a] flex items-center gap-2 px-1">
          <span className="material-symbols-outlined text-lg">arrow_upward</span>
          유출 상세 ({fixedExpenses.length}건)
        </h3>

        <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#c5c5d3]/20 space-y-3">
          {fixedExpenses.length === 0 ? (
            <p className="text-center text-[#757682] text-xs py-2">
              등록된 고정지출이 없습니다. (0원)
            </p>
          ) : (
            fixedExpenses.map((exp) => (
              <div
                key={exp.id}
                className="flex justify-between items-center text-sm py-1 border-b border-[#c5c5d3]/10 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#ba1a1a] text-base">
                    shopping_cart
                  </span>
                  <div>
                    <span className="font-bold text-[#191c1e] block">{exp.name}</span>
                    <span className="text-[10px] text-[#757682]">
                      {exp.category} ({exp.paymentDay || '매월'})
                    </span>
                  </div>
                </div>
                <span className="font-bold text-[#ba1a1a]">
                  -{(Number(exp.monthlyAmount) || 0).toLocaleString()}원
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 5. CFO Rule Note */}
      <div className="bg-[#6cf8bb]/20 border border-[#6cf8bb]/40 p-4 rounded-2xl flex items-start gap-3">
        <span className="material-symbols-outlined text-[#00714d] text-xl shrink-0">info</span>
        <p className="text-xs text-[#00714d] leading-relaxed">
          <span className="font-bold">원칙 알림:</span> 최초설정에서 등록한 월수입과 고정지출이 순현금흐름에 정확하게 수치화되어 실시간 반영됩니다.
        </p>
      </div>
    </div>
  );
};

