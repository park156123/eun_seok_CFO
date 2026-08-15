/**
 * Centralized Category Theme, Icon & Color Utilities.
 * Handles single-source mapping for major categories and subcategories.
 */

export interface CategoryTheme {
  icon: string;
  color: string;      // Primary HEX code
  textColor: string;  // Tailwind text color class
  bgColor: string;    // Tailwind bg color class for progress bars
  bgLight: string;    // Tailwind light bg color class
}

const CATEGORY_THEME_MAP: Record<string, CategoryTheme> = {
  식비: { icon: 'restaurant', color: '#d97706', textColor: 'text-amber-600', bgColor: 'bg-amber-500', bgLight: 'bg-amber-50' },
  장보기: { icon: 'shopping_cart', color: '#d97706', textColor: 'text-amber-600', bgColor: 'bg-amber-500', bgLight: 'bg-amber-50' },
  외식: { icon: 'restaurant_menu', color: '#ea580c', textColor: 'text-orange-600', bgColor: 'bg-orange-500', bgLight: 'bg-orange-50' },
  배달: { icon: 'delivery_dining', color: '#ea580c', textColor: 'text-orange-600', bgColor: 'bg-orange-500', bgLight: 'bg-orange-50' },
  카페: { icon: 'local_cafe', color: '#b45309', textColor: 'text-amber-700', bgColor: 'bg-amber-600', bgLight: 'bg-amber-50' },
  생활: { icon: 'home', color: '#0284c7', textColor: 'text-sky-600', bgColor: 'bg-sky-500', bgLight: 'bg-sky-50' },
  가족: { icon: 'family_restroom', color: '#7c3aed', textColor: 'text-purple-600', bgColor: 'bg-purple-500', bgLight: 'bg-purple-50' },
  교육: { icon: 'school', color: '#6d28d9', textColor: 'text-purple-700', bgColor: 'bg-purple-600', bgLight: 'bg-purple-50' },
  건강: { icon: 'favorite', color: '#dc2626', textColor: 'text-red-600', bgColor: 'bg-red-500', bgLight: 'bg-red-50' },
  운동: { icon: 'fitness_center', color: '#059669', textColor: 'text-emerald-600', bgColor: 'bg-emerald-500', bgLight: 'bg-emerald-50' },
  보험: { icon: 'shield', color: '#059669', textColor: 'text-emerald-600', bgColor: 'bg-emerald-500', bgLight: 'bg-emerald-50' },
  통신: { icon: 'smartphone', color: '#2563eb', textColor: 'text-indigo-600', bgColor: 'bg-indigo-500', bgLight: 'bg-indigo-50' },
  이동: { icon: 'directions_car', color: '#d97706', textColor: 'text-orange-600', bgColor: 'bg-orange-500', bgLight: 'bg-orange-50' },
  교통: { icon: 'directions_car', color: '#d97706', textColor: 'text-orange-600', bgColor: 'bg-orange-500', bgLight: 'bg-orange-50' },
  미용: { icon: 'content_cut', color: '#db2777', textColor: 'text-pink-600', bgColor: 'bg-pink-500', bgLight: 'bg-pink-50' },
  쇼핑: { icon: 'shopping_bag', color: '#2563eb', textColor: 'text-blue-600', bgColor: 'bg-blue-500', bgLight: 'bg-blue-50' },
  기부: { icon: 'volunteer_activism', color: '#0d9488', textColor: 'text-teal-600', bgColor: 'bg-teal-500', bgLight: 'bg-teal-50' },
  여행: { icon: 'flight', color: '#0284c7', textColor: 'text-sky-600', bgColor: 'bg-sky-500', bgLight: 'bg-sky-50' },
  미분류: { icon: 'help_outline', color: '#64748b', textColor: 'text-slate-500', bgColor: 'bg-slate-400', bgLight: 'bg-slate-50' },
  기타: { icon: 'more_horiz', color: '#64748b', textColor: 'text-slate-500', bgColor: 'bg-slate-400', bgLight: 'bg-slate-50' },
};

const DEFAULT_THEME: CategoryTheme = {
  icon: 'more_horiz',
  color: '#64748b',
  textColor: 'text-slate-500',
  bgColor: 'bg-slate-400',
  bgLight: 'bg-slate-50',
};

/**
 * Returns complete theme (icon, color, text/bg classes) for a major category.
 */
export function getCategoryTheme(categoryName: string): CategoryTheme {
  if (!categoryName) return DEFAULT_THEME;
  const clean = categoryName.trim();
  if (CATEGORY_THEME_MAP[clean]) return CATEGORY_THEME_MAP[clean];

  for (const key of Object.keys(CATEGORY_THEME_MAP)) {
    if (clean.includes(key)) {
      return CATEGORY_THEME_MAP[key];
    }
  }
  return DEFAULT_THEME;
}

/**
 * Returns Material Symbol icon for a major category.
 */
export function getCategoryIcon(categoryName: string): string {
  return getCategoryTheme(categoryName).icon;
}

const SUBCATEGORY_ICON_MAP: Record<string, string> = {
  장보기: 'shopping_cart',
  외식: 'restaurant_menu',
  배달: 'delivery_dining',
  카페: 'local_cafe',
  운동: 'fitness_center',
  '병원·약국': 'medical_services',
  병원: 'medical_services',
  약국: 'medical_services',
  교육비: 'school',
  교육: 'school',
  보험료: 'shield',
  보험: 'shield',
  편의점: 'local_convenience_store',
  교통: 'directions_car',
  차량유지: 'directions_car',
  통신비: 'smartphone',
  생활용품: 'home',
  주거관리: 'home',
  배우자생활비: 'family_restroom',
  '배우자 생활비': 'family_restroom',
  육아: 'family_restroom',
  경조사: 'family_restroom',
  여가문화: 'attractions',
  기부: 'volunteer_activism',
  기타지출: 'more_horiz',
  미용: 'content_cut',
  쇼핑: 'shopping_bag',
};

/**
 * Returns Material Symbol icon for a subcategory name.
 */
export function getSubCategoryIcon(subCategoryName: string, parentCategoryName?: string): string {
  if (!subCategoryName) return 'more_horiz';
  const clean = subCategoryName.trim();
  if (SUBCATEGORY_ICON_MAP[clean]) return SUBCATEGORY_ICON_MAP[clean];

  for (const key of Object.keys(SUBCATEGORY_ICON_MAP)) {
    if (clean.includes(key)) {
      return SUBCATEGORY_ICON_MAP[key];
    }
  }

  if (parentCategoryName) {
    return getCategoryIcon(parentCategoryName);
  }

  return 'more_horiz';
}
