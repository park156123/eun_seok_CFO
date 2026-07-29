import React, { useState } from 'react';
import { Transaction, ExpenseType } from '../types';

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
  const [expenseType, setExpenseType] = useState<ExpenseType>('living');
  const [isIncome, setIsIncome] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('식비');
  const [memo, setMemo] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant || !amount) return;

    const numAmt = Number(amount);
    let icon = 'shopping_bag';
    if (category === '식비') icon = 'restaurant';
    else if (category === '교통') icon = 'directions_subway';
    else if (category === '주거/통신') icon = 'home';
    else if (category === '사업비') icon = 'work';

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      date: new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }),
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      merchant,
      amount: numAmt,
      type: expenseType,
      category,
      icon,
      isIncome,
      memo,
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
          {/* Income vs Expense & Living vs Business Switch */}
          <div className="flex gap-2 p-1 bg-[#e6e8ea] rounded-xl">
            <button
              type="button"
              onClick={() => {
                setIsIncome(false);
                setExpenseType('living');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                !isIncome && expenseType === 'living'
                  ? 'bg-white text-[#00236f] shadow-xs'
                  : 'text-[#757682]'
              }`}
            >
              생활비 (지출)
            </button>
            <button
              type="button"
              onClick={() => {
                setIsIncome(false);
                setExpenseType('business');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                !isIncome && expenseType === 'business'
                  ? 'bg-[#006c49] text-white shadow-xs'
                  : 'text-[#757682]'
              }`}
            >
              사업비 (지출)
            </button>
            <button
              type="button"
              onClick={() => {
                setIsIncome(true);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                isIncome ? 'bg-[#1e3a8a] text-white shadow-xs' : 'text-[#757682]'
              }`}
            >
              수입
            </button>
          </div>

          {/* Merchant */}
          <div className="p-3 bg-white rounded-xl border border-[#c5c5d3]/20">
            <label className="block text-[11px] font-bold text-[#757682] mb-1">
              거래처 / 내역명
            </label>
            <input
              type="text"
              required
              placeholder="예: 스타벅스, 쿠팡, 클라우드 결제"
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
              <option value="식비">식비</option>
              <option value="생활비">생활비</option>
              <option value="교통">교통</option>
              <option value="주거/통신">주거/통신</option>
              <option value="사업비">사업비</option>
              <option value="기타">기타</option>
            </select>
          </div>

          {/* Memo */}
          <div className="p-3 bg-white rounded-xl border border-[#c5c5d3]/20">
            <label className="block text-[11px] font-bold text-[#757682] mb-1">메모</label>
            <input
              type="text"
              placeholder="간단한 메모 입력"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full bg-transparent border-none p-0 focus:outline-none text-xs text-[#191c1e]"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-[#00236f] text-white font-bold text-sm rounded-xl shadow-md transition-transform active:scale-95"
          >
            내역 저장하기
          </button>
        </form>
      </div>
    </div>
  );
};
