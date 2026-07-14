import type { CategoryItem, TransactionType } from '@/types/ledger';
import { SEED_TIMESTAMP } from '@/constants/ledger';

/**
 * Seeded default categories. Ids are STABLE (`cat-*`, not random UUIDs) and stamped with a
 * fixed timestamp so every install ships byte-identical defaults — merge pairs them by id
 * instead of creating one duplicate "식비" per device. User-created categories get random UUIDs.
 */
function seed(
  id: string,
  name: string,
  icon: string,
  type: TransactionType,
  subcategories: string[] = ['기타'],
): CategoryItem {
  return {
    id,
    name,
    icon,
    type,
    subcategories,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
    deleted: false,
  };
}

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  // 지출 (expense) — id gaps (cat-2, cat-5, cat-9) are retired categories folded into others by the
  // category migration (see lib/ledger/migrate); ids stay stable so a device's seeds still pair by id
  // on merge. 식비 keeps its own cafe/snack breakdown below, so the retired 카페/간식 leaves no extra label.
  seed('cat-1', '식비', 'Utensils', '지출', [
    '커피/음료',
    '베이커리',
    '디저트/떡',
    '도넛/핫도그',
    '아이스크림/빙수',
    '기타간식',
    '기타',
  ]),
  seed('cat-3', '술/유흥', 'Beer', '지출'),
  seed('cat-4', '생활', 'Home', '지출'),
  seed('cat-6', '쇼핑', 'ShoppingBag', '지출', ['온라인쇼핑', '패션/쇼핑', '기타']),
  seed('cat-7', '뷰티/미용', 'Scissors', '지출'),
  seed('cat-8', '교통', 'Bus', '지출', ['자동차', '기타']),
  seed('cat-10', '주거/통신', 'Wifi', '지출'),
  seed('cat-11', '의료/건강', 'HeartPulse', '지출'),
  seed('cat-12', '금융', 'Landmark', '지출'),
  seed('cat-13', '문화/여가', 'Ticket', '지출'),
  seed('cat-14', '여행/숙박', 'Plane', '지출'),
  seed('cat-15', '교육/학습', 'BookOpen', '지출'),
  seed('cat-16', '자녀/육아', 'Baby', '지출'),
  seed('cat-17', '반려동물', 'Cat', '지출'),
  seed('cat-18', '경조/선물', 'Gift', '지출'),
  seed('cat-19', '기타', 'MoreHorizontal', '지출'),

  // 수입 (income) — id gap (cat-102) retired: 상여금 folded into 급여's subcategories (see lib/ledger/migrate).
  seed('cat-101', '급여', 'Banknote', '수입', ['상여금', '기타']),
  seed('cat-103', '사업수입', 'Briefcase', '수입'),
  seed('cat-104', '아르바이트', 'Clock', '수입'),
  seed('cat-105', '용돈', 'Wallet', '수입'),
  seed('cat-106', '금융수입', 'PiggyBank', '수입'),
  seed('cat-107', '보험금', 'ShieldPlus', '수입'),
  seed('cat-108', '기타', 'MoreHorizontal', '수입'),

  // 이체 (transfer) — id gap (cat-201) retired: 내계좌이체 folded into 이체's subcategories (see lib/ledger/migrate).
  seed('cat-202', '이체', 'ArrowRight', '이체', ['내계좌이체', '기타']),
  seed('cat-203', '카드대금', 'CreditCard', '이체'),
  seed('cat-204', '저축', 'PiggyBank', '이체'),
  seed('cat-205', '현금', 'Banknote', '이체'),
  seed('cat-206', '투자', 'TrendingUp', '이체'),
  seed('cat-207', '기타', 'MoreHorizontal', '이체'),
];
