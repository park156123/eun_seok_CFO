import type { IncomingMessage, ServerResponse } from "http";
import { GoogleGenAI } from "@google/genai";

// Vercel Serverless Function Handler (Node.js runtime)
export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse & { status: (code: number) => any; json: (data: any) => any }) {
  // 1. Method check: POST only
  if (req.method !== "POST") {
    if (typeof res.status === "function") {
      res.status(405);
      if (typeof res.json === "function") {
        return res.json({ error: "Method Not Allowed" });
      }
    }
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Method Not Allowed" }));
  }

  // 2. Parse request body
  let input: any;
  try {
    if (req.body && typeof req.body === "object") {
      input = req.body;
    } else if (typeof req.body === "string") {
      input = JSON.parse(req.body);
    } else {
      // Buffer chunks if body parser not present
      const buffers: Uint8Array[] = [];
      for await (const chunk of req) {
        buffers.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      const rawBody = Buffer.concat(buffers).toString("utf-8");
      input = rawBody ? JSON.parse(rawBody) : {};
    }
  } catch (err: any) {
    const errorPayload = { error: "Invalid JSON request body" };
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(errorPayload));
  }

  // Helper function to send JSON response safely
  const sendJson = (statusCode: number, data: any) => {
    if (typeof res.status === "function" && typeof res.json === "function") {
      return res.status(statusCode).json(data);
    }
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(data));
  };

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    // 3. Fallback response if GEMINI_API_KEY is not configured
    if (!apiKey) {
      const isNegative = (input?.current?.netCashFlow || 0) < 0;
      const compMonth = input?.comparison?.month ? `${input.comparison.month.split('-')[1]}월` : '이전 결산';
      const fallbackResult = {
        spendingInsight: input?.comparison
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
      };
      return sendJson(200, fallbackResult);
    }

    // 4. Initialize Gemini client and call model with same exact prompt
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

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
    return sendJson(200, parsed);
  } catch (error: any) {
    console.error("Monthly analysis serverless error:", error);
    return sendJson(500, { error: error.message || "Failed to generate monthly analysis" });
  }
}
