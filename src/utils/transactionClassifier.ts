import {
  MerchantRule,
  CategoryRule,
  ExclusionRule,
  ClassificationResult,
  ExclusionReasonCode,
  RuleConfidence,
} from '../types';
import {
  INITIAL_MERCHANT_RULES,
  INITIAL_EXCLUSION_RULES,
  INITIAL_CATEGORY_RULES,
  getExclusionReasonLabel,
} from '../data/initialClassificationRules';

/**
 * 거래처명 정규화
 */
export function normalizeMerchantName(merchantRaw: string): string {
  if (!merchantRaw) return '';
  let cleaned = merchantRaw.trim();
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.toUpperCase();
  cleaned = cleaned.replace(/[_\-,]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

/**
 * Helper to apply auto-confirm logic
 */
function buildClassificationResult(
  confidence: RuleConfidence,
  autoConfirm: boolean | undefined,
  baseResult: {
    merchantOriginal: string;
    merchantNormalized: string;
    merchantMaster?: string | null;
    classificationType: 'consumer' | 'excluded';
    majorCategory?: string | null;
    minorCategory?: string | null;
    exclusionReason?: ExclusionReasonCode | null;
    exclusionType?: string | null;
    included?: boolean;
    dashboardTreatment?: 'exclude' | 'include' | 'separate';
    debtTreatment?: string | null;
    needsConfirmation?: boolean;
    appliedRuleId?: string | null;
    appliedRuleType?: 'user-confirmed' | 'exclusion' | 'exact-merchant' | 'alias' | 'keyword' | 'category' | 'industry' | 'pattern' | 'ai-recommend' | 'none' | null;
    userConfirmed?: boolean;
    reviewCompleted?: boolean;
    userQuestion?: string | null;
  }
): ClassificationResult {
  const isAutoConfirmed = (confidence === 'confirmed' || confidence === 'high') && autoConfirm !== false;
  const needsConfirmation = isAutoConfirmed ? false : (baseResult.needsConfirmation ?? true);

  return {
    merchantOriginal: baseResult.merchantOriginal,
    merchantNormalized: baseResult.merchantNormalized,
    merchantMaster: baseResult.merchantMaster ?? null,
    classificationType: baseResult.classificationType,
    majorCategory: baseResult.majorCategory ?? null,
    minorCategory: baseResult.minorCategory ?? null,
    exclusionReason: baseResult.exclusionReason ?? null,
    exclusionType: baseResult.exclusionType ?? null,
    included: baseResult.included ?? (baseResult.classificationType === 'consumer'),
    dashboardTreatment: baseResult.dashboardTreatment,
    debtTreatment: baseResult.debtTreatment ?? null,
    confidence: confidence,
    needsConfirmation: needsConfirmation,
    appliedRuleId: baseResult.appliedRuleId ?? null,
    appliedRuleType: baseResult.appliedRuleType ?? null,
    userConfirmed: isAutoConfirmed || baseResult.userConfirmed || false,
    reviewCompleted: isAutoConfirmed || baseResult.reviewCompleted || false,
    classificationStatus: isAutoConfirmed ? 'auto_confirmed' : needsConfirmation ? 'needs_review' : 'auto_confirmed',
    userQuestion: baseResult.userQuestion ?? null,
  };
}

/**
 * 1) 사용자 수정으로 저장된 확정 규칙 검색 (우선순위 1)
 */
export function findUserConfirmedRule(
  normalized: string,
  raw: string,
  rules: MerchantRule[]
): MerchantRule | null {
  const userRules = rules.filter((r) => r.isActive && r.source === 'user-confirmed');
  for (const rule of userRules) {
    for (const pattern of rule.patterns) {
      const normPattern = normalizeMerchantName(pattern);
      if (rule.matchType === 'exact' && (normalized === normPattern || raw === pattern)) {
        return rule;
      }
      if (
        (rule.matchType === 'keyword' || rule.matchType === 'contains' || rule.matchType === 'alias') &&
        (normalized.includes(normPattern) || raw.includes(pattern))
      ) {
        return rule;
      }
    }
  }
  return null;
}

/**
 * 2) 정확한 거래처명 일치 검색 (우선순위 2)
 */
export function findExactMerchantRule(
  normalized: string,
  raw: string,
  rules: MerchantRule[]
): MerchantRule | null {
  const activeRules = rules.filter((r) => r.isActive && r.source !== 'user-confirmed');
  for (const rule of activeRules) {
    if (rule.matchType !== 'exact') continue;
    for (const pattern of rule.patterns) {
      const normPattern = normalizeMerchantName(pattern);
      if (normalized === normPattern || raw === pattern) {
        return rule;
      }
    }
  }
  return null;
}

/**
 * 3) 거래처 부분/키워드/포함 일치 검색 (우선순위 3)
 */
export function findContainsMerchantRule(
  normalized: string,
  raw: string,
  rules: MerchantRule[]
): MerchantRule | null {
  const activeRules = rules.filter((r) => r.isActive && r.source !== 'user-confirmed');
  for (const rule of activeRules) {
    if (rule.matchType === 'exact') continue;
    for (const pattern of rule.patterns) {
      const normPattern = normalizeMerchantName(pattern);
      if (normalized.includes(normPattern) || raw.includes(pattern)) {
        return rule;
      }
    }
  }
  return null;
}

/**
 * 4) 제외거래 확정 규칙 검색 (우선순위 4)
 */
export function findExclusionRule(
  normalized: string,
  raw: string,
  rules: ExclusionRule[]
): ExclusionRule | null {
  const activeExclusions = rules.filter((r) => r.isActive);
  for (const rule of activeExclusions) {
    for (const pattern of rule.patterns) {
      const normPattern = normalizeMerchantName(pattern);
      if (rule.matchType === 'exact' && (normalized === normPattern || raw === pattern)) {
        return rule;
      }
      if (
        (rule.matchType === 'contains' || rule.matchType === 'keyword' || !rule.matchType) &&
        (normalized.includes(normPattern) || raw.includes(pattern))
      ) {
        return rule;
      }
    }
  }
  return null;
}

/**
 * 5) 카테고리 키워드 규칙 검색 (우선순위 5)
 */
export function findCategoryRule(
  normalized: string,
  raw: string,
  categoryRules: CategoryRule[]
): CategoryRule | null {
  const activeCatRules = categoryRules.filter((r) => r.isActive).sort((a, b) => (b.priority ?? 50) - (a.priority ?? 50));
  for (const catRule of activeCatRules) {
    const kwList = catRule.keywords && catRule.keywords.length > 0
      ? catRule.keywords
      : (catRule.keyword ? [catRule.keyword] : []);
    for (const kw of kwList) {
      if (!kw) continue;
      const normKw = normalizeMerchantName(kw);
      if (normalized.includes(normKw) || raw.includes(kw)) {
        return catRule;
      }
    }
  }
  return null;
}

/**
 * 6) 업종 Rule 추론 (우선순위 6)
 */
export function findIndustryRule(
  normalized: string,
  raw: string
): {
  majorCategory: string;
  minorCategory: string;
  merchantMaster?: string;
  needsConfirmation?: boolean;
  userQuestion?: string;
} | null {
  const norm = normalized.toUpperCase().replace(/\s+/g, '');
  const rawClean = raw.trim();

  // 쿠팡 특수 처리 (생활 > 생활용품)
  if (norm.includes('쿠팡') || norm.includes('COUPANG')) {
    return {
      majorCategory: '생활',
      minorCategory: '생활용품',
      merchantMaster: '쿠팡',
      needsConfirmation: false,
    };
  }

  // 카카오페이 결제 단독인 경우 -> 확인 필요
  if (
    norm === '카카오페이' ||
    norm === '카카오페이결제' ||
    norm === '카카오페이(결제)' ||
    norm === 'KAKAOPAY'
  ) {
    return {
      majorCategory: '기타',
      minorCategory: '기타지출',
      merchantMaster: '카카오페이',
      needsConfirmation: true,
      userQuestion: '카카오페이 결제의 실제 거래처와 용도를 확인해주세요.',
    };
  }

  // 편의점
  if (/GS25|CU|세븐일레븐|이마트24|미니스톱|지에스25|씨유|편의점/.test(norm)) {
    return {
      majorCategory: '식비',
      minorCategory: '편의점',
      merchantMaster: rawClean,
      needsConfirmation: false,
    };
  }

  // 카페
  if (
    /스타벅스|스벅|투썸|메가커피|컴포즈|빽다방|이디야|할리스|엔제리너스|탐앤탐스|폴바셋|파스쿠찌|더벤티|매머드커피|바나프레소|쥬씨|공차|메가MGC|카페|커피|베이커리|빵집|제과|제과점|로스터리|찻집|디저트|도넛|던킨|파리바게뜨|뚜레쥬르|성심당|삼송빵집/.test(
      norm
    )
  ) {
    return {
      majorCategory: '식비',
      minorCategory: '카페',
      merchantMaster: rawClean,
      needsConfirmation: false,
    };
  }

  // 마트 / 장보기
  if (
    /이마트|홈플러스|롯데마트|농협|하나로마트|하나로|청과|정육|수산|야채|과일|식자재|마트|슈퍼|슈퍼마켓|유통|드림마트|코스트코|트레이더스|메가마트|로컬푸드|축산|농산/.test(
      norm
    )
  ) {
    return {
      majorCategory: '식비',
      minorCategory: '장보기',
      merchantMaster: rawClean,
      needsConfirmation: false,
    };
  }

  // 음식점 / 외식
  if (
    /국밥|냉면|짬뽕|중국집|짜장|치킨|피자|분식|김밥|족발|보쌈|식당|횟집|칼국수|쌀국수|돈까스|고기|갈비|삼겹살|곱창|막창|닭갈비|오리|샤브|수제비|순대|탕|찌개|덮밥|카레|라멘|스시|초밥|참치|우동|소바|게장|낙지|오징어|아구찜|해물|찜닭|찜|구이|불고기|갈비탕|설렁탕|곰탕|감자탕|해장국|추어탕|삼계탕|자장면|마라탕|훠궈|양꼬치|타코|파스타|리조또|스테이크|햄버거|수제버거|샌드위치|샐러드|토스트|만두|떡볶이|튀김|핫도그|어묵|백반|한식|양식|일식|중식|주점|호프|포차|갈비집|고깃집|숯불|밥집|푸드|키친|가든|회관|뷔페|음식점/.test(
      norm
    )
  ) {
    return {
      majorCategory: '식비',
      minorCategory: '외식',
      merchantMaster: rawClean,
      needsConfirmation: false,
    };
  }

  // 병원·약국
  if (
    /병원|의원|한의원|치과|약국|내과|외과|피부과|안과|정형외과|성형외과|이비인후과|소아과|소아청소년과|재활의학과|비뇨기과|산부인과|신경과|정신건강의학과|마취통증의학과|가정의학과|한방병원|종합병원|메디컬/.test(
      norm
    )
  ) {
    return {
      majorCategory: '건강',
      minorCategory: '병원·약국',
      merchantMaster: rawClean,
      needsConfirmation: false,
    };
  }

  // 교육비
  if (
    /방과후|학원|교재|피아노|미술|줄넘기|태권도|영어|수학|국어|과외|어린이집|유치원|공부방|독서실|스터디카페|교육|검도|발레|연기|음악|수영장|수영교실|보습학원|입시|어학원|예체능|논술|한자|컴퓨터|코딩|윤선생|눈높이|웅진|교원|대교|한솔|구몬|해법|셀파|홈런|밀크T|메가스터디|이투스|대성|청담어학원|정상어학원|POLY|아발론/.test(
      norm
    )
  ) {
    return {
      majorCategory: '가족',
      minorCategory: '교육비',
      merchantMaster: rawClean,
      needsConfirmation: false,
    };
  }

  // 보험
  if (
    /DB|DB손해보험|DB손|현대해상|흥국|흥국화재|흥국생명|메리츠|메리츠화재|삼성화재|삼성생명|교보생명|한화생명|한화손해보험|KB손해보험|KB손해|라이나|라이나생명|AXA|악사|보험|생명|화재|손해보험|연금보험|해상보험|캐롯/.test(
      norm
    )
  ) {
    return {
      majorCategory: '보험',
      minorCategory: '보험료',
      merchantMaster: rawClean,
      needsConfirmation: false,
    };
  }

  // 운동
  if (/피트니스|헬스|복싱|필라테스|요가|스포츠|골프|수영|크로스핏|클라이밍/.test(norm)) {
    return {
      majorCategory: '건강',
      minorCategory: '운동',
      merchantMaster: rawClean,
      needsConfirmation: false,
    };
  }

  // 통신
  if (/LGU\+|SKT|KT|알뜰폰|엘지유플러스|LG유플러스|SK텔레콤|케이티/.test(norm)) {
    return {
      majorCategory: '통신',
      minorCategory: '통신비',
      merchantMaster: rawClean,
      needsConfirmation: false,
    };
  }

  // 교통/차량유지
  if (/주유소|주유|GS칼텍스|SK에너지|S\-OIL|현대오일뱅크|주차|주차장/.test(norm)) {
    return {
      majorCategory: '이동',
      minorCategory: '차량유지',
      merchantMaster: rawClean,
      needsConfirmation: false,
    };
  }
  if (/택시|버스|지하철|코레일|티머니|카카오T|교통/.test(norm)) {
    return {
      majorCategory: '이동',
      minorCategory: '교통',
      merchantMaster: rawClean,
      needsConfirmation: false,
    };
  }

  return null;
}

/**
 * 7) 패턴 Rule 추론
 */
export function findPatternRule(
  normalized: string,
  raw: string
): {
  majorCategory: string;
  minorCategory: string;
  merchantMaster?: string;
} | null {
  const norm = normalized.toUpperCase().replace(/\s+/g, '');
  const rawClean = raw.trim();

  if (/미용실|헤어|헤어샵|뷰티|네일|바버샵|살롱/.test(norm)) {
    return {
      majorCategory: '생활',
      minorCategory: '생활용품',
      merchantMaster: rawClean,
    };
  }

  if (/카센터|공임나라|오토오아시스|스피드메이트|타이어|세차|모터스/.test(norm)) {
    return {
      majorCategory: '이동',
      minorCategory: '차량유지',
      merchantMaster: rawClean,
    };
  }

  if (/클리닉|메디컬|의료/.test(norm)) {
    return {
      majorCategory: '건강',
      minorCategory: '병원·약국',
      merchantMaster: rawClean,
    };
  }

  if (/스튜디오|사진관|스냅|인쇄|프린트/.test(norm)) {
    return {
      majorCategory: '생활',
      minorCategory: '생활용품',
      merchantMaster: rawClean,
    };
  }

  if (/몰|쇼핑|스토어|브랜드|패션|아울렛|백화점|마켓/.test(norm)) {
    return {
      majorCategory: '생활',
      minorCategory: '생활용품',
      merchantMaster: rawClean,
    };
  }

  return null;
}

function mapToExclusionReasonCode(reasonOrType: string | undefined | null): ExclusionReasonCode {
  if (!reasonOrType) return 'unknown';
  if (reasonOrType === 'internal_transfer' || reasonOrType.includes('내부이체')) return 'internal_transfer';
  if (reasonOrType === 'business_transaction' || reasonOrType.includes('사업')) return 'business_transaction';
  if (reasonOrType === 'debt_principal_repayment' || reasonOrType.includes('부채') || reasonOrType.includes('대여금') || reasonOrType.includes('원금')) return 'debt_principal_repayment';
  if (reasonOrType === 'asset_transfer' || reasonOrType.includes('자산')) return 'asset_transfer';
  if (reasonOrType === 'income' || reasonOrType.includes('입금')) return 'income';
  return 'unknown';
}

/**
 * 공통 분류 함수: classifyTransaction
 * 우선순위:
 * 1. User Confirmed Rule
 * 2. Merchant Exact Rule
 * 3. Merchant Contains / Alias / Keyword Rule
 * 4. Exclusion Rule
 * 5. Category Keyword Rule
 * 6. Industry Rule & Pattern Rule
 * 7. AI Recommendation
 * 8. Needs Confirmation
 */
export function classifyTransaction(
  merchantRaw: string,
  context?: {
    rules?: MerchantRule[];
    exclusionRules?: ExclusionRule[];
    categoryRules?: CategoryRule[];
  }
): ClassificationResult {
  const merchantOriginal = merchantRaw || '';
  const merchantNormalized = normalizeMerchantName(merchantOriginal);

  const merchantRules = context?.rules || INITIAL_MERCHANT_RULES;
  const exclusionRules = context?.exclusionRules || INITIAL_EXCLUSION_RULES;
  const categoryRules = context?.categoryRules || INITIAL_CATEGORY_RULES;

  const isPureDigits = /^\d{6,}$/.test(merchantOriginal.trim());

  // 1. 사용자 확정 규칙 (우선순위 1)
  const userRule = findUserConfirmedRule(merchantNormalized, merchantOriginal, merchantRules);
  if (userRule) {
    return buildClassificationResult(userRule.confidence || 'confirmed', userRule.autoConfirm ?? true, {
      merchantOriginal,
      merchantNormalized,
      merchantMaster: userRule.merchantMaster || merchantOriginal,
      classificationType: 'consumer',
      majorCategory: userRule.majorCategory,
      minorCategory: userRule.minorCategory,
      exclusionReason: null,
      included: true,
      needsConfirmation: false,
      appliedRuleId: userRule.id,
      appliedRuleType: 'user-confirmed',
      userConfirmed: true,
      reviewCompleted: true,
    });
  }

  // 2. Merchant Master - 정확한 거래처명 일치 (우선순위 2)
  const exactRule = findExactMerchantRule(merchantNormalized, merchantOriginal, merchantRules);
  if (exactRule) {
    return buildClassificationResult(exactRule.confidence || 'confirmed', exactRule.autoConfirm ?? true, {
      merchantOriginal,
      merchantNormalized,
      merchantMaster: exactRule.merchantMaster || merchantOriginal,
      classificationType: exactRule.included === false ? 'excluded' : 'consumer',
      majorCategory: exactRule.majorCategory,
      minorCategory: exactRule.minorCategory,
      exclusionReason: null,
      included: exactRule.included ?? true,
      appliedRuleId: exactRule.id,
      appliedRuleType: 'exact-merchant',
    });
  }

  // 3. Merchant Master - 거래처 부분/키워드/포함 일치 (우선순위 3)
  const containsRule = findContainsMerchantRule(merchantNormalized, merchantOriginal, merchantRules);
  if (containsRule) {
    return buildClassificationResult(containsRule.confidence || 'confirmed', containsRule.autoConfirm ?? true, {
      merchantOriginal,
      merchantNormalized,
      merchantMaster: containsRule.merchantMaster || merchantOriginal,
      classificationType: containsRule.included === false ? 'excluded' : 'consumer',
      majorCategory: containsRule.majorCategory,
      minorCategory: containsRule.minorCategory,
      exclusionReason: null,
      included: containsRule.included ?? true,
      appliedRuleId: containsRule.id,
      appliedRuleType: 'keyword',
    });
  }

  // 4. Exclusion Rule - 제외거래 확정 규칙 (우선순위 4)
  const exclusionRule = findExclusionRule(merchantNormalized, merchantOriginal, exclusionRules);
  if (exclusionRule) {
    const reasonCode = mapToExclusionReasonCode(exclusionRule.exclusionReason || exclusionRule.exclusionType);
    const label = getExclusionReasonLabel(reasonCode);
    const conf = exclusionRule.confidence || 'confirmed';

    return buildClassificationResult(conf, exclusionRule.autoConfirm ?? true, {
      merchantOriginal,
      merchantNormalized,
      merchantMaster: null,
      classificationType: 'excluded',
      majorCategory: null,
      minorCategory: null,
      exclusionReason: reasonCode,
      exclusionType: label,
      included: false,
      dashboardTreatment: exclusionRule.dashboardTreatment,
      debtTreatment: exclusionRule.debtTreatment || 'none',
      appliedRuleId: exclusionRule.id,
      appliedRuleType: 'exclusion',
      needsConfirmation: false,
    });
  }

  // 승인번호나 숫자 집합 등 불명확한 거래
  if (isPureDigits) {
    return buildClassificationResult('low', false, {
      merchantOriginal,
      merchantNormalized,
      merchantMaster: null,
      classificationType: 'excluded',
      majorCategory: null,
      minorCategory: null,
      exclusionReason: 'unknown',
      exclusionType: '확인 불가',
      included: false,
      needsConfirmation: true,
      appliedRuleId: null,
      appliedRuleType: 'none',
      userQuestion: '승인번호 거래 내역의 거래처와 용도를 확인해주세요.',
    });
  }

  // 5. Category Keyword Rule (우선순위 5)
  const categoryRule = findCategoryRule(merchantNormalized, merchantOriginal, categoryRules);
  if (categoryRule) {
    return buildClassificationResult(categoryRule.confidence || 'high', categoryRule.autoConfirm ?? true, {
      merchantOriginal,
      merchantNormalized,
      merchantMaster: merchantOriginal,
      classificationType: 'consumer',
      majorCategory: categoryRule.majorCategory,
      minorCategory: categoryRule.minorCategory,
      exclusionReason: null,
      included: true,
      appliedRuleId: categoryRule.id,
      appliedRuleType: 'category',
    });
  }

  // 6. 업종 Rule & 패턴 Rule (우선순위 6)
  const industryRule = findIndustryRule(merchantNormalized, merchantOriginal);
  if (industryRule) {
    const isNeedsConf = industryRule.needsConfirmation ?? false;
    return buildClassificationResult(isNeedsConf ? 'low' : 'high', !isNeedsConf, {
      merchantOriginal,
      merchantNormalized,
      merchantMaster: industryRule.merchantMaster || merchantOriginal,
      classificationType: 'consumer',
      majorCategory: industryRule.majorCategory,
      minorCategory: industryRule.minorCategory,
      exclusionReason: null,
      included: true,
      needsConfirmation: isNeedsConf,
      appliedRuleId: null,
      appliedRuleType: 'industry',
      userQuestion: isNeedsConf ? industryRule.userQuestion : null,
    });
  }

  const patternRule = findPatternRule(merchantNormalized, merchantOriginal);
  if (patternRule) {
    return buildClassificationResult('high', true, {
      merchantOriginal,
      merchantNormalized,
      merchantMaster: patternRule.merchantMaster || merchantOriginal,
      classificationType: 'consumer',
      majorCategory: patternRule.majorCategory,
      minorCategory: patternRule.minorCategory,
      exclusionReason: null,
      included: true,
      appliedRuleId: null,
      appliedRuleType: 'pattern',
    });
  }

  // 7. AI 추천 (우선순위 7)
  const isPersonalName = /^[가-힣]{2,4}$/.test(merchantOriginal.trim());
  const isTransferOrUnclear = /이체|송금|대여금|원금|입금|출금|결제/.test(merchantOriginal.trim());

  if (!isPersonalName && !isTransferOrUnclear && merchantOriginal.trim().length >= 2) {
    return buildClassificationResult('medium', true, {
      merchantOriginal,
      merchantNormalized,
      merchantMaster: merchantOriginal.trim(),
      classificationType: 'consumer',
      majorCategory: '생활',
      minorCategory: '생활용품',
      exclusionReason: null,
      included: true,
      appliedRuleId: null,
      appliedRuleType: 'ai-recommend',
    });
  }

  // 8. 규칙 미일치 / 확인 필요 (우선순위 8)
  return buildClassificationResult('low', false, {
    merchantOriginal,
    merchantNormalized,
    merchantMaster: null,
    classificationType: 'consumer',
    majorCategory: null,
    minorCategory: null,
    exclusionReason: null,
    included: false,
    needsConfirmation: true,
    appliedRuleId: null,
    appliedRuleType: 'none',
    userQuestion: isPersonalName
      ? `'${merchantOriginal}' 님과의 거래 목적을 확인해주세요.`
      : `'${merchantOriginal}' 거래의 카테고리를 확인해주세요.`,
  });
}

/**
 * 거래 내역 배열 재분류
 */
export function reclassifyTransactions(
  transactions: any[],
  context?: {
    rules?: MerchantRule[];
    exclusionRules?: ExclusionRule[];
    categoryRules?: CategoryRule[];
  }
): any[] {
  return transactions.map((tx) => {
    const classificationText = tx.classificationText || tx.merchantOriginal || tx.merchant || '';
    const classification = classifyTransaction(classificationText, context);
    return {
      ...tx,
      merchantOriginal: tx.merchantOriginal || tx.merchant || '',
      merchant: classification.merchantMaster || tx.merchant || tx.merchantOriginal,
      classification,
      category: classification.majorCategory
        ? `${classification.majorCategory} > ${classification.minorCategory}`
        : classification.classificationType === 'excluded'
        ? `제외 > ${classification.exclusionType || '제외'}`
        : '미분류',
      needsReview: classification.needsConfirmation,
      userConfirmed: classification.userConfirmed ?? tx.userConfirmed ?? false,
      reviewCompleted: classification.reviewCompleted ?? tx.reviewCompleted ?? false,
    };
  });
}
