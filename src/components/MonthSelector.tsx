import React, { useState } from 'react';
import {
  formatYearMonth,
  getPrevMonth,
  getNextMonth,
  parseToYyyyMm,
} from '../context/SelectedMonthContext';

interface MonthSelectorProps {
  selectedMonth: string; // 'YYYY-MM' or 'YYYY년 M월'
  onChangeMonth: (newMonth: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showDropdownPicker?: boolean;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  selectedMonth,
  onChangeMonth,
  className = '',
  size = 'md',
}) => {
  const normalizedYyyyMm = parseToYyyyMm(selectedMonth);
  const formatted = formatYearMonth(normalizedYyyyMm);

  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const handlePrev = () => {
    onChangeMonth(getPrevMonth(normalizedYyyyMm));
  };

  const handleNext = () => {
    onChangeMonth(getNextMonth(normalizedYyyyMm));
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      onChangeMonth(e.target.value);
      setIsPickerOpen(false);
    }
  };

  // Pre-generate recent and upcoming month options for simple dropdown menu
  const generateMonthOptions = () => {
    const options: string[] = [];
    const [currYStr] = normalizedYyyyMm.split('-');
    const currY = parseInt(currYStr, 10) || 2026;

    for (let y = currY - 1; y <= currY + 1; y++) {
      for (let m = 1; m <= 12; m++) {
        options.push(`${y}-${String(m).padStart(2, '0')}`);
      }
    }
    return options;
  };

  const monthOptions = generateMonthOptions();

  return (
    <div className={`inline-flex items-center gap-1.5 bg-white border border-[#c5c5d3]/40 rounded-xl p-1 shadow-2xs relative ${className}`}>
      {/* Prev Month Button */}
      <button
        type="button"
        onClick={handlePrev}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#444651] hover:bg-[#00236f]/10 hover:text-[#00236f] transition-colors cursor-pointer active:scale-95"
        title="이전 달"
        aria-label="이전 달 이동"
      >
        <span className="material-symbols-outlined text-lg">chevron_left</span>
      </button>

      {/* Main Month Button / Dropdown Trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsPickerOpen(!isPickerOpen)}
          className="px-2.5 py-1 rounded-lg hover:bg-[#00236f]/5 transition-colors font-dohyeon text-sm text-[#00236f] flex items-center gap-1 cursor-pointer"
        >
          <span>{formatted}</span>
          <span className={`material-symbols-outlined text-base transition-transform ${isPickerOpen ? 'rotate-180' : ''}`}>
            arrow_drop_down
          </span>
        </button>

        {/* Dropdown Menu */}
        {isPickerOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 max-h-60 overflow-y-auto bg-white border border-[#c5c5d3]/40 rounded-xl shadow-xl z-50 p-1 space-y-0.5">
            <div className="p-2 border-b border-[#eceef0] flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#757682]">월 선택</span>
              <input
                type="month"
                value={normalizedYyyyMm}
                onChange={handleDateInputChange}
                className="text-xs border rounded px-1 py-0.5 bg-[#f7f9fb]"
              />
            </div>
            {monthOptions.map((opt) => {
              const isSelected = opt === normalizedYyyyMm;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChangeMonth(opt);
                    setIsPickerOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-[#00236f] text-white'
                      : 'hover:bg-[#f0f4fd] text-[#191c1e]'
                  }`}
                >
                  <span>{formatYearMonth(opt)}</span>
                  {isSelected && (
                    <span className="material-symbols-outlined text-sm">check</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Next Month Button */}
      <button
        type="button"
        onClick={handleNext}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#444651] hover:bg-[#00236f]/10 hover:text-[#00236f] transition-colors cursor-pointer active:scale-95"
        title="다음 달"
        aria-label="다음 달 이동"
      >
        <span className="material-symbols-outlined text-lg">chevron_right</span>
      </button>
    </div>
  );
};
