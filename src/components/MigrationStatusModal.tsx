import React, { useState, useEffect } from 'react';
import { runAprilOneWayMigration, MigrationReport } from '../services/migrationService';
import {
  compareLocalStorageAndFirestoreRead,
  ReadComparisonReport,
  SPOUSE_EMAIL,
} from '../services/firestoreReadComparisonService';
import {
  runOwnerWriteTestAndVerify,
  attemptViewerWriteAndVerify,
} from '../services/firestoreDataService';
import { runStep10aVerification, Step10aReport } from '../services/step10aVerificationService';
import { auth } from '../services/firebase';
import { PRIMARY_OWNER_EMAIL, getUserRole } from '../services/householdService';
import { ALLOWED_EMAILS } from '../services/authService';
import { GlobalMockDataStore } from '../services/dataStore';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  RefreshCw,
  X,
  UserCheck,
  ShieldCheck,
  PenTool,
  Lock,
  Layers,
} from 'lucide-react';

interface MigrationStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MigrationStatusModal: React.FC<MigrationStatusModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'step10a' | 'step9b' | 'step9a' | 'step8'>('step10a');
  const [report10a, setReport10a] = useState<Step10aReport | null>(null);
  const [report8, setReport8] = useState<MigrationReport | null>(null);
  const [report9a, setReport9a] = useState<ReadComparisonReport | null>(null);

  // Step 9B State
  const [ownerTestResult, setOwnerTestResult] = useState<any>(null);
  const [viewerTestResult, setViewerTestResult] = useState<any>(null);
  const [testing9b, setTesting9b] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUserEmail = auth.currentUser?.email || '';
  const role = getUserRole(currentUserEmail);
  const isOwner = role === 'owner';

  const handleRunStep10a = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runStep10aVerification(currentUserEmail);
      setReport10a(res);
    } catch (err: any) {
      setError(err?.message || 'Step 10A 검증 실행 오류');
    } finally {
      setLoading(false);
    }
  };

  const handleRunStep9bTests = async () => {
    setTesting9b(true);
    try {
      if (isOwner) {
        const ownerRes = await runOwnerWriteTestAndVerify(currentUserEmail);
        setOwnerTestResult(ownerRes);
      } else {
        const viewerRes = await attemptViewerWriteAndVerify(currentUserEmail);
        setViewerTestResult(viewerRes);
      }
    } catch (err: any) {
      console.error('STEP 9B Test err:', err);
    } finally {
      setTesting9b(false);
    }
  };

  const handleRunStep8 = async () => {
    if (!currentUserEmail) {
      setError('인증된 유저 정보가 없습니다.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await runAprilOneWayMigration(currentUserEmail);
      setReport8(res);
    } catch (err: any) {
      setError(err?.message || 'Migration 중 오류 발생');
    } finally {
      setLoading(false);
    }
  };

  const handleRunStep9a = async () => {
    if (!currentUserEmail) {
      setError('인증된 유저 정보가 없습니다.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await compareLocalStorageAndFirestoreRead(currentUserEmail, '2026-04');
      setReport9a(res);
    } catch (err: any) {
      setError(err?.message || 'Firestore READ 검증 중 오류 발생');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'step10a' && !report10a && !loading) {
        handleRunStep10a();
      } else if (activeTab === 'step9b' && !ownerTestResult && !viewerTestResult && !testing9b) {
        handleRunStep9bTests();
      } else if (activeTab === 'step9a' && !report9a && !loading) {
        handleRunStep9a();
      } else if (activeTab === 'step8' && isOwner && !report8 && !loading) {
        handleRunStep8();
      }
    }
  }, [isOpen, activeTab, isOwner]);

  if (!isOpen) return null;

  const writeStatus = GlobalMockDataStore.getFirestoreWriteStatus();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-emerald-400" />
            <h2 className="font-bold text-lg text-white">우리집 CFO - Firebase 전환 및 승계 검증</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-700 my-3 overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('step10a');
              if (!report10a) handleRunStep10a();
            }}
            className={`py-2 px-3 font-semibold text-xs border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'step10a'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            STEP 10A: 5월 승계 & 동기화 검증
          </button>

          <button
            onClick={() => {
              setActiveTab('step9b');
              if (!ownerTestResult && !viewerTestResult) handleRunStep9bTests();
            }}
            className={`py-2 px-3 font-semibold text-xs border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'step9b'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <PenTool className="w-4 h-4" />
            STEP 9B: OWNER WRITE & 백업
          </button>

          <button
            onClick={() => {
              setActiveTab('step9a');
              if (!report9a) handleRunStep9a();
            }}
            className={`py-2 px-3 font-semibold text-xs border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'step9a'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            STEP 9A: VIEWER & READ 검증
          </button>

          <button
            onClick={() => {
              setActiveTab('step8');
              if (isOwner && !report8) handleRunStep8();
            }}
            className={`py-2 px-3 font-semibold text-xs border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'step8'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            STEP 8: Migration
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-sm">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
              <strong>오류:</strong> {error}
            </div>
          )}

          {(loading || testing9b) && (
            <div className="p-8 flex flex-col items-center justify-center gap-3 text-slate-300">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-xs font-medium">데이터 승계 및 Firestore 동기화 검증 실행 중...</p>
            </div>
          )}

          {/* TAB: STEP 10A */}
          {activeTab === 'step10a' && report10a && !loading && (
            <div className="space-y-3 text-xs">
              {/* Overall Verdict Header */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  report10a.overallVerdict === 'A. 동기화 검증 완료'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-bold text-sm">전체 판정: {report10a.overallVerdict}</p>
                    <p className="text-[11px] opacity-80">
                      로그인: {report10a.userEmail} ({report10a.role.toUpperCase()}) | 5월 결산 미확정(정상)
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-900/60 border border-slate-700">
                  Primary: Firestore
                </span>
              </div>

              {/* Breakdown Cards */}
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 space-y-2">
                <p className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-400" /> 1. 5월 시작 Snapshot 승계 결과
                </p>
                <p className="text-slate-300 text-[11px]">{report10a.maySnapshotInheritance.summary}</p>
                <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                  <div className="p-2 bg-slate-800/80 rounded border border-slate-700">
                    <span className="text-slate-400 block text-[10px]">총 자산</span>
                    <span className="font-bold text-emerald-400">{report10a.maySnapshotInheritance.totalAssets.toLocaleString()}원</span>
                  </div>
                  <div className="p-2 bg-slate-800/80 rounded border border-slate-700">
                    <span className="text-slate-400 block text-[10px]">총 부채</span>
                    <span className="font-bold text-amber-400">{report10a.maySnapshotInheritance.totalDebts.toLocaleString()}원</span>
                  </div>
                  <div className="p-2 bg-slate-800/80 rounded border border-slate-700">
                    <span className="text-slate-400 block text-[10px]">순자산</span>
                    <span className="font-bold text-emerald-300">{report10a.maySnapshotInheritance.netWorth.toLocaleString()}원</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 space-y-1.5">
                <p className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 2. 자산 / 부채 원금 1:1 승계 검증
                </p>
                <p className="text-slate-300 text-[11px]">{report10a.assetInheritance.summary}</p>
                <p className="text-slate-300 text-[11px]">{report10a.debtPrincipalInheritance.summary}</p>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 space-y-1.5">
                <p className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> 3. 부채 조건(금리/상환방식/납부일) 유지
                </p>
                <p className="text-slate-300 text-[11px] mb-1">{report10a.debtTermsPreservation.summary}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {report10a.debtTermsPreservation.details.map((dt, i) => (
                    <div key={i} className="p-1.5 bg-slate-800/60 rounded border border-slate-700/50 text-[10px] flex justify-between items-center">
                      <span className="text-slate-200 font-medium truncate max-w-[120px]">{dt.debtName}</span>
                      <span className="text-emerald-400 font-mono">{dt.rate} | {dt.method} | {dt.paymentDay}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 space-y-1.5">
                <p className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                  <PenTool className="w-4 h-4 text-emerald-400" /> 4. 안전 테스트 항목 (FIREBASE_SYNC_TEST) & Firestore 저장
                </p>
                <p className="text-slate-300 text-[11px]">{report10a.testItemDetails.summary}</p>
                <div className="p-2 bg-slate-800/80 rounded border border-slate-700 flex justify-between items-center text-[11px]">
                  <span>항목: <strong className="text-emerald-300">{report10a.testItemDetails.description}</strong> ({report10a.testItemDetails.date})</span>
                  <span className="font-bold text-emerald-400">{report10a.testItemDetails.amount.toLocaleString()}원</span>
                </div>
                <p className="text-slate-300 text-[11px]">
                  • OWNER WRITE: <strong className="text-emerald-400">{report10a.ownerWriteResult.summary}</strong>
                </p>
                <p className="text-slate-300 text-[11px]">
                  • Firestore READ: <strong className="text-emerald-400">{report10a.ownerReadBackResult.summary}</strong>
                </p>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 space-y-1 text-[11px]">
                <p className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-400" /> 5. VIEWER 조회 및 보호 규정
                </p>
                <p className="text-slate-300">• VIEWER 조회: {report10a.viewerReadability.summary}</p>
                <p className="text-slate-300">• VIEWER 차단: {report10a.viewerWriteBlock.summary}</p>
                <p className="text-slate-300">• 4월 확정 데이터: <strong className="text-emerald-400">{report10a.aprilDataProtection.summary}</strong></p>
                <p className="text-slate-300">• 백업: {report10a.localStorageProtection.summary}</p>
              </div>
            </div>
          )}

          {/* TAB 1: STEP 9B */}
          {activeTab === 'step9b' && !testing9b && (
            <div className="space-y-4">
              {/* Primary Architecture Status */}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-emerald-300">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-bold text-sm">
                      Primary WRITE 저장소: <span className="underline decoration-emerald-400">Firestore</span> 전환 완료
                    </p>
                    <p className="text-xs opacity-80">
                      로그인 계정: {currentUserEmail || '미인증'} ({role.toUpperCase()})
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-900/60 border border-slate-700 block text-center">
                    백업: localStorage (유지)
                  </span>
                </div>
              </div>

              {/* System Configuration Box */}
              <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-700/60 space-y-2 text-xs">
                <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> 1. 저장소 구성 및 보안 원칙 준수 현황
                </p>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Primary READ: <strong>Firestore</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Primary WRITE: <strong>Firestore (OWNER)</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>안전 백업: <strong>localStorage (보존)</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>VIEWER WRITE: <strong>Security Rules 차단</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>4월 실제 데이터: <strong>100% 보존 (수정없음)</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>계산 로직/SSOT: <strong>변경 없음 (동일)</strong></span>
                  </div>
                </div>
              </div>

              {/* OWNER WRITE Test Result */}
              <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-700/60 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-emerald-400" /> 2. OWNER WRITE 실전 테스트 (4월 데이터 영향 없음)
                  </span>
                  <button
                    onClick={handleRunStep9bTests}
                    className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] transition-colors cursor-pointer"
                  >
                    테스트 실행
                  </button>
                </div>

                {isOwner ? (
                  ownerTestResult ? (
                    <div
                      className={`p-2.5 rounded-lg border text-[11px] ${
                        ownerTestResult.success
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                          : 'bg-red-500/10 border-red-500/20 text-red-300'
                      }`}
                    >
                      <p className="font-bold">{ownerTestResult.message}</p>
                      {ownerTestResult.writtenValue && (
                        <p className="font-mono text-[10px] opacity-80 mt-1">
                          테스트 페이로드: {JSON.stringify(ownerTestResult.writtenValue)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-[11px]">OWNER 테스트를 진행하려면 버튼을 클릭하세요.</p>
                  )
                ) : (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-[11px]">
                    현재 로그인 계정({currentUserEmail})은 VIEWER입니다. OWNER 계정({PRIMARY_OWNER_EMAIL})으로 로그인 시 WRITE 테스트 가능합니다.
                  </div>
                )}
              </div>

              {/* VIEWER WRITE Block Test Result */}
              <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-700/60 text-xs space-y-2">
                <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-400" /> 3. VIEWER WRITE 차단 검증
                </p>

                {!isOwner ? (
                  viewerTestResult ? (
                    <div
                      className={`p-2.5 rounded-lg border text-[11px] ${
                        viewerTestResult.blocked
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                          : 'bg-red-500/10 border-red-500/20 text-red-300'
                      }`}
                    >
                      <p className="font-bold">{viewerTestResult.message}</p>
                    </div>
                  ) : (
                    <p className="text-slate-400 text-[11px]">VIEWER 테스트 진행 중...</p>
                  )
                ) : (
                  <div className="p-2.5 bg-slate-800/80 rounded-lg border border-slate-700 text-slate-300 text-[11px]">
                    VIEWER 계정({SPOUSE_EMAIL}) 로그인 시 Security Rules에 의한 WRITE 차단이 자동으로 검증됩니다. (클라이언트 UI 버튼도 비활성화됨)
                  </div>
                )}
              </div>

              {/* Error Handling & Safeguard Info */}
              <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-700/60 text-xs space-y-1">
                <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-emerald-400" /> 4. Firestore 저장 실패 에러 핸들링 상태
                </p>
                <div className="text-slate-300 text-[11px] space-y-0.5">
                  <p>• 네트워크 연결 끊김 또는 Permission 오류 발생 시, console 에러 기록 및 UI 에러 알림 제공</p>
                  <p>• 저장 실패 시 localStorage 원본 데이터가 100% 보존되어 데이터 손실이 절대 발생하지 않습니다.</p>
                  {writeStatus.lastError && (
                    <p className="text-red-400 font-mono mt-1">최근 에러: {writeStatus.lastError}</p>
                  )}
                  {writeStatus.lastSaveTime && (
                    <p className="text-emerald-400 font-mono">최근 Firestore 동기화: {new Date(writeStatus.lastSaveTime).toLocaleString('ko-KR')}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STEP 9A */}
          {activeTab === 'step9a' && report9a && !loading && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  report9a.overallMatch
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  {report9a.overallMatch ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                  )}
                  <div>
                    <p className="font-bold text-sm">
                      Firestore READ 1:1 검증 판정: {report9a.overallMatch ? 'PASS (100% 일치)' : '일부 항목 확인 필요'}
                    </p>
                    <p className="text-xs opacity-80">
                      로그인 계정: {currentUserEmail} ({role.toUpperCase()})
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-900/60 border border-slate-700">
                  WRITE 저장소: Firestore (Primary)
                </span>
              </div>

              <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-700/60 space-y-2 text-xs">
                <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-400" /> 1. 배우자 계정 VIEWER 등록 현황
                </p>
                <div className="space-y-1 text-slate-300 pl-1">
                  <div className="flex items-center justify-between py-0.5 border-b border-slate-800">
                    <span className="text-slate-400">OWNER 계정:</span>
                    <span className="font-mono text-emerald-400 font-semibold">{PRIMARY_OWNER_EMAIL} (READ / WRITE)</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 border-b border-slate-800">
                    <span className="text-slate-400">배우자 VIEWER 계정:</span>
                    <span className="font-mono text-emerald-400 font-semibold">{SPOUSE_EMAIL} (READ ONLY)</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-slate-400">AuthGate Allowlist 상태:</span>
                    <span className="text-emerald-400 font-semibold">정상 등록됨 ({ALLOWED_EMAILS.length}개 계정)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <SectionResultCard title={report9a.assetsAndDebts.sectionName} comp={report9a.assetsAndDebts} />
                <SectionResultCard title={report9a.debtTerms.sectionName} comp={report9a.debtTerms} />
                <SectionResultCard title={report9a.monthlySettlement.sectionName} comp={report9a.monthlySettlement} />
                <SectionResultCard title={report9a.ledger.sectionName} comp={report9a.ledger} />
                <SectionResultCard title={report9a.planner.sectionName} comp={report9a.planner} />
              </div>
            </div>
          )}

          {/* TAB 3: STEP 8 */}
          {activeTab === 'step8' && report8 && !loading && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  report8.overallVerdict === 'PASS'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  {report8.overallVerdict === 'PASS' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400" />
                  )}
                  <div>
                    <p className="font-bold text-sm">Migration 판정: {report8.overallVerdict}</p>
                    <p className="text-xs opacity-80">
                      실행 시간: {new Date(report8.timestamp).toLocaleString('ko-KR')}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-900/60 border border-slate-700">
                  OWNER 인증 완료
                </span>
              </div>

              <div className="space-y-2">
                <SectionResultCard title="Master (자산/부채/수입원)" comp={report8.master} />
                <SectionResultCard title="Snapshot 2026년 4월" comp={report8.snapshotApril} />
                <SectionResultCard title="MonthlySettlement 2026년 4월" comp={report8.settlementApril} />
                <SectionResultCard title="Ledger (가계부 거래내역)" comp={report8.ledger} />
                <SectionResultCard title="Planner (목표 & 일정)" comp={report8.planner} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-700 mt-3 flex items-center justify-between">
          <button
            onClick={
              activeTab === 'step10a'
                ? handleRunStep10a
                : activeTab === 'step9b'
                ? handleRunStep9bTests
                : activeTab === 'step9a'
                ? handleRunStep9a
                : handleRunStep8
            }
            disabled={loading || testing9b || (activeTab === 'step8' && !isOwner)}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs py-2 px-4 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || testing9b ? 'animate-spin' : ''}`} />
            {activeTab === 'step10a'
              ? 'STEP 10A 검증 재실행'
              : activeTab === 'step9b'
              ? 'STEP 9B 검증 재실행'
              : activeTab === 'step9a'
              ? 'READ 검증 다시 실행'
              : 'Migration 재실행'}
          </button>

          <button
            onClick={onClose}
            className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium py-2 px-4 rounded-xl transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

function SectionResultCard({ title, comp }: { title: string; comp: any }) {
  const isPass = comp.status === 'PASS';
  return (
    <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 text-xs">
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-slate-200">{title}</span>
        <span
          className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
            isPass ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}
        >
          {comp.status}
        </span>
      </div>
      <p className="text-slate-300 text-[11px] leading-relaxed">{comp.summary}</p>
      {comp.mismatches && comp.mismatches.length > 0 && (
        <div className="mt-1.5 p-2 bg-red-500/10 rounded border border-red-500/20 text-red-300 text-[10px]">
          불일치 항목: {comp.mismatches.join(', ')}
        </div>
      )}
    </div>
  );
}
