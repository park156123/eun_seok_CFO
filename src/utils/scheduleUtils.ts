import { ScheduleEvent, ScheduleCategory, ScheduleStatus } from '../types';
import { formatAssetAmountKRW } from './amountUtils';

export const SCHEDULE_CATEGORIES: ScheduleCategory[] = [
  '대출·원금',
  '임대·보증금',
  '세금',
  '가족',
  '여행·기타',
];

export function getEffectiveScheduleCategory(sch: ScheduleEvent): ScheduleCategory {
  if (sch.category) return sch.category;
  const t = sch.title || '';
  if (['대출', '만기', '원금', '상환'].some((k) => t.includes(k))) return '대출·원금';
  if (['임대', '임차인', '보증금'].some((k) => t.includes(k))) return '임대·보증금';
  if (['세금', '종합소득세', '부가세', '재산세'].some((k) => t.includes(k))) return '세금';
  if (['가족', '부모님', '장모님', '생일', '경조사'].some((k) => t.includes(k))) return '가족';
  return '여행·기타';
}

export function getScheduleStatus(sch: ScheduleEvent): ScheduleStatus {
  if (sch.completed || sch.status === 'completed') return 'completed';
  if (sch.status === 'extended') return 'extended';
  return 'in_progress';
}

export function getScheduleStatusBadge(sch: ScheduleEvent): { label: string; badgeClass: string } {
  const st = getScheduleStatus(sch);
  if (st === 'completed') {
    return {
      label: '완료',
      badgeClass: 'bg-[#00236f]/10 text-[#00236f] font-bold border border-[#00236f]/20',
    };
  }
  if (st === 'extended') {
    return {
      label: '연장',
      badgeClass: 'bg-purple-100 text-purple-800 font-bold border border-purple-200',
    };
  }
  return {
    label: '진행중',
    badgeClass: 'bg-blue-100 text-blue-800 font-bold border border-blue-200',
  };
}

export function getCategoryIcon(cat: ScheduleCategory): string {
  switch (cat) {
    case '대출·원금':
      return 'account_balance';
    case '임대·보증금':
      return 'home';
    case '세금':
      return 'receipt_long';
    case '가족':
      return 'family_restroom';
    case '여행·기타':
      return 'flight_takeoff';
    default:
      return 'event';
  }
}

export function formatPlannerAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount)) || Number(amount) <= 0) {
    return '금액 미정';
  }
  return formatAssetAmountKRW(amount);
}

export function getTodayFormatted(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

export interface DDayInfo {
  text: string;
  badgeClass: string;
  diffDays?: number;
  isOverdue?: boolean;
  isCompleted?: boolean;
}

export function getScheduleDDayInfo(sch: ScheduleEvent): DDayInfo {
  if (sch.completed) {
    const compDate = sch.completedAt || getTodayFormatted();
    return {
      text: `완료 ${compDate}`,
      badgeClass: 'bg-gray-200 text-gray-700 font-bold',
      isCompleted: true,
    };
  }

  if (!sch.date) {
    return {
      text: '예정',
      badgeClass: 'bg-gray-400 text-white font-bold',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cleanDateStr = sch.date.replace(/\./g, '-');
  const parts = cleanDateStr.split('-').map((p) => parseInt(p, 10));
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    const year = parts[0];
    const month = parts[1] - 1;
    const day = parts[2] && !isNaN(parts[2]) ? parts[2] : 1;
    const targetDate = new Date(year, month, day);

    const timeDiff = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        text: '처리 필요',
        badgeClass: 'bg-[#ba1a1a] text-white font-bold',
        diffDays,
        isOverdue: true,
      };
    }

    if (diffDays <= 60) {
      return {
        text: diffDays === 0 ? 'D-Day' : `D-${diffDays}`,
        badgeClass: 'bg-[#ba1a1a] text-white font-bold',
        diffDays,
      };
    }

    if (diffDays <= 180) {
      return {
        text: `D-${diffDays}`,
        badgeClass: 'bg-orange-500 text-white font-bold',
        diffDays,
      };
    }

    return {
      text: `D-${diffDays}`,
      badgeClass: 'bg-gray-400 text-white font-bold',
      diffDays,
    };
  }

  return {
    text: '예정',
    badgeClass: 'bg-gray-400 text-white font-bold',
  };
}

export function getScheduleDDay(sch: ScheduleEvent): string {
  return getScheduleDDayInfo(sch).text;
}
