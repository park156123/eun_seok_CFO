import React, { useState, useEffect } from 'react';
import { ScreenId } from '../types';

interface AIBriefingScreenProps {
  onNavigate: (screen: ScreenId) => void;
}

export const AIBriefingScreen: React.FC<AIBriefingScreenProps> = () => {
  const [briefing, setBriefing] = useState({
    summary: '오늘의 한 줄: 이번 달 소비는 안정적입니다.',
    goodPoint: '생활비가 지난달보다 감소했습니다',
    warningPoint: '카드 결제일이 다가옵니다',
    actionItem: '이번 주 불필요한 소비만 줄여보세요',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Optionally fetch live Gemini AI briefing
    async function loadBriefing() {
      try {
        setLoading(true);
        const res = await fetch('/api/cfo/briefing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: {
              netWorth: '12억 4,000만원',
              spending: '5,050,000원',
              status: '흑자',
            },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.summary) {
            setBriefing({
              summary: data.summary.startsWith('오늘의') ? data.summary : `오늘의 한 줄: ${data.summary}`,
              goodPoint: data.goodPoint || briefing.goodPoint,
              warningPoint: data.warningPoint || briefing.warningPoint,
              actionItem: data.actionItem || briefing.actionItem,
            });
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadBriefing();
  }, []);

  return (
    <div className="space-y-4 pb-28">
      {/* CFO Insight Hero Card */}
      <section className="relative overflow-hidden rounded-2xl bg-[#1e3a8a] p-6 text-white shadow-md">
        <div className="flex items-start gap-4">
          <div className="bg-white/10 p-3 rounded-2xl flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-3xl text-white"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              smart_toy
            </span>
          </div>
          <div>
            <h2 className="font-dohyeon text-lg text-white/80 mb-1">CFO의 통찰</h2>
            <p className="font-body-lg text-lg text-white leading-snug font-medium">
              {loading ? 'AI 분석 중...' : briefing.summary}
            </p>
          </div>
        </div>
        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
      </section>

      {/* Analysis Grid Cards */}
      <div className="space-y-3">
        {/* Good Point */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_4px_12px_rgba(30,58,138,0.05)] border border-[#c5c5d3]/30 flex items-center gap-4 active:scale-[0.98] transition-transform">
          <div className="w-12 h-12 rounded-full bg-[#6cf8bb]/30 flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-[#00714d] text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
          </div>
          <div className="flex-1">
            <h3 className="font-dohyeon text-base text-[#191c1e] mb-0.5">좋은 점</h3>
            <p className="font-body-md text-sm text-[#444651]">{briefing.goodPoint}</p>
          </div>
        </div>

        {/* Warning Point */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_4px_12px_rgba(30,58,138,0.05)] border border-[#c5c5d3]/30 flex items-center gap-4 active:scale-[0.98] transition-transform">
          <div className="w-12 h-12 rounded-full bg-[#ffddb8]/40 flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-[#653e00] text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              error
            </span>
          </div>
          <div className="flex-1">
            <h3 className="font-dohyeon text-base text-[#191c1e] mb-0.5">주의할 점</h3>
            <p className="font-body-md text-sm text-[#444651]">{briefing.warningPoint}</p>
          </div>
        </div>

        {/* Recommended Action */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_4px_12px_rgba(30,58,138,0.05)] border border-[#c5c5d3]/30 flex items-center gap-4 active:scale-[0.98] transition-transform">
          <div className="w-12 h-12 rounded-full bg-[#dce1ff]/50 flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-[#00236f] text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              lightbulb
            </span>
          </div>
          <div className="flex-1">
            <h3 className="font-dohyeon text-base text-[#191c1e] mb-0.5">추천 행동</h3>
            <p className="font-body-md text-sm text-[#444651]">{briefing.actionItem}</p>
          </div>
        </div>
      </div>

      {/* Visual Content Section */}
      <div className="mt-6 rounded-2xl overflow-hidden h-48 relative shadow-xs">
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAYMH8-eLyZAW5ZOkWFr0RcjpDUB8r4otCYZyzUColmTBkntx05yb3JXXnkzXUBaRZ39pYEmmav4khO4NLuHo6qEphe8HRVoYq5Z4fxq2d3udul1C_oNDS1095y2LDjqejeQtUNVxKeA2TSg-Z3DQnhkyBrKhKh2gSmcYbexcHRJVmDAvMg_nbl67hTpcHw8QS8Bt-T7dFXjpmEoLB9Ej1ao0gZYh7zboCsEirLCE7hj3oacrV7WQQk"
          alt="Clean modern home office"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#f7f9fb]/90 via-[#f7f9fb]/40 to-transparent flex items-end p-5">
          <p className="font-body-sm text-sm text-[#00236f] font-bold">
            AI 브리핑 (상세): 안정적인 자산 관리가 이어지고 있어요.
          </p>
        </div>
      </div>
    </div>
  );
};
