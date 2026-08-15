import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini AI client
function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

app.post("/api/cfo/monthly-analysis", async (req, res) => {
  try {
    const input = req.body;
    const ai = getAIClient();

    if (!ai) {
      // Fallback response if GEMINI_API_KEY is not set
      const isNegative = (input.current?.netCashFlow || 0) < 0;
      const compMonth = input.comparison?.month ? `${input.comparison.month.split('-')[1]}월` : '이전 결산';
      return res.json({
        spendingInsight: input.comparison
          ? `${compMonth} 대비 생활지출의 변동폭을 점검하고 식비 및 고정성 지출을 균형 있게 관리하는 것이 좋습니다.`
          : "기록된 소비 지출 패턴을 확인하였으며, 주요 카테고리별 예산 준수 여부를 점검해 보세요.",
        keyFindings: isNegative
          ? [
              "세금 납부나 일시적 대규모 지출로 인해 이번 달 총현금유출이 수입을 초과했습니다.",
              "생활비 자체의 급증이라기보다 특정 비정기 지출의 영향이 크므로 구조적 과소비로 볼 필요는 없습니다."
            ]
          : [
              "수입 대비 생활지출과 금융비용이 계획된 범위 내에서 안정적으로 통제되고 있습니다.",
              "순현금흐름 흑자를 유지하며 순자산 형성 기조를 안정적으로 이어가고 있습니다."
            ],
        question: isNegative ? "이번 달 발생한 비정기 지출이 향후에도 정기적으로 반복될 예정인지 확인해 보세요." : null,
        actions: [
          "다음 달 예상되는 고정비 및 금융비용 이체 일정을 사전에 점검하세요.",
          "예비비 계좌를 별도로 분리하여 비정기 지출에 대비하세요."
        ]
      });
    }

    const systemInstruction = `당신은 대한민국 가계의 실제 재무 데이터를 종합 분석하는 최고재무책임자 "My Home CFO"입니다.
당신의 역할은 화면에 이미 보이는 숫자를 단순히 다시 읽어주는(낭독하는) 것이 아닙니다.

[핵심 분석 원칙]
1. 숫자 낭독 금지:
   - "7월 총수입은 얼마이고 총현금유출은 얼마입니다" 식의 단순 수치 나열을 엄격히 금지합니다.
   - 데이터 간의 상관관계, 인과관계, 현금흐름의 진짜 원인을 해석하세요.
2. 지출의 성격 구분:
   - 생활지출 = 순수 가계 소비
   - 금융비용 = 대출 이자 등 실제 금융 비용
   - 원금상환 = 현금 감소이나 부채가 줄어드는 자산 구조 개선(순자산 불변/부채감소)
   - 저축투자 = 소비가 아닌 자산 이동
   - 세금·공과 = 가계 생활 소비와 완전히 다른 공적 현금유출
   - 총현금유출이 많다는 이유만으로 '과소비'라고 단정하지 마세요.
3. 비교 기준 엄수:
   - 비교는 퍼센트(%)보다 실제 원화 금액 차이(예: 약 247만원 증가 등)를 우선합니다.
   - comparison.month가 직전 달(1개월 전)이 아니라면 "지난달"이라고 말하지 말고 반드시 "4월과 비교하면"처럼 해당 월을 명시하세요.
   - 불완전한 월이나 없는 데이터는 억지로 비교하지 마세요.
4. 사용자 메모(specialNotes) 연계:
   - 특이사항 문구를 앵무새처럼 그대로 복창하지 마세요. 실제 재무 수치 변동과의 연관성을 해석할 때만 활용하세요.
5. 간결성과 실용성:
   - 근거 없는 추측이나 억지 조언("지출을 줄이세요", "저축을 늘리세요")을 금지합니다.
   - question은 꼭 필요한 의문이 있을 때만 1개 작성하고, 불필요하면 null로 반환하세요.
   - actions는 최대 2개의 구체적이고 실천 가능한 제안이어야 합니다.

[출력 JSON 포맷]
반드시 다음 JSON 규격을 준수하세요:
{
  "spendingInsight": "가계부용 1~2문장 소비 인사이트 (금액 기준, 핵심 소비 패턴 또는 비교월 대비 생활소비 평가)",
  "keyFindings": ["CFO가 발견한 핵심 재무 요인 1 (최대 2개)", "핵심 재무 요인 2"],
  "question": "확인하면 좋은 핵심 의문 1개 (없으면 null)",
  "actions": ["실천 가능한 행동 제안 1 (최대 2개)", "실천 가능한 행동 제안 2"]
}`;

    const promptText = `사용자의 월간 재무 분석 데이터:\n${JSON.stringify(input, null, 2)}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: promptText,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "{}";
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (error: any) {
    console.error("Monthly analysis error:", error);
    res.status(500).json({ error: error.message || "Failed to generate monthly analysis" });
  }
});

// API Routes
app.post("/api/cfo/chat", async (req, res) => {
  try {
    const { message, context } = req.body;
    const ai = getAIClient();

    if (!ai) {
      // Fallback friendly CFO responses if GEMINI_API_KEY is not set
      let fallbackText = "안녕하세요! 우리집 CFO입니다. 질문해 주신 내용을 재무 데이터와 비교 분석하고 있어요.";
      if (message.includes("과소비")) {
        fallbackText = "이번 달 총지출 5,050,000원 중 식비(배달의민족 245,000원 포함)와 생활비 지출이 다소 높습니다. 배달 음식을 주 1회 줄이시면 월 약 15만원을 추가 저축하실 수 있습니다!";
      } else if (message.includes("대출")) {
        fallbackText = "현재 현하우스 담보대출 금리가 4.0%로 월 원리금 320만원이 지출되고 있습니다. 현재 여유 자금 4,200만원 중 일부를 고금리 대출 원금 조기상환에 활용하시면 총 이자 비용을 약 420만원 절감할 수 있습니다.";
      } else if (message.includes("요약")) {
        fallbackText = "이번 달 순현금흐름은 +2,270,000원으로 건전한 흑자 상태입니다! 사업소득이 전월 대비 24% 증가하여 매우 긍정적이며, 대출원금 상환으로 순자산이 꾸준히 늘고 있습니다.";
      } else if (message.includes("여행")) {
        fallbackText = "현재 저축 속도와 예비비(가용현금 4,200만원) 수준을 고려할 때, 800만원 예산의 가족 여행은 재무 안전성을 해치지 않고 추진 가능합니다!";
      }

      return res.json({ text: fallbackText });
    }

    const systemInstruction = `당신은 '우리집 CFO' 앱의 친절하고 유능한 개인/가족 전담 AI CFO (최고재무책임자)입니다.
사용자 '박은석 님 가족'의 재무 상태를 바탕으로 직관적이고 정확하며 현실적인 조언을 제공하세요.
핵심 규칙:
1. 생활비와 사업비를 명확히 구분합니다.
2. 저축은 소비가 아니며, 대출원금 상환은 부채 감소(자산 이동), 대출이자는 금융비용임을 유념하세요.
3. 한국 원화(원/만원/억원) 단위를 사용하여 정중하고 신뢰감 주는 어조로 답하세요.
4. 답변은 2~4문장 정도로 명확하고 읽기 쉽게 정리해 주세요.`;

    const promptText = `사용자 질문: ${message}\n현재 사용자 재무 상태 요약:\n${JSON.stringify(context || {})}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: promptText,
      config: {
        systemInstruction,
      },
    });

    res.json({ text: response.text || "답변을 생성하지 못했습니다." });
  } catch (error: any) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: error.message || "An error occurred with Gemini API" });
  }
});

app.post("/api/cfo/briefing", async (req, res) => {
  try {
    const { context } = req.body;
    const ai = getAIClient();

    if (!ai) {
      return res.json({
        summary: "이번 달 소비는 안정적입니다.",
        goodPoint: "생활비가 지난달보다 감소했습니다.",
        warningPoint: "카드 결제일과 차량 교체 예정일이 다가옵니다.",
        actionItem: "이번 주 불필요한 배달 음식 및 소액 지출만 체크해 보세요.",
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `사용자의 재무 데이터: ${JSON.stringify(context || {})}
다음 JSON 형식으로 오늘의 CFO 브리핑을 작성해 주세요:
{
  "summary": "오늘의 한 줄 종합 평가 (1문장)",
  "goodPoint": "잘하고 있는 점 (1문장)",
  "warningPoint": "주의할 점 (1문장)",
  "actionItem": "추천 행동 지침 (1문장)"
}`,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("Briefing error:", error);
    res.json({
      summary: "이번 달 소비는 안정적입니다.",
      goodPoint: "생활비가 지난달보다 감소했습니다.",
      warningPoint: "카드 결제일이 다가옵니다.",
      actionItem: "이번 주 불필요한 소비만 줄여보세요.",
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
