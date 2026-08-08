import React, { useState } from 'react';
import { Transaction } from '../types';
import { CONSUMER_CATEGORY_GROUPS } from '../data/consumerCategories';
import { auth } from '../services/firebase';
import { getUserRole } from '../services/householdService';
import { ShieldAlert } from 'lucide-react';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (tx: Transaction) => void;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onAddTransaction,
}) => {
  const [isIncome, setIsIncome] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('식비');
  const [memo, setMemo] = useState('');

  const currentUserEmail = auth.currentUser?.email;
  const userRole = getUserRole(currentUserEmail);
  const isViewer = userRole === 'viewer';

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant || !amount) return;

    const numAmt = Number(amount);
    let icon = 'shopping_bag';
    const foundGroup = CONSUMER_CATEGORY_GROUPS.find((g) => g.name === category);
    if (foundGroup) icon = foundGroup.icon;

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      date: new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }),
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      merchant,
      amount: numAmt,
      type: 'living',
      category,
      icon,
      isIncome,
      memo,
      userConfirmed: true,
    };

    onAddTransaction(newTx);
    setMerchant('');
    setAmount('');
    setMemo('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs transition-opacity">
      <div className="bg-[#f7f9fb] w-full max-w-2xl rounded-t-3xl shadow-2xl p-6 pb-8 border-t border-[#c5c5d3]/30 animate-in slide-in-from-bottom duration-250">
        <div className="w-12 h-1 bg-[#c5c5d3] rounded-full mx-auto mb-4" />

        <div className="flex justify-between items-center mb-4">
          <h2 className="font-dohyeon text-lg text-[#00236f]">새 수입/지출 내역 입력</h2>
          <button onClick={onClose} className="text-[#757682] p-1 hover:text-[#00236f]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Income vs Expense Switch */}
          <div className="flex gap-2 p-1 bg-[#e6e8ea] rounded-xl">
            <button
              type="button"
              onClick={() => setIsIncome(false)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                !isIncome ? 'bg-white text-[#00236f] shadow-xs' : 'text-[#757682]'
              }`}
            >
              지출 (생활비)
            </button>
            <button
              type="button"
              onClick={() => setIsIncome(true)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                isIncome ? 'bg-[#00236f] text-white shadow-xs' : 'text-[#757682]'
              }`}
            >
              수입
            </button>
          </div>

          {/* Merchant */}
          <div className="p-3 bg-white rounded-xl border border-[#c5c5d3]/20">
            <label className="block text-[11px] font-bold text-[#757682] mb-1">
              상호명 / 내역명
            </label>
            <input
              type="text"
              required
              placeholder="예: 스타벅스, GS25, 쿠팡"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="w-full bg-transparent border-none p-0 focus:outline-none text-sm text-[#191c1e] font-bold"
            />
          </div>

          {/* Amount */}
          <div className="p-3 bg-white rounded-xl border border-[#c5c5d3]/20">
            <label className="block text-[11px] font-bold text-[#757682] mb-1">금액 (원)</label>
            <input
              type="number"
              required
              placeholder="예: 15000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent border-none p-0 focus:outline-none text-base text-[#191c1e] font-bold"
            />
          </div>

          {/* Category */}
          <div className="p-3 bg-white rounded-xl border border-[#c5c5d3]/20">
            <label className="block text-[11px] font-bold text-[#757682] mb-1">카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-transparent border-none p-0 focus:outline-none text-sm text-[#191c1e]"
            >
              {CONSUMER_CATEGORY_GROUPS.map((group) => (
                <option key={group.name} value={group.name}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          {/* Memo */}
          <div className="p-3 bg-white rounded-xl border border-[#c5c5d3]/20">
            <label className="block text-[11px] font-bold text-[#757682] mb-1">메모 (선택)</label>
            <input
              type="text"
              placeholder="예: 점심 식대, 선물 구입"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full bg-transparent border-none p-0 focus:outline-none text-sm text-[#191c1e]"
            />
          </div>

          {isViewer && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-800 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
              <span>VIEWER (읽기 전용 계정) 권한입니다. 내역 추가가 제한됩니다.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isViewer}
            className={`w-full py-3.5 font-bold text-sm rounded-xl shadow-md transition-all ${
              isViewer
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-[#00236f] text-white active:scale-95'
            }`}
          >
            {isViewer ? '저장 불가 (VIEWER 권한)' : '저장하기'}
          </button>
        </form>
      </div>
    </div>
  );
};
