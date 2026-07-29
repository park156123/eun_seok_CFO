import React from 'react';
import { ScreenId, Goal, ScheduleEvent } from '../types';

interface PlannerMainScreenProps {
  onNavigate: (screen: ScreenId) => void;
  goals: Goal[];
  schedules: ScheduleEvent[];
}

export const PlannerMainScreen: React.FC<PlannerMainScreenProps> = ({
  onNavigate,
  goals,
  schedules,
}) => {
  return (
    <div className="space-y-6 pb-28">
      {/* Hero Header */}
      <section className="bg-gradient-to-r from-[#00236f] to-[#1e3a8a] text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="z-10 relative">
          <span className="font-label-md text-xs text-[#90a8ff] mb-1 block uppercase tracking-wider">
            Future Planner
          </span>
          <h2 className="font-dohyeon text-2xl text-white mb-2">
            박은석 님 가족의 재무 플래너
          </h2>
          <p className="font-body-sm text-xs text-white/80 leading-relaxed">
            미래 지출 일정과 인생 목표를 시뮬레이션하여 안전한 재무 관리를 도와드립니다.
          </p>
        </div>
        <div className="absolute -right-6 -bottom-6 opacity-10 text-white pointer-events-none">
          <span className="material-symbols-outlined text-[140px]">event_repeat</span>
        </div>
      </section>

      {/* Main Navigation Bento Cards */}
      <section className="grid grid-cols-2 gap-3">
        <div
          id="planner-nav-schedules"
          onClick={() => onNavigate('4-1')}
          className="bg-white p-5 rounded-2xl shadow-xs border border-[#c5c5d3]/20 flex flex-col justify-between h-40 cursor-pointer hover:border-[#00236f]/40 transition-all active:scale-[0.98]"
        >
          <div className="w-11 h-11 rounded-2xl bg-[#ffddb8]/40 text-[#653e00] flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">calendar_month</span>
          </div>
          <div>
            <h3 className="font-dohyeon text-base text-[#191c1e]">미래 일정</h3>
            <p className="font-label-md text-[11px] text-[#757682]">
              D-Day & 지출 예정 이벤트
            </p>
          </div>
        </div>

        <div
          id="planner-nav-goals"
          onClick={() => onNavigate('4-2')}
          className="bg-white p-5 rounded-2xl shadow-xs border border-[#c5c5d3]/20 flex flex-col justify-between h-40 cursor-pointer hover:border-[#00236f]/40 transition-all active:scale-[0.98]"
        >
          <div className="w-11 h-11 rounded-2xl bg-[#6cf8bb]/30 text-[#00714d] flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">flag</span>
          </div>
          <div>
            <h3 className="font-dohyeon text-base text-[#191c1e]">목표·시뮬레이션</h3>
            <p className="font-label-md text-[11px] text-[#757682]">
              은퇴, 여행, 대출상환
            </p>
          </div>
        </div>
      </section>

      {/* Timeline Schedule Preview */}
      <section className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-dohyeon text-base text-[#00236f] flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">schedule</span>
            다가오는 다액 지출 일정
          </h3>
          <button
            onClick={() => onNavigate('4-1')}
            className="text-xs font-bold text-[#00236f] hover:underline flex items-center"
          >
            전체보기 <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>

        <div className="space-y-2">
          {schedules.slice(0, 2).map((sch) => (
            <div
              key={sch.id}
              onClick={() => onNavigate('4-1')}
              className="bg-white p-4 rounded-2xl border border-[#c5c5d3]/20 flex justify-between items-center shadow-xs cursor-pointer hover:bg-[#f2f4f6]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1e3a8a]/10 text-[#00236f] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">
                    {sch.categoryIcon || 'event'}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#191c1e]">{sch.title}</span>
                    {sch.isPrimary && (
                      <span className="text-[10px] font-bold bg-[#00236f] text-white px-2 py-0.2 rounded">
                        PRIMARY
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#757682]">{sch.date} 예정</span>
                </div>
              </div>
              <span className="font-dohyeon text-base text-[#00236f]">
                {sch.amount >= 10000000
                  ? `${(sch.amount / 10000).toLocaleString()}만원`
                  : `${sch.amount.toLocaleString()}원`}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Goal Progress Preview */}
      <section className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-dohyeon text-base text-[#00236f] flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">ads_click</span>
            진행 중인 재무 목표
          </h3>
          <button
            onClick={() => onNavigate('4-2')}
            className="text-xs font-bold text-[#00236f] hover:underline flex items-center"
          >
            전체보기 <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>

        <div className="space-y-3">
          {goals.slice(0, 2).map((goal) => (
            <div
              key={goal.id}
              onClick={() => onNavigate('4-2')}
              className="bg-white p-4 rounded-2xl border border-[#c5c5d3]/20 shadow-xs space-y-2 cursor-pointer hover:bg-[#f2f4f6]"
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-[#191c1e]">{goal.title}</span>
                <span className="font-dohyeon text-sm text-[#006c49]">
                  {goal.progressPercentage}% 달성
                </span>
              </div>
              <div className="w-full bg-[#e6e8ea] h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#006c49] h-full rounded-full"
                  style={{ width: `${goal.progressPercentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[#757682]">
                <span>현재 {goal.currentAmount.toLocaleString()}원</span>
                <span>목표 {goal.targetAmount.toLocaleString()}원</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
