# LEDGER Native — 마이그레이션 계획

> 원본(web) → 이 레포(native)로의 이관 계획 및 확정 결정 기록. 세션이 길어져도 이 문서를 기준으로 이어간다.

- **원본**: `~/Downloads/ledger` — Vite + React 19 + **zustand + localforage(IndexedDB)**, 로컬 전용 웹 앱. AI Studio 산출물.
- **대상**: 이 레포 — Expo SDK 57 + Expo Router(`src/app`) + RN 0.86 + React 19.2 + TypeScript strict.

## 핵심 성격 (중요)

웹의 **"감성 UI + 가계부 계산 로직"은 이식 대상**이지만, 이 프로젝트의 정체성인 **인증 + Google Drive 동기화 + sync 메타 계층은 원본에 존재하지 않아 신규 구축**한다.

원본에 **없는 것**(= 새로 만들어야 함):
- 인증 0 (로그인 화면 없음)
- 실제 클라우드 동기화 없음 (`syncToCloud()`는 800ms 후 alert만 띄우는 가짜 스텁)
- sync 메타(`createdAt`/`updatedAt`/`deleted`) 없음, 삭제는 전부 **물리 삭제**
- Gemini AI: 의존성만 있고 호출 코드 0줄, Insights 탭은 "coming soon" placeholder
- 카테고리 CRUD UI: store 액션은 있으나 화면 미연결

## 확정 결정

1. **상태관리 = zustand** (원본 스토어 거의 1:1 이식) + AsyncStorage 영속화. Supabase 호출에만 TanStack Query(Phase 5). → CLAUDE.md의 "jotai" 대신 zustand 채택(데이터가 단순, 원본이 zustand, 최저 리스크).
2. **예산 모델 = 원본 그대로.** 기본예산(`settings.budget`) + 월별 오버라이드(`monthlyBudgets['YYYY-MM']`) + **그 달 첫 진입 시 예산 확인 프롬프트**(`lastBudgetConfirmation !== 현재월(YYYY-MM)`, 달력상 1일이 아니라 "그 달 첫 앱 진입" 기준) + month detail 인라인 수정. 카테고리별 예산 엔티티는 만들지 않음.
3. **Insights = v1 제외** (placeholder 유지, 나중에 별도 설계).
4. **백엔드 = 유지.** 현재는 사용자 데이터만이지만, 향후 **"가공한 데이터를 서버가 클라이언트로 서빙"하는 확장**을 위해 백엔드 필요. Phase 5에서 (A) Supabase Auth vs (B) Google 직접 로그인 최종 확정 — 현재 기본 가정은 **백엔드 유지(Supabase)**.
5. **패키지 매니저 = npm** (`package-lock.json` 존재).
6. **reactCompiler**: `app.json`의 실험 플래그 유지 + `babel-plugin-react-compiler` 설치. NativeWind babel과 충돌 시 재검토(비필수 최적화라 필요 시 끔).

## 데이터 모델 (sync-ready, Phase 1에서 확정)

동기화 엔티티(거래·카테고리)는 공통 메타를 가진다: **`id`(UUID, expo-crypto) · `createdAt` · `updatedAt` · `deleted`(soft-delete)**. 삭제는 물리 삭제 금지 → `deleted:true` + `updatedAt` 갱신.

- **Transaction** (원본 `LedgerRow`): `id, year, month, day, type('수입'|'지출'|'이체'), category, merchant, amount(정수 KRW), note` + 메타
- **CategoryItem**: `id, name, icon, type, subcategories[]` + 메타
- **Settings** (단일 동기화 문서): `budget, monthlyBudgets, currency, fixedExpenseTypes[], fixedExpenses[], lastBudgetConfirmation`
- 로컬 저장 형태는 원본 유지(`records: Record<'YYYY-MM', LedgerRow[]>`) 가능하되, **병합은 UUID 단위**로 수행(sync 계층이 평탄화).

## 재사용 vs 재작성

| 그대로 재사용 (로직/타입) | 소폭 수정 재사용 | 완전 재작성 (UI) |
|---|---|---|
| `getMonthlyBudget`/`getYearlyBudget`, 잔여예산 공식(4곳) | store 전체: `localforage`→AsyncStorage, `crypto.randomUUID`→`expo-crypto`, `alert` 제거 | 모든 화면 JSX → View/Text/Pressable/FlatList |
| 수입/지출 집계 reducer, 일별 그룹핑·정렬·검색 | 통화 포맷 `toLocaleString`→`Intl.NumberFormat('ko-KR')` | RecordDrawer: vaul+radix+day-picker → `@gorhom/bottom-sheet`+RN 캘린더 |
| 캘린더 날짜 계산, date-fns 사용 | 물리삭제 → soft-delete | 다이얼로그 → RN Modal/Alert, 캘린더 그리드 → RN flex/FlatList |
| 기본 카테고리 33개, 타입 정의 | 타입에 sync 메타 추가 | `motion` → Reanimated/Moti, lucide-react → lucide-react-native |

