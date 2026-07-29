import React from 'react';

export const SpendingAnalysisScreen: React.FC = () => {
  const categoryData = [
    { name: '식비', percentage: 45, amount: 784000, color: '#00236f' },
    { name: '주거/통신', percentage: 20, amount: 348000, color: '#4edea3' },
    { name: '교통', percentage: 15, amount: 261000, color: '#ef9900' },
    { name: '생활', percentage: 10, amount: 174000, color: '#b6c4ff' },
    { name: '기타', percentage: 10, amount: 174000, color: '#e0e3e5' },
  ];

  const top5Merchants = [
    { rank: 1, name: '배달의민족', category: '식비', amount: 245000, borderColor: 'border-l-[#00236f]' },
    { rank: 2, name: '쿠팡', category: '생활', amount: 182000, borderColor: 'border-l-[#00236f]/60' },
    { rank: 3, name: '현대오일뱅크', category: '교통', amount: 120000, borderColor: 'border-l-[#00236f]/40' },
    { rank: 4, name: '이마트', category: '식비', amount: 95000, borderColor: 'border-l-[#c5c5d3]' },
    { rank: 5, name: '스타벅스', category: '식비', amount: 68000, borderColor: 'border-l-[#c5c5d3]/50' },
  ];

  return (
    <div className="space-y-6 pb-28">
      {/* AI One-line Analysis Card */}
      <section className="relative overflow-hidden bg-[#1e3a8a] text-white p-5 rounded-2xl shadow-md">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-[#6ffbbe] text-2xl shrink-0">
            auto_awesome
          </span>
          <p className="font-body-md text-sm leading-relaxed">
            식비 비중이 가장 높습니다. <br />
            <span className="font-bold text-[#6ffbbe]">배달 음식을 줄이면 15만원</span>을 아낄 수 있어요! ✨
          </p>
        </div>
        <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
      </section>

      {/* Category Donut Chart Section */}
      <section className="bg-white p-6 rounded-2xl shadow-xs border border-[#c5c5d3]/20 space-y-6">
        <h2 className="font-dohyeon text-lg text-[#00236f]">카테고리별 소비 비율</h2>

        <div className="flex flex-col items-center gap-6">
          {/* Conic Gradient SVG or Styled Ring Donut */}
          <div className="relative w-48 h-48 flex items-center justify-center">
            <div
              className="w-full h-full rounded-full shadow-inner"
              style={{
                background: `conic-gradient(
                  #00236f 0% 45%,
                  #4edea3 45% 65%,
                  #ef9900 65% 80%,
                  #b6c4ff 80% 90%,
                  #e0e3e5 90% 100%
                )`,
              }}
            />
            {/* Center cutout */}
            <div className="absolute w-28 h-28 bg-[#f7f9fb] rounded-full flex flex-col items-center justify-center shadow-xs">
              <span className="font-label-md text-[10px] text-[#757682]">총 지출액</span>
              <span className="font-dohyeon text-base text-[#00236f]">1,742,000원</span>
            </div>
          </div>

          {/* Category Legend List */}
          <div className="w-full space-y-3">
            {categoryData.map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-body-sm text-xs text-[#444651] font-medium">{cat.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-dohyeon text-base text-[#00236f] mr-2">
                    {cat.percentage}%
                  </span>
                  <span className="font-label-md text-xs text-[#757682]">
                    {cat.amount.toLocaleString()}원
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TOP 5 Most Spent Merchants */}
      <section className="space-y-3">
        <h2 className="font-dohyeon text-lg text-[#00236f] flex items-center gap-2 px-1">
          <span className="material-symbols-outlined text-[#006c49]">trending_up</span>
          가장 많이 쓴 곳 TOP 5
        </h2>

        <div className="flex flex-col gap-2.5">
          {top5Merchants.map((item) => (
            <div
              key={item.rank}
              className={`bg-white p-4 rounded-xl shadow-xs flex items-center justify-between border-l-4 ${item.borderColor} border-y border-r border-[#c5c5d3]/20 hover:shadow-md transition-all`}
            >
              <div className="flex items-center gap-4">
                <span className="font-dohyeon text-lg text-[#00236f]/40 w-5 text-center">
                  {item.rank}
                </span>
                <div>
                  <p className="font-body-md font-bold text-sm text-[#191c1e]">{item.name}</p>
                  <p className="font-label-md text-[11px] text-[#757682]">{item.category}</p>
                </div>
              </div>
              <p className="font-body-lg font-bold text-base text-[#00236f]">
                {item.amount.toLocaleString()}원
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
