import React, { useState, useEffect } from 'react';
import { ScreenId } from '../types';
import { useSelectedMonth } from '../context/SelectedMonthContext';
import { MonthSelector } from '../components/MonthSelector';
import { getMonthlyRecordForMonth, getTransactionsForMonth } from '../utils/monthDataSelectors';

interface AIBriefingScreenProps {
  onNavigate: (screen: ScreenId) => void;
}

export const AIBriefingScreen: React.FC<AIBriefingScreenProps> = ({ onNavigate }) => {
  const { selectedMonth, setSelectedMonth, formattedSelectedMonth } = useSelectedMonth();

  const [briefing, setBriefing] = useState<{
    summary: string;
    goodPoint: string;
    warningPoint: string;
    actionItem: string;
  } | null>(null);

  useEffect(() => {
    const record = getMonthlyRecordForMonth(selectedMonth);
    const txs = getTransactionsForMonth(selectedMonth);

    if (record && (record.status === '완료' || record.status === '결산잠금' || txs.length > 0)) {
      setBriefing({
        summary: `${formattedSelectedMonth} 리포트: 총 수입과 지출 구조가 집계되었습니다.`,
        goodPoint: `${formattedSelectedMonth} 생활비 및 소비 지출이 분석 범주 내에서 투명하게 관리되었습니다.`,
        warningPoint: `다음 달 예상되는 고정비 및 금융비용 이체 일정을 사전에 점검하세요.`,
        actionItem: `가계부 지출 항목 분석 결과를 토대로 다음 달 자금 배분 계획을 수립하세요.`,
      });
    } else {
      setBriefing(null);
    }
  }, [selectedMonth, formattedSelectedMonth]);

  return (
    <div className="space-y-5 pb-28">
      {/* 0. Top Header Bar with Month Selector */}
      <section className="bg-white p-4 rounded-2xl border border-[#c5c5d3]/30 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="font-dohyeon text-lg text-[#00236f]">
            {formattedSelectedMonth} AI 월간리포트
          </h1>
          <p className="text-xs text-[#757682] mt-0.5 font-medium">
            AI 스마트 CFO의 결산 종합 분석
          </p>
        </div>
        <MonthSelector
          selectedMonth={selectedMonth}
          onChangeMonth={setSelectedMonth}
        />
      </section>

      {briefing ? (
        <>
          {/* CFO Insight Hero Card */}
          <section className="relative overflow-hidden rounded-2xl bg-[#1e3a8a] p-6 text-white shadow-md">
            <div className="flex items-start gap-4">
              <div className="bg-white/10 p-3 rounded-2xl flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-3xl text-white"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  smart_toy
                </span>
              </div>
              <div>
                <h2 className="font-dohyeon text-lg text-white/80 mb-1">
                  {formattedSelectedMonth} CFO 통찰
                </h2>
                <p className="font-body-lg text-lg text-white leading-snug font-medium">
                  {briefing.summary}
                </p>
              </div>
            </div>
            <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/5 rounded-full blur-xl pointer-events-none" />
          </section>

          {/* 3 Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#c5c5d3]/20 space-y-2">
              <div className="flex items-center gap-2 text-[#006c49]">
                <span className="material-symbols-outlined text-xl">thumb_up</span>
                <h3 className="font-dohyeon text-sm">잘한 점</h3>
              </div>
              <p className="text-xs text-[#444651] leading-relaxed">
                {briefing.goodPoint}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#c5c5d3]/20 space-y-2">
              <div className="flex items-center gap-2 text-[#c2410c]">
                <span className="material-symbols-outlined text-xl">warning</span>
                <h3 className="font-dohyeon text-sm">주의할 점</h3>
              </div>
              <p className="text-xs text-[#444651] leading-relaxed">
                {briefing.warningPoint}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#c5c5d3]/20 space-y-2">
              <div className="flex items-center gap-2 text-[#00236f]">
                <span className="material-symbols-outlined text-xl">task</span>
                <h3 className="font-dohyeon text-sm">실천 과제</h3>
              </div>
              <p className="text-xs text-[#444651] leading-relaxed">
                {briefing.actionItem}
              </p>
            </div>
          </div>
        </>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-2xl p-8 text-center border border-[#c5c5d3]/20 shadow-xs space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#00236f]/10 text-[#00236f] flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">auto_awesome</span>
          </div>
          <div className="space-y-1">
            <h3 className="font-dohyeon text-base text-[#191c1e]">
              {formattedSelectedMonth} AI 월간리포트가 아직 생성되지 않았어요
            </h3>
            <p className="text-xs text-[#757682] max-w-sm mx-auto leading-relaxed">
              월간결산을 진행하거나 {formattedSelectedMonth} CSV 거래 내역을 등록하면 확정 수입·지출 데이터를 바탕으로 맞춤형 AI 재정 리포트가 생성됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('2-3')}
            className="px-5 py-2.5 bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs font-dohyeon rounded-xl transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">calendar_month</span>
            {formattedSelectedMonth} 결산 진행하기
          </button>
        </div>
      )}
    </div>
  );
};
