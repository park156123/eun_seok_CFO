import React, { useState } from 'react';
import { Goal } from '../types';

interface GoalsSimulationScreenProps {
  goals: Goal[];
  onAddGoal: (goal: Goal) => void;
}

export const GoalsSimulationScreen: React.FC<GoalsSimulationScreenProps> = ({
  goals,
  onAddGoal,
}) => {
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [extraMonthlySavings, setExtraMonthlySavings] = useState<number>(0);

  // New goal state
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState<'여행' | '대출상환' | '노후' | '차량' | '기타'>('여행');
  const [targetAmt, setTargetAmt] = useState('');
  const [currentAmt, setCurrentAmt] = useState('');
  const [goalMemo, setGoalMemo] = useState('');

  const handleCreateGoal = () => {
    if (!goalTitle || !targetAmt) return;
    const target = Number(targetAmt);
    const curr = Number(currentAmt) || 0;
    const pct = Math.min(100, Math.round((curr / target) * 100));

    onAddGoal({
      id: `goal-${Date.now()}`,
      title: goalTitle,
      category: goalCategory,
      targetAmount: target,
      currentAmount: curr,
      progressPercentage: pct,
      memo: goalMemo,
      icon: 'flag',
    });

    setGoalTitle('');
    setTargetAmt('');
    setCurrentAmt('');
    setGoalMemo('');
    setShowAddGoalModal(false);
  };

  return (
    <div className="space-y-6 pb-28">
      {/* 1. Dynamic AI Retirement Simulator */}
      <section className="bg-gradient-to-br from-[#00236f] to-[#1e3a8a] text-white p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#6cf8bb]">auto_awesome</span>
            <h2 className="font-dohyeon text-lg text-white">은퇴 시점 시뮬레이터</h2>
          </div>
          <span className="text-[10px] bg-[#6cf8bb]/30 text-[#6cf8bb] font-bold px-2.5 py-1 rounded-full border border-[#6cf8bb]/40">
            AI REALTIME
          </span>
        </div>

        <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-xs space-y-2">
          <div className="flex justify-between items-center text-xs text-white/80">
            <span>현재 월 저축액</span>
            <span className="font-bold text-white text-sm">227만원/월</span>
          </div>
          <div className="flex justify-between items-center text-xs text-white/80">
            <span>예상 은퇴 가능 연령</span>
            <span className="font-bold text-[#6cf8bb] text-base">58세 (약 12년 남음)</span>
          </div>
        </div>

        {/* Interactive Slider */}
        <div className="space-y-2 pt-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-white/80">추가 월 저축액 설정</span>
            <span className="font-bold text-[#6cf8bb]">+{extraMonthlySavings}만원</span>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            step="10"
            value={extraMonthlySavings}
            onChange={(e) => setExtraMonthlySavings(Number(e.target.value))}
            className="w-full accent-[#6cf8bb] cursor-pointer"
          />
          <div className="bg-[#6cf8bb]/20 p-3 rounded-xl border border-[#6cf8bb]/30 text-xs text-[#6cf8bb] font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">speed</span>
            {extraMonthlySavings > 0 ? (
              <span>
                월 {extraMonthlySavings}만원 추가 저축 시, 은퇴가 약{' '}
                <span className="underline font-extrabold">
                  {Math.round(extraMonthlySavings * 0.6)}개월
                </span>{' '}
                앞당겨집니다!
              </span>
            ) : (
              <span>슬라이더를 조절하여 은퇴 단축 기간을 계산해 보세요!</span>
            )}
          </div>
        </div>
      </section>

      {/* 2. Active Goals List */}
      <section className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-dohyeon text-lg text-[#00236f] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006c49]">flag</span>
            목표 리스트
          </h3>
          <span className="text-xs font-bold text-[#757682]">{goals.length}개 진행 중</span>
        </div>

        <div className="space-y-4">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="bg-white rounded-2xl p-5 shadow-xs border border-[#c5c5d3]/20 space-y-3 hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#6cf8bb]/30 text-[#00714d] flex items-center justify-center shrink-0 font-bold">
                    <span className="material-symbols-outlined text-xl">
                      {goal.icon || 'flag'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#00236f] bg-[#dce1ff] px-2 py-0.5 rounded">
                      {goal.category}
                    </span>
                    <h4 className="font-bold text-base text-[#191c1e] mt-0.5">{goal.title}</h4>
                  </div>
                </div>

                <span className="font-dohyeon text-lg text-[#006c49]">
                  {goal.progressPercentage}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#e6e8ea] h-3 rounded-full overflow-hidden">
                <div
                  className="bg-[#006c49] h-full rounded-full transition-all duration-500"
                  style={{ width: `${goal.progressPercentage}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-[#757682] font-semibold">
                <span>모은 금액: {goal.currentAmount.toLocaleString()}원</span>
                <span>목표 금액: {goal.targetAmount.toLocaleString()}원</span>
              </div>

              {goal.memo && (
                <p className="text-xs text-[#444651] bg-[#f2f4f6] p-3 rounded-xl leading-relaxed">
                  {goal.memo}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Floating FAB to add goal */}
      <button
        id="fab-add-goal"
        onClick={() => setShowAddGoalModal(true)}
        className="fixed bottom-22 right-5 w-14 h-14 bg-[#00236f] text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform z-40 hover:bg-[#1e3a8a]"
        aria-label="Add goal"
      >
        <span className="material-symbols-outlined text-[32px]">add</span>
      </button>

      {/* Add Goal Modal Dialog */}
      {showAddGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <h3 className="font-dohyeon text-lg text-[#00236f]">새 재무 목표 추가</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#757682] font-bold mb-1">목표 이름</label>
                <input
                  type="text"
                  placeholder="예: 자녀 유학 자금, 제주도 집 마련"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#c5c5d3]/40 focus:outline-none focus:border-[#00236f]"
                />
              </div>

              <div>
                <label className="block text-[#757682] font-bold mb-1">카테고리</label>
                <select
                  value={goalCategory}
                  onChange={(e) => setGoalCategory(e.target.value as any)}
                  className="w-full p-3 rounded-xl border border-[#c5c5d3]/40 focus:outline-none focus:border-[#00236f]"
                >
                  <option value="여행">여행</option>
                  <option value="대출상환">대출상환</option>
                  <option value="노후">노후</option>
                  <option value="차량">차량</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              <div>
                <label className="block text-[#757682] font-bold mb-1">목표 금액 (원)</label>
                <input
                  type="number"
                  placeholder="예: 10000000"
                  value={targetAmt}
                  onChange={(e) => setTargetAmt(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#c5c5d3]/40 focus:outline-none focus:border-[#00236f]"
                />
              </div>

              <div>
                <label className="block text-[#757682] font-bold mb-1">현재 모은 금액 (원)</label>
                <input
                  type="number"
                  placeholder="예: 2000000"
                  value={currentAmt}
                  onChange={(e) => setCurrentAmt(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#c5c5d3]/40 focus:outline-none focus:border-[#00236f]"
                />
              </div>

              <div>
                <label className="block text-[#757682] font-bold mb-1">메모</label>
                <input
                  type="text"
                  placeholder="목표 계획 메모"
                  value={goalMemo}
                  onChange={(e) => setGoalMemo(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#c5c5d3]/40 focus:outline-none focus:border-[#00236f]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAddGoalModal(false)}
                className="flex-1 py-3 bg-[#e6e8ea] text-[#444651] font-bold text-xs rounded-xl"
              >
                취소
              </button>
              <button
                onClick={handleCreateGoal}
                className="flex-1 py-3 bg-[#00236f] text-white font-bold text-xs rounded-xl shadow-md"
              >
                목표 생성
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
