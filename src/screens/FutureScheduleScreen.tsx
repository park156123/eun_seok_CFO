import React, { useState } from 'react';
import { ScheduleEvent, ScheduleCategory, ScheduleStatus } from '../types';
import {
  SCHEDULE_CATEGORIES,
  getEffectiveScheduleCategory,
  getCategoryIcon,
  formatPlannerAmount,
  getScheduleDDayInfo,
  getScheduleStatus,
  getScheduleStatusBadge,
  getTodayFormatted,
} from '../utils/scheduleUtils';

interface FutureScheduleScreenProps {
  schedules: ScheduleEvent[];
  onAddSchedule: (sch: ScheduleEvent) => void;
  onUpdateSchedule: (sch: ScheduleEvent) => void;
}

export const FutureScheduleScreen: React.FC<FutureScheduleScreenProps> = ({
  schedules,
  onAddSchedule,
  onUpdateSchedule,
}) => {
  const [filter, setFilter] = useState<string>('all');

  // Accordion state for completed schedules (default: false / collapsed)
  const [isCompletedOpen, setIsCompletedOpen] = useState<boolean>(false);

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategory, setNewCategory] = useState<ScheduleCategory>('대출·원금');
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newMemo, setNewMemo] = useState('');

  // Detail View & Edit Modal State
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleEvent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editCategory, setEditCategory] = useState<ScheduleCategory>('대출·원금');
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editMemo, setEditMemo] = useState('');

  // Extension Inline Mode inside Detail View
  const [isExtending, setIsExtending] = useState(false);
  const [extendDate, setExtendDate] = useState('');
  const [extendReason, setExtendReason] = useState('');

  // Filter schedules by selected category
  const filteredSchedules = (schedules || []).filter((sch) => {
    if (filter === 'all') return true;
    return getEffectiveScheduleCategory(sch) === filter;
  });

  // Split into Active (in_progress, extended) and Completed
  const activeSchedules = filteredSchedules.filter((s) => !s.completed && s.status !== 'completed');
  const completedSchedules = filteredSchedules.filter((s) => Boolean(s.completed) || s.status === 'completed');

  const handleCreate = () => {
    if (!newTitle.trim() || !newDate.trim()) return;
    onAddSchedule({
      id: `sch-${Date.now()}`,
      title: newTitle.trim(),
      date: newDate.trim(),
      amount: newAmount ? Number(newAmount) : 0,
      category: newCategory,
      memo: newMemo.trim(),
      categoryIcon: getCategoryIcon(newCategory),
      completed: false,
      status: 'in_progress',
    });

    setNewCategory('대출·원금');
    setNewTitle('');
    setNewDate('');
    setNewAmount('');
    setNewMemo('');
    setShowAddModal(false);
  };

  const handleOpenDetail = (sch: ScheduleEvent) => {
    setSelectedSchedule(sch);
    setIsEditing(false);
    setIsExtending(false);
  };

  // Status changes from Detail View
  const handleSetStatus = (sch: ScheduleEvent, targetStatus: ScheduleStatus) => {
    if (targetStatus === 'extended') {
      setIsExtending(true);
      setExtendDate(sch.date || '');
      setExtendReason('');
      return;
    }

    let updated: ScheduleEvent;

    if (targetStatus === 'completed') {
      updated = {
        ...sch,
        completed: true,
        completedAt: sch.completedAt || getTodayFormatted(),
        status: 'completed',
      };
    } else {
      // in_progress (completed cancel / restoration)
      updated = {
        ...sch,
        completed: false,
        completedAt: undefined,
        status: 'in_progress',
      };
    }

    onUpdateSchedule(updated);
    setSelectedSchedule(updated);
    setIsExtending(false);
  };

  const handleSaveExtension = () => {
    if (!selectedSchedule || !extendDate.trim()) return;

    let finalMemo = selectedSchedule.memo || '';
    if (extendReason.trim()) {
      finalMemo = finalMemo
        ? `${finalMemo}\n[연장 사유] ${extendReason.trim()}`
        : `[연장 사유] ${extendReason.trim()}`;
    }

    const updated: ScheduleEvent = {
      ...selectedSchedule,
      date: extendDate.trim(),
      status: 'extended',
      completed: false,
      completedAt: undefined,
      memo: finalMemo,
    };

    onUpdateSchedule(updated);
    setSelectedSchedule(updated);
    setIsExtending(false);
  };

  const handleStartEdit = () => {
    if (!selectedSchedule) return;
    const effCategory = getEffectiveScheduleCategory(selectedSchedule);
    setEditCategory(effCategory);
    setEditTitle(selectedSchedule.title || '');
    setEditDate(selectedSchedule.date || '');
    setEditAmount(selectedSchedule.amount ? String(selectedSchedule.amount) : '');
    setEditMemo(selectedSchedule.memo || '');
    setIsEditing(true);
    setIsExtending(false);
  };

  const handleSaveEdit = () => {
    if (!selectedSchedule || !editTitle.trim() || !editDate.trim()) return;
    const numAmount = editAmount ? Number(editAmount) : 0;
    const isAmountChanged = numAmount !== selectedSchedule.amount;
    const isMemoChanged = editMemo.trim() !== (selectedSchedule.memo || '').trim();

    const updated: ScheduleEvent = {
      ...selectedSchedule,
      title: editTitle.trim(),
      date: editDate.trim(),
      amount: numAmount,
      category: editCategory,
      memo: editMemo.trim(),
      categoryIcon: getCategoryIcon(editCategory),
      userModifiedAmount: selectedSchedule.userModifiedAmount || isAmountChanged,
      userModifiedMemo: selectedSchedule.userModifiedMemo || isMemoChanged,
    };

    onUpdateSchedule(updated);
    setSelectedSchedule(updated);
    setIsEditing(false);
  };

  const renderScheduleCard = (sch: ScheduleEvent) => {
    const effCategory = getEffectiveScheduleCategory(sch);
    const icon = sch.categoryIcon || getCategoryIcon(effCategory);
    const dDayInfo = getScheduleDDayInfo(sch);
    const statusBadge = getScheduleStatusBadge(sch);

    return (
      <div
        key={sch.id}
        onClick={() => handleOpenDetail(sch)}
        className={`bg-white rounded-2xl p-4 shadow-xs border transition-all cursor-pointer ${
          sch.completed
            ? 'bg-gray-50/80 border-gray-200 opacity-85'
            : 'border-[#c5c5d3]/20 hover:border-[#00236f]/30 hover:shadow-md'
        }`}
      >
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                sch.completed ? 'bg-gray-200 text-gray-500' : 'bg-[#dce1ff] text-[#00236f]'
              }`}
            >
              <span className="material-symbols-outlined text-xl">
                {sch.completed ? 'check_circle' : icon}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    sch.completed
                      ? 'bg-gray-200 text-gray-600'
                      : 'bg-[#00236f]/10 text-[#00236f]'
                  }`}
                >
                  {effCategory}
                </span>

                {/* Status Badge */}
                <span className={`text-[10px] px-2 py-0.5 rounded ${statusBadge.badgeClass}`}>
                  {statusBadge.label}
                </span>

                <h4
                  className={`font-bold text-sm truncate ${
                    sch.completed ? 'line-through text-gray-500' : 'text-[#191c1e]'
                  }`}
                >
                  {sch.title}
                </h4>

                {sch.isPrimary && !sch.completed && (
                  <span className="text-[9px] font-bold bg-[#00236f] text-white px-1.5 py-0.2 rounded">
                    PRIMARY
                  </span>
                )}
                {sch.isAutoGenerated && (
                  <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                    자동생성
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-[#757682]">
                <span>{sch.date} 예정</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded ${dDayInfo.badgeClass}`}>
                  {dDayInfo.text}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span
              className={`font-dohyeon text-base sm:text-lg block ${
                sch.completed ? 'text-gray-400 line-through' : 'text-[#00236f]'
              }`}
            >
              {formatPlannerAmount(sch.amount)}
            </span>
          </div>
        </div>

        {sch.memo && (
          <p className="text-xs text-[#444651] bg-[#f2f4f6] p-2.5 rounded-xl mt-2 leading-relaxed truncate">
            {sch.memo}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-28">
      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
        {['전체', ...SCHEDULE_CATEGORIES].map((item, idx) => (
          <button
            key={idx}
            onClick={() => setFilter(idx === 0 ? 'all' : item)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              (filter === 'all' && idx === 0) || filter === item
                ? 'bg-[#00236f] text-white shadow-xs'
                : 'bg-white text-[#444651] border border-[#c5c5d3]/30 hover:bg-gray-50'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {/* 1. Active Schedules Section */}
      <section className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-dohyeon text-base text-[#00236f]">진행 중인 일정</h3>
          <span className="text-xs text-[#757682]">총 {activeSchedules.length}건</span>
        </div>

        {activeSchedules.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-[#757682] text-xs border border-[#c5c5d3]/20 space-y-1">
            <span className="material-symbols-outlined text-3xl text-gray-300 block">event_available</span>
            <p className="font-bold text-[#191c1e]">진행 중인 일정이 없습니다.</p>
            <p>새 미래 일정을 추가해 보세요.</p>
          </div>
        ) : (
          <div className="space-y-3">{activeSchedules.map(renderScheduleCard)}</div>
        )}
      </section>

      {/* 2. Completed Schedules Accordion Section (Default Collapsed) */}
      {completedSchedules.length > 0 && (
        <section className="space-y-3 pt-2 border-t border-gray-200/60">
          <button
            type="button"
            onClick={() => setIsCompletedOpen((prev) => !prev)}
            className="w-full flex justify-between items-center p-3 bg-gray-100/70 hover:bg-gray-100 rounded-2xl text-xs font-bold text-[#444651] transition-all"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-gray-500">task_alt</span>
              <span>완료된 일정 {completedSchedules.length}건</span>
            </div>
            <div className="flex items-center gap-1 text-gray-500">
              <span>{isCompletedOpen ? '접기' : '펼치기'}</span>
              <span className="material-symbols-outlined text-lg">
                {isCompletedOpen ? 'expand_less' : 'expand_more'}
              </span>
            </div>
          </button>

          {isCompletedOpen && (
            <div className="space-y-3 animate-in fade-in duration-200">
              {completedSchedules.map(renderScheduleCard)}
            </div>
          )}
        </section>
      )}

      {/* Add Schedule Button */}
      <button
        id="btn-add-schedule-modal"
        onClick={() => setShowAddModal(true)}
        className="w-full py-4 bg-[#00236f] text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform"
      >
        <span className="material-symbols-outlined text-lg">add</span>
        새 미래 일정 추가
      </button>

      {/* 1. Add Schedule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="font-dohyeon text-lg text-[#00236f]">새 미래 일정 추가</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[#757682] font-bold mb-1.5">
                  종류 <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SCHEDULE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                        newCategory === cat
                          ? 'bg-[#00236f] text-white shadow-xs'
                          : 'bg-[#f2f4f6] text-[#444651] border border-transparent hover:border-[#00236f]/30'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[#757682] font-bold mb-1">
                  일정명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="예: 자녀 대학 등록금, 차량 교체"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#c5c5d3]/40 focus:outline-none focus:border-[#00236f]"
                />
              </div>

              <div>
                <label className="block text-[#757682] font-bold mb-1">
                  예정일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="예: 2026.05 또는 2026.05.15"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#c5c5d3]/40 focus:outline-none focus:border-[#00236f]"
                />
              </div>

              <div>
                <label className="block text-[#757682] font-bold mb-1">예상 금액 (원)</label>
                <input
                  type="number"
                  placeholder="예: 5000000 (미입력 시 금액 미정)"
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

            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 bg-[#e6e8ea] text-[#444651] font-bold text-xs rounded-xl"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || !newDate.trim()}
                className="flex-1 py-3 bg-[#00236f] disabled:bg-gray-300 text-white font-bold text-xs rounded-xl shadow-md"
              >
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Schedule Detail View & Status Management Modal */}
      {selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#dce1ff] text-[#00236f] flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">
                    {getCategoryIcon(getEffectiveScheduleCategory(selectedSchedule))}
                  </span>
                </div>
                <h3 className="font-dohyeon text-lg text-[#00236f]">
                  {isEditing ? '일정 수정하기' : '일정 상세정보'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedSchedule(null);
                  setIsEditing(false);
                  setIsExtending(false);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {!isEditing ? (
              /* Read-Only Detail View & Status Selection */
              <div className="space-y-4 text-xs">
                {/* 1. Generation source badge */}
                <div className="flex items-center justify-between bg-[#f2f4f6] p-3 rounded-2xl">
                  <span className="text-[#757682] font-bold">생성 구 분</span>
                  {selectedSchedule.isAutoGenerated ? (
                    <span className="font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">auto_awesome</span>
                      기본정보 자동 생성 일정
                    </span>
                  ) : (
                    <span className="font-bold text-[#00236f] bg-[#00236f]/10 px-2.5 py-1 rounded-lg flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">edit_note</span>
                      직접 추가한 일정
                    </span>
                  )}
                </div>

                {/* 2 ~ 8. Main Detail Items */}
                <div className="space-y-2.5 bg-white border border-gray-100 rounded-2xl p-4 shadow-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[#757682]">일정 종류</span>
                    <span className="font-bold text-[#00236f] bg-[#00236f]/10 px-2.5 py-0.5 rounded-full">
                      {getEffectiveScheduleCategory(selectedSchedule)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#757682]">일 정 명</span>
                    <span className="font-bold text-[#191c1e] text-sm">{selectedSchedule.title}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#757682]">예 정 일</span>
                    <span className="font-bold text-[#191c1e]">{selectedSchedule.date}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#757682]">D-Day 또는 완료일</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded ${
                        getScheduleDDayInfo(selectedSchedule).badgeClass
                      }`}
                    >
                      {getScheduleDDayInfo(selectedSchedule).text}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#757682]">현재 상태</span>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded ${
                        getScheduleStatusBadge(selectedSchedule).badgeClass
                      }`}
                    >
                      {getScheduleStatusBadge(selectedSchedule).label}
                      {selectedSchedule.completed && selectedSchedule.completedAt
                        ? ` (${selectedSchedule.completedAt})`
                        : ''}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-[#757682]">예상 금액</span>
                    <span className="font-dohyeon text-base text-[#00236f]">
                      {formatPlannerAmount(selectedSchedule.amount)}
                    </span>
                  </div>
                </div>

                {/* Memo section */}
                <div>
                  <span className="block text-[#757682] font-bold mb-1">메모</span>
                  <div className="bg-[#f2f4f6] p-3 rounded-2xl text-[#191c1e] leading-relaxed whitespace-pre-wrap">
                    {selectedSchedule.memo || '등록된 메모가 없습니다.'}
                  </div>
                </div>

                {/* Status Selector Section */}
                {!isExtending ? (
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <label className="block text-[#757682] font-bold text-xs">상태 변경</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSetStatus(selectedSchedule, 'in_progress')}
                        className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                          getScheduleStatus(selectedSchedule) === 'in_progress'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">pending</span>
                        진행중
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetStatus(selectedSchedule, 'extended')}
                        className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                          getScheduleStatus(selectedSchedule) === 'extended'
                            ? 'bg-purple-700 text-white shadow-xs'
                            : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">schedule</span>
                        연장
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetStatus(selectedSchedule, 'completed')}
                        className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                          getScheduleStatus(selectedSchedule) === 'completed'
                            ? 'bg-gray-700 text-white shadow-xs'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        완료
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Extension Form inside Detail View */
                  <div className="space-y-3 p-3 bg-purple-50/80 border border-purple-200 rounded-2xl animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5 text-purple-900 font-bold">
                      <span className="material-symbols-outlined text-base">update</span>
                      <span>일정 연장 설정</span>
                    </div>

                    <div>
                      <label className="block text-purple-900 font-bold mb-1">
                        새 예정일 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="예: 2026.12.31"
                        value={extendDate}
                        onChange={(e) => setExtendDate(e.target.value)}
                        className="w-full p-2.5 bg-white rounded-xl border border-purple-300 focus:outline-none focus:border-purple-600 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-purple-900 font-bold mb-1">연장 사유 메모 (선택)</label>
                      <input
                        type="text"
                        placeholder="예: 6개월 연장 협의 완료"
                        value={extendReason}
                        onChange={(e) => setExtendReason(e.target.value)}
                        className="w-full p-2.5 bg-white rounded-xl border border-purple-300 focus:outline-none focus:border-purple-600 text-xs"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsExtending(false)}
                        className="flex-1 py-2 bg-gray-200 text-gray-700 font-bold text-xs rounded-xl"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveExtension}
                        disabled={!extendDate.trim()}
                        className="flex-1 py-2 bg-purple-700 disabled:bg-gray-300 text-white font-bold text-xs rounded-xl shadow-xs"
                      >
                        연장 저장
                      </button>
                    </div>
                  </div>
                )}

                {/* Bottom Footer Actions */}
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setSelectedSchedule(null);
                      setIsEditing(false);
                      setIsExtending(false);
                    }}
                    className="flex-1 py-3 bg-[#e6e8ea] text-[#444651] font-bold text-xs rounded-xl"
                  >
                    닫기
                  </button>
                  <button
                    onClick={handleStartEdit}
                    className="flex-1 py-3 bg-[#00236f] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    수정하기
                  </button>
                </div>
              </div>
            ) : (
              /* Edit View (Modifying amount, memo, title, date, category) */
              <div className="space-y-4 text-xs">
                {selectedSchedule.isAutoGenerated && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-2xl text-xs flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-base shrink-0 mt-0.5">
                      warning
                    </span>
                    <p className="leading-relaxed">
                      기본정보에서 자동 생성된 일정입니다.<br />
                      수정한 내용은 이 일정에만 적용됩니다. (원금/메모 직접 수정 가능)
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-[#757682] font-bold mb-1">종류</label>
                    <div className="flex flex-wrap gap-1.5">
                      {SCHEDULE_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setEditCategory(cat)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                            editCategory === cat
                              ? 'bg-[#00236f] text-white shadow-xs'
                              : 'bg-[#f2f4f6] text-[#444651] border border-transparent hover:border-[#00236f]/30'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#757682] font-bold mb-1">
                      일정명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full p-3 rounded-xl border border-[#c5c5d3]/40 focus:outline-none focus:border-[#00236f]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#757682] font-bold mb-1">
                      예정일 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full p-3 rounded-xl border border-[#c5c5d3]/40 focus:outline-none focus:border-[#00236f]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#757682] font-bold mb-1">예상 금액 (원)</label>
                    <input
                      type="number"
                      placeholder="원 단위 (미입력 시 금액 미정)"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full p-3 rounded-xl border border-[#c5c5d3]/40 focus:outline-none focus:border-[#00236f]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#757682] font-bold mb-1">메모</label>
                    <textarea
                      rows={3}
                      value={editMemo}
                      onChange={(e) => setEditMemo(e.target.value)}
                      className="w-full p-3 rounded-xl border border-[#c5c5d3]/40 focus:outline-none focus:border-[#00236f]"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-3 bg-[#e6e8ea] text-[#444651] font-bold text-xs rounded-xl"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={!editTitle.trim() || !editDate.trim()}
                    className="flex-1 py-3 bg-[#00236f] disabled:bg-gray-300 text-white font-bold text-xs rounded-xl shadow-md"
                  >
                    저장하기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
