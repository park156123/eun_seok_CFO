import React, { useState, useMemo, useEffect } from 'react';
import { GlobalMockDataStore } from '../services/dataStore';
import { SnapshotService } from '../services/snapshotService';
import {
  wonToMan,
  manToWon,
  formatManInputValue,
  parseManInputValue,
  formatKoreanAmountFromMan,
} from '../utils/amountUtils';

interface OpeningSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: string; // e.g., '2026년 4월' or '2026-04'
  onConfirmed?: (month: string, confirmedSnapshot: any) => void;
}

interface AssetItemState {
  id: string;
  name: string;
  category: string;
  refValue: number; // Master current reference value
  value: number; // User entered starting value
  memo: string;
  showMemo?: boolean;
  isIncluded: boolean;
  isCustom?: boolean;
}

interface DebtItemState {
  id: string;
  name: string;
  creditor: string;
  refPrincipal: number; // Master current reference principal
  openingPrincipal: number; // User entered starting principal
  scheduledPrincipalRepayment: number;
  memo: string;
  showMemo?: boolean;
  isIncluded: boolean;
  isCustom?: boolean;
}

const formatKoreanWon = (num: number): string => {
  if (!num) return '0원';
  if (num >= 100000000 && num % 100000000 === 0) {
    return `${num / 100000000}억원`;
  } else if (num >= 100000000) {
    const euk = Math.floor(num / 100000000);
    const remainder = num % 100000000;
    if (remainder >= 10000) {
      const man = Math.floor(remainder / 10000);
      return `${euk}억 ${man.toLocaleString()}만원`;
    }
    return `${euk}억 ${remainder.toLocaleString()}원`;
  } else if (num >= 10000) {
    const man = Math.floor(num / 10000);
    const remainder = num % 10000;
    if (remainder > 0) {
      return `${man.toLocaleString()}만 ${remainder.toLocaleString()}원`;
    }
    return `${man.toLocaleString()}만원`;
  }
  return `${num.toLocaleString()}원`;
};

