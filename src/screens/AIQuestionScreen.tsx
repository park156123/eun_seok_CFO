import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

export const AIQuestionScreen: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'ai',
      text: '안녕하세요! 무엇이든 물어보세요. 박은석 님 가족의 재무 데이터를 바탕으로 지능적으로 답변해 드립니다.',
      time: '오전 10:24',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const recommendedQuestions = [
    { text: '이번 달 과소비는?', icon: 'trending_up', bg: 'bg-[#006c49]', textCol: 'text-[#6cf8bb]' },
    { text: '대출 먼저 갚을까?', icon: 'payments', bg: 'bg-[#dce1ff]', textCol: 'text-[#00236f]' },
    { text: '이번 달 요약해줘', icon: 'summarize', bg: 'bg-[#6cf8bb]', textCol: 'text-[#00714d]' },
    { text: '여행 가도 될까?', icon: 'flight_takeoff', bg: 'bg-[#ba1a1a]', textCol: 'text-white' },
  ];

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const res = await fetch('/api/cfo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          context: {
            userName: '박은석',
            netWorth: '12억 4,000만원',
            spendingThisMonth: '5,050,000원',
            livingExpenses: '2,100,000원',
            businessExpenses: '2,950,000원',
            netCashflow: '+2,270,000원',
            availableCash: '4,200,000원',
            loans: [
              { name: '현하우스 담보대출', amount: '5억 2,000만원', rate: '4.0%', monthlyPayment: '320만원' },
              { name: '어머니 차입금', amount: '1억 5,000만원', rate: '무이자' },
            ],
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: data.text || '죄송합니다. 답변을 생성하지 못했습니다.',
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error('API request failed');
      }
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        text: '네트워크 연결을 확인한 후 다시 시도해 주세요.',
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-140px)] pb-36">
      {/* Chat History & Welcome */}
      <div className="flex-1 space-y-6 pt-4">
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-3 max-w-[90%]">
            {msg.sender === 'ai' ? (
              <>
                <div className="w-10 h-10 rounded-2xl bg-[#1e3a8a] flex items-center justify-center shrink-0 shadow-xs">
                  <span
                    className="material-symbols-outlined text-[#90a8ff]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    psychology
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="bg-white p-4 rounded-2xl rounded-tl-xs shadow-[0_4px_12px_rgba(0,35,111,0.05)] border border-[#c5c5d3]/20 text-[#191c1e] text-sm leading-relaxed">
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-[#757682] px-1 block">{msg.time}</span>
                </div>
              </>
            ) : (
              <div className="ml-auto space-y-1 text-right">
                <div className="bg-[#00236f] text-white p-4 rounded-2xl rounded-tr-xs shadow-xs text-sm leading-relaxed inline-block text-left">
                  {msg.text}
                </div>
                <span className="text-[10px] text-[#757682] px-1 block">{msg.time}</span>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 max-w-[85%] items-center">
            <div className="w-10 h-10 rounded-2xl bg-[#1e3a8a] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#90a8ff] animate-pulse">
                smart_toy
              </span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-[#c5c5d3]/20 text-xs text-[#757682] flex items-center gap-2">
              <span className="animate-spin text-[#00236f] text-sm">autorenew</span>
              AI CFO가 질문을 분석하고 있습니다...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Recommended Questions Section */}
      <section className="py-4 mt-2">
        <div className="flex items-center gap-2 mb-3">
          <span
            className="material-symbols-outlined text-[#006c49] text-sm"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>
          <h2 className="font-dohyeon text-base text-[#00236f]">추천 질문</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {recommendedQuestions.map((q, idx) => (
            <button
              key={idx}
              id={`recommended-q-${idx}`}
              onClick={() => handleSend(q.text)}
              className="flex flex-col items-start p-4 bg-white rounded-2xl border border-[#c5c5d3]/20 shadow-xs hover:bg-[#dce1ff]/30 transition-all text-left group active:scale-95"
            >
              <span
                className={`material-symbols-outlined ${q.bg} ${q.textCol} px-1.5 py-1 rounded-md mb-2 text-sm`}
              >
                {q.icon}
              </span>
              <span className="font-body-md text-sm font-semibold text-[#444651] group-hover:text-[#00236f]">
                {q.text}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Floating Chat Input Area */}
      <div className="fixed bottom-18 left-0 right-0 z-40 px-4 pb-4 bg-gradient-to-t from-[#f7f9fb] via-[#f7f9fb]/90 to-transparent">
        <div className="max-w-2xl mx-auto flex gap-2 bg-white p-2.5 rounded-3xl shadow-[0_8px_24px_rgba(0,35,111,0.08)] border border-[#c5c5d3]/30 items-center">
          <input
            id="cfo-chat-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            placeholder="궁금한 재무 정보를 물어보세요..."
            className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm px-3 text-[#191c1e] placeholder:text-[#757682]/70"
          />
          <button
            id="cfo-chat-send-btn"
            onClick={() => handleSend()}
            disabled={!inputText.trim() || loading}
            className="bg-[#00236f] text-white w-11 h-11 rounded-2xl flex items-center justify-center active:scale-90 transition-transform shadow-sm disabled:opacity-40"
            aria-label="Send"
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              send
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
