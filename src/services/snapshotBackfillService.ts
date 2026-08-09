import { SnapshotService } from './snapshotService';
import { saveSnapshotToFirestore } from './firestoreDataService';

export interface BackfillResult {
  monthKey: string;
  status: 'success' | 'skipped' | 'failed';
  message: string;
  payload?: any;
}

/**
 * Safely backfills confirmed snapshots from localStorage to Firestore for specified months.
 * NOTE: THIS FUNCTION IS NOT CALLED AUTOMATICALLY. Call only upon explicit user request.
 */
export const backfillConfirmedSnapshotsToFirestore = async (
  monthKeys: string[] = ['2026-04', '2026-05']
): Promise<BackfillResult[]> => {
  const results: BackfillResult[] = [];

  for (const monthKey of monthKeys) {
    try {
      const monthlySnapshot = SnapshotService.getOpeningSnapshot(monthKey);
      if (!monthlySnapshot) {
        results.push({
          monthKey,
          status: 'skipped',
          message: `localStorage에 ${monthKey} Snapshot이 존재하지 않습니다.`,
        });
        continue;
      }

      if (monthlySnapshot.status !== 'confirmed') {
        results.push({
          monthKey,
          status: 'skipped',
          message: `localStorage의 ${monthKey} Snapshot 상태가 'confirmed'가 아닙니다 (현재 status: ${monthlySnapshot.status}).`,
        });
        continue;
      }

      const assetSnapshots = SnapshotService.getAssetSnapshotsByMonth(monthKey) || [];
      const debtSnapshots = SnapshotService.getDebtSnapshotsByMonth(monthKey) || [];
      const debtMovements = SnapshotService.getMonthlyDebtMovements(monthKey) || [];

      const payload = {
        monthlySnapshot,
        assetSnapshots,
        debtSnapshots,
        debtMovements,
      };

      await saveSnapshotToFirestore(monthKey, payload);

      results.push({
        monthKey,
        status: 'success',
        message: `households/family_cfo/snapshots/${monthKey} 백필 성공 (${assetSnapshots.length}개 자산, ${debtSnapshots.length}개 부채)`,
        payload,
      });
    } catch (err: any) {
      results.push({
        monthKey,
        status: 'failed',
        message: `백필 실패: ${err?.message || String(err)}`,
      });
    }
  }

  return results;
};

// Expose on window object for easy manual invocation in developer console when requested
if (typeof window !== 'undefined') {
  (window as any).__backfillConfirmedSnapshotsToFirestore = backfillConfirmedSnapshotsToFirestore;
}
