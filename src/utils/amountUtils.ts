/**
 * Utility functions for 10,000-won (만원) unit input and Korean currency text helpers.
 *
 * Principles:
 * - UI inputs receive and display values in 만원 units.
 * - Internal storage and calculations remain strictly in Won (원) numbers.
 * - Korean text helpers format 만원 input values into natural Korean amount strings.
 */

/**
 * Converts a Won value (e.g. 1,600,000,000) to integer 만원 value (e.g. 160,000).
 */
export function wonToMan(won: number | string | null | undefined): number {
  if (won === null || won === undefined || won === '') return 0;
  const numWon = typeof won === 'number' ? won : Number(String(won).replace(/[^0-9]/g, '')) || 0;
  return Math.floor(numWon / 10000);
}

/**
 * Converts a 만원 input value (e.g. 160,000 or "160,000") to Won storage value (e.g. 1,600,000,000).
 */
export function manToWon(man: number | string | null | undefined): number {
  if (man === null || man === undefined || man === '') return 0;
  const numMan = typeof man === 'number' ? man : Number(String(man).replace(/[^0-9]/g, '')) || 0;
  return Math.floor(numMan * 10000);
}

/**
 * Formats a raw 만원 input value/string into comma-separated integer string (e.g., "160,000").
 * Strips non-numeric characters.
 */
export function formatManInputValue(manInput: number | string | null | undefined): string {
  if (manInput === null || manInput === undefined || manInput === '') return '';
  const cleanStr = String(manInput).replace(/[^0-9]/g, '');
  if (!cleanStr) return '';
  const num = parseInt(cleanStr, 10);
  if (isNaN(num)) return '';
  return num.toLocaleString();
}

/**
 * Parses a 만원 input value/string to integer number of 만원.
 */
export function parseManInputValue(manInput: number | string | null | undefined): number {
  if (manInput === null || manInput === undefined || manInput === '') return 0;
  const cleanStr = String(manInput).replace(/[^0-9]/g, '');
  if (!cleanStr) return 0;
  return parseInt(cleanStr, 10) || 0;
}

/**
 * Converts a 만원 input value (number or string) to Korean text representation.
 * Examples:
 *  160000 만원 -> "16억원"
 *  125000 만원 -> "12억 5,000만원"
 *  32000 만원  -> "3억 2,000만원"
 *  6600 만원   -> "6,600만원"
 *  500 만원    -> "500만원"
 *  0 만원      -> "0원"
 */
export function formatKoreanAmountFromMan(manInput: number | string | null | undefined): string {
  if (manInput === null || manInput === undefined || manInput === '') return '0원';

  const rawStr = typeof manInput === 'number' ? String(manInput) : String(manInput);
  const cleanStr = rawStr.replace(/[^0-9]/g, '');
  if (!cleanStr) return '0원';

  const manValue = parseInt(cleanStr, 10);
  if (isNaN(manValue) || manValue <= 0) return '0원';

  const eok = Math.floor(manValue / 10000);
  const remainderMan = manValue % 10000;

  if (eok > 0) {
    if (remainderMan > 0) {
      return `${eok}억 ${remainderMan.toLocaleString()}만원`;
    }
    return `${eok}억원`;
  } else {
    return `${remainderMan.toLocaleString()}만원`;
  }
}

/**
 * Formats a raw Won (원) value into 10,000-won (만원) rounded display string.
 * Uses Math.round for rounding to the nearest 만원.
 * Preserves negative and positive signs.
 * Examples:
 *  36,260,000  -> "3,626만원"
 *  38,566,331  -> "3,857만원"
 *  -38,566,331 -> "-3,857만원"
 *  8,765,098   -> "877만원"
 *  21,330,000  -> "2,133만원"
 *  0           -> "0만원"
 */
export function formatWonToManwon(won: number | null | undefined): string {
  if (won === null || won === undefined || isNaN(Number(won))) return '0만원';
  const numWon = Number(won);
  const roundedMan = Math.round(numWon / 10000);
  return `${roundedMan.toLocaleString()}만원`;
}

/**
 * Formats a raw Won (원) value into Korean mixed currency representation (억, 만원).
 * Examples:
 *  397,530,000 -> "3억 9,753만원"
 *  66,000,000  -> "6,600만원"
 *  660,000,000 -> "6억 6,000만원"
 */
export function formatKoreanAmountFromWon(won: number | null | undefined): string {
  if (won === null || won === undefined || isNaN(Number(won)) || Number(won) <= 0) return '';
  const man = wonToMan(won);
  return formatKoreanAmountFromMan(man);
}