## 로드맵

```
Phase 0  기반 세팅      NativeWind+팔레트/폰트, 라이브러리, Expo Router 구조, 프로바이더  ← 진행 중
Phase 1  데이터 계층    타입+sync메타+soft-delete, zustand 이식, 순수로직/유틸/테스트     ★모델 확정
Phase 2  읽기 화면      Year → Month → Spreadsheet(리스트/캘린더), 감성 토큰·모션
Phase 3  쓰기 플로우    RecordDrawer(bottom-sheet)+RHF/zod, 예산 프롬프트/인라인, 공용 confirm/toast, "작성종료=로컬저장" 훅
Phase 4  설정/카테고리  SettingsView(예산·고정지출) + CategoryManager CRUD 신규
Phase 5  인증          Supabase + Google OAuth(Drive 스코프), 로그인, secure-store 토큰   ※외부설정 선행
Phase 6  Drive 동기화   Drive I/O + 병합엔진(합집합/로컬우선/삭제우선) + 트리거(앱시작·작성종료·포그라운드)  ★정체성
Phase 7  마감          엠프티/스켈레톤/모션 일관성, tsc·lint·verify, EAS
```

Phase 0~4 = 로그인·인터넷 없이 동작하는 로컬 가계부. Phase 5~6 = 그 위에 인증·Drive.

## Drive 동기화 스테이징 — "모델은 처음, 엔진은 나중"

1. **Phase 1(선행)**: 모든 동기화 엔티티에 sync 메타 + soft-delete. 저장을 **repository 인터페이스** 뒤로(우선 AsyncStorage 구현). 화면은 로컬만 바라봄.
2. **Phase 5**: Google OAuth로 **Drive 접근 토큰** 확보 → `expo-secure-store`. 토큰 만료/재인증.
3. **Phase 6-A**: `src/lib/services/sync/` 단일 계층의 **Drive I/O**(사용자 Drive에 원장 JSON 읽기/쓰기, 원자적 쓰기).
4. **Phase 6-B**: **병합 엔진** — 새 항목=합집합 · 수정 충돌=로컬 우선 · 삭제 vs 수정=삭제 우선(UUID 매칭).
5. **Phase 6-C**: **트리거** — 앱 시작 + 작성 종료(Phase 3 훅) + 포그라운드 복귀. 오프라인 큐, 실패 시 로컬 절대 보존, 감성 톤 상태 표시.

> 외부 선행: Supabase 프로젝트 + Google Cloud OAuth 클라이언트(iOS/Android/web, Drive 스코프). Phase 5 진입 시 체크리스트 제공.

## 디자인 토큰 (warm / editorial)

- **Palette**: paper `#FCFBF7` · ink `#1A1A1A` · muted taupe `#8C887D` · line `#E8E4D9` · fill `#F5F3ED`. 의미색: 수입 green-600, 지출 red-600, 이체 blue-500, 선택 indigo-500/600.
- **Fonts**: 헤딩 `Playfair Display`(italic), 본문 `Inter`, 숫자/금액 `JetBrains Mono`. (expo-font + @expo-google-fonts)
- 두 디자인 언어 존재: editorial(warm, 각진 카드) vs mobile-app(gray, 둥근 카드). 네이티브에선 warm 톤으로 통일 지향.

## 진행 상태

- **Phase 0 완료** ✅ — 검증: `tsc` 0 · `expo lint` 0 · `expo export`(iOS) 번들 성공.
  - NativeWind 4.2 + Tailwind 3.4 셋업(babel/metro/tailwind.config/global.css/`nativewind-env.d.ts`, `*.css` 타입 선언).
  - 팔레트/폰트 상수(`src/constants/palette.ts`, `src/constants/fonts.ts`), Playfair/Inter/JetBrains 로딩.
  - 라우팅: 표준 Expo Router `Tabs`(Journal/Insights/Settings) + 루트 프로바이더(GestureHandlerRootView, SafeAreaProvider, 폰트 스플래시 게이트). 화면은 감성 톤 플레이스홀더.
  - Expo 스타터 데모 클러스터(themed-\*, animated-icon, app-tabs, collapsible 등) 제거.
  - reactCompiler 실험 플래그 유지 — NativeWind와 충돌 없음 확인.
  - ⚠️ 후속(비차단): `@expo-google-fonts/*` 인덱스 import가 전 weight를 번들에 포함 → 필요한 weight만 subpath import로 최적화(폴리시 단계).
