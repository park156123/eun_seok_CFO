import React, { useState } from 'react';
import { Transaction, ExpenseType } from '../types';

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
  const [filter, setFilter] = useState<'all' | 'living' | 'business'>('all');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Filter transactions
  const filtered = transactions.filter((t) => {
    if (filter === 'living') return t.type === 'living';
    if (filter === 'business') return t.type === 'business';
    return true;
  });

  const totalExpense = filtered
    .filter((t) => !t.isIncome)
    .reduce((sum, t) => sum + t.amount, 0);

  // Group by date
  const groupedDates = Array.from(new Set(filtered.map((t) => t.date)));

  return (
    <div className="space-y-4 pb-28">
      {/* Filter Tabs */}
      <section className="sticky top-16 bg-[#f7f9fb] py-2 z-30">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button
            id="filter-chip-all"
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-full font-label-md text-xs transition-all ${
              filter === 'all'
                ? 'bg-[#00236f] text-white shadow-xs'
                : 'bg-white text-[#444651] border border-[#c5c5d3]/30 hover:bg-[#f2f4f6]'
            }`}
          >
            전체
          </button>
          <button
            id="filter-chip-living"
            onClick={() => setFilter('living')}
            className={`px-4 py-2 rounded-full font-label-md text-xs transition-all ${
              filter === 'living'
                ? 'bg-[#00236f] text-white shadow-xs'
                : 'bg-white text-[#444651] border border-[#c5c5d3]/30 hover:bg-[#f2f4f6]'
            }`}
          >
            생활비
          </button>
          <button
            id="filter-chip-business"
            onClick={() => setFilter('business')}
            className={`px-4 py-2 rounded-full font-label-md text-xs transition-all ${
              filter === 'business'
                ? 'bg-[#00236f] text-white shadow-xs'
                : 'bg-white text-[#444651] border border-[#c5c5d3]/30 hover:bg-[#f2f4f6]'
            }`}
          >
            사업비
          </button>
        </div>
      </section>

      {/* Summary */}
      <div className="my-2">
        <p className="font-label-md text-xs text-[#444651] mb-1">총 지출</p>
        <h2 className="font-dohyeon text-2xl text-[#00236f]">
          {totalExpense.toLocaleString()}원
        </h2>
      </div>

      {/* Transaction List */}
      <div className="space-y-4">
        {groupedDates.map((dateStr) => {
          const itemsOnDate = filtered.filter((t) => t.date === dateStr);
          return (
            <div key={dateStr} className="space-y-2">
              <p className="font-label-md text-xs text-[#757682] py-1 border-b border-[#c5c5d3]/20">
                {dateStr}
              </p>

              {itemsOnDate.map((tx) => (
                <div
                  key={tx.id}
                  id={`tx-card-${tx.id}`}
                  onClick={() => setEditingTx(tx)}
                  className="group bg-white rounded-2xl p-4 shadow-[0_4px_12px_rgba(49,46,129,0.05)] border border-[#eceef0] flex items-center gap-3 transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer active:scale-[0.98]"
                >
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                      tx.type === 'business'
                        ? 'bg-[#ffdad6] text-[#93000a]'
                        : tx.category === '식비'
                        ? 'bg-[#1e3a8a] text-[#90a8ff]'
                        : 'bg-[#ffddb8] text-[#653e00]'
                    }`}
                  >
                    <span className="material-symbols-outlined">{tx.icon || 'receipt'}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-body-md text-sm font-bold text-[#191c1e] truncate">
                        {tx.merchant}
                      </h3>
                      <span className="font-dohyeon text-base text-[#00236f]">
                        -{tx.amount.toLocaleString()}원
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                          tx.type === 'business'
                            ? 'bg-[#5c3800] text-[#ef9900]'
                            : 'bg-[#6cf8bb]/30 text-[#00714d]'
                        }`}
                      >
                        {tx.type === 'business' ? '사업비' : tx.category}
                      </span>
                      <span className="font-body-sm text-xs text-[#444651]">{tx.time}</span>
                    </div>
                  </div>

                  <span className="material-symbols-outlined text-[#c5c5d3] group-hover:text-[#00236f] transition-colors">
                    chevron_right
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Bottom Sheet Modal for Editing Transaction */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs transition-opacity">
          <div className="bg-[#f7f9fb] w-full max-w-2xl rounded-t-3xl shadow-2xl p-6 pb-8 border-t border-[#c5c5d3]/30 animate-in slide-in-from-bottom duration-250">
            <div className="w-12 h-1 bg-[#c5c5d3] rounded-full mx-auto mb-5" />

            <div className="flex justify-between items-center mb-4">
              <h2 className="font-dohyeon text-lg text-[#00236f]">거래 내역 상세 수정</h2>
              <button
                id="close-edit-sheet-btn"
                onClick={() => setEditingTx(null)}
                className="text-[#757682] hover:text-[#00236f] p-1"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {/* Type Switcher */}
              <div className="flex gap-2 p-1 bg-[#e6e8ea] rounded-xl mb-2">
                <button
                  type="button"
                  onClick={() => setEditingTx({ ...editingTx, type: 'living' })}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    editingTx.type === 'living'
                      ? 'bg-white text-[#00236f] shadow-xs'
                      : 'text-[#757682]'
                  }`}
                >
                  생활비
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTx({ ...editingTx, type: 'business' })}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    editingTx.type === 'business'
                      ? 'bg-[#006c49] text-white shadow-xs'
                      : 'text-[#757682]'
                  }`}
                >
                  사업비
                </button>
              </div>

              {/* Merchant */}
              <div className="p-3 bg-white rounded-xl border border-[#c5c5d3]/20">
                <label className="block text-[11px] font-bold text-[#757682] mb-1">거래처</label>
                <input
                  type="text"
                  value={editingTx.merchant}
                  onChange={(e) => setEditingTx({ ...editingTx, merchant: e.target.value })}
                  className="w-full bg-transparent border-none p-0 focus:outline-none font-body-lg text-base text-[#191c1e] font-semibold"
                />
              </div>

              {/* Amount */}
              <div className="p-3 bg-white rounded-xl border border-[#c5c5d3]/20">
                <label className="block text-[11px] font-bold text-[#757682] mb-1">금액</label>
                <input
                  type="number"
                  value={editingTx.amount}
                  onChange={(e) => setEditingTx({ ...editingTx, amount: Number(e.target.value) || 0 })}
                  className="w-full bg-transparent border-none p-0 focus:outline-none font-body-lg text-base text-[#191c1e] font-semibold"
                />
              </div>

              {/* Category */}
              <div className="p-3 bg-white rounded-xl border border-[#c5c5d3]/20">
                <label className="block text-[11px] font-bold text-[#757682] mb-1">카테고리</label>
                <select
                  value={editingTx.category}
                  onChange={(e) => setEditingTx({ ...editingTx, category: e.target.value })}
                  className="w-full bg-transparent border-none p-0 focus:outline-none font-body-lg text-sm text-[#191c1e]"
                >
                  <option value="식비">식비</option>
                  <option value="생활비">생활비</option>
                  <option value="교통">교통</option>
                  <option value="주거/통신">주거/통신</option>
                  <option value="사업비">사업비</option>
                  <option value="기타">기타</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                id="delete-tx-btn"
                onClick={() => {
                  onDeleteTransaction(editingTx.id);
                  setEditingTx(null);
                }}
                className="px-4 py-3.5 bg-[#ffdad6] text-[#ba1a1a] font-bold text-sm rounded-xl hover:bg-[#ffdad6]/80 transition-transform active:scale-95 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-lg">delete</span>
              </button>

              <button
                id="save-tx-btn"
                onClick={() => {
                  onUpdateTransaction(editingTx);
                  setEditingTx(null);
                }}
                className="flex-1 py-3.5 bg-[#00236f] text-white font-bold text-sm rounded-xl shadow-md transition-transform active:scale-95"
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
