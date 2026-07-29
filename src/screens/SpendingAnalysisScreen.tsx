import React, { useState, useEffect } from 'react';
import { GlobalMockDataStore, ConsumerSpendingSummary } from '../services/dataStore';
import { getCategoryGroup } from '../data/consumerCategories';
import { ActiveSessionBanner } from '../components/ActiveSessionBanner';

export const SpendingAnalysisScreen: React.FC = () => {
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

  const totalExpense = summary.totalExpense;
  const categoryData = summary.categoryBreakdown.map((cat) => {
    const group = getCategoryGroup(cat.category);
    return {
      name: cat.category,
      amount: cat.amount,
      percentage: cat.percentage,
      count: cat.count,
      color: group.color,
      icon: group.icon,
    };
  });

  const topCategory = categoryData[0] || null;
  const top5Merchants = summary.top5Merchants;

  // 3. AI Comment & Benchmark Analysis
  let aiComment = '분석할 지출 데이터가 충분하지 않습니다. CSV 내역을 업로드해주세요.';
  let benchmarkMsg = '이번 달 지출 패턴이 조화롭게 유지되고 있습니다.';

  if (topCategory && totalExpense > 0) {
    if (topCategory.percentage > 40) {
      aiComment = `이번 세션 지출 중 ${topCategory.name} 비중이 ${topCategory.percentage}%로 가장 높습니다.`;
      benchmarkMsg = `${topCategory.name} 항목이 전체 지출의 큰 비중을 차지하고 있어 해당 항목 관리가 절약의 핵심입니다.`;
    } else if (top5Merchants.length > 0) {
      aiComment = `가장 결제 금액이 큰 상호는 '${top5Merchants[0].merchant}' (${top5Merchants[0].totalAmount.toLocaleString()}원) 입니다.`;
      benchmarkMsg = `상위 5개 주요 거래처 지출을 모니터링하면 합리적인 소비 통제가 가능합니다.`;
    } else {
      aiComment = `전체 ${categoryData.length}개 카테고리에 총 ${totalExpense.toLocaleString()}원이 지출되었습니다.`;
    }
  }

  // Calculate conic gradient stops for visual chart
  let cumulative = 0;
  const gradientStops = categoryData.map((cat) => {
    const start = cumulative;
    const end = cumulative + cat.percentage;
    cumulative = end;
    return `${cat.color} ${start}% ${end}%`;
  });
  const conicStyle =
    gradientStops.length > 0
      ? `conic-gradient(${gradientStops.join(', ')})`
      : 'conic-gradient(#e0e3e5 0% 100%)';

  return (
    <div className="space-y-6 pb-28">
      {/* Active Session Info Banner (Requirement 3) */}
      <ActiveSessionBanner showActions={true} />

      {/* AI One-line Analysis Card */}
      <section className="relative overflow-hidden bg-[#00236f] text-white p-5 rounded-2xl shadow-md">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-[#6ffbbe] text-2xl shrink-0">
            auto_awesome
          </span>
          <div>
            <p className="font-body-md text-sm leading-relaxed font-medium">
              {aiComment}
            </p>
            <p className="text-xs text-[#6ffbbe] font-bold mt-1">
              💡 {benchmarkMsg}
            </p>
          </div>
        </div>
      </section>

      {/* Category Donut Chart Section */}
      <section className="bg-white p-6 rounded-2xl shadow-xs border border-[#c5c5d3]/20 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="font-dohyeon text-lg text-[#00236f]">카테고리별 소비 비율</h2>
          <span className="text-xs font-bold text-[#00236f] bg-[#f0f4fd] px-2.5 py-1 rounded-md">
            소비 포함 {summary.totalCount}건
          </span>
        </div>

        {totalExpense === 0 ? (
          <div className="text-center py-10 text-[#757682]">
            <span className="material-symbols-outlined text-4xl mb-2 text-[#c5c5d3]">pie_chart</span>
            <p className="text-sm font-medium">분석할 소비지출 데이터가 없습니다.</p>
            <p className="text-xs text-[#757682] mt-1">
              제외 처리되거나 확인 필요 상태인 거래는 소비 비율 계산에서 제외됩니다.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            {/* Conic Gradient Donut */}
            <div className="relative w-48 h-48 flex items-center justify-center">
              <div
                className="w-full h-full rounded-full shadow-inner transition-all duration-500"
                style={{ background: conicStyle }}
              />
              {/* Center cutout */}
              <div className="absolute w-28 h-28 bg-[#f7f9fb] rounded-full flex flex-col items-center justify-center shadow-xs">
                <span className="font-label-md text-[10px] text-[#757682]">총 소비지출</span>
                <span className="font-dohyeon text-base text-[#00236f]">
                  {totalExpense.toLocaleString()}원
                </span>
              </div>
            </div>

            {/* Category Legend List */}
            <div className="w-full space-y-3">
              {categoryData.map((cat) => (
                <div key={cat.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-body-sm text-xs text-[#191c1e] font-semibold">
                      {cat.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-dohyeon text-base text-[#00236f] mr-2">
                      {cat.percentage}%
                    </span>
                    <span className="font-label-md text-xs text-[#757682]">
                      {cat.amount.toLocaleString()}원 ({cat.count}건)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* TOP 5 Most Spent Merchants */}
      <section className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h2 className="font-dohyeon text-lg text-[#00236f] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006c49]">trending_up</span>
            가장 많이 결제한 상호 TOP 5
          </h2>
          <span className="text-[11px] text-[#757682]">개인 송금 및 이체 제외</span>
        </div>

        {top5Merchants.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl text-center text-[#757682] text-sm border border-[#c5c5d3]/20">
            소비 결제 상호 내역이 없습니다. (개인간 이체 및 제외 항목은 TOP 5에서 제외됩니다.)
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {top5Merchants.map((item, idx) => {
              return (
                <div
                  key={item.merchant}
                  className="bg-white p-4 rounded-2xl shadow-xs flex items-center justify-between border border-[#c5c5d3]/20 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-7 h-7 rounded-full bg-[#00236f]/10 text-[#00236f] font-dohyeon text-sm flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#191c1e]">{item.merchant}</h3>
                      <p className="text-[11px] text-[#757682] mt-0.5">
                        <span className="px-1.5 py-0.5 bg-[#f0f4fd] text-[#00236f] rounded font-semibold text-[10px] mr-1">
                          소비 상호
                        </span>
                        · {item.count}회 결제
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-dohyeon text-base text-[#00236f]">
                      {item.totalAmount.toLocaleString()}원
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
