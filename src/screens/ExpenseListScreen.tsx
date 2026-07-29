import React, { useState } from 'react';
import { Transaction } from '../types';
import { CONSUMER_CATEGORY_GROUPS, getCategoryGroup, parseCategoryString } from '../data/consumerCategories';
import { GlobalMockDataStore } from '../services/dataStore';
import { ActiveSessionBanner } from '../components/ActiveSessionBanner';

interface ExpenseListScreenProps {
  transactions: Transaction[];
  onUpdateTransaction: (updated: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export const ExpenseListScreen: React.FC<ExpenseListScreenProps> = ({
  transactions,
  onUpdateTransaction,
  onDeleteTransaction,
}) => {
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedMajor, setSelectedMajor] = useState<string>('식비');
  const [selectedMinor, setSelectedMinor] = useState<string>('외식');

  // Filter transactions for current active session
  const activeSessionTxs = GlobalMockDataStore.getActiveSessionTransactions();
  const displayTxs = activeSessionTxs.length > 0 ? activeSessionTxs : transactions;

  const includedTxs = displayTxs.filter((t) => {
    if (t.analysisStatus === 'excluded') return false;
    const cat = t.category || '';
    if (cat.startsWith('제외') || cat.includes('내부이체')) return false;
    return !t.isIncome && (Number(t.amount) || 0) > 0;
  });

  const totalExpense = includedTxs.reduce((sum, t) => sum + t.amount, 0);

  // Group by date
  const groupedDates = Array.from(new Set(includedTxs.map((t) => t.date)));

  const handleStartEdit = (tx: Transaction) => {
    setEditingTx(tx);
    const parsed = parseCategoryString(tx.category);
    setSelectedMajor(parsed.major);
    setSelectedMinor(parsed.minor);
  };

  const handleSaveEdit = async () => {
    if (!editingTx) return;

    const newCategory = `${selectedMajor} > ${selectedMinor}`;
    const updatedTx: Transaction = {
      ...editingTx,
      type: 'living',
      category: newCategory,
      userConfirmed: true,
      needsReview: false,
      analysisStatus: 'included',
    };

    onUpdateTransaction(updatedTx);

    await GlobalMockDataStore.saveUserMerchantLearning(
      editingTx.merchantOriginal || editingTx.merchant,
      editingTx.merchant,
      selectedMajor,
      selectedMinor
    );

    setEditingTx(null);
  };

  const activeMajorGroup = CONSUMER_CATEGORY_GROUPS.find((g) => g.name === selectedMajor) || CONSUMER_CATEGORY_GROUPS[0];

  return (
    <div className="space-y-4 pb-28">
      {/* Active Session Info Banner (Requirement 3) */}
      <ActiveSessionBanner showActions={true} />

      {/* Header Summary */}
      <div className="my-2 bg-white p-5 rounded-2xl shadow-xs border border-[#c5c5d3]/20 flex justify-between items-center">
        <div>
          <p className="font-label-md text-xs text-[#757682] mb-1">현재 세션 총 소비 지출</p>
          <h2 className="font-dohyeon text-2xl text-[#00236f]">
            -{totalExpense.toLocaleString()}원
          </h2>
        </div>
        <div className="text-right">
          <span className="px-3 py-1 bg-[#00236f]/10 text-[#00236f] text-xs font-bold rounded-full">
            소비 포함 {includedTxs.length}건
          </span>
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-4">
        {groupedDates.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-[#c5c5d3]/20 text-[#757682]">
            <span className="material-symbols-outlined text-4xl mb-2 text-[#c5c5d3]">receipt_long</span>
            <p className="text-sm font-medium">소비로 집계된 지출 내역이 없습니다.</p>
            <p className="text-xs text-[#909090] mt-1">월간결산 메뉴에서 CSV 파일을 업로드하거나 거래를 등록하세요.</p>
          </div>
        ) : (
          groupedDates.map((dateStr) => {
            const itemsOnDate = includedTxs.filter((t) => t.date === dateStr);
            return (
              <div key={dateStr} className="space-y-2">
                <p className="font-label-md text-xs text-[#757682] py-1 border-b border-[#c5c5d3]/20 font-semibold px-1">
                  {dateStr}
                </p>

                {itemsOnDate.map((tx) => {
                  const { major, minor } = parseCategoryString(tx.category);
                  const catGroup = getCategoryGroup(major);
                  const displayCategory = minor ? `${major} > ${minor}` : major;

                  return (
                    <div
                      key={tx.id}
                      className="bg-white p-4 rounded-2xl shadow-xs flex items-center justify-between border border-[#c5c5d3]/20 hover:border-[#00236f]/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: catGroup.bgLight }}
                        >
                          <span
                            className="material-symbols-outlined text-lg"
                            style={{ color: catGroup.color }}
                          >
                            {catGroup.icon}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-[#191c1e]">{tx.merchant}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              style={{ backgroundColor: catGroup.bgLight, color: catGroup.color }}
                            >
                              {displayCategory}
                            </span>
                            {tx.needsReview && (
                              <span className="bg-[#fff7ed] text-[#c2410c] text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#ffedd5]">
                                확인필요
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="font-dohyeon text-base text-[#00236f] block">
                            -{tx.amount.toLocaleString()}원
                          </span>
                          {tx.time && (
                            <span className="text-[10px] text-[#757682] block">{tx.time}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(tx)}
                            className="w-8 h-8 rounded-lg hover:bg-[#f2f4f6] text-[#757682] hover:text-[#00236f] flex items-center justify-center transition-colors cursor-pointer"
                            title="분류 수정"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            onClick={() => onDeleteTransaction(tx.id)}
                            className="w-8 h-8 rounded-lg hover:bg-[#fff0f0] text-[#757682] hover:text-[#ba1a1a] flex items-center justify-center transition-colors cursor-pointer"
                            title="삭제"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* Edit Category Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-[#00236f]/20">
            <div className="flex justify-between items-center border-b border-[#c5c5d3]/20 pb-3">
              <div>
                <h3 className="font-dohyeon text-base text-[#00236f]">거래 분류 수정</h3>
                <p className="text-xs text-[#757682] font-semibold mt-0.5">
                  {editingTx.merchant}
                </p>
              </div>
              <button
                onClick={() => setEditingTx(null)}
                className="text-[#757682] hover:text-[#00236f] text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#191c1e] block mb-1">
                  대분류 선택
                </label>
                <select
                  value={selectedMajor}
                  onChange={(e) => {
                    setSelectedMajor(e.target.value);
                    const group = CONSUMER_CATEGORY_GROUPS.find((g) => g.name === e.target.value);
                    if (group && group.subCategories.length > 0) {
                      setSelectedMinor(group.subCategories[0].name);
                    }
                  }}
                  className="w-full p-2.5 border border-[#c5c5d3] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#00236f]"
                >
                  {CONSUMER_CATEGORY_GROUPS.map((g) => (
                    <option key={g.name} value={g.name}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#191c1e] block mb-1">
                  소분류 선택
                </label>
                <select
                  value={selectedMinor}
                  onChange={(e) => setSelectedMinor(e.target.value)}
                  className="w-full p-2.5 border border-[#c5c5d3] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#00236f]"
                >
                  {activeMajorGroup.subCategories.map((sub) => (
                    <option key={sub.name} value={sub.name}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditingTx(null)}
                className="flex-1 py-2.5 border border-[#c5c5d3]/50 text-[#757682] font-dohyeon text-xs rounded-xl hover:bg-[#f2f4f6] cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-2.5 bg-[#00236f] text-white font-dohyeon text-xs rounded-xl hover:bg-[#1e3a8a] cursor-pointer shadow-xs"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
