import { MerchantRule, CategoryRule, ExclusionRule, ExclusionReasonCode } from '../types';
import {
  INITIAL_JSON_MERCHANT_RULES,
  INITIAL_JSON_CATEGORY_RULES,
  INITIAL_JSON_EXCLUSION_RULES,
} from './ruleLoader';

export { CONSUMER_CATEGORIES } from './consumerCategories';

export const EXCLUSION_REASONS: { code: ExclusionReasonCode; label: string; description: string }[] = [
  { code: 'internal_transfer', label: '내부이체', description: '본인/가족 계좌 간 이동' },
  { code: 'business_transaction', label: '사업거래', description: '사업/업무 관련 경비' },
  { code: 'debt_principal_repayment', label: '부채 원금상환', description: '대출/부채 원금 상환' },
  { code: 'asset_transfer', label: '자산 이동', description: '적금/투자/저축 계좌 송금' },
  { code: 'income', label: '입금/환불', description: '수입, 입금 및 환불' },
  { code: 'unknown', label: '확인 불가', description: '기타 소비 분석 제외 항목' },
];

export function getExclusionReasonLabel(code: ExclusionReasonCode | string | null | undefined): string {
  if (!code) return '제외';
  const match = EXCLUSION_REASONS.find((r) => r.code === code);
  if (match) return match.label;
  if (code === '내부이체' || code === 'internal_transfer') return '내부이체';
  if (code === '사업거래' || code === 'business_transaction' || code === '법인거래 제외' || code === '사업비 제외' || code === '사업 금융비용 제외' || code === '임대사업 제외') return '사업거래';
  if (code === '부채 원금상환' || code === 'debt_principal_repayment' || code === '대여금반환 / 원금상환') return '부채 원금상환';
  if (code === '자산 이동' || code === 'asset_transfer') return '자산 이동';
  if (code === '입금' || code === 'income') return '입금';
  if (code === '확인 불가' || code === 'unknown') return '확인 불가';
  return code;
}

export const INITIAL_MERCHANT_RULES: MerchantRule[] = INITIAL_JSON_MERCHANT_RULES;
export const INITIAL_EXCLUSION_RULES: ExclusionRule[] = INITIAL_JSON_EXCLUSION_RULES;
export const INITIAL_CATEGORY_RULES: CategoryRule[] = INITIAL_JSON_CATEGORY_RULES;
