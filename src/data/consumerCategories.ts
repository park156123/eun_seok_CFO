export interface ConsumerSubCategory {
  name: string;
  code: string;
}

export interface ConsumerCategoryGroup {
  name: string;
  icon: string;
  color: string;
  bgLight: string;
  subCategories: ConsumerSubCategory[];
}

export const CONSUMER_CATEGORY_GROUPS: ConsumerCategoryGroup[] = [
  {
    name: '식비',
    icon: 'restaurant',
    color: '#1e3a8a',
    bgLight: '#dbeafe',
    subCategories: [
      { name: '외식', code: 'dining_out' },
      { name: '편의점', code: 'convenience' },
      { name: '카페', code: 'cafe' },
      { name: '장보기', code: 'grocery' },
      { name: '배달', code: 'delivery' },
    ],
  },
  {
    name: '생활',
    icon: 'home',
    color: '#0284c7',
    bgLight: '#e0f2fe',
    subCategories: [
      { name: '생활용품', code: 'supplies' },
      { name: '주거관리', code: 'housing' },
    ],
  },
  {
    name: '가족',
    icon: 'family_restroom',
    color: '#7c3aed',
    bgLight: '#f3e8ff',
    subCategories: [
      { name: '배우자 생활비', code: 'spouse_living' },
      { name: '교육비', code: 'education' },
      { name: '육아', code: 'childcare' },
      { name: '경조사', code: 'family_events' },
    ],
  },
  {
    name: '건강',
    icon: 'favorite',
    color: '#dc2626',
    bgLight: '#fee2e2',
    subCategories: [
      { name: '병원·약국', code: 'medical' },
      { name: '운동', code: 'fitness' },
    ],
  },
  {
    name: '이동',
    icon: 'directions_car',
    color: '#d97706',
    bgLight: '#fef3c7',
    subCategories: [
      { name: '교통', code: 'transport' },
      { name: '차량유지', code: 'car_maintenance' },
    ],
  },
  {
    name: '통신',
    icon: 'smartphone',
    color: '#2563eb',
    bgLight: '#eff6ff',
    subCategories: [
      { name: '통신비', code: 'telecom' },
    ],
  },
  {
    name: '보험',
    icon: 'verified_user',
    color: '#059669',
    bgLight: '#d1fae5',
    subCategories: [
      { name: '아이보험', code: 'insurance_child' },
      { name: '본인보험', code: 'insurance_self' },
      { name: '운전자보험', code: 'insurance_driver' },
      { name: '보험료', code: 'insurance' },
    ],
  },
  {
    name: '기타',
    icon: 'more_horiz',
    color: '#6b7280',
    bgLight: '#f3f4f6',
    subCategories: [
      { name: '기부', code: 'donation' },
      { name: '기타지출', code: 'other_expense' },
    ],
  },
];

export function getCategoryGroup(majorCategoryStr: string): ConsumerCategoryGroup {
  const found = CONSUMER_CATEGORY_GROUPS.find(
    (g) => g.name === majorCategoryStr || majorCategoryStr?.includes(g.name)
  );
  if (found) return found;

  // Fallback
  return CONSUMER_CATEGORY_GROUPS[CONSUMER_CATEGORY_GROUPS.length - 1]; // 기타
}

export function parseCategoryString(categoryStr: string): { major: string; minor: string } {
  if (!categoryStr || categoryStr === '미분류' || categoryStr === '분류 대기') {
    return { major: '기타', minor: '분류 대기' };
  }
  if (categoryStr.includes('>')) {
    const parts = categoryStr.split('>').map((p) => p.trim());
    return { major: parts[0] || '기타', minor: parts[1] || parts[0] || '기타지출' };
  }
  
  // Try matching minor category directly
  for (const group of CONSUMER_CATEGORY_GROUPS) {
    if (group.name === categoryStr) {
      return { major: group.name, minor: group.subCategories[0]?.name || '일반' };
    }
    const matchedSub = group.subCategories.find((s) => s.name === categoryStr);
    if (matchedSub) {
      return { major: group.name, minor: matchedSub.name };
    }
  }

  return { major: '기타', minor: categoryStr };
}
