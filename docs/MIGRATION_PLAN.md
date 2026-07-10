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

> ⚠️ **환경/SDK**: 스토어 Expo Go가 **최대 SDK 54**까지만 지원해서(iOS 26.5에서도 그게 최신), 온디바이스 테스트를 위해 프로젝트를 **Expo SDK 54**로 맞춤 — expo 54.0.35 / RN 0.81.5 / React 19.1 / reanimated 4.1 / expo-router 6.0. 스토어 Expo Go가 상위 SDK를 지원하거나 dev build 할 때 `expo install expo@^57 && expo install --fix`로 올릴 수 있음. 다운그레이드 시 주의: app.json plugins에서 SDK54 비호환 항목(expo-image/status-bar/web-browser) 제거 + `babel-preset-expo` 명시 설치 필요. iOS 시뮬레이터는 이 맥에 Xcode 없어 불가 → 실기기 Expo Go로 테스트.

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
- **Phase 4 완료** ✅ — 검증: `tsc` 0 · `expo lint` 0 · `vitest` 23/23 · `expo export`(iOS) 번들 성공. ⚠️ 드로어 UI는 실기기 확인 필요(bottom-sheet는 web 미렌더 + 이 머신 Xcode 부재). web 스크린샷은 사용자 dev 서버가 8081 점유 중이라 생략 → 실기기 hot reload로 확인.
  - 설정 탭을 **중첩 Stack으로 전환**: `settings/_layout`(Stack) + `settings/index`(설정) + `settings/categories`(카테고리 관리). 기존 leaf `settings.tsx` 삭제. 라우트 `/settings`·`/settings/categories`(정적, typedRoutes 통과).
  - **SettingsView**(`settings/index.tsx`): 기본예산 인라인 입력(로컬 버퍼→blur 커밋) · 카테고리 관리 이동 행(활성 분류 수) · 고정지출 카드 리스트(탭→드로어 편집)+추가+엠프티. 원본 웹의 인라인 테이블을 **탭→드로어 편집**으로 재설계(RecordDrawer/BudgetDrawer와 일관, 모바일 적합).
  - **CategoryManager**(`settings/categories.tsx`): 타입 탭(지출/수입/이체) + 아이콘 그리드(4열, 소분류 수) + "새 카테고리 추가". **웹이 미구현했던 CRUD를 신규 구현**.
  - 신규 드로어: `category-drawer.tsx`(이름·타입·아이콘 그리드·소분류 칩 편집, add/updateCategory·soft-delete) · `fixed-expense-drawer.tsx`(금액·이름·유형·결제일·메모, Settings.fixedExpenses 배열 rewrite). 둘 다 RHF+zod, ref present/dismiss 패턴.
  - 신규 상수/스키마: `constants/icons.ts`(PICKABLE_ICONS 아이콘 팔레트, CategoryIcon이 미지의 이름은 Circle로 폴백) · `schemas/fixed-expense.ts`. ⚠️ `schemas/category.ts`의 `subcategories`를 `.default(['기타'])`→required로 변경(RHF+zodResolver 입력/출력 타입 정합 — transaction.note와 동일 이슈 예방). 기본값 ['기타']는 드로어가 주입.
  - FixedExpense는 동기화 개별 엔티티가 아니라 **Settings 문서 안의 배열** → add/edit/delete는 배열 rewrite(soft-delete 아님, Settings 전체가 updatedAt 기준 병합).
