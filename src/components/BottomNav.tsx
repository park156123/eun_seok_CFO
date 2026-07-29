import React from 'react';
import { ScreenId, MainTab } from '../types';

interface BottomNavProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentScreen, onNavigate }) => {
  // Determine active main tab based on screen prefix
  let activeTab: MainTab = 'home';
  if (currentScreen.startsWith('1-')) activeTab = 'home';
  else if (currentScreen.startsWith('2-')) activeTab = 'ledger';
  else if (currentScreen.startsWith('3-')) activeTab = 'assets';
  else if (currentScreen.startsWith('4-')) activeTab = 'planner';

  const tabs: { id: MainTab; defaultScreen: ScreenId; label: string; icon: string }[] = [
    { id: 'home', defaultScreen: '1-0', label: '홈', icon: 'home' },
    { id: 'ledger', defaultScreen: '2-0', label: '가계부', icon: 'account_balance_wallet' },
    { id: 'assets', defaultScreen: '3-0', label: '자산', icon: 'payments' },
    { id: 'planner', defaultScreen: '4-0', label: '플래너', icon: 'calendar_month' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-[#f7f9fb]/90 backdrop-blur-lg border-t border-[#c5c5d3]/30 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] h-18 pb-safe flex justify-around items-center px-2">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`nav-tab-${tab.id}`}
            onClick={() => onNavigate(tab.defaultScreen)}
            className={`flex flex-col items-center justify-center px-4 py-1.5 rounded-2xl transition-all duration-200 active:scale-90 ${
              isActive
                ? 'bg-[#6cf8bb] text-[#00714d] font-bold shadow-sm'
                : 'text-[#444651] hover:text-[#00236f]'
            }`}
          >
            <span
              className="material-symbols-outlined text-[24px] mb-0.5"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {tab.icon}
            </span>
            <span className="font-label-md text-[12px]">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