const formatConfirmedDate = (isoStr?: string | null): string => {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}.${m}.${day} ${hh}:${mm}`;
  } catch {
    return isoStr;
  }
};

const getInitialMasterAssets = (): AssetItemState[] => {
  const assetsData = GlobalMockDataStore.getAssets();
  let masters: any[] = [];
  if (Array.isArray(assetsData)) {
    masters = assetsData;
  } else if (assetsData?.onboardingAssets && assetsData.onboardingAssets.length > 0) {
    masters = assetsData.onboardingAssets.map((a: any) => ({
      id: a.id,
      name: a.assetName || a.name || '자산',
      category: a.assetType || a.category || '기타자산',
      amount: Number(a.currentValue) || Number(a.amount) || 0,
      memo: a.memo || '',
    }));
  } else if (assetsData?.mainAssets) {
    masters = assetsData.mainAssets;
  }

  return masters.map((ma: any) => {
    const masterVal = Number(ma.amount) || Number(ma.currentValue) || 0;
    return {
      id: ma.id,
      name: ma.name || ma.assetName || '자산',
      category: ma.category || ma.assetType || '기타자산',
      refValue: masterVal,
      value: masterVal, // Pre-fill with master default value
      memo: ma.memo || '',
      showMemo: false,
      isIncluded: true,
      isCustom: false,
    };
  });
};

const getInitialMasterDebts = (): DebtItemState[] => {
  const debtsData = GlobalMockDataStore.getDebts();
  let masters: any[] = [];
  if (Array.isArray(debtsData)) {
    masters = debtsData;
  } else if (debtsData?.onboardingDebts && debtsData.onboardingDebts.length > 0) {
    masters = debtsData.onboardingDebts.map((d: any) => ({
      id: d.id,
      name: d.debtName || d.name || '부채',
      amount: Number(d.currentBalance) || Number(d.amount) || 0,
      principalRepayment: Number(d.manualPrincipalPayment) || Number(d.currentPrincipalPayment) || 0,
      creditor: d.creditorName || d.creditor || '금융기관',
      memo: d.memo || '',
    }));
  } else if (debtsData?.mainDebts) {
    masters = debtsData.mainDebts;
  }

  return masters.map((md: any) => {
    const name = md.name || md.debtName || '부채';
    const masterBal = Number(md.amount) || Number(md.currentBalance) || 0;
    const creditor = md.creditor || (name.includes('담보') || name.includes('대출') ? '금융기관' : '개인/금융');
    return {
      id: md.id,
      name,
      creditor,
      refPrincipal: masterBal,
      openingPrincipal: masterBal, // Pre-fill with master default balance
      scheduledPrincipalRepayment: Number(md.principalRepayment) || 0,
      memo: md.memo || '',
      showMemo: false,
      isIncluded: true,
      isCustom: false,
    };
  });
};

export const OpeningSnapshotModal: React.FC<OpeningSnapshotModalProps> = ({
  isOpen,
  onClose,
  selectedMonth,
  onConfirmed,
}) => {
  // Parse month string into YYYY-MM and formatted display
  const { yearMonthStr, displayMonth, defaultRefDate } = useMemo(() => {
    const match = selectedMonth.match(/(\d{4})[^\d]?(\d{1,2})/);
    if (match) {
      const y = match[1];
      const m = String(parseInt(match[2], 10)).padStart(2, '0');
      return {
        yearMonthStr: `${y}-${m}`,
        displayMonth: `${y}년 ${parseInt(m, 10)}월`,
        defaultRefDate: `${y}-${m}-01`,
      };
    }
    return {
      yearMonthStr: '2026-04',
      displayMonth: selectedMonth || '2026년 4월',
      defaultRefDate: '2026-04-01',
    };
  }, [selectedMonth]);

  const [referenceDate, setReferenceDate] = useState<string>(defaultRefDate);
  const [hasDraft, setHasDraft] = useState<boolean>(false);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const [isEditingConfirmed, setIsEditingConfirmed] = useState<boolean>(false);
  const [showEditPrompt, setShowEditPrompt] = useState<boolean>(false);
  const [confirmedAtDate, setConfirmedAtDate] = useState<string | null>(null);

  const isReadOnly = isConfirmed && !isEditingConfirmed;

  const [saveFeedback, setSaveFeedback] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [confirmFeedback, setConfirmFeedback] = useState<'idle' | 'confirming' | 'confirmed'>('idle');
  const [diagnosticStep, setDiagnosticStep] = useState<string>('대기');
  const [showInModalConfirm, setShowInModalConfirm] = useState<boolean>(false);

  // Initial Master Assets
  const [assetItems, setAssetItems] = useState<AssetItemState[]>(getInitialMasterAssets);

  // Initial Master Debts
  const [debtItems, setDebtItems] = useState<DebtItemState[]>(getInitialMasterDebts);

  // Query and restore Opening Snapshot when modal opens
  // Priority: Confirmed -> Draft -> Default master initial values
  useEffect(() => {
    setShowInModalConfirm(false);
    setShowEditPrompt(false);
    setIsEditingConfirmed(false);
    if (!isOpen) {
      setSaveFeedback('idle');
      setConfirmFeedback('idle');
      setDiagnosticStep('대기');
      return;
    }
    setDiagnosticStep('대기');

    try {
      const snap = GlobalMockDataStore.getOpeningSnapshotDraft(yearMonthStr);
      if (snap) {
        if (snap.status === 'confirmed') {
          setIsConfirmed(true);
          setConfirmedAtDate(snap.confirmedAt || snap.updatedAt || null);
          setHasDraft(false);
        } else {
          setIsConfirmed(false);
          setConfirmedAtDate(null);
          setHasDraft(true);
        }

        const refDate = snap.referenceDate || (snap as any).baseDate;
        if (refDate) {
          setReferenceDate(refDate);
        }

        const mastersA = getInitialMasterAssets();
        const mastersD = getInitialMasterDebts();

        if (Array.isArray(snap.assets) && snap.assets.length > 0) {
          const restoredAssets: AssetItemState[] = snap.assets.map((a: any) => {
            const masterMatch = mastersA.find((ma) => ma.id === (a.linkedAssetId || a.id));
            return {
              id: a.id || a.linkedAssetId || `asset-${Date.now()}`,
              name: a.assetNameSnapshot || a.name || masterMatch?.name || '자산',
              category: a.assetTypeSnapshot || a.category || masterMatch?.category || '기타자산',
              refValue: masterMatch ? masterMatch.refValue : 0,
              value: Number(a.value) || 0,
              memo: a.memo || '',
              showMemo: Boolean(a.memo),
              isIncluded: a.isIncluded !== false,
              isCustom: Boolean(a.isHistoricalOnly || a.isCustom || (!masterMatch && !a.linkedAssetId)),
            };
          });
          setAssetItems(restoredAssets);
        }

        if (Array.isArray(snap.debts) && snap.debts.length > 0) {
          const restoredDebts: DebtItemState[] = snap.debts.map((d: any) => {
            const masterMatch = mastersD.find((md) => md.id === (d.linkedDebtId || d.id));
            return {
              id: d.id || d.linkedDebtId || `debt-${Date.now()}`,
              name: d.debtNameSnapshot || d.name || masterMatch?.name || '부채',
              creditor: d.creditorNameSnapshot || d.creditor || masterMatch?.creditor || '개인/금융',
              refPrincipal: masterMatch ? masterMatch.refPrincipal : 0,
              openingPrincipal: Number(d.openingPrincipal) || 0,
              scheduledPrincipalRepayment: Number(d.scheduledPrincipalRepayment) || 0,
              memo: d.memo || '',
              showMemo: Boolean(d.memo),
              isIncluded: d.isIncluded !== false,
              isCustom: Boolean(d.isHistoricalOnly || d.isCustom || (!masterMatch && !d.linkedDebtId)),
            };
          });
          setDebtItems(restoredDebts);
        }
      } else {
        setIsConfirmed(false);
        setConfirmedAtDate(null);
        setHasDraft(false);
        setReferenceDate(defaultRefDate);
        setAssetItems(getInitialMasterAssets());
        setDebtItems(getInitialMasterDebts());
      }
    } catch (error) {
      console.error('Failed to restore opening snapshot:', error);
      setIsConfirmed(false);
      setConfirmedAtDate(null);
      setHasDraft(false);
      setReferenceDate(defaultRefDate);
      setAssetItems(getInitialMasterAssets());
      setDebtItems(getInitialMasterDebts());
    }
  }, [isOpen, yearMonthStr, defaultRefDate]);

  if (!isOpen) return null;

  // Real-time summary calculation
  const totalAssets = assetItems
    .filter((item) => item.isIncluded)
    .reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  const totalDebts = debtItems
    .filter((item) => item.isIncluded)
    .reduce((sum, item) => sum + (Number(item.openingPrincipal) || 0), 0);

  const netWorth = totalAssets - totalDebts;

  // Handlers for Asset Items
  const handleAssetChange = (id: string, field: keyof AssetItemState, value: any) => {
    if (isReadOnly) return;
    setAssetItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleAddPastAsset = () => {
    if (isReadOnly) return;
    const newId = `past-asset-${Date.now()}`;
    setAssetItems((prev) => [
      ...prev,
      {
        id: newId,
        name: '',
        category: '과거자산',
        refValue: 0,
        value: 0,
        memo: '',
        showMemo: false,
        isIncluded: true,
        isCustom: true,
      },
    ]);
  };

  const handleRemoveAsset = (id: string) => {
    if (isReadOnly) return;
    setAssetItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Handlers for Debt Items
  const handleDebtChange = (id: string, field: keyof DebtItemState, value: any) => {
    if (isReadOnly) return;
    setDebtItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleAddPastDebt = () => {
    if (isReadOnly) return;
    const newId = `past-debt-${Date.now()}`;
    const placeholders = ['어머니 차입금', '큰이모 차입금', '기타 지인 차입금'];
    const placeholderName = placeholders[Math.floor(Math.random() * placeholders.length)];

    setDebtItems((prev) => [
      ...prev,
      {
        id: newId,
        name: placeholderName,
        creditor: '개인/지인',
        refPrincipal: 0,
        openingPrincipal: 0,
        scheduledPrincipalRepayment: 0,
        memo: '',
        showMemo: false,
        isIncluded: true,
        isCustom: true,
      },
    ]);
  };

  const handleRemoveDebt = (id: string) => {
    if (isReadOnly) return;
    setDebtItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCancelConfirmedEdit = () => {
    setIsEditingConfirmed(false);
    setIsConfirmed(true);
    setShowEditPrompt(false);
    setDiagnosticStep('수정 취소');
    try {
      const snap = GlobalMockDataStore.getOpeningSnapshotDraft(yearMonthStr);
      if (snap) {
        setConfirmedAtDate(snap.confirmedAt || snap.updatedAt || null);
        const refDate = snap.referenceDate || (snap as any).baseDate;
        if (refDate) {
          setReferenceDate(refDate);
        }
        const mastersA = getInitialMasterAssets();
        const mastersD = getInitialMasterDebts();

        if (Array.isArray(snap.assets) && snap.assets.length > 0) {
          const restoredAssets: AssetItemState[] = snap.assets.map((a: any) => {
            const masterMatch = mastersA.find((ma) => ma.id === (a.linkedAssetId || a.id));
            return {
              id: a.id || a.linkedAssetId || `asset-${Date.now()}`,
              name: a.assetNameSnapshot || a.name || masterMatch?.name || '자산',
              category: a.assetTypeSnapshot || a.category || masterMatch?.category || '기타자산',
              refValue: masterMatch ? masterMatch.refValue : 0,
              value: Number(a.value) || 0,
              memo: a.memo || '',
              showMemo: Boolean(a.memo),
              isIncluded: a.isIncluded !== false,
              isCustom: Boolean(a.isHistoricalOnly || a.isCustom || (!masterMatch && !a.linkedAssetId)),
            };
          });
          setAssetItems(restoredAssets);
        }

        if (Array.isArray(snap.debts) && snap.debts.length > 0) {
          const restoredDebts: DebtItemState[] = snap.debts.map((d: any) => {
            const masterMatch = mastersD.find((md) => md.id === (d.linkedDebtId || d.id));
            return {
              id: d.id || d.linkedDebtId || `debt-${Date.now()}`,
              name: d.debtNameSnapshot || d.name || masterMatch?.name || '부채',
              creditor: d.creditorNameSnapshot || d.creditor || masterMatch?.creditor || '개인/금융',
              refPrincipal: masterMatch ? masterMatch.refPrincipal : 0,
              openingPrincipal: Number(d.openingPrincipal) || 0,
              scheduledPrincipalRepayment: Number(d.scheduledPrincipalRepayment) || 0,
              memo: d.memo || '',
              showMemo: Boolean(d.memo),
              isIncluded: d.isIncluded !== false,
              isCustom: Boolean(d.isHistoricalOnly || d.isCustom || (!masterMatch && !d.linkedDebtId)),
            };
          });
          setDebtItems(restoredDebts);
        }
      }
    } catch (err) {
      console.error('Failed to cancel confirmed edit:', err);
    }
  };

  const handleSaveConfirmedEdit = () => {
    if (saveFeedback !== 'idle' || confirmFeedback !== 'idle') return;
    setConfirmFeedback('confirming');
    setDiagnosticStep('Confirmed 스냅샷 수정 저장 중...');

    try {
      const payload = {
        month: yearMonthStr,
        baseDate: referenceDate,
        assets: assetItems,
        debts: debtItems,
        totalAssets,
        totalDebts,
        netWorth,
      };

      const result = GlobalMockDataStore.updateConfirmedOpeningSnapshot(payload);
      if (!result || result.status !== 'confirmed') {
        throw new Error('확정 스냅샷 수정 저장 결과가 올바르지 않습니다.');
      }

      setConfirmFeedback('confirmed');
      setDiagnosticStep('✓ 수정 완료');
      setIsEditingConfirmed(false);
      setIsConfirmed(true);
      setConfirmedAtDate(result.confirmedAt || result.updatedAt || new Date().toISOString());

      if (onConfirmed) {
        onConfirmed(yearMonthStr, result);
      }

      setTimeout(() => {
        setConfirmFeedback('idle');
        onClose();
      }, 800);
    } catch (err: any) {
      console.error('[OpeningSnapshotModal] save confirmed edit error:', err);
      const errMsg = err?.message || '스냅샷 수정 저장 중 오류가 발생했습니다.';
      setDiagnosticStep(`오류 - ${errMsg}`);
      alert(errMsg);
      setConfirmFeedback('idle');
    }
  };

  const handleSaveDraft = () => {
    if (saveFeedback !== 'idle' || confirmFeedback !== 'idle' || isReadOnly) return;
    setSaveFeedback('saving');

    setTimeout(() => {
      try {
        const payload = {
          month: yearMonthStr,
          baseDate: referenceDate,
          assets: assetItems,
          debts: debtItems,
          totalAssets,
          totalDebts,
          netWorth,
        };

        const draft = SnapshotService.prepareOpeningSnapshotDraft(payload);
        GlobalMockDataStore.saveOpeningSnapshotDraft(draft);
        setHasDraft(true);

        setSaveFeedback('saved');
        setTimeout(() => {
          setSaveFeedback('idle');
        }, 1500);
      } catch (error: any) {
        alert(error?.message || '시작 스냅샷 임시저장 중 오류가 발생했습니다.');
        setSaveFeedback('idle');
      }
    }, 200);
  };

  const handleFirstConfirmClick = () => {
    console.log('[OpeningSnapshot] first confirm button clicked');
    setDiagnosticStep('1. 확정 버튼 클릭 감지');

    if (saveFeedback !== 'idle' || confirmFeedback !== 'idle' || isConfirmed) {
      console.warn('[OpeningSnapshot] Click ignored due to feedback/confirmed state:', { saveFeedback, confirmFeedback, isConfirmed });
      return;
    }

    try {
      const payload = {
        month: yearMonthStr,
        baseDate: referenceDate,
        assets: assetItems,
        debts: debtItems,
        totalAssets,
        totalDebts,
        netWorth,
      };

      setDiagnosticStep('2. payload 생성 및 사전 검증 중');

      // Pre-validate draft creation
      const draft = SnapshotService.prepareOpeningSnapshotDraft(payload);
      const formIncludedDebtsCount = debtItems.filter((d) => d.isIncluded !== false).length;
      
      if (formIncludedDebtsCount !== draft.debts.length) {
        throw new Error(`부채 저장 개수가 일치하지 않습니다\n화면 포함 부채 ${formIncludedDebtsCount}건 / 저장 대상 부채 ${draft.debts.length}건`);
      }

      setDiagnosticStep('3. 2차 확인 영역 표시');
      setShowInModalConfirm(true);
    } catch (error: any) {
      console.error('[OpeningSnapshotModal] validation error:', error);
      const errMsg = error?.message || '검증 중 오류가 발생했습니다.';
      setDiagnosticStep(`오류 - ${errMsg}`);
      alert(errMsg);
    }
  };

  const handleFinalConfirm = () => {
    console.log('[OpeningSnapshot] handleFinalConfirm triggered');
    setDiagnosticStep('4. 최종 확정 클릭');
    setConfirmFeedback('confirming');

    try {
      const payload = {
        month: yearMonthStr,
        baseDate: referenceDate,
        assets: assetItems,
        debts: debtItems,
        totalAssets,
        totalDebts,
        netWorth,
      };

      const formTotalDebts = debtItems.length;
      const formIncludedDebts = debtItems.filter((d) => d.isIncluded !== false).length;

      // 1. Prepare draft and verify count
      const draft = SnapshotService.prepareOpeningSnapshotDraft(payload);
      const draftDebtsCount = draft.debts.length;

      if (formIncludedDebts !== draftDebtsCount) {
        throw new Error(`부채 저장 개수가 일치하지 않습니다\n화면 포함 부채 ${formIncludedDebts}건 / 저장 대상 부채 ${draftDebtsCount}건`);
      }

      // 2. Save draft to store
      GlobalMockDataStore.saveOpeningSnapshotDraft(draft);
      setDiagnosticStep('5. Draft 저장 완료');

      // 3. Confirm opening snapshot draft in DataStore
      setDiagnosticStep('6. DataStore 확정 호출');
      const result = GlobalMockDataStore.confirmOpeningSnapshotDraft(yearMonthStr);

      // 4. Strict validation on Confirmed return object
      if (!result || result.status !== 'confirmed') {
        throw new Error('확정 처리 결과가 올바르지 않습니다 (status != confirmed).');
      }

      if (result.debts.length !== formIncludedDebts) {
        throw new Error(`Confirmed 부채 수 불일치 (요청: ${formIncludedDebts}건, Confirmed: ${result.debts.length}건)`);
      }

      const confirmedDebtsSum = Math.round(
        result.debts.reduce((sum, d) => sum + (Number(d.openingPrincipal) || 0), 0)
      );

      if (Math.round(result.totalDebts) !== confirmedDebtsSum) {
        throw new Error(`Confirmed totalDebts(${result.totalDebts})와 부채 원금 합계(${confirmedDebtsSum}) 불일치`);
      }

      // Verify '재호' presence if included in form
      const jaehoIncluded = debtItems.some((d) => (d.name || '').includes('재호') && d.isIncluded !== false);
      if (jaehoIncluded && !result.debts.some((d) => (d.debtNameSnapshot || '').includes('재호'))) {
        throw new Error('Confirmed 부채 항목에서 "재호" 부채가 누락되었습니다.');
      }

      // Verify '광주엄니' presence if included in form
      const gwangjuIncluded = debtItems.some((d) => (d.name || '').includes('광주엄니') && d.isIncluded !== false);
      if (gwangjuIncluded && !result.debts.some((d) => (d.debtNameSnapshot || '').includes('광주엄니'))) {
        throw new Error('Confirmed 부채 항목에서 "광주엄니" 부채가 누락되었습니다.');
      }

      console.log('[OpeningSnapshotModal] confirm successful:', {
        status: result.status,
        assetsCount: result.assets.length,
        debtsCount: result.debts.length,
        totalDebts: result.totalDebts,
      });

      const formattedTotalDebts = `${result.totalDebts.toLocaleString()}원`;
      setDiagnosticStep(
        `7. Confirmed 반환 완료 | 폼 ${formTotalDebts}건 | 포함 ${formIncludedDebts}건 | Draft ${draftDebtsCount}건 | Confirmed ${result.debts.length}건 | 총부채 ${formattedTotalDebts}`
      );

      setShowInModalConfirm(false);
      setConfirmFeedback('confirmed');
      setIsConfirmed(true);
      setConfirmedAtDate(result.confirmedAt);

      if (onConfirmed) {
        onConfirmed(yearMonthStr, result);
      }

      setTimeout(() => {
        setConfirmFeedback('idle');
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('[OpeningSnapshotModal] final confirm error:', err);
      const errMsg = err?.message || '스냅샷 확정 처리 중 오류가 발생했습니다.';
      setDiagnosticStep(`오류 - ${errMsg}`);
      alert(errMsg);
      setConfirmFeedback('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden border border-[#c5c5d3]/30 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#e1e2ec] flex items-center justify-between bg-[#f8f9fc]">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="material-symbols-outlined text-[#00236f] text-xl">flag</span>
              <h2 className="text-lg font-dohyeon text-[#1b1b1f]">
                {displayMonth} 시작 스냅샷{isEditingConfirmed ? ' 수정' : isConfirmed ? ' 보기' : hasDraft ? ' 이어쓰기' : ' 작성'}
              </h2>
              {isEditingConfirmed ? (
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-md border border-amber-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">edit</span>
                  수정 모드
                </span>
              ) : isConfirmed ? (
                <span className="px-2.5 py-0.5 bg-[#006c49]/10 text-[#006c49] text-[11px] font-bold rounded-md border border-[#006c49]/30 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">check_circle</span>
                  확정 완료
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-[#e8edff] text-[#00236f] text-[11px] font-semibold rounded-md border border-[#00236f]/20">
                  시작점
                </span>
              )}
            </div>
            {isConfirmed && confirmedAtDate && (
              <p className="text-[11px] text-[#006c49] mt-0.5 font-sans font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">event_available</span>
                확정일 {formatConfirmedDate(confirmedAtDate)} {isEditingConfirmed && '(수정 작성 중)'}
              </p>
            )}
            {!isConfirmed && (
              <p className="text-xs text-[#444651] mt-0.5 font-sans">
                {hasDraft ? '임시저장된 시작 상태를 이어 작성합니다.' : '첫 장부의 시작 상태를 입력합니다.'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#757782] hover:text-[#1b1b1f] hover:bg-[#e1e2ec]/50 rounded-lg transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs font-sans text-[#1b1b1f]">
          {/* 섹션1: 기준 정보 */}
          <div className="bg-[#f2f4f6] p-4 rounded-xl border border-[#e1e2ec] space-y-3">
            <h3 className="font-dohyeon text-sm text-[#00236f] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">event_note</span>
              섹션 1. 기준 정보
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#444651] mb-1">기준월 (읽기전용)</label>
                <input
                  type="text"
                  value={yearMonthStr}
                  readOnly
                  className="w-full px-3 py-2 bg-[#e8e8ed] border border-[#c5c5d3] rounded-lg font-mono text-xs text-[#555] cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#444651] mb-1">기준일</label>
                <input
                  type="date"
                  value={referenceDate}
                  disabled={isReadOnly}
                  readOnly={isReadOnly}
                  onChange={(e) => setReferenceDate(e.target.value)}
                  className={`w-full px-3 py-2 border border-[#c5c5d3] rounded-lg text-xs text-[#1b1b1f] transition-colors ${
                    isReadOnly ? 'bg-[#e8e8ed] text-[#555] cursor-not-allowed' : 'bg-white focus:outline-hidden focus:border-[#00236f]'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* 섹션2: 자산 시작잔액 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-dohyeon text-sm text-[#00236f] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">account_balance_wallet</span>
                섹션 2. 자산 시작잔액
              </h3>
              <span className="text-[11px] text-[#757782]">
                {isReadOnly ? '확정된 스냅샷 항목입니다' : '체크 해제 시 스냅샷에서 제외됩니다'}
              </span>
            </div>

            <div className="space-y-2.5">
              {assetItems.map((asset) => (
                <div
                  key={asset.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    asset.isIncluded
                      ? 'bg-white border-[#c5c5d3]/50 shadow-2xs'
                      : 'bg-[#f8f9fc] border-[#e1e2ec] opacity-60'
                  }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    {/* 포함 체크 & 이름 */}
                    <div className="sm:col-span-4 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={asset.isIncluded}
                        disabled={isReadOnly}
                        onChange={(e) => handleAssetChange(asset.id, 'isIncluded', e.target.checked)}
                        className="w-4 h-4 rounded-xs text-[#00236f] focus:ring-[#00236f] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      {asset.isCustom ? (
                        <input
                          type="text"
                          placeholder="과거 자산명 입력"
                          value={asset.name}
                          disabled={isReadOnly}
                          readOnly={isReadOnly}
                          onChange={(e) => handleAssetChange(asset.id, 'name', e.target.value)}
                          className={`w-full px-2 py-1 border border-[#c5c5d3] rounded-md text-xs font-medium ${
                            isReadOnly ? 'bg-[#f2f4f6] text-[#1b1b1f] cursor-not-allowed' : 'bg-white'
                          }`}
                        />
                      ) : (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[#1b1b1f]">{asset.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-[#f2f4f6] text-[#444651] rounded-xs border border-[#c5c5d3]/40">
                              {asset.category}
                            </span>
                          </div>
                          {/* 읽기전용 현재 참고금액 */}
                          {asset.refValue > 0 && (
                            <span className="text-[11px] text-gray-400 block mt-0.5">
                              현재 참고금액: {formatKoreanWon(asset.refValue)} ({asset.refValue.toLocaleString()}원)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 유형 (Custom일 경우 수정가능) */}
                    <div className="sm:col-span-2">
                      {asset.isCustom ? (
                        <input
                          type="text"
                          placeholder="유형 (예: 부동산/주식)"
                          value={asset.category}
                          disabled={isReadOnly}
                          readOnly={isReadOnly}
                          onChange={(e) => handleAssetChange(asset.id, 'category', e.target.value)}
                          className={`w-full px-2 py-1 border border-[#c5c5d3] rounded-md text-xs ${
                            isReadOnly ? 'bg-[#f2f4f6] text-[#1b1b1f] cursor-not-allowed' : 'bg-white'
                          }`}
                        />
                      ) : (
                        <span className="text-[11px] text-[#757782] block text-center sm:text-left">
                          {asset.category}
                        </span>
                      )}
                    </div>

                    {/* 시작 금액 입력 */}
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] text-[#757782] mb-0.5">
                        {displayMonth} 당시 금액 (만원)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={formatManInputValue(wonToMan(asset.value))}
                          disabled={isReadOnly}
                          readOnly={isReadOnly}
                          onChange={(e) => {
                            const manNum = parseManInputValue(e.target.value);
                            handleAssetChange(asset.id, 'value', manToWon(manNum));
                          }}
                          placeholder="0"
                          className={`w-full pl-2 pr-10 py-1 border border-[#c5c5d3] rounded-md text-right font-mono text-xs ${
                            isReadOnly ? 'bg-[#f2f4f6] text-[#1b1b1f] cursor-not-allowed' : 'bg-white focus:border-[#00236f]'
                          }`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#757782] font-semibold">
                          만원
                        </span>
                      </div>
                      <p className="text-[11px] text-[#00236f] mt-0.5 text-right font-medium">
                        {formatKoreanAmountFromMan(wonToMan(asset.value))}
                      </p>
                    </div>

                    {/* 메모 토글 및 삭제 */}
                    <div className="sm:col-span-2 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAssetChange(asset.id, 'showMemo', !asset.showMemo)}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                          asset.memo
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {asset.showMemo ? '메모 닫기' : asset.memo ? '메모있음' : '+ 메모'}
                      </button>
                      {!isReadOnly && asset.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAsset(asset.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded-xs transition-colors cursor-pointer"
                          title="삭제"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 메모 접힘 입력 영역 */}
                  {asset.showMemo && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <input
                        type="text"
                        placeholder="특이사항이나 메모를 입력하세요"
                        value={asset.memo}
                        disabled={isReadOnly}
                        readOnly={isReadOnly}
                        onChange={(e) => handleAssetChange(asset.id, 'memo', e.target.value)}
                        className={`w-full px-2.5 py-1 border border-[#c5c5d3]/60 rounded-md text-xs ${
                          isReadOnly ? 'bg-[#f2f4f6] text-[#1b1b1f] cursor-not-allowed' : 'bg-[#f8f9fc]'
                        }`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 섹션4: 과거에만 존재했던 자산 추가 버튼 */}
            {!isReadOnly && (
              <div className="pt-1 space-y-1">
                <button
                  type="button"
                  onClick={handleAddPastAsset}
                  className="w-full py-2.5 border-2 border-dashed border-[#00236f]/30 hover:border-[#00236f] bg-[#00236f]/5 hover:bg-[#00236f]/10 text-[#00236f] font-dohyeon rounded-xl text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  + 과거에만 존재했던 자산 추가
                </button>
                <p className="text-[11px] text-gray-400 text-center">
                  현재는 보유하지 않지만 기준월에는 존재했던 항목을 입력합니다.
                </p>
              </div>
            )}
          </div>

          {/* 섹션3: 부채 시작잔액 */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-dohyeon text-sm text-[#00236f] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">credit_card</span>
                섹션 3. 부채 시작잔액
              </h3>
              <span className="text-[11px] text-[#757782]">
                {isReadOnly ? '확정된 스냅샷 항목입니다' : '체크 해제 시 스냅샷에서 제외됩니다'}
              </span>
            </div>

            <div className="space-y-2.5">
              {debtItems.map((debt) => (
                <div
                  key={debt.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    debt.isIncluded
                      ? 'bg-white border-[#c5c5d3]/50 shadow-2xs'
                      : 'bg-[#f8f9fc] border-[#e1e2ec] opacity-60'
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* 상단 라인: 포함체크, 부채명, 채권자(읽기전용 또는 추가부채용) */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <div className="sm:col-span-7 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={debt.isIncluded}
                          disabled={isReadOnly}
                          onChange={(e) => handleDebtChange(debt.id, 'isIncluded', e.target.checked)}
                          className="w-4 h-4 rounded-xs text-[#00236f] focus:ring-[#00236f] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        {debt.isCustom ? (
                          <input
                            type="text"
                            placeholder="과거 부채명 (예: 어머니 차입금)"
                            value={debt.name}
                            disabled={isReadOnly}
                            readOnly={isReadOnly}
                            onChange={(e) => handleDebtChange(debt.id, 'name', e.target.value)}
                            className={`w-full px-2 py-1 border border-[#c5c5d3] rounded-md text-xs font-medium ${
                              isReadOnly ? 'bg-[#f2f4f6] text-[#1b1b1f] cursor-not-allowed' : 'bg-white'
                            }`}
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#1b1b1f]">{debt.name}</span>
                            {/* 읽기전용 채권자 표시 */}
                            <span className="text-[10px] px-2 py-0.5 bg-[#f2f4f6] text-[#444651] rounded-md border border-[#c5c5d3]/40">
                              {debt.creditor}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="sm:col-span-5 flex items-center justify-end gap-2">
                        {debt.isCustom && (
                          <input
                            type="text"
                            placeholder="채권자/지인명"
                            value={debt.creditor}
                            disabled={isReadOnly}
                            readOnly={isReadOnly}
                            onChange={(e) => handleDebtChange(debt.id, 'creditor', e.target.value)}
                            className={`w-32 px-2 py-1 border border-[#c5c5d3] rounded-md text-xs ${
                              isReadOnly ? 'bg-[#f2f4f6] text-[#1b1b1f] cursor-not-allowed' : 'bg-white'
                            }`}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleDebtChange(debt.id, 'showMemo', !debt.showMemo)}
                          className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                            debt.memo
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {debt.showMemo ? '메모 닫기' : debt.memo ? '메모있음' : '+ 메모'}
                        </button>
                        {!isReadOnly && debt.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDebt(debt.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded-xs transition-colors cursor-pointer ml-1"
                            title="삭제"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 하단 라인: 원금 잔액, 월 예정 원금상환 */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#f8f9fc] p-2.5 rounded-lg border border-[#e1e2ec]/60">
                      <div className="sm:col-span-6">
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-[10px] font-medium text-[#444651]">
                            기준일 당시 원금잔액 (만원)
                          </label>
                          {debt.refPrincipal > 0 && (
                            <span className="text-[10px] text-gray-400">
                              현재 참고: {formatKoreanWon(debt.refPrincipal)}
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={formatManInputValue(wonToMan(debt.openingPrincipal))}
                            disabled={isReadOnly}
                            readOnly={isReadOnly}
                            onChange={(e) => {
                              const manNum = parseManInputValue(e.target.value);
                              handleDebtChange(debt.id, 'openingPrincipal', manToWon(manNum));
                            }}
                            placeholder="0"
                            className={`w-full pl-2 pr-10 py-1 border border-[#c5c5d3] rounded-md text-right font-mono text-xs ${
                              isReadOnly ? 'bg-[#f2f4f6] text-[#1b1b1f] cursor-not-allowed' : 'bg-white focus:border-[#00236f]'
                            }`}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#757782] font-semibold">
                            만원
                          </span>
                        </div>
                        <p className="text-[11px] text-[#00236f] mt-0.5 text-right font-medium">
                          {formatKoreanAmountFromMan(wonToMan(debt.openingPrincipal))}
                        </p>
                      </div>

                      <div className="sm:col-span-6">
                        <label className="block text-[10px] font-medium text-[#444651] mb-0.5">
                          월 예정 원금상환액 (만원)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formatManInputValue(wonToMan(debt.scheduledPrincipalRepayment))}
                            disabled={isReadOnly}
                            readOnly={isReadOnly}
                            onChange={(e) => {
                              const manNum = parseManInputValue(e.target.value);
                              handleDebtChange(debt.id, 'scheduledPrincipalRepayment', manToWon(manNum));
                            }}
                            placeholder="0"
                            className={`w-full pl-2 pr-10 py-1 border border-[#c5c5d3] rounded-md text-right font-mono text-xs ${
                              isReadOnly ? 'bg-[#f2f4f6] text-[#1b1b1f] cursor-not-allowed' : 'bg-white focus:border-[#00236f]'
                            }`}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#757782] font-semibold">
                            만원
                          </span>
                        </div>
                        <p className="text-[11px] text-[#00236f] mt-0.5 text-right font-medium">
                          {formatKoreanAmountFromMan(wonToMan(debt.scheduledPrincipalRepayment))}
                        </p>
                      </div>
                    </div>

                    {/* 접힘 메모 영역 */}
                    {debt.showMemo && (
                      <div className="pt-1">
                        <input
                          type="text"
                          placeholder="부채 관련 메모를 입력하세요"
                          value={debt.memo}
                          disabled={isReadOnly}
                          readOnly={isReadOnly}
                          onChange={(e) => handleDebtChange(debt.id, 'memo', e.target.value)}
                          className={`w-full px-2.5 py-1 border border-[#c5c5d3]/60 rounded-md text-xs ${
                            isReadOnly ? 'bg-[#f2f4f6] text-[#1b1b1f] cursor-not-allowed' : 'bg-[#f8f9fc]'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 섹션5: 과거에만 존재했던 부채 추가 버튼 */}
            {!isReadOnly && (
              <div className="pt-1 space-y-1">
                <button
                  type="button"
                  onClick={handleAddPastDebt}
                  className="w-full py-2.5 border-2 border-dashed border-[#00236f]/30 hover:border-[#00236f] bg-[#00236f]/5 hover:bg-[#00236f]/10 text-[#00236f] font-dohyeon rounded-xl text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  + 과거에만 존재했던 부채 추가
                </button>
                <p className="text-[11px] text-gray-400 text-center">
                  현재는 보유하지 않지만 기준월에는 존재했던 항목을 입력합니다.
                </p>
              </div>
            )}
          </div>

          {/* 섹션6: 실시간 요약 카드 */}
          <div className="bg-[#f2f4f6] p-4 rounded-xl border border-[#00236f]/20 shadow-2xs space-y-2">
            <h4 className="font-dohyeon text-xs text-[#00236f] flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">calculate</span>
              {isConfirmed ? '확정 합계 요약' : '실시간 합계 미리보기'}
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-white p-2.5 rounded-lg border border-[#e1e2ec]">
                <span className="block text-[10px] text-[#757782]">총 자산</span>
                <span className="font-mono font-bold text-xs text-blue-700">
                  {totalAssets.toLocaleString()}원
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#e1e2ec]">
                <span className="block text-[10px] text-[#757782]">총 부채</span>
                <span className="font-mono font-bold text-xs text-red-600">
                  {totalDebts.toLocaleString()}원
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#e1e2ec]">
                <span className="block text-[10px] text-[#757782]">시작 순자산</span>
                <span
                  className={`font-mono font-bold text-xs ${
                    netWorth >= 0 ? 'text-[#00236f]' : 'text-red-700'
                  }`}
                >
                  {netWorth.toLocaleString()}원
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#f8f9fc] border-t border-[#e1e2ec] flex flex-col gap-2">
          {/* Diagnostic Status Banner */}
          <div className="text-xs font-mono font-bold text-[#00236f] bg-blue-50/90 border border-blue-200/80 px-3 py-2 rounded-xl flex items-center justify-between flex-wrap gap-2">
            <span>폼 {debtItems.length}건 | 포함 {debtItems.filter(d => d.isIncluded !== false).length}건</span>
            <span>진단: {diagnosticStep}</span>
          </div>

          {isEditingConfirmed ? (
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCancelConfirmedEdit}
                className="px-4 py-2 bg-white hover:bg-[#e1e2ec]/50 text-[#444651] text-xs font-dohyeon rounded-xl border border-[#c5c5d3]/50 transition-all cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                disabled={confirmFeedback === 'confirming'}
                onClick={handleSaveConfirmedEdit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-dohyeon rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {confirmFeedback === 'confirming'
                  ? '저장 중...'
                  : confirmFeedback === 'confirmed'
                  ? '✓ 수정 완료'
                  : '수정 저장'}
              </button>
            </div>
          ) : isConfirmed ? (
            showEditPrompt ? (
              <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-4 flex flex-col gap-3 my-1">
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-amber-700 shrink-0 mt-0.5 text-lg">
                    help_outline
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-amber-950 font-dohyeon">
                      {displayMonth} 자산·부채 기준값을 수정하시겠습니까?
                    </p>
                    <p className="text-xs text-amber-900 leading-relaxed font-sans font-medium">
                      수정하면 해당 월의 순자산과 금융비용 계산 결과가 다시 반영됩니다
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditPrompt(false);
                      setDiagnosticStep('돌아가기 선택');
                    }}
                    className="px-4 py-2 bg-white hover:bg-amber-100 text-amber-900 text-xs font-dohyeon rounded-xl border border-amber-300 transition-all cursor-pointer"
                  >
                    돌아가기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditPrompt(false);
                      setIsEditingConfirmed(true);
                      setDiagnosticStep('수정 모드 진입');
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-dohyeon rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    수정 시작
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-[#006c49] font-medium">
                  <span className="material-symbols-outlined text-sm">lock</span>
                  <span>확정 완료된 시작 스냅샷입니다. (읽기 전용)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-white hover:bg-[#e1e2ec]/50 text-[#444651] text-xs font-dohyeon rounded-xl border border-[#c5c5d3]/50 transition-all cursor-pointer"
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditPrompt(true);
                      setDiagnosticStep('수정 안내');
                    }}
                    className="px-4 py-2 bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs font-dohyeon rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">edit</span>
                    수정하기
                  </button>
                </div>
              </div>
            )
          ) : showInModalConfirm ? (
            <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-4 flex flex-col gap-3 my-1">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-amber-700 shrink-0 mt-0.5 text-lg">
                  help_outline
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-amber-950 font-dohyeon">
                    {displayMonth} 시작 스냅샷을 확정하시겠습니까?
                  </p>
                  <p className="text-xs text-amber-900 leading-relaxed font-sans font-medium">
                    확정 후에는 해당 월의 자산·부채 기준값으로 사용됩니다.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowInModalConfirm(false);
                    setDiagnosticStep('돌아가기 선택');
                  }}
                  className="px-4 py-2 bg-white hover:bg-amber-100 text-amber-900 text-xs font-dohyeon rounded-xl border border-amber-300 transition-all cursor-pointer"
                >
                  돌아가기
                </button>
                <button
                  type="button"
                  disabled={confirmFeedback === 'confirming'}
                  onClick={handleFinalConfirm}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-dohyeon rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {confirmFeedback === 'confirming' ? '확정 처리 중...' : '최종 확정'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-white hover:bg-[#e1e2ec]/50 text-[#444651] text-xs font-dohyeon rounded-xl border border-[#c5c5d3]/50 transition-all cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={saveFeedback !== 'idle' || confirmFeedback !== 'idle'}
                  onClick={handleSaveDraft}
                  className={`px-4 py-2 text-xs font-dohyeon rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    saveFeedback === 'saving'
                      ? 'bg-blue-100 text-blue-700 cursor-wait'
                      : saveFeedback === 'saved'
                      ? 'bg-emerald-100 text-emerald-800 font-bold'
                      : 'bg-[#00236f] hover:bg-[#1e3a8a] text-white shadow-xs'
                  }`}
                >
                  {saveFeedback === 'saving'
                    ? '저장 중...'
                    : saveFeedback === 'saved'
                    ? '✓ 임시저장 완료'
                    : '임시저장'}
                </button>
                <button
                  type="button"
                  disabled={saveFeedback !== 'idle' || confirmFeedback !== 'idle'}
                  onClick={handleFirstConfirmClick}
                  className={`px-4 py-2 text-xs font-dohyeon rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    confirmFeedback === 'confirming'
                      ? 'bg-emerald-200 text-emerald-800 cursor-wait'
                      : confirmFeedback === 'confirmed'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  }`}
                >
                  {confirmFeedback === 'confirming'
                    ? '확정 중...'
                    : confirmFeedback === 'confirmed'
                    ? '✓ 확정 완료'
                    : '확정'}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 text-right font-sans">
                확정 후에는 {displayMonth} 장부의 시작 기준으로 사용됩니다.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
