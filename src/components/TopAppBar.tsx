import React from 'react';
import { ScreenId } from '../types';

interface TopAppBarProps {
  currentScreen: ScreenId;
  title?: string;
  onBack?: () => void;
  onNavigate?: (screen: ScreenId) => void;
  showProfile?: boolean;
  showBack?: boolean;
  actions?: React.ReactNode;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  currentScreen,
  title,
  onBack,
  onNavigate,
  showProfile,
  showBack,
  actions,
}) => {
  // Map screen to title if not explicitly passed
  let screenTitle = title;
  if (!screenTitle) {
    switch (currentScreen) {
      case '1-0':
        screenTitle = 'My Home CFO';
        break;
      case '1-1':
        screenTitle = 'AI 브리핑';
        break;
      case '1-2':
        screenTitle = 'AI 질문';
        break;
      case '2-0':
        screenTitle = '가계부';
        break;
      case '2-1':
        screenTitle = '지출내역';
        break;
      case '2-2':
        screenTitle = '소비분석';
        break;
      case '2-3':
        screenTitle = '월간결산';
        break;
      case '3-0':
        screenTitle = '자산';
        break;
      case '3-1':
        screenTitle = '자산·부채';
        break;
      case '3-2':
        screenTitle = '현금흐름';
        break;
      case '4-0':
      case '4-1':
        screenTitle = '플래너';
        break;
      case '4-2':
        screenTitle = '목표·시뮬레이션';
        break;
      default:
        screenTitle = '우리집 CFO';
    }
  }

  const isDetailScreen =
    showBack ??
    (currentScreen !== '1-0' &&
      currentScreen !== '2-0' &&
      currentScreen !== '3-0' &&
      currentScreen !== '4-0' &&
      currentScreen !== '4-1');

  // Back destination fallback logic
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (onNavigate) {
      if (currentScreen.startsWith('1-')) onNavigate('1-0');
      else if (currentScreen.startsWith('2-')) onNavigate('2-0');
      else if (currentScreen.startsWith('3-')) onNavigate('3-0');
      else if (currentScreen.startsWith('4-')) onNavigate('4-1');
    }
  };

  return (
    <header className="sticky top-0 w-full z-40 bg-[#f7f9fb]/90 backdrop-blur-md border-b border-[#c5c5d3]/20 shadow-xs flex items-center justify-between px-5 h-16 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        {isDetailScreen ? (
          <button
            id="top-back-button"
            onClick={handleBack}
            className="p-1 rounded-full text-[#00236f] hover:bg-[#e6e8ea] active:scale-95 transition-all"
            aria-label="Back"
          >
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
        ) : showProfile ? (
          <div className="w-9 h-9 rounded-full overflow-hidden bg-[#dce1ff] shrink-0 border border-white shadow-xs">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAAxMJSdIsPQrNQoABMjOs3VeUvFngu582mbR15Is14VgGCuLtnAh407uJ_JhdjvzvSw7Jjzt36jGs6TCsTaHHAN7mLh7SsVcqwTBDFnQ8nO5jFcD0Db2rg7fCQ_ram0gZoLlnneaFvMfXhjYzUSXjpCDeDoWp4yTIf8SVJPWnUFhwusj7pp6_NaHQlbHo9NWMrHphPqiJihE5gG9JAPuZTRuL7rsZ3PlL6neJL_aOxXnwt1LkVTIgJ"
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
        ) : null}

        <h1 className="font-dohyeon text-[22px] text-[#00236f] leading-none tracking-tight">
          {screenTitle}
        </h1>
      </div>

      <div className="flex items-center gap-1">
        {actions || (
          <button
            id="notifications-button"
            className="w-10 h-10 flex items-center justify-center rounded-full text-[#00236f] hover:bg-[#e6e8ea] active:scale-95 transition-all"
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined text-[24px]">notifications</span>
          </button>
        )}
      </div>
    </header>
  );
};
