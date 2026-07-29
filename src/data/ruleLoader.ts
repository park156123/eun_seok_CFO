import merchantRulesJson from './cfoMerchantRules.json';
import categoryRulesJson from './cfoCategoryRules.json';
import exclusionRulesJson from './cfoExclusionRules.json';
import policyJson from './cfoClassificationPolicy.json';
import { MerchantRule, CategoryRule, ExclusionRule } from '../types';

function mapExclusionTypeLabel(reason: string): string {
  switch (reason) {
    case 'internal_transfer':
      return '내부이체';
    case 'user_excluded':
      return '사용자 제외';
    case 'business_transaction':
      return '사업거래';
    case 'debt_principal_repayment':
      return '부채 원금상환';
    case 'unknown':
      return '확인 불가';
    default:
      return '제외';
  }
}

export function loadMerchantRules(): MerchantRule[] {
  return (merchantRulesJson as any[]).map((r) => ({
    id: r.id,
    merchantMaster: r.merchantMaster || '',
    patterns: Array.isArray(r.patterns) ? r.patterns : [],
    matchType: r.matchType || 'contains',
    majorCategory: r.majorCategory || '기타',
    minorCategory: r.minorCategory || '기타지출',
    included: r.classificationType === 'consumer',
    confidence: r.confidence || 'confirmed',
    autoConfirm: r.autoConfirm ?? true,
    source: r.source || 'initial-master',
    isActive: r.isActive ?? true,
    memo: r.memo,
  }));
}

export function loadCategoryRules(): CategoryRule[] {
  return (categoryRulesJson as any[]).map((r) => ({
    id: r.id,
    keywords: Array.isArray(r.keywords) ? r.keywords : [r.keyword || ''],
    keyword: Array.isArray(r.keywords) && r.keywords.length > 0 ? r.keywords[0] : (r.keyword || ''),
    majorCategory: r.majorCategory,
    minorCategory: r.minorCategory,
    priority: r.priority ?? 50,
    confidence: r.confidence || 'high',
    autoConfirm: r.autoConfirm ?? true,
    isActive: r.isActive ?? true,
  }));
}

export function loadExclusionRules(): ExclusionRule[] {
  return (exclusionRulesJson as any[]).map((r) => ({
    id: r.id,
    patterns: Array.isArray(r.patterns) ? r.patterns : [],
    matchType: r.matchType || 'contains',
    exclusionType: mapExclusionTypeLabel(r.exclusionReason),
    exclusionReason: r.exclusionReason || 'unknown',
    dashboardTreatment: r.dashboardTreatment || 'exclude',
    debtTreatment: r.debtTreatment || 'none',
    confidence: r.confidence || 'confirmed',
    autoConfirm: r.autoConfirm ?? true,
    source: r.source || 'initial-master',
    isActive: r.isActive ?? true,
  }));
}

export function loadClassificationPolicy() {
  return policyJson;
}

export const INITIAL_JSON_MERCHANT_RULES = loadMerchantRules();
export const INITIAL_JSON_CATEGORY_RULES = loadCategoryRules();
export const INITIAL_JSON_EXCLUSION_RULES = loadExclusionRules();