- **Phase 4.5 로컬 기능 파리티 완료** ✅ — 검증: `tsc` 0 · `expo lint` 0 · `vitest` 23/23 · `expo export`(iOS) 성공. 원본 웹 10개 컴포넌트 정독 후, **백엔드와 무관한데 Phase 2(읽기 우선) 빌드 중 누락됐던 로컬 기능**을 보강:
  - **연도 추가/삭제**(`(journal)/index.tsx`): store `addYear`/`deleteYear`를 UI에 연결(인라인 추가 폼 + 카드 휴지통→Alert 확인). ⚠️ 원본 로컬 앱의 실기능인데 그동안 UI가 없어 새 연도를 못 만들던 갭 해소.
  - **캘린더 날짜 상호작용**(`[year]/[month].tsx`): `MonthCalendar`를 Pressable 셀로(날짜 선택) + `SelectedDayDetail`(그날 내역 목록/빈상태/추가). `RecordDrawer`에 `defaultDay` prop 추가(캘린더 선택일로 새 기록 생성). FAB도 캘린더 모드에선 선택일 사용.
  - **MonthView 연간 합계 헤더**(수입/지출) · **월 요약 고정지출 라인**(fixedTotal>0일 때만).
  - **의도적 미이식(갭 아님)**: YearView 카드/리스트 토글(모바일 단일폭 불필요) · 예산 프롬프트 하드 게이팅(원본은 예산 없으면 기록 추가 차단 → 네이티브는 감성 톤 위해 현재 월만 부드럽게 안내) · `syncToCloud`(원본은 800ms 후 alert 뿐인 가짜 스텁 → Phase 6 실제 Drive 동기화로 대체). RecordDrawer 소분류 선택은 **원본에도 없음**(대분류만) → 갭 아님. ⚠️ 데이터 키: 원본은 거래의 category를 **id**로 저장, 네이티브는 **name**으로 저장(네이티브 내부는 name으로 일관 — 카테고리 rename 시 기존 거래 매칭이 끊길 수 있는 건 향후 유의점).
