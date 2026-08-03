import React, { useState, useEffect } from 'react';
import { ScreenId, Transaction, ScheduleEvent, SettlementData } from '../types';
import { GlobalMockDataStore } from '../services/dataStore';
import { useSelectedMonth } from '../context/SelectedMonthContext';
import { MonthSelector } from '../components/MonthSelector';
import { getMonthlySettlementSummary, getMonthlyRecordForMonth } from '../utils/monthDataSelectors';
import { formatWonToManwon, formatKoreanAmountFromWon } from '../utils/amountUtils';

// Helper: keyword-based icon mapping for major monthly changes (specialNotes)
function getIconForNote(text: string): { icon: string; bgClass: string; textClass: string } {
  if (/임대|현하우스|계약/.test(text)) {
    return { icon: 'home', bgClass: 'bg-[#00236f]/10', textClass: 'text-[#00236f]' };
  }
  if (/입사|원장|매출|사업/.test(text)) {
    return { icon: 'person', bgClass: 'bg-[#006c49]/10', textClass: 'text-[#006c49]' };
  }
  if (/원금|상환|부채|대출/.test(text)) {
    return { icon: 'account_balance', bgClass: 'bg-[#4a58a9]/10', textClass: 'text-[#4a58a9]' };
  }
  return { icon: 'edit_note', bgClass: 'bg-[#757682]/10', textClass: 'text-[#444651]' };
}

