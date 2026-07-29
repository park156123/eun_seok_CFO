import React, { useState, useEffect } from 'react';
import { GlobalMockDataStore } from '../services/dataStore';

export const CashflowScreen: React.FC = () => {
  const [data, setData] = useState(() => GlobalMockDataStore.getData());
  const [targetMonthStr, setTargetMonthStr] = useState('2026년 6월');

  useEffect(() => {
    return GlobalMockDataStore.subscribe((newData) => {
      setData(newData);
    });
  }, []);

  // Parse target year & month
  const parseYearMonth = (str: string) => {
    const match = str.match(/(\d+)년\s*(\d+)월/);
    if (match) {
      return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) };
    }
    return { year: 2026, month: 6 };
  };

  const { year, month } = parseYearMonth(targetMonthStr);
  const cashflow = GlobalMockDataStore.getMonthlyCashflowSummary(year, month);

  const totalInflow = cashflow.totalInflow;
  const totalOutflow = cashflow.totalOutflow;
  const netFlow = cashflow.netCashflow;
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
      {/* Month Selector Bar */}
      <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-[#c5c5d3]/20 shadow-xs">
        <span className="font-bold text-sm text-[#00236f] flex items-center gap-1.5">
          <span className="material-symbols-outlined text-lg">calendar_month</span>
          기준 월
        </span>
        <div className="flex items-center gap-2">
          {['2026년 6월', '2026년 7월', '2026년 8월'].map((m) => (
            <button
              key={m}
              onClick={() => setTargetMonthStr(m)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                targetMonthStr === m
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-[#e6e8ea] text-[#444651] hover:bg-[#d8dadc]'
              }`}
            >
              {m.replace('2026년 ', '')}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Summary Overview Header */}
      <section className="bg-white rounded-3xl p-6 shadow-xs border border-[#c5c5d3]/20 space-y-4">
        <span className="font-label-md text-xs text-[#757682]">
          {targetMonthStr} 순현금흐름 (NET FLOW)
        </span>
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
          유입 상세 ({cashflow.inflowDetails.length}건)
        </h3>

        <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#c5c5d3]/20 space-y-3">
          {cashflow.inflowDetails.length === 0 ? (
            <p className="text-center text-[#757682] text-xs py-2">
              등록된 수입원이 없습니다. (0원)
            </p>
          ) : (
            cashflow.inflowDetails.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center text-sm py-1 border-b border-[#c5c5d3]/10 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006c49] text-base">
                    payments
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#191c1e] block">{item.name}</span>
                      {item.isActual && (
                        <span className="text-[9px] bg-[#6cf8bb]/40 text-[#00714d] px-1.5 py-0.2 rounded font-bold">
                          확정
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#757682]">{item.type}</span>
                  </div>
                </div>
                <span className="font-bold text-[#006c49]">
                  +{(Number(item.amount) || 0).toLocaleString()}원
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
          유출 상세 ({cashflow.outflowDetails.length}건)
        </h3>

        <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#c5c5d3]/20 space-y-3">
          {cashflow.outflowDetails.length === 0 ? (
            <p className="text-center text-[#757682] text-xs py-2">
              등록된 지출 내역이 없습니다. (0원)
            </p>
          ) : (
            cashflow.outflowDetails.map((exp) => (
              <div
                key={exp.id}
                className="flex justify-between items-center text-sm py-1 border-b border-[#c5c5d3]/10 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#ba1a1a] text-base">
                    {exp.id === 'interest' ? 'percent' : exp.id === 'principal' ? 'account_balance' : 'shopping_cart'}
                  </span>
                  <div>
                    <span className="font-bold text-[#191c1e] block">{exp.name}</span>
                    <span className="text-[10px] text-[#757682]">{exp.category}</span>
                  </div>
                </div>
                <span className="font-bold text-[#ba1a1a]">
                  -{(Number(exp.amount) || 0).toLocaleString()}원
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
          <span className="font-bold">SSOT 원칙:</span> 월간결산 및 기본정보관리의 동일한 실시간 데이터 소스를 참조하여 순현금흐름이 자동 산출됩니다.
        </p>
      </div>
    </div>
  );
};
