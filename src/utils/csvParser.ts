import Papa from 'papaparse';
import { ReviewTransaction } from '../screens/MonthlySettlementScreen';

export interface ColumnMapping {
  dateCol: string;
  merchantCol: string; // 보낸분/받는분, 상대방, 가맹점, 거래처
  transactionTypeCol?: string; // 적요, 거래구분
  transferMemoCol?: string; // 송금메모, 메모, 비고
  amountCol: string; // 출금액, 결제금액
  depositCol?: string; // 입금액
  balanceCol?: string; // 잔액
}

export interface CsvValidationStats {
  totalCount: number; // 총 거래 건수
  validDateCount: number; // 날짜 인식 건수
  validMerchantCount: number; // 거래처 인식 건수
  validAmountCount: number; // 금액 인식 건수
  errorCount: number; // 파싱 오류 건수
}

export interface CsvParseResult {
  headers: string[];
  rawRows: Record<string, string>[];
  detectedMapping: ColumnMapping;
  hasAutoMapping: boolean;
  transactions: ReviewTransaction[];
  totalRows: number;
  stats: CsvValidationStats;
}

// 헤더 후보 키워드 정의
const DATE_CANDIDATES = [
  '거래일시',
  '거래일',
  '이용일',
  '승인일',
  '사용일',
  '일자',
  '날짜',
  '일시',
  'date',
  'transaction_date',
];

// 보낸분/받는분 등 실제 거래처 후보 (적요는 제외)
const MERCHANT_CANDIDATES = [
  '보낸분/받는분',
  '보낸분',
  '받는분',
  '상대방',
  '가맹점',
  '가맹점명',
  '거래처',
  '이용가맹점',
  '상호',
  '상호명',
  'merchant',
  'payee',
  'description',
];

const TRANSACTION_TYPE_CANDIDATES = [
  '적요',
  '거래방식',
  '거래구분',
  '구분',
  '적요명',
  'type',
];

const TRANSFER_MEMO_CANDIDATES = [
  '송금메모',
  '메모',
  '내용',
  '비고',
  'memo',
];

const AMOUNT_CANDIDATES = [
  '출금액',
  '출금금액',
  '결제금액',
  '거래금액',
  '사용금액',
  '이용금액',
  '승인금액',
  '지출금액',
  '찾으신금액',
  '출금',
  '금액',
  'amount',
  'debit',
];

const DEPOSIT_CANDIDATES = [
  '입금액',
  '입금금액',
  '맡기신금액',
  '입금',
  '수입금액',
  'credit',
];

const BALANCE_CANDIDATES = [
  '잔액',
  '거래후잔액',
  '잔액(원)',
  'balance',
];

/**
 * 1. EUC-KR / CP949 / UTF-8 인코딩 자동 감지 읽기
 */
export async function readCsvFileWithEncoding(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
  const utf8Text = utf8Decoder.decode(arrayBuffer);

  if (utf8Text.includes('\uFFFD')) {
    try {
      const eucKrDecoder = new TextDecoder('euc-kr');
      return eucKrDecoder.decode(arrayBuffer);
    } catch {
      return utf8Text;
    }
  }

  return utf8Text;
}

/**
 * 2. 실제 헤더 행(Row) 탐색
 */
