import React, { useState } from 'react';
import { ScheduleEvent } from '../types';

interface FutureScheduleScreenProps {
  schedules: ScheduleEvent[];
  onAddSchedule: (sch: ScheduleEvent) => void;
}

export const FutureScheduleScreen: React.FC<FutureScheduleScreenProps> = ({
  schedules,
  onAddSchedule,
}) => {
  const [filter, setFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newMemo, setNewMemo] = useState('');

  const totalAmount = schedules.reduce((sum, s) => sum + s.amount, 0);

  const handleCreate = () => {
    if (!newTitle || !newAmount) return;
    onAddSchedule({
      id: `sch-${Date.now()}`,
      title: newTitle,
      date: newDate || '2025.12',
      amount: Number(newAmount),
      memo: newMemo,
      categoryIcon: 'event',
    });
    setNewTitle('');
    setNewDate('');
    setNewAmount('');
    setNewMemo('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 pb-28">
      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
        {['전체', '예정된 주요 지출', '정기 지출', '세금·공과금'].map((item, idx) => (
          <button
            key={idx}
            onClick={() => setFilter(idx === 0 ? 'all' : item)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              (filter === 'all' && idx === 0) || filter === item
                ? 'bg-[#00236f] text-white shadow-xs'
                : 'bg-white text-[#444651] border border-[#c5c5d3]/30'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {/* Summary Banner */}
      <div className="bg-gradient-to-r from-[#5c3800] to-[#805000] text-white p-5 rounded-2xl shadow-md flex justify-between items-center">
        <div>
          <span className="font-label-md text-xs text-[#ffddb8] block">총 예정 지출액</span>
          <h2 className="font-dohyeon text-2xl text-white">
            {(totalAmount / 10000).toLocaleString()}만원
          </h2>
        </div>
        <span className="material-symbols-outlined text-4xl text-[#ffddb8]">calendar_today</span>
      </div>

      {/* Timeline List */}
      <section className="space-y-3">
        <h3 className="font-dohyeon text-base text-[#00236f] px-1">미래 지출 일정 리스트</h3>

        <div className="space-y-3">
          {schedules.map((sch) => (
            <div
              key={sch.id}
              className="bg-white rounded-2xl p-4 shadow-xs border border-[#c5c5d3]/20 space-y-2 hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[#dce1ff] text-[#00236f] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg">
                      {sch.categoryIcon || 'event'}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-sm text-[#191c1e]">{sch.title}</h4>
                      {sch.isPrimary && (
                        <span className="text-[9px] font-bold bg-[#00236f] text-white px-1.5 py-0.2 rounded">
                          PRIMARY
                        </span>
                      )}
                      {sch.dDay && (
                        <span className="text-[10px] font-bold bg-[#ba1a1a] text-white px-1.5 py-0.2 rounded">
                          {sch.dDay}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#757682]">{sch.date} 예정</span>
                  </div>
                </div>

                <span className="font-dohyeon text-lg text-[#00236f]">
                  {sch.amount >= 10000000
                    ? `${(sch.amount / 10000).toLocaleString()}만원`
                    : `${sch.amount.toLocaleString()}원`}
                </span>
              </div>

              {sch.memo && (
                <p className="text-xs text-[#444651] bg-[#f2f4f6] p-2.5 rounded-xl mt-2 leading-relaxed">
                  {sch.memo}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Add Schedule Button */}
      <button
        id="btn-add-schedule-modal"
        onClick={() => setShowAddModal(true)}
        className="w-full py-4 bg-[#00236f] text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform"
      >
        <span className="material-symbols-outlined text-lg">add</span>
        새 미래 일정 추가
      </button>

      {/* Add Schedule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <h3 className="font-dohyeon text-lg text-[#00236f]">미래 일정 추가</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#757682] font-bold mb-1">일정명</label>
                <input
                  type="text"
                  placeholder="예: 자녀 대학 등록금, 차량 교체"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#c5c5d3]/40 focus:outline-none focus:border-[#00236f]"
                />
              </div>

              <div>
                <label className="block text-[#757682] font-bold mb-1">예정 시기</label>
                <input
                  type="text"
                  placeholder="예: 2026.05"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#c5c5d3]/40 focus:outline-none focus:border-[#00236f]"
                />
              </div>

              <div>
                <label className="block text-[#757682] font-bold mb-1">예상 금액 (원)</label>
                <input
                  type="number"
                  placeholder="예: 5000000"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#c5c5d3]/40 focus:outline-none focus:border-[#00236f]"
                />
              </div>

              <div>
                <label className="block text-[#757682] font-bold mb-1">메모</label>
                <input
                  type="text"
                  placeholder="상세 설명 메모"
                  value={newMemo}
                  onChange={(e) => setNewMemo(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#c5c5d3]/40 focus:outline-none focus:border-[#00236f]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 bg-[#e6e8ea] text-[#444651] font-bold text-xs rounded-xl"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 py-3 bg-[#00236f] text-white font-bold text-xs rounded-xl shadow-md"
              >
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