interface HomeScreenProps {
  onNavigate: (screen: ScreenId) => void;
  transactions?: Transaction[];
  schedules?: ScheduleEvent[];
  netCashflow?: number;
  totalSpending?: number;
  settlementData?: SettlementData;
  onToggleDataState?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  schedules: propSchedules,
}) => {
  const { selectedMonth, setSelectedMonth, formattedSelectedMonth } = useSelectedMonth();
  const [storeData, setStoreData] = useState(() => GlobalMockDataStore.getData());

  useEffect(() => {
    return GlobalMockDataStore.subscribe((newData) => {
      setStoreData(newData);
    });
  }, []);

  const rawSchedules = storeData.otherSettings?.schedules || propSchedules || [];

  // Core selector for settlement summary
  const summary = getMonthlySettlementSummary(selectedMonth);

  // Retrieve selected month's MonthlySettlementRecord
  const currentRecord = getMonthlyRecordForMonth(selectedMonth);

  // Retrieve specialNotes: read user written specialNotes directly from currentRecord (no seed or defaults)
  const rawSpecialNotes = currentRecord?.specialNotes ? currentRecord.specialNotes.trim() : '';

  // Split specialNotes by newline, filter empty, slice max 3
  const majorChanges: string[] = rawSpecialNotes
    ? rawSpecialNotes
        .split('\n')
        .map((s: string) => s.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  // Retrieve existing AI CFO Report summary directly from saved record
  const getSavedAiReportSummary = (): string | null => {
    if (!currentRecord) return null;

    const recAny = currentRecord as any;
    if (recAny.aiSummary && typeof recAny.aiSummary === 'string' && recAny.aiSummary.trim() !== '') {
      return recAny.aiSummary.trim();
    }
    if (recAny.aiReport?.summary && typeof recAny.aiReport.summary === 'string' && recAny.aiReport.summary.trim() !== '') {
      return recAny.aiReport.summary.trim();
    }
    if (recAny.aiReport?.oneLine && typeof recAny.aiReport.oneLine === 'string' && recAny.aiReport.oneLine.trim() !== '') {
      return recAny.aiReport.oneLine.trim();
    }

    // If report is completed/locked for this month, use the existing saved report's summary
    if (currentRecord.status === '결산잠금' || currentRecord.status === '완료') {
      return `${summary.formattedSelectedMonth || formattedSelectedMonth} 리포트: 총 수입과 지출 구조가 집계되었습니다.`;
    }

    return null;
  };

  const savedAiReportSummary = getSavedAiReportSummary();
  const hasAiReport = Boolean(savedAiReportSummary);
  const aiOneLineComment = savedAiReportSummary
    ? (savedAiReportSummary.length > 60 ? savedAiReportSummary.slice(0, 57) + '...' : savedAiReportSummary)
    : '';

  // Calculate upcoming schedules from real planner schedule source (today onwards, max 3)
  const getUpcomingSchedules = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return rawSchedules
      .map((sch) => {
        let schDate: Date | null = null;
        let dDayStr = sch.dDay || '';

        if (sch.date) {
          const cleanDateStr = sch.date.replace(/\./g, '-');
          const parts = cleanDateStr.split('-').map((p) => parseInt(p, 10));
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            const year = parts[0];
            const month = parts[1] - 1;
            const day = parts[2] && !isNaN(parts[2]) ? parts[2] : 1;
            schDate = new Date(year, month, day);
          }
        }

        let diffDays = 0;
        if (schDate) {
          const timeDiff = schDate.getTime() - today.getTime();
          diffDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
          if (!dDayStr) {
            if (diffDays === 0) dDayStr = 'D-Day';
            else if (diffDays > 0) dDayStr = `D-${diffDays}`;
            else dDayStr = `D+${Math.abs(diffDays)}`;
          }
        }

        const amountVal = sch.amount || sch.expectedPayment || 0;
        const formattedAmount = amountVal > 0 ? formatKoreanAmountFromWon(amountVal) : '';

        return {
          ...sch,
          schDate,
          diffDays,
          dDayStr: dDayStr || 'D-Day',
          formattedAmount,
        };
      })
      .filter((sch) => {
        if (sch.schDate) {
          return sch.diffDays >= 0;
        }
        return true;
      })
      .sort((a, b) => {
        if (!a.schDate && !b.schDate) return 0;
        if (!a.schDate) return 1;
        if (!b.schDate) return -1;
        return a.schDate.getTime() - b.schDate.getTime();
      })
      .slice(0, 3);
  };

  const upcomingSchedules = getUpcomingSchedules();

  // Status Badge UI
  const renderStatusBadge = () => {
    switch (summary.status) {
      case 'completed':
        return (
          <span className="bg-[#e6f4ed] text-[#006c49] border border-[#c3e9d5] font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5 shadow-2xs shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#006c49]"></span>
            결산 완료
          </span>
        );
      case 'in_progress':
        return (
          <span className="bg-[#f0f4fd] text-[#00236f] border border-[#d0e0fc] font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5 shadow-2xs shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#00236f]"></span>
            결산 작성 중
          </span>
        );
      case 'none':
      default:
        return (
          <span className="bg-[#f3f4f6] text-[#6b7280] border border-[#e5e7eb] font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5 shadow-2xs shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#9ca3af]"></span>
            결산 데이터 없음
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 pb-28">
      {/* 2. 선택월 및 결산 상태 영역 */}
      <section className="bg-white p-5 rounded-2xl border border-[#c5c5d3]/30 shadow-[0_4px_16px_rgba(0,35,111,0.06)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#eceef0]">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-dohyeon text-xl text-[#00236f]">
                {summary.formattedSelectedMonth}
              </h1>
              {renderStatusBadge()}
            </div>
            {summary.completedAtDisplay ? (
              <p className="text-xs text-[#757682] mt-1 font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">schedule</span>
                결산 확정일시: {summary.completedAtDisplay}
              </p>
            ) : (
              <p className="text-xs text-[#757682] mt-1 font-medium">
                선택월 결산 상태 및 핵심 요약 데이터
              </p>
            )}
          </div>

          <MonthSelector
            selectedMonth={selectedMonth}
            onChangeMonth={setSelectedMonth}
          />
        </div>

        {/* 3. 핵심 숫자 4개 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: 총수입 */}
          <div className="bg-[#f7f9fb] p-3.5 sm:p-4 rounded-xl border border-[#c5c5d3]/20 flex flex-col justify-between space-y-2 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#006c49]/10 text-[#006c49] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-lg">payments</span>
              </div>
              <span className="text-xs font-bold text-[#444651]">총수입</span>
            </div>
            <div className="min-w-0 overflow-hidden">
              {summary.hasData ? (
                <span className="font-dohyeon text-base sm:text-lg lg:text-xl text-[#006c49] block whitespace-nowrap tracking-tight">
                  +{formatWonToManwon(summary.totalIncome)}
                </span>
              ) : (
                <span className="text-xs text-[#757682] block font-medium">
                  아직 결산 데이터가 없습니다
                </span>
              )}
            </div>
          </div>

          {/* Card 2: 총현금유출 */}
          <div className="bg-[#f7f9fb] p-3.5 sm:p-4 rounded-xl border border-[#c5c5d3]/20 flex flex-col justify-between space-y-2 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#ba1a1a]/10 text-[#ba1a1a] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-lg">output</span>
              </div>
              <span className="text-xs font-bold text-[#444651]">총현금유출</span>
            </div>
            <div className="min-w-0 overflow-hidden">
              {summary.hasData ? (
                <span className="font-dohyeon text-base sm:text-lg lg:text-xl text-[#ba1a1a] block whitespace-nowrap tracking-tight">
                  {summary.totalOutflow > 0 ? `-${formatWonToManwon(summary.totalOutflow)}` : formatWonToManwon(0)}
                </span>
              ) : (
                <span className="text-xs text-[#757682] block font-medium">
                  아직 결산 데이터가 없습니다
                </span>
              )}
            </div>
          </div>

          {/* Card 3: 생활지출 */}
          <div className="bg-[#f7f9fb] p-3.5 sm:p-4 rounded-xl border border-[#c5c5d3]/20 flex flex-col justify-between space-y-2 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#00236f]/10 text-[#00236f] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-lg">shopping_cart</span>
              </div>
              <span className="text-xs font-bold text-[#444651]">생활지출</span>
            </div>
            <div className="min-w-0 overflow-hidden">
              {summary.hasData ? (
                <span className="font-dohyeon text-base sm:text-lg lg:text-xl text-[#191c1e] block whitespace-nowrap tracking-tight">
                  {formatWonToManwon(summary.livingExpense)}
                </span>
              ) : (
                <span className="text-xs text-[#757682] block font-medium">
                  아직 결산 데이터가 없습니다
                </span>
              )}
            </div>
          </div>

          {/* Card 4: 부채상환 원금 */}
          <div className="bg-[#f7f9fb] p-3.5 sm:p-4 rounded-xl border border-[#c5c5d3]/20 flex flex-col justify-between space-y-2 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#4a58a9]/10 text-[#4a58a9] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-lg">account_balance</span>
              </div>
              <span className="text-xs font-bold text-[#444651]">부채상환 원금</span>
            </div>
            <div className="min-w-0 overflow-hidden">
              {summary.hasData ? (
                <span className="font-dohyeon text-base sm:text-lg lg:text-xl text-[#191c1e] block whitespace-nowrap tracking-tight">
                  {formatWonToManwon(summary.debtPrincipal)}
                </span>
              ) : (
                <span className="text-xs text-[#757682] block font-medium">
                  아직 결산 데이터가 없습니다
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 4. 월간결산 보기 버튼 */}
        <button
          onClick={() => onNavigate('2-3')}
          className="w-full py-4 bg-[#00236f] text-white font-dohyeon text-base rounded-xl shadow-md hover:bg-[#1e3a8a] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
        >
          <span className="material-symbols-outlined text-xl">play_circle</span>
          {summary.hasData
            ? `${summary.formattedSelectedMonth} 월간결산 보기`
            : `${summary.formattedSelectedMonth} 결산 시작하기`}
        </button>
      </section>

      {/* 5. 이번 달 주요 변화 */}
      <section className="bg-white p-5 rounded-2xl border border-[#c5c5d3]/30 shadow-[0_4px_16px_rgba(0,35,111,0.06)] space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#00236f] text-xl">auto_stories</span>
            <h2 className="font-dohyeon text-base text-[#00236f]">이번 달 주요 변화</h2>
          </div>
          {majorChanges.length > 0 && (
            <span className="text-[11px] font-bold text-[#757682]">
              총 {majorChanges.length}건
            </span>
          )}
        </div>

        {majorChanges.length > 0 ? (
          <div className="space-y-2.5">
            {majorChanges.map((item, index) => {
              const iconInfo = getIconForNote(item);
              return (
                <div
                  key={index}
                  className="p-3.5 bg-[#f7f9fb] rounded-xl border border-[#c5c5d3]/20 flex items-center gap-3 transition-all hover:bg-[#f0f4fd]/50"
                >
                  <div className={`w-9 h-9 rounded-lg ${iconInfo.bgClass} ${iconInfo.textClass} flex items-center justify-center shrink-0`}>
                    <span className="material-symbols-outlined text-xl">{iconInfo.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-[#191c1e] font-medium leading-relaxed break-words line-clamp-2">
                      {item}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-5 bg-[#f7f9fb] rounded-xl border border-dashed border-[#c5c5d3]/50 text-center space-y-2.5">
            <p className="text-xs text-[#757682] font-medium">
              이번 달에 기록된 주요 변화가 없습니다
            </p>
            <button
              type="button"
              onClick={() => onNavigate('2-3')}
              className="px-3.5 py-1.5 bg-[#00236f]/10 text-[#00236f] hover:bg-[#00236f]/20 font-dohyeon text-xs rounded-lg transition-all cursor-pointer inline-flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">edit_note</span>
              월간결산에서 기록하기
            </button>
          </div>
        )}
      </section>

      {/* 6. AI CFO 한 줄 코멘트 */}
      <section className="bg-[#e6f4ed] p-4 sm:p-5 rounded-2xl border border-[#c3e9d5] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6.5 h-6.5 rounded-lg bg-[#006c49]/15 text-[#006c49] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                smart_toy
              </span>
            </div>
            <h3 className="font-dohyeon text-sm sm:text-base text-[#004b32]">
              AI CFO 한 줄 코멘트
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('1-1')}
            className="text-xs font-dohyeon text-[#006c49] hover:text-[#004b32] flex items-center gap-1 cursor-pointer hover:underline shrink-0"
          >
            AI 리포트 보기
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>

        {hasAiReport ? (
          <p className="text-xs sm:text-sm text-[#003824] font-medium leading-relaxed bg-white/70 p-3.5 rounded-xl border border-[#006c49]/10">
            &ldquo;{aiOneLineComment}&rdquo;
          </p>
        ) : (
          <p className="text-xs sm:text-sm text-[#003824]/70 font-medium leading-relaxed bg-white/70 p-3.5 rounded-xl border border-[#006c49]/10">
            아직 생성된 AI 리포트가 없습니다
          </p>
        )}
      </section>

      {/* 7. 오늘 기준 다가오는 일정 */}
      <section className="bg-white p-5 rounded-2xl border border-[#c5c5d3]/30 shadow-[0_4px_16px_rgba(0,35,111,0.06)] space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#00236f] text-xl">event_upcoming</span>
            <h2 className="font-dohyeon text-base text-[#00236f]">오늘 기준 다가오는 일정</h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('4-1')}
            className="text-xs font-dohyeon text-[#00236f] hover:underline flex items-center gap-0.5 cursor-pointer shrink-0"
          >
            전체 일정 보기
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>

        {upcomingSchedules.length > 0 ? (
          <div className="space-y-2.5">
            {upcomingSchedules.map((sch) => (
              <div
                key={sch.id}
                onClick={() => onNavigate('4-1')}
                className="p-3.5 bg-[#f7f9fb] rounded-xl border border-[#c5c5d3]/20 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#f0f4fd]/50 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-[#00236f]/10 text-[#00236f] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-xl">
                      {sch.categoryIcon || 'calendar_today'}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-xs sm:text-sm text-[#191c1e] truncate">
                        {sch.title}
                      </h4>
                      <span className="text-[10px] font-bold bg-[#ba1a1a] text-white px-1.5 py-0.5 rounded shrink-0">
                        {sch.dDayStr}
                      </span>
                    </div>
                    <p className="text-xs text-[#757682] mt-0.5 font-medium">
                      {sch.date}
                    </p>
                  </div>
                </div>

                {sch.formattedAmount && (
                  <span className="font-dohyeon text-sm sm:text-base text-[#00236f] shrink-0">
                    {sch.formattedAmount}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5 bg-[#f7f9fb] rounded-xl border border-dashed border-[#c5c5d3]/50 text-center space-y-2.5">
            <p className="text-xs text-[#757682] font-medium">
              등록된 다가오는 일정이 없습니다
            </p>
            <button
              type="button"
              onClick={() => onNavigate('4-1')}
              className="px-3.5 py-1.5 bg-[#00236f]/10 text-[#00236f] hover:bg-[#00236f]/20 font-dohyeon text-xs rounded-lg transition-all cursor-pointer inline-flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              플래너에서 일정 등록하기
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