export function findHeaderRowIndex(lines: string[]): number {
  let bestIdx = 0;
  let maxScore = 0;

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = line.split(/,|\t/).map((c) => c.replace(/^["']|["']$/g, '').trim().toLowerCase());

    let score = 0;
    for (const cell of cells) {
      if (!cell) continue;

      const isDate = DATE_CANDIDATES.some((k) => cell === k || cell.includes(k));
      const isMerchant = MERCHANT_CANDIDATES.some((k) => cell === k || cell.includes(k));
      const isTxType = TRANSACTION_TYPE_CANDIDATES.some((k) => cell === k || cell.includes(k));
      const isAmount = AMOUNT_CANDIDATES.some((k) => cell === k || cell.includes(k));
      const isDeposit = DEPOSIT_CANDIDATES.some((k) => cell === k || cell.includes(k));
      const isBalance = BALANCE_CANDIDATES.some((k) => cell === k || cell.includes(k));

      if (isDate || isMerchant || isTxType || isAmount || isDeposit || isBalance) {
        score++;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestIdx = i;
    }
  }

  return bestIdx;
}

/**
 * 3. 컬럼 자동 추천 로직
 */
export function detectColumns(headers: string[]): ColumnMapping {
  let dateCol = '';
  let merchantCol = '';
  let transactionTypeCol = '';
  let transferMemoCol = '';
  let amountCol = '';
  let depositCol = '';
  let balanceCol = '';

  const cleanHeaders = headers.map((h) => h.trim().replace(/^["']|["']$/g, ''));

  // Match Date
  for (const candidate of DATE_CANDIDATES) {
    const found = cleanHeaders.find(
      (h) => h.toLowerCase() === candidate || h.toLowerCase().includes(candidate)
    );
    if (found) {
      dateCol = found;
      break;
    }
  }

  // Match Transaction Type (적요)
  for (const candidate of TRANSACTION_TYPE_CANDIDATES) {
    const found = cleanHeaders.find(
      (h) => (h.toLowerCase() === candidate || h.toLowerCase().includes(candidate)) && h !== dateCol
    );
    if (found) {
      transactionTypeCol = found;
      break;
    }
  }

  // Match Merchant (보낸분/받는분)
  for (const candidate of MERCHANT_CANDIDATES) {
    const found = cleanHeaders.find(
      (h) => (h.toLowerCase() === candidate || h.toLowerCase().includes(candidate)) && h !== dateCol && h !== transactionTypeCol
    );
    if (found) {
      merchantCol = found;
      break;
    }
  }

  // Match Transfer Memo (송금메모)
  for (const candidate of TRANSFER_MEMO_CANDIDATES) {
    const found = cleanHeaders.find(
      (h) => (h.toLowerCase() === candidate || h.toLowerCase().includes(candidate)) && h !== dateCol && h !== transactionTypeCol && h !== merchantCol
    );
    if (found) {
      transferMemoCol = found;
      break;
    }
  }

  // Match Amount (출금액)
  for (const candidate of AMOUNT_CANDIDATES) {
    const found = cleanHeaders.find(
      (h) =>
        (h.toLowerCase() === candidate || h.toLowerCase().includes(candidate)) &&
        h !== dateCol &&
        h !== merchantCol &&
        h !== transactionTypeCol &&
        h !== transferMemoCol
    );
    if (found) {
      amountCol = found;
      break;
    }
  }

  // Match Deposit (입금액)
  for (const candidate of DEPOSIT_CANDIDATES) {
    const found = cleanHeaders.find(
      (h) =>
        (h.toLowerCase() === candidate || h.toLowerCase().includes(candidate)) &&
        h !== dateCol &&
        h !== merchantCol &&
        h !== transactionTypeCol &&
        h !== transferMemoCol &&
        h !== amountCol
    );
    if (found) {
      depositCol = found;
      break;
    }
  }

  // Match Balance (잔액)
  for (const candidate of BALANCE_CANDIDATES) {
    const found = cleanHeaders.find(
      (h) =>
        (h.toLowerCase() === candidate || h.toLowerCase().includes(candidate)) &&
        h !== dateCol &&
        h !== merchantCol &&
        h !== transactionTypeCol &&
        h !== transferMemoCol &&
        h !== amountCol &&
        h !== depositCol
    );
    if (found) {
      balanceCol = found;
      break;
    }
  }

  // Fallbacks if missing
  if (!merchantCol && transactionTypeCol) {
    // If no explicit merchantCol found, try using transactionTypeCol as fallback, but prefer transferMemoCol if present
    merchantCol = transferMemoCol || transactionTypeCol;
  }
  if (!dateCol && cleanHeaders.length > 0) dateCol = cleanHeaders[0];
  if (!merchantCol && cleanHeaders.length > 1) merchantCol = cleanHeaders[1];
  if (!amountCol && cleanHeaders.length > 2) amountCol = cleanHeaders[2];

  return { dateCol, merchantCol, transactionTypeCol, transferMemoCol, amountCol, depositCol, balanceCol };
}

/**
 * 5. 금액 파싱
 */
export function parseAmount(val: string | number | undefined): number {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }
  if (!val) return 0;

  const str = String(val).trim();
  if (!str) return 0;

  const cleaned = str.replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-') return 0;

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * 6. 날짜 파싱
 */
export function parseDateString(rawDate: string | undefined): string {
  if (!rawDate) return '';
  const str = String(rawDate).trim();
  if (!str) return '';

  const pad = (n: string) => (n.length === 1 ? '0' + n : n);

  const fullDateTimeMatch = str.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?/);
  if (fullDateTimeMatch) {
    const [_, y, m, d, hh, mm] = fullDateTimeMatch;
    const datePart = `${y}.${pad(m)}.${pad(d)}`;
    if (hh && mm) {
      return `${datePart} ${pad(hh)}:${pad(mm)}`;
    }
    return datePart;
  }

  const compactMatch = str.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compactMatch) {
    const [_, y, m, d] = compactMatch;
    return `${y}.${m}.${d}`;
  }

  const shortMatch = str.match(/(\d{1,2})[-./](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (shortMatch) {
    const [_, m, d, hh, mm] = shortMatch;
    const datePart = `2026.${pad(m)}.${pad(d)}`;
    if (hh && mm) {
      return `${datePart} ${pad(hh)}:${pad(mm)}`;
    }
    return datePart;
  }

  return str;
}

/**
 * 마지막 합계 행 (Summary Row) 판별 함수
 */
function isSummaryRow(row: Record<string, string>, mapping: ColumnMapping): boolean {
  const dateVal = (row[mapping.dateCol] || '').trim();
  const merchantVal = (row[mapping.merchantCol] || '').trim();
  const typeVal = (mapping.transactionTypeCol ? row[mapping.transactionTypeCol] : '').trim();
  const memoVal = (mapping.transferMemoCol ? row[mapping.transferMemoCol] : '').trim();

  const rowValuesStr = Object.values(row).join(' ');

  // 조건 1: 거래일시가 비어 있고 행에 "합계" 또는 "소계" 문자열 존재
  if (!dateVal && (rowValuesStr.includes('합계') || rowValuesStr.includes('소계'))) {
    return true;
  }

  // 조건 2: 거래일시가 비어 있고 merchant, type, memo 등이 모두 비어 있음
  if (!dateVal && !merchantVal && !typeVal && !memoVal) {
    return true;
  }

  // 조건 3: "합계"라는 단어가 보낸분/받는분이나 송금메모/적요 등에 포함되고 날짜가 없음
  if (!dateVal && (merchantVal.includes('합계') || memoVal.includes('합계') || typeVal.includes('합계'))) {
    return true;
  }

  return false;
}

/**
 * CSV 파싱 및 검증 함수
 */
export function parseAndValidateCsvRows(
  rawRows: Record<string, string>[],
  mapping: ColumnMapping
): { transactions: ReviewTransaction[]; stats: CsvValidationStats } {
  let validDateCount = 0;
  let validMerchantCount = 0;
  let validAmountCount = 0;
  let errorCount = 0;

  // 1. 합계 행(Summary row) 및 완전 빈 행 미리 필터링
  const validRows = rawRows.filter((row) => {
    // 합계 행 체크
    if (isSummaryRow(row, mapping)) {
      return false;
    }

    const dateVal = row[mapping.dateCol];
    const merchantVal = row[mapping.merchantCol];
    const amountVal = row[mapping.amountCol];
    const depositVal = mapping.depositCol ? row[mapping.depositCol] : undefined;
    const typeVal = mapping.transactionTypeCol ? row[mapping.transactionTypeCol] : undefined;
    const memoVal = mapping.transferMemoCol ? row[mapping.transferMemoCol] : undefined;

    return Boolean(dateVal || merchantVal || amountVal || depositVal || typeVal || memoVal);
  });

  const transactions: ReviewTransaction[] = validRows.map((row, idx) => {
    const rawDate = row[mapping.dateCol];
    const rawMerchant = row[mapping.merchantCol]; // 보낸분/받는분
    const rawType = mapping.transactionTypeCol ? row[mapping.transactionTypeCol] : undefined; // 적요
    const rawMemo = mapping.transferMemoCol ? row[mapping.transferMemoCol] : undefined; // 송금메모
    const rawAmount = row[mapping.amountCol]; // 출금액
    const rawDeposit = mapping.depositCol ? row[mapping.depositCol] : undefined; // 입금액
    const rawBalance = mapping.balanceCol ? row[mapping.balanceCol] : undefined; // 잔액

    // 1. 날짜 파싱
    const parsedDate = parseDateString(rawDate);
    const hasValidDate = Boolean(parsedDate);
    if (hasValidDate) validDateCount++;

    // 2. 거래처 표시 우선순위
    // 1) 보낸분/받는분 -> 2) 송금메모 -> 3) 적요
    const payeeStr = (rawMerchant || '').trim();
    const memoStr = (rawMemo || '').trim();
    const typeStr = (rawType || '').trim();

    let primaryMerchant = payeeStr;
    if (!primaryMerchant) {
      primaryMerchant = memoStr;
    }
    if (!primaryMerchant) {
      primaryMerchant = typeStr;
    }
    if (!primaryMerchant) {
      primaryMerchant = '미지정 거래처';
    }

    const hasValidMerchant = Boolean(payeeStr || memoStr || typeStr);
    if (hasValidMerchant) validMerchantCount++;

    // 3. classificationText 생성 (보낸분/받는분과 송금메모 결합)
    let classificationText = '';
    if (payeeStr && memoStr && payeeStr !== memoStr) {
      classificationText = `${payeeStr} ${memoStr}`;
    } else if (payeeStr) {
      classificationText = payeeStr;
    } else if (memoStr) {
      classificationText = memoStr;
    } else {
      classificationText = typeStr;
    }

    // 4. 금액 파싱 (출금 및 입금)
    let parsedAmount = parseAmount(rawAmount);
    let parsedDeposit = parseAmount(rawDeposit);

    if (parsedAmount === 0 && parsedDeposit > 0) {
      parsedAmount = parsedDeposit;
    } else if (parsedAmount < 0) {
      parsedAmount = Math.abs(parsedAmount);
    }

    const hasValidAmount = parsedAmount > 0;
    if (hasValidAmount) validAmountCount++;

    // 잔액 파싱
    const parsedBalance = parseAmount(rawBalance);

    // 파싱 오류 체크
    const isError = !hasValidDate || !hasValidMerchant || !hasValidAmount;
    if (isError) errorCount++;

    // 5. ReviewTransaction 생성 (초기 상태: pending)
    const txItem: ReviewTransaction = {
      id: `csv-tx-${idx}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: parsedDate || '날짜 미지정',
      merchant: primaryMerchant,
      merchantOriginal: payeeStr || primaryMerchant,
      transactionType: typeStr || undefined,
      transferMemo: memoStr || undefined,
      classificationText,
      amount: parsedAmount,
      depositAmount: parsedDeposit > 0 ? parsedDeposit : undefined,
      balance: parsedBalance > 0 ? parsedBalance : undefined,
      rawRow: row, // 원본 CSV 한 줄 보관
      category: '미분류',
      type: 'living',
      needsReview: false,
      classificationStatus: 'pending', // CSV 파싱 직후는 항상 pending!
      confidenceLevel: 'low',
      confidenceScore: 0,
      userConfirmed: false,
    };

    return txItem;
  });

  return {
    transactions,
    stats: {
      totalCount: transactions.length,
      validDateCount,
      validMerchantCount,
      validAmountCount,
      errorCount,
    },
  };
}

/**
 * 메인 CSV 텍스트 파싱 워크플로우
 */
export function parseCsvText(csvText: string): CsvParseResult {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headerLineIdx = findHeaderRowIndex(lines);

  const cleanCsvText = lines.slice(headerLineIdx).join('\n');

  const parsed = Papa.parse<Record<string, string>>(cleanCsvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().replace(/^["']|["']$/g, ''),
  });

  const rawHeaders = parsed.meta.fields || [];
  const headers = rawHeaders.filter((h) => h && h.trim().length > 0 && !h.startsWith('_'));
  const rawRows = parsed.data || [];

  const detectedMapping = detectColumns(headers);

  const hasAutoMapping = Boolean(
    detectedMapping.dateCol &&
      detectedMapping.merchantCol &&
      detectedMapping.amountCol &&
      headers.includes(detectedMapping.dateCol) &&
      headers.includes(detectedMapping.merchantCol) &&
      headers.includes(detectedMapping.amountCol)
  );

  const { transactions, stats } = parseAndValidateCsvRows(rawRows, detectedMapping);

  return {
    headers,
    rawRows,
    detectedMapping,
    hasAutoMapping,
    transactions,
    totalRows: stats.totalCount,
    stats,
  };
}