- **UX 폴리시: 공용 애니메이션 헤더** ✅ — 원본 웹의 헤더 감성(제목 글자 스태거 등장 + 문구 전환 애니 + 백링크가 부제 아래)을 네이티브에 이식. 신규 `src/components/app-header.tsx`(`AppHeader`): 제목을 **글자 단위 fade+rise 스태거**(RN Animated, moti/reanimated-web 이슈 회피) + 부제 FadeIn + **백링크를 부제 아래 슬롯**으로. `useFocusEffect`로 **화면 focus마다 재생**(하단탭은 remount 안 하므로 key 증가로 replay). 5개 화면(Year/Month/Spreadsheet/Settings/Insights) 공통 적용 → **제목이 전 탭에서 같은 위치**(백링크가 제목을 밀지 않음)라 Journal↔Settings↔Insights 전환 시 세로 점프 없음. 검증 tsc0·lint0·vitest23·export. (원본이 SPA 지속 헤더였던 것과 달리 Expo는 화면별이라, 지속 헤더가 아닌 "focus 시 각 화면 헤더 재생"으로 근사.)
- **삭제 UX 보강 + 웹 삭제 버그 수정** ✅ — 검증 tsc0·lint0·vitest23·export. (1) **공용 `ConfirmDialog`**(`src/components/confirm-dialog.tsx` = RN Modal + `ConfirmProvider`/`useConfirm` 훅, 루트 마운트): ⚠️ **`Alert.alert`는 react-native-web에서 no-op** → 웹에선 삭제 확인창이 안 뜨고 삭제가 실행 안 됨(사용자 리포트 "웹에서 클릭 자체가 안돼"의 원인). 4곳(연도·거래·카테고리·고정지출)의 `Alert.alert`를 `useConfirm`(웹·네이티브 공용)으로 교체. CLAUDE.md의 "공용 confirm 모달" 권장과 일치. ⚠️ **앞으로 삭제/확인은 `Alert.alert` 대신 `useConfirm`을 쓸 것.** (단 거래·카테고리·고정 삭제는 드로어 내부라, 드로어가 웹 미렌더인 한 웹에선 여전히 도달 불가 — 별개 한계.) (2) **월 단위 삭제**: `deleteMonth`(그 달 버킷 전부 soft-delete) 스토어 액션 + SpreadsheetView 하단 "이 달 기록 전체 삭제"(기록 있을 때만 노출) → 연도 삭제와 대칭. 위치는 사용자 선택(월 카드 휴지통 아니라 월 상세 화면).
- **Phase 5 완료** ✅ — 인증. `src/lib/auth/auth.ts`: **Google OAuth(Supabase Auth 경유)** — `openid email profile` + `drive.file` 스코프(앱이 만든 파일만 = 최소권한). PKCE 코드 교환, 네이티브는 고정 `myapp://auth/callback` 스킴(Expo Go에서 LAN IP가 바뀌어 redirect가 깨지던 문제 회피), 웹은 origin redirect. Google **provider 토큰**은 SIGNED_IN 세션에만 실려 오므로 즉시 캡처해 `token-store.ts`(secure-store)에 보관. 로그인 화면 + `auth/callback` + `auth-store`. ⚠️ 외부 설정(Supabase 프로젝트 + Google Cloud OAuth 클라이언트, Drive 스코프)은 사용자가 완료.
- **Phase 6 완료** ✅ — Drive 동기화(이 앱의 정체성). `src/lib/sync/`: `drive-api.ts`(Drive REST v3 fetch — stat/create/write, `DriveFileMeta{id,modifiedTime}`, ⚠️ 쿼리값 `encodeURIComponent` — RN fetch는 공백을 자동 인코딩 안 해 모바일이 400 나던 것 수정), `drive-auth.ts`(access token 재발급), `merge.ts`(Phase 1 병합엔진 재사용: 합집합·로컬우선·삭제우선), `sync-service.ts`(**dirty-flag push + modifiedTime pull skip** — 로컬 변경 없으면 push 생략, Drive modifiedTime 그대로면 pull 생략). 트리거: **앱 시작 · 포그라운드 복귀 · 작성 종료**(드로어 dismiss → `syncOnEditEnd`). 실패해도 로컬 보존. ⚠️ 남은 검증: **실기기 2대 병합 실전**, >5MB resumable 업로드, tombstone 정리.
- **UX 마감 폴리시(웹 반응형 + 감성)** ✅ — 검증: `tsc` 0 · `expo lint` 0 · `expo export`(web) 성공.
  - **좁은 웹 = 모바일 레이아웃**: `hooks/use-responsive.ts`의 `useIsWideScreen`(폭 768 기준) — 브라우저를 폰 폭으로 줄이면 데스크톱 대신 모바일 UI. 넓은 웹은 `WebTopNav`(로고 이미지) + 하단탭 숨김, 그 외엔 커스텀 `MobileTabBar`(기본 탭바가 콘텐츠를 상단정렬해서 직접 그림 — 넉넉한 높이 + 세로중앙 + 대문자 트래킹 라벨).
  - **금액 입력 web 오버플로 수정**(`lib/amount-width.ts`): RNW `<input>` 기본폭이 넓어 잘리던 것 → 내용폭 계산으로 중앙정렬 유지. 4개 금액 드로어 + 설정 기본예산.
  - **기본예산 편집을 드로어로**(`default-budget-drawer.tsx`) · **BackLink 부모경로 이동**(딥링크 안전 — `router.back()` 대신 pathname 마지막 세그먼트 제거).
  - **저장 성공 토스트**(`components/toast.tsx`, provider+훅 — `useConfirm`과 동형): 5개 드로어(기록·월예산·기본예산·고정지출·카테고리) 저장에 부드러운 상단 토스트.
  - **웹 부트 화면**(`boot-screen.tsx`): `!ready` 때 `null` 대신 paper 배경+로고 → 웹 콜드로드 흰 화면 깜빡임 제거(네이티브는 스플래시가 덮음).
  - **일관성 패스**(서브에이전트 감사 기반): 톤 아웃라이어 "없습니다"→"없어요", 카테고리 빈 상태 추가, Insights·카테고리 진입 `FadeIn`, 연도 추가/삭제·폼 토글 `LayoutAnimation`(공용 `lib/animate-next-layout.ts`).
- **다음: Phase 7 마감(잔여)** — 전역 동기화 상태 표시(감성 톤 pill, `useSyncStore` → `AppHeader`), 빈상태 컨테이너 스타일 통일, 리스트 add/remove 모션 확대(거래행·고정지출·카테고리 타일), EAS dev build(Expo Go SDK54 제약 탈출), 실기기 다기기 병합 검증. Insights는 여전히 **v1 제외**(placeholder 유지).