- **Phase 1 완료** ✅ — 검증: `tsc` 0 · `expo lint` 0 · `vitest` 23/23 · `expo export`(iOS) 번들 성공.
  - 타입(`src/types/ledger.ts`): Transaction/CategoryItem/FixedExpense/Settings/LedgerSnapshot + **SyncMeta(id/createdAt/updatedAt/deleted)**.
  - 기본 카테고리 33개(`src/constants/categories.ts`) — stable id + 고정 seed 타임스탬프로 병합 중복 방지. 상수/기본설정(`src/constants/ledger.ts`).
  - 순수 유틸: `money.ts`(정수 KRW, 엔진-독립 grouping) · `date.ts`(월키/경계/주입 clock) · `ledger/{budget,selectors}.ts`(집계·잔여예산 4공식).
  - **병합 엔진**(`src/lib/sync/merge.ts`): 합집합 / 로컬우선 / 삭제우선 + 월이동 전역 재버킷팅. 순수·테스트 완료(Phase 6엔 I/O·트리거만 남김).
  - 저장: `id.ts`(expo-crypto) · `storage/ledger-storage.ts`(repository 인터페이스 + AsyncStorage 단일 스냅샷 키).
  - 스토어(`src/store/ledger-store.ts`): zustand, soft-delete, write-through 직렬 persist, year/month 버킷 잠금. 부팅 하이드레이션 연결 + Journal이 실데이터 read.
  - zod 폼 스키마(`src/schemas/{transaction,category}.ts`).
- **Phase 2 완료** ✅ — 검증: `tsc` 0 · `expo lint` 0 · `vitest` 23/23 · `expo export`(iOS) + Expo web 실렌더 스크린샷 확인(iOS 시뮬레이터는 이 머신에 Xcode 부재 → Expo web + Chrome 헤드리스로 대체 캡처).
  - Journal 중첩 Stack 라우팅: `(journal)/index`(연도) → `[year]`(월) → `[year]/[month]`(상세). 숫자 파라미터만(한글 경로 금지).
  - 화면: YearView(연도 카드+요약+잔여예산) · MonthView(12개월 그리드) · SpreadsheetView(요약·리스트/캘린더 토글·검색·일별그룹·카테고리 아이콘). **전부 읽기 전용**(편집은 Phase 3).
  - 공용 프리미티브: `src/components/{screen,back-link,amount-stat,category-icon,fade-in}.tsx` — 톤 변경은 프리미티브 한 곳에서 전 화면 전파.
  - 모션: ⚠️ **moti는 웹(Metro)에서 `tslib.__extends` interop 에러 → 제거**하고 **RN 내장 `Animated`로 FadeIn** 구현(네이티브·웹 동일). 리치 애니메이션은 reanimated 직접 사용(Phase 3 bottom-sheet 등).
  - 개발용 시드 `src/lib/dev/seed-dev-data.ts`(`__DEV__` 한정, 빈 스토어만).
  - ⚠️ web 전용 이슈: 세로 ScrollView 콘텐츠 폭이 뷰포트보다 넓어 우측이 잘려 보임(react-native-web 특성). 네이티브는 정상. 웹 배포 시 폭 제약 필요(후속).
- **Phase 3 완료** ✅ — 검증: `tsc` 0 · `expo lint` 0 errors(1 benign warn) · `vitest` · `expo export`(iOS). ⚠️ **드로어 UI는 실기기/시뮬레이터에서만 검증 가능**(bottom-sheet는 react-native-web 미렌더 + 이 머신 Xcode 부재) → 온디바이스 테스트 필요.
  - RecordDrawer(`src/components/record-drawer.tsx`): @gorhom/bottom-sheet + RHF/zod. 금액(포맷)·타입 토글·카테고리 픽커·거래처·날짜(일)·메모. 저장(추가/수정)·삭제(soft-delete + Alert 확인).
  - BudgetDrawer(`src/components/budget-drawer.tsx`): 요약 카드 탭 → 월 예산 인라인 편집 + **그 달 첫 진입 자동 프롬프트**(현재월·무예산·미확정 시) + "기본 예산으로" 토글.
  - SpreadsheetView 연결: FAB(추가) · 행 탭(수정) · 요약 탭(예산) · 빈 상태 CTA.
  - "작성 종료 = 로컬 저장"은 스토어 write-through로 이미 자동. **Drive push 트리거는 Phase 6에서 이 지점(드로어 dismiss/저장)에 연결**.
  - React Compiler 주의: RHF `watch()`가 "incompatible-library" 경고 → 해당 컴포넌트만 메모 스킵(무해). Animated.Value는 `useState` lazy-init로 `react-hooks/refs` 회피.
  - 후속(선택): 저장 성공 토스트, 캘린더 셀 금액 표기.
- **다음: Phase 4 설정/카테고리** — SettingsView(기본예산·고정지출 CRUD) + CategoryManager CRUD(웹이 미구현한 카테고리 추가/수정/삭제 신규).
