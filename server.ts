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
