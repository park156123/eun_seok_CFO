import React, { useState, useEffect } from 'react';
import { GlobalMockDataStore, ConsumerSpendingSummary } from '../services/dataStore';

interface ActiveSessionBannerProps {
  onStartNewAnalysis?: () => void;
  onConfirmSettlement?: () => void;
  showActions?: boolean;
}

export const ActiveSessionBanner: React.FC<ActiveSessionBannerProps> = ({
  onStartNewAnalysis,
  onConfirmSettlement,
  showActions = true,
}) => {
  const [summary, setSummary] = useState<ConsumerSpendingSummary>(() =>
    GlobalMockDataStore.getConsumerSpendingSummary()
  );
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    const updateSummary = () => {
      setSummary(GlobalMockDataStore.getConsumerSpendingSummary());
    };
    updateSummary();
    const unsubscribe = GlobalMockDataStore.subscribe(() => {
      updateSummary();
    });
    return () => unsubscribe();
  }, []);

  const sessionInfo = summary.activeSessionInfo;

  if (!sessionInfo && summary.totalSessionRawCount === 0) {
    return (
      <div className="bg-[#f0f4fd] border border-[#00236f]/15 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs mb-4 shadow-2xs">
        <div className="flex items-center gap-2 text-[#00236f]">
          <span className="material-symbols-outlined text-lg">info</span>
          <span className="font-medium">
            현재 활성화된 CSV 분석 세션이 없습니다. [월간결산] 화면에서 CSV를 업로드하면 소비 분석이 시작됩니다.
          </span>
        </div>
      </div>
    );
  }

  const handleResetSession = () => {
    if (window.confirm('현재 임시 CSV 분석 세션을 초기화하고 새 분석을 시작하시겠습니까?\n(기본 정보, 수입원, 자산/부채, 분류 규칙, 과거 확정 결산은 유지됩니다.)')) {
      GlobalMockDataStore.resetCurrentCsvSession();
      if (onStartNewAnalysis) {
        onStartNewAnalysis();
      }
    }
  };

  return (
    <div className="bg-[#f0f4fd] border border-[#00236f]/20 rounded-2xl p-4 space-y-3 mb-5 shadow-xs animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#00236f]/10 pb-2.5">
        <div className="flex items-center gap-2 text-[#00236f]">
          <span className="material-symbols-outlined text-xl text-[#00236f]">
            analytics
          </span>
          <span className="font-dohyeon text-sm text-[#00236f]">
            현재 CSV 분석 세션 정보
          </span>
          {sessionInfo?.sourceFileName && (
            <span className="bg-[#00236f] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              {sessionInfo.sourceFileName}
            </span>
          )}
        </div>

        {showActions && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetSession}
              className="px-3 py-1.5 bg-white border border-[#00236f]/20 text-[#00236f] hover:bg-[#00236f] hover:text-white text-xs font-dohyeon rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <span className="material-symbols-outlined text-sm">restart_alt</span>
              새 분석 시작
            </button>

            {onConfirmSettlement && (
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="px-3 py-1.5 bg-[#00236f] text-white hover:bg-[#1e3a8a] text-xs font-dohyeon rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <span className="material-symbols-outlined text-sm">task_alt</span>
                이번 달 결산 확정
              </button>
            )}
          </div>
        )}
      </div>

      {/* Session Details Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="bg-white p-2.5 rounded-xl border border-[#c5c5d3]/20">
          <span className="text-[10px] text-[#757682] block">업로드 일시</span>
          <span className="font-bold text-[#191c1e] text-xs mt-0.5 block truncate">
            {sessionInfo?.importedAt || '정보 없음'}
          </span>
        </div>

        <div className="bg-white p-2.5 rounded-xl border border-[#c5c5d3]/20">
          <span className="text-[10px] text-[#757682] block">분석 대상 기간</span>
          <span className="font-bold text-[#191c1e] text-xs mt-0.5 block truncate">
            {sessionInfo?.dateRange || '기간 정보 없음'}
          </span>
        </div>

        <div className="bg-white p-2.5 rounded-xl border border-[#c5c5d3]/20">
          <span className="text-[10px] text-[#757682] block">소비 포함 거래</span>
          <span className="font-dohyeon text-xs text-[#006c49] mt-0.5 block">
            {summary.totalCount}건 ({summary.totalExpense.toLocaleString()}원)
          </span>
        </div>

        <div className="bg-white p-2.5 rounded-xl border border-[#c5c5d3]/20">
          <span className="text-[10px] text-[#757682] block">제외 / 확인 필요</span>
          <span className="font-bold text-xs mt-0.5 block">
            <span className="text-[#991b1b]">제외 {summary.excludedSummary.count}건</span>
            {' | '}
            <span className="text-[#c2410c]">확인필요 {summary.pendingSummary.count}건</span>
          </span>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-[#00236f]/20">
            <div className="flex items-center gap-2 text-[#00236f]">
              <span className="material-symbols-outlined text-2xl">verified</span>
              <h3 className="font-dohyeon text-base text-[#191c1e]">
                이번 달 결산 확정
              </h3>
            </div>

            <p className="text-xs text-[#444651] leading-relaxed">
              현재 분석 중인 <strong className="text-[#00236f]">{summary.totalCount}건 ({summary.totalExpense.toLocaleString()}원)</strong>의 거래 데이터를 해당 월의 확정 월간결산 기록으로 저장하시겠습니까?
            </p>

            <div className="bg-[#f0f4fd] p-3 rounded-xl border border-[#00236f]/15 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#757682]">소비 지출 합계:</span>
                <span className="font-bold text-[#00236f]">{summary.totalExpense.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#757682]">소비 제외 거래:</span>
                <span className="font-medium text-[#991b1b]">{summary.excludedSummary.count}건</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 bg-white border border-[#c5c5d3]/50 text-[#757682] font-dohyeon text-xs rounded-xl hover:bg-[#f7f9fb] transition-all cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  if (onConfirmSettlement) {
                    onConfirmSettlement();
                  }
                }}
                className="flex-1 py-2.5 bg-[#00236f] text-white font-dohyeon text-xs rounded-xl hover:bg-[#1e3a8a] shadow-xs transition-all cursor-pointer"
              >
                확정하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
