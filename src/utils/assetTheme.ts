/**
 * Material Symbol Icon helpers for Asset & Debt details lists.
 */

export function getAssetTypeIcon(assetType?: string, assetName?: string): string {
  const target = `${assetType || ''} ${assetName || ''}`.trim();
  if (!target) return 'account_balance_wallet';

  if (target.includes('아파트')) return 'apartment';
  if (target.includes('상가')) return 'store';
  if (target.includes('현금')) return 'payments';
  if (
    target.includes('예금') ||
    target.includes('적금') ||
    target.includes('예적금') ||
    target.includes('통장') ||
    target.includes('청약')
  ) {
    return 'savings';
  }
  if (
    target.includes('주식') ||
    target.includes('펀드') ||
    target.includes('암호화폐') ||
    target.includes('코인') ||
    target.includes('채권') ||
    target.includes('투자')
  ) {
    return 'monitoring';
  }
  if (
    target.includes('부동산') ||
    target.includes('주택') ||
    target.includes('건물') ||
    target.includes('토지') ||
    target.includes('빌라') ||
    target.includes('오피스텔')
  ) {
    return 'home';
  }

  return 'account_balance_wallet';
}

export function getDebtTypeIcon(debtType?: string, lender?: string, debtName?: string): string {
  const target = `${debtType || ''} ${lender || ''} ${debtName || ''}`.trim();
  if (!target) return 'receipt_long';

  if (target.includes('카드')) return 'credit_card';
  if (
    target.includes('개인') ||
    target.includes('차용') ||
    target.includes('지인') ||
    target.includes('가족')
  ) {
    return 'handshake';
  }
  if (
    target.includes('은행') ||
    target.includes('담보') ||
    target.includes('신용') ||
    target.includes('대출') ||
    target.includes('금융') ||
    target.includes('원리금') ||
    target.includes('마이너스')
  ) {
    return 'account_balance';
  }

  return 'receipt_long';
}
