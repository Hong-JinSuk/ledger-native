@AGENTS.md

# LEDGER (Native)

개인 프로젝트 LEDGER의 모바일 앱(Expo) Claude Code 설정 파일입니다.
원본은 AI Studio로 만든 웹 React 앱(`../ledger` 또는 다운로드 폴더)이며, 이 레포는 그것을 **React Native(Expo)로 재구축**한 것입니다.

## Overview & Stack

- **Purpose**: 개인 가계부 서비스. 사용자가 카테고리·예산을 설정하고, 지출/수입 내역(어디에 얼마를 썼는지)을 기록·관리한다.
- **차별점 = "감성"**: 흔한 가계부와의 차별점은 **감성적인 톤과 UX**다. 딱딱한 스프레드시트형 도구가 아니라, 기록하는 경험 자체가 기분 좋고 따뜻하게 느껴지도록 만든다. (아래 [디자인 방향] 참조.)
- **Platform**: 모바일(iOS/Android)과 웹 모두 지원. 모바일은 이 Expo 레포가 메인, 웹은 원본 웹 레포 또는 Expo web 빌드로 제공.
- **Framework**: Expo (SDK 최신) + Expo Router (파일 기반 라우팅) + React Native + TypeScript (strict)
- **Styling**: NativeWind (React Native용 Tailwind) — 원본 웹의 Tailwind 클래스를 최대한 재사용
- **State**: 서버 상태 TanStack Query (`staleTime` 명시) · 클라 상태 jotai (`src/store/`) · Form react-hook-form + zod (`src/schemas/`)
- **Auth**: Supabase Auth + **Google OAuth (Google 로그인만 지원)** — Drive 접근 권한이 필수라서
- **Backend**: Supabase — **사용자 데이터(계정/프로필)만** 관리. 가계부 데이터는 저장하지 않음
- **가계부 데이터 저장소**: 사용자 본인의 **Google Drive** (로컬 우선 → 동기화). 아래 [데이터 저장 & 동기화]가 이 프로젝트의 핵심
- **HTTP**: axios 단일 인스턴스 (`src/lib/api/axios.ts`)
- **Local Storage**: `@react-native-async-storage/async-storage` (작성 중/오프라인 1차 저장) · 토큰은 `expo-secure-store`
- **패키지 매니저**: (yarn / npm 중 택1 — 정하고 이 줄을 확정할 것)

> ⚠️ 이 프로젝트는 **웹이 아니라 네이티브**다. `div`/`span`/`button`/CSS/DOM API를 쓰지 말 것. 아래 [플랫폼 규칙] 참조.

## Commands

```bash
npx expo start            # 개발 서버 (QR로 Expo Go 또는 시뮬레이터 실행)
npx expo start --ios      # iOS 시뮬레이터로 바로
npx expo start --android  # Android 에뮬레이터로 바로
npx expo start --clear    # Metro 캐시 삭제 후 시작 (이상 동작 시)
npx tsc --noEmit          # 타입 검사
npx expo lint             # Lint 검사
```

> 작업 후 반드시 `npx tsc --noEmit`과 `npx expo lint`로 오류가 없는지 확인할 것.

## Project Structure

```
app/               # Expo Router 라우트 (파일 = 화면). _layout.tsx가 네비게이션 정의
├── (tabs)/        # 탭 네비게이션 그룹
├── _layout.tsx    # 루트 레이아웃 (프로바이더 주입: Query, jotai 등)
└── ...

src/
├── components/    # 재사용 컴포넌트 (RN View/Text 기반)
├── constants/     # 매직 넘버, 문자열 상수
├── hooks/         # 커스텀 훅
├── lib/           # 유틸 / 헬퍼 (api, services 등)
├── schemas/       # react-hook-form 관련 zod
├── store/         # jotai / atom
└── types/         # 공유 TypeScript 타입
```

## 도메인 개념 (가계부)

- **거래(Transaction)**: 지출 또는 수입 한 건. 금액·날짜·카테고리·메모 등을 가진다. 지출/수입 타입을 구분한다.
- **카테고리(Category)**: 사용자가 정의하는 분류(식비·교통·문화 등). 색/아이콘을 가질 수 있어 감성 UI에 활용.
- **예산(Budget)**: 특정 기간·카테고리에 대한 목표 한도. 실제 지출과 비교해 진행률을 보여준다.
- ⚠️ **모든 항목은 동기화용 공통 메타를 가진다** (거래·카테고리·예산 공통): 기기 생성 **`id`(UUID)** · **`createdAt`** · **`updatedAt`** · **`deleted`(soft-delete 플래그)**. 이 필드들이 Google Drive 병합의 열쇠다 ([데이터 저장 & 동기화] 참조). **삭제는 물리 삭제가 아니라 `deleted: true` + `updatedAt` 갱신**으로 처리한다.
- ⚠️ **금액 처리**: 통화·소수점·반올림 오차에 주의. 부동소수점 연산으로 돈을 다루지 말 것 — 정수(최소 단위, 예: 원) 또는 검증된 방식으로 다룬다. 통화 포맷팅은 공용 유틸로 통일.
- ⚠️ **날짜/기간**: 월별 집계·기간 필터가 핵심이다. 타임존·"이번 달" 경계 처리를 공용 유틸로 통일해 화면마다 다르게 계산되지 않게 할 것.

## 웹 → 네이티브 변환 규칙 — ⚠️ CRITICAL

원본 웹 코드를 옮길 때 **로직은 재사용, UI 계층은 재작성**한다. 아래 매핑을 따를 것.

| 웹 (원본)                     | 네이티브 (이 레포)                                                   |
| ----------------------------- | -------------------------------------------------------------------- |
| `div`, `section`              | `View`                                                               |
| `p`, `span`, `h1~h6`          | `Text` (⚠️ 모든 텍스트는 반드시 `Text` 안에 있어야 함)               |
| `button` + `onClick`          | `Pressable` + `onPress`                                              |
| `input`                       | `TextInput`                                                          |
| `img`                         | `Image` (expo-image 권장)                                            |
| `a href` / react-router       | expo-router `Link` / `router.push()`                                 |
| 스크롤 영역                   | `ScrollView` 또는 `FlatList`(긴 목록은 FlatList)                     |
| CSS / Tailwind className      | NativeWind `className` (대부분 그대로, 일부 웹 전용 클래스는 미지원) |
| localStorage / sessionStorage | AsyncStorage                                                         |
| `window`, `document`, DOM API | 사용 금지 — RN에는 없음. RN 대응 API로 교체                          |
| `fetch`                       | axios 인스턴스 (아래 규칙)                                           |

- **재사용 가능(거의 그대로)**: API 호출 로직, 커스텀 훅, zod 스키마, 타입, 유틸 함수, TanStack Query/jotai 스토어.
- **재작성 필요**: 화면/컴포넌트의 JSX와 스타일.
- NativeWind에서 안 되는 Tailwind 클래스(예: 일부 웹 전용 pseudo, grid)는 RN 방식으로 대체할 것. 막히면 즉석 하드코딩 말고 어떻게 대체할지 먼저 확인.

## 데이터 저장 & 동기화 — ⚠️ 프로젝트의 핵심 (MOST CRITICAL)

**이 앱의 정체성은 "서버 DB 없는 가계부"다.** 가계부 데이터는 우리 서버가 아니라 **사용자 본인의 Google Drive**에 저장된다. 이 구조가 프로젝트에서 가장 중요하므로, 데이터 흐름을 건드리는 작업은 반드시 아래 규칙을 지킬 것.

### 저장소 역할 분리

- **Supabase (백엔드 서버)**: **사용자 데이터(계정/프로필)만** 관리. 인증은 **Supabase Auth + Google OAuth**. 가계부 내역(거래·카테고리·예산)은 여기에 저장하지 **않는다.**
- **Google Drive (사용자 소유)**: 실제 가계부 데이터의 원격 저장소. Google 로그인으로 얻은 권한으로 사용자 본인의 Drive에 읽고 쓴다.
- **로컬(기기)**: 작성 중/오프라인의 1차 저장소. AsyncStorage(또는 로컬 DB)에 보관.

> 그래서 로그인은 **Google 로그인만** 지원한다. Drive 접근 권한이 필수이기 때문 (Credentials 로그인 등은 없음).

### 데이터 흐름 (로컬 우선 → 나중에 동기화)

1. **작성 중에는 로컬에만 저장한다.** 가계부를 작성하는 동안 매 입력마다 Drive에 쓰지 않는다.
2. **작성 화면을 나가거나 작성을 끝냈을 때** 그 결과를 Google Drive에 동기화(push)한다.
3. **오프라인에서 작성한 경우**엔 로컬에만 쌓아두고, 나중에 **앱을 다시 켰을 때** Drive와 싱크를 확인해 병합·업로드한다.
4. 즉 로컬은 항상 최신 작업 공간, Drive는 "확정된 원격 상태". 앱 시작 시와 작성 종료 시가 동기화 트리거다.

### 앱 시작 시 동기화 & 병합 규칙 — ⚠️ CRITICAL

앱을 켜면 로컬과 Drive를 비교해 병합한다. 오프라인 중 로컬이 바뀌었고 그 사이 Drive에도 변경이 있을 수 있으므로:

- **고유 ID로 항목을 짝짓는다.** 모든 거래/카테고리/예산은 **기기에서 생성한 UUID**를 PK로 가진다. (⚠️ 서버가 ID를 발급하는 방식 금지 — 오프라인에서 ID를 못 받으면 병합이 깨진다.) 각 항목은 `createdAt`·`updatedAt`(수정 시각)·`deleted`(soft-delete 플래그)를 가진다.
- **새로 추가된 항목(양쪽에 다른 항목)**: 둘 다 살린다(합집합).
- **같은 항목을 양쪽에서 수정(충돌)**: **로컬이 우선.** Drive는 보통 이전 상태이고 사용자는 로컬에서 수정하기 때문. 병합 후 그 항목의 `updatedAt`을 갱신해 둘 것.
- **한쪽 삭제 · 다른 쪽 수정**: **삭제가 우선.** 삭제된 항목은 수정 여부와 무관하게 삭제로 확정한다. (그래서 삭제는 물리 삭제가 아니라 **soft-delete + `updatedAt`**로 표현해, 병합 시 "삭제됨"을 인식할 수 있어야 한다.)
- 병합이 끝나면 병합 결과를 로컬과 Drive 양쪽에 반영해 두 저장소를 일치시킨다.

### 구현 주의

- Drive I/O·병합 로직은 **화면에 흩뿌리지 말고 단일 서비스 계층**(예: `src/lib/services/sync/`)으로 모은다. 화면은 로컬 데이터만 바라보고, 동기화는 이 계층이 담당한다.
- 동기화는 실패할 수 있다(네트워크·권한 만료). 실패해도 **로컬 데이터는 절대 잃지 않게** 하고, 다음 트리거에서 재시도한다. 사용자에게는 조용히/부드럽게 상태를 알린다(감성 톤).
- Drive 접근 토큰 만료·재인증 흐름을 처리한다. 토큰은 `expo-secure-store`에 보관.
- 동기화 중 앱 종료·중단에 대비해, 부분 쓰기로 Drive 파일이 깨지지 않도록 원자적 쓰기(임시 파일 후 교체 등)를 고려한다.

이 앱의 정체성은 **"감성"**이다. UI/카피/인터랙션을 만들 때 항상 이 방향을 우선한다.

- **따뜻하고 부드러운 톤**: 날카로운 대비·차가운 회색 일변도보다, 부드러운 색감·여백·둥근 모서리를 기본으로. 원본 웹의 디자인 톤(색상 팔레트·타이포)을 존중해 그대로 옮기고, 함부로 "기본 머티리얼/딱딱한 대시보드" 스타일로 바꾸지 말 것.
- **숫자를 감정으로 감싸기**: 가계부는 숫자가 중심이지만, 그 숫자를 무미건조하게 나열하지 않는다. 카피·엠프티 스테이트·피드백 메시지에 온기를 담는다 (예: 빈 화면에 "아직 기록이 없어요" 같은 다정한 안내).
- **부드러운 모션**: 화면 전환·목록 추가/삭제·펼침에 급작스러운 점프 대신 부드러운 애니메이션을 기본으로 (react-native-reanimated / Layout Animation). 감성의 상당 부분이 "움직임의 결"에서 온다.
- **일관성**: 감성 톤은 특정 화면만이 아니라 앱 전체에서 일관돼야 한다. 새 화면도 기존의 색·간격·둥글기·모션 리듬을 따른다.
- ⚠️ **감성을 이유로 기능·접근성·가독성을 해치지 말 것.** 예쁘지만 안 보이는 저대비 텍스트, 너무 작은 터치 타겟은 금지. 감성과 사용성은 양립해야 한다.
- 새 화면/컴포넌트를 만들 때 톤 판단이 애매하면 즉석에서 정하지 말고 먼저 방향을 확인할 것.

## Styling (NativeWind) — ⚠️ CRITICAL

- 스타일은 **NativeWind `className`**을 기본으로 쓴다. 인라인 `style={{}}`은 NativeWind로 표현 불가한 동적 값에만.
- 원본 웹의 Tailwind 디자인 토큰(색상·간격)을 `tailwind.config.js`로 최대한 옮겨와 룩앤필을 유지한다.
- 반응형: 웹의 `sm:`/`md:`/`lg:`는 화면 폭 기반인데, 모바일 앱은 단일 폭이 기본이다. 브레이크포인트에 의존하던 레이아웃은 **모바일 세로 화면 기준으로 재설계**할 것 (그냥 클래스만 떼오면 어색해짐).
- 터치 타겟은 최소 44x44 pt 이상 확보 (버튼·아이콘).

## 라우팅 (Expo Router) — ⚠️ CRITICAL

- `app/` 디렉터리의 파일 구조가 곧 라우트다 (Next.js App Router와 유사 개념).
- 화면 이동은 `<Link href="...">` 또는 `router.push('/path')`.
- ⚠️ **동적 경로에 한글/원문을 그대로 넘기지 말 것.** 원본 웹에서 `/stocks/엔비디아`처럼 깨졌던 이슈와 동일 — 파라미터는 안전한 식별자(id/ticker)로 해석해서 넘긴다.
- 네비게이션 구조(탭/스택)는 `_layout.tsx`에서 정의한다.

## API Calls — ⚠️ CRITICAL

- **모든 API 호출은 `src/lib/api/axios.ts`의 `api` 인스턴스를 쓴다. `fetch` 사용 금지.**
  - baseURL은 `.env`의 `EXPO_PUBLIC_API_URL` 등으로 주입 (⚠️ Expo 환경변수는 `EXPO_PUBLIC_` 접두어가 있어야 클라에 노출됨).
  - 긴 응답이 예상되는 호출은 `{ timeout: 60000 }` 등으로 timeout 명시 (기본 10s).
  - 응답 에러는 인터셉터에서 `throw new Error(message)`로 정규화 → 호출 측은 `error instanceof Error ? error.message : ...`로 받는다.
- ⚠️ 실기기/에뮬레이터에서 `localhost`는 PC의 localhost가 아니다. 로컬 백엔드를 붙일 때는 PC의 LAN IP(예: `http://192.168.x.x:PORT`)를 쓰거나 Android 에뮬레이터는 `10.0.2.2`를 쓴다.

## API 응답 표준 — ⚠️ CRITICAL

**적용 범위**: 이 표준은 **우리 서버(Supabase)로 가는 호출**에만 적용된다. 가계부 데이터를 다루는 **Google Drive 직접 읽기/쓰기는 Drive API 자체 응답**을 쓰므로 이 표준을 타지 않는다. (이 앱에서 우리 서버로 가는 건 주로 사용자 데이터 정도다.)

### 공통 envelope

모든 응답은 아래 형태를 따른다.

```json
{
  "code": 200,
  "status": "success",
  "message": "성공",
  "response": {}
}
```

- `code`: HTTP 상태코드(number).
- `status`: `"success"` | `"fail"`.
- `message`: 사람이 읽을 메시지. 실패 시 사용자에게 보여줄 문구.
- `response`: 실제 페이로드. 데이터 없음/실패 시 `null`.

실패 예:

```json
{
  "code": 400,
  "status": "fail",
  "message": "잘못된 요청입니다",
  "response": null
}
```

### response의 세 가지 형태

`response`는 상황에 따라 아래 셋 중 하나다. **더 늘리지 말 것.**

1. **목록(List)** — `{ data, total, page, size }` 형태로 **항상** 통일한다.

   ```json
   "response": { "data": [], "total": 0, "page": 1, "size": 20 }
   ```

   - `total`: 조건에 맞는 전체 건수(현재 페이지가 아니라 총합).
   - ⚠️ **페이지네이션을 하지 않고 전체를 다 준 경우엔 `page: -1, size: -1`** ("자르지 않고 다 줬다"는 신호). 형태는 그대로 유지해 목록 파싱 코드가 갈라지지 않게 한다. 클라는 `page === -1`이면 "이게 전부, 더 불러올 것 없음"으로 판단.

2. **단일 리소스(Single)** — 목록이 아니면 페이지네이션 필드 없이 객체를 그대로 담는다.
   ```json
   "response": { "id": "...", "email": "...", "nickname": "..." }
   ```
   (단일 리소스에 `page/size`를 억지로 붙이지 말 것 — 목록이 아니면 페이지 개념이 없다.)
3. **없음/실패** — `null`.

> 원칙: **"자를 게 있는(페이징 의미가 있는) 목록"에만 page/size를 쓴다.** 목록류는 무조건 `{ data, total, page, size }`(전체면 -1), 목록이 아니면 객체 그대로.

### 쿼리 파라미터 & 훅

- **쿼리 파라미터 이름은 의미가 드러나게.** 검색어를 무지성 `q`로 두지 말 것 → `searchKey`, `title` 등 도메인에 맞는 이름.
- 클라 훅의 목록 응답 타입도 이 목록 형태(`{ data, total, page, size }`)로 받는다.
- **신규 GET 훅을 만들 땐 페이징 필요 여부를 먼저 물어볼 것.** 임의로 page/size를 붙이지 말 것.

### axios 인터셉터 처리

- 응답 인터셉터가 envelope를 풀어 처리한다: `status === "fail"`(또는 실패 code)이면 `message`를 꺼내 **`throw new Error(message)`로 정규화**한다. 성공이면 `response`를 반환(또는 envelope를 그대로 두되 훅에서 `response`만 꺼내 쓰기 — 팀 규칙 하나로 통일).
- 그래서 호출 측(훅)은 `try/catch`로 받고, 전역 에러 처리(toast 등)는 인터셉터/공용 유틸에서 일관되게 한다.

## 로컬 저장 (AsyncStorage) — ⚠️ CRITICAL

- 웹의 `localStorage`는 전부 `@react-native-async-storage/async-storage`로 대체한다.
- ⚠️ AsyncStorage는 **비동기(Promise)**다. `localStorage.getItem()`처럼 동기로 쓰던 코드는 `await`가 필요하도록 리팩터링해야 한다.
- 값은 문자열만 저장 가능 → 객체는 `JSON.stringify`/`JSON.parse`.
- 토큰 등 민감 정보는 AsyncStorage 대신 `expo-secure-store`를 고려.

## Error Handling

- API 호출은 hook 안에서 → 오류는 `throw new Error(message)`로 던진다.
- 전역 에러 처리(toast 등)는 인터셉터/공용 유틸로. 웹의 toast는 RN에서 `react-native-toast-message` 같은 라이브러리 또는 공용 컴포넌트로 대체.

## UI Rules — ⚠️ CRITICAL

### 스타일 변경 금지 원칙

**스타일 변경이 명시적으로 요청되지 않은 경우, 기존 레이아웃과 className을 함부로 바꾸지 말 것.** 기능 추가·로직 변경 시 기존 스타일은 유지. 레이아웃을 건드려야 하면 먼저 확인.

### 공용화로 UX 일관성 확보

반복되는 인터랙션·UX 패턴(리스트, 모달, 폼, 로딩/스켈레톤, 삭제 확인 등)은 즉석 구현하지 말고 **공용 컴포넌트/훅으로 추출**해 모든 화면이 동일하게 동작하게 한다.

- **삭제(되돌릴 수 없는 액션) 확인**: 실행 전 반드시 한 번 더 확인. 웹의 `window.confirm` 대신 RN `Alert.alert` 또는 공용 confirm 모달 컴포넌트를 쓴다.
- **가역적 mutation은 낙관적 업데이트 기본**: 즐겨찾기·토글·읽음 처리 등 되돌릴 수 있는 액션은 서버 응답을 기다리지 말고 즉시 UI 반영. react-query `onMutate`(스냅샷+캐시 수정) → `onError`(롤백) → `onSettled`(invalidate) 패턴.
- **긴 목록은 `FlatList`**: `.map()`으로 대량 렌더 금지 (성능). `FlatList`의 `keyExtractor`·`renderItem` 사용.

### 안전 영역 (Safe Area)

노치·상태바·홈 인디케이터를 침범하지 않도록 화면은 `SafeAreaView`(react-native-safe-area-context) 안에 둔다.

## Code Style

- **언어**: TypeScript 엄격 모드(`strict: true`). `any` 원칙적 금지, 불가피하면 이유를 주석으로.
- **Import**: ES Module. CommonJS(`require`) 금지.
- **컴포넌트**: 함수형 + Hooks만. 클래스형 금지.
- **네이밍**:
  - 컴포넌트 파일: `kebab-case.tsx` (예: `transaction-card.tsx`)
  - 컴포넌트 함수명: `export default function PascalCase`
  - 유틸/훅 파일: `kebab-case.ts`
  - 훅 이름: `use`로 시작
- **구조 분해**: import 및 props에서 가능하면 사용.
- **상수**: 매직 넘버·문자열은 `src/constants/`로 분리.
- **파일 내 함수 배치**: 주 컴포넌트인 `export default function`을 (상수/타입 다음의) 파일 상단에 두고, 그 파일 전용 헬퍼·서브 컴포넌트는 그 아래에 정의한다. (호이스팅되므로 아래 정의해도 참조 가능.)

## What Claude Gets Wrong (Known Issues)

Expo/RN 전환에서 반복되기 쉬운 실수:

**데이터 저장 & 동기화 (가장 조심할 것):**

- 가계부 데이터를 Supabase에 저장하려는 시도 → **가계부 데이터는 Google Drive, Supabase는 사용자 데이터만.**
- 작성 중 매 입력마다 Drive에 쓰기 → 로컬 우선, 동기화는 작성 종료·앱 시작 시에만.
- 항목 ID를 서버/Drive에서 발급 → 반드시 **기기 UUID**. 아니면 오프라인 병합이 깨짐.
- 삭제를 물리 삭제로 처리 → **soft-delete(`deleted` + `updatedAt`)**. 아니면 병합 시 "삭제됨"을 알 수 없음.
- 충돌 병합 규칙 위반 → **수정은 로컬 우선, 삭제는 삭제 우선.**
- 동기화 실패 시 로컬 데이터 유실 → 로컬은 절대 먼저 지우지 말 것. 성공 후에만 정리.
- Google 외 로그인 추가 → Drive 권한이 핵심이라 **Google 로그인만.**

**RN 일반:**

- 웹 요소(`div`/`span`/`button`)를 그대로 남겨둠 → RN 컴포넌트로 교체 필수.
- 텍스트를 `Text` 없이 `View`에 직접 넣음 → 런타임 에러.
- `localStorage`/`window`/`document` 등 웹 전용 API 잔존 → AsyncStorage/RN API로 교체.
- 환경변수에 `EXPO_PUBLIC_` 접두어 누락 → 클라에서 값이 `undefined`.
- 실기기/에뮬레이터에서 `localhost` 백엔드 접속 실패 → LAN IP / `10.0.2.2` 사용.
- 긴 목록을 `.map()`으로 렌더 → `FlatList`로.
- Metro 캐시로 인한 이상 동작 → `npx expo start --clear`.
- `console.log` 디버그 잔존 → 커밋 전 제거.

## Claude 작업 권한

- **읽기 전용(변경 없는) 작업은 사전 허락 없이 실행해도 된다**: 파일 읽기/grep/탐색, 원본 웹 프로젝트 참조, 읽기성 HTTP 요청 등. 물어보지 말 것.
- 상태를 바꾸는 작업(파일 수정·삭제, 패키지 설치 등)은 사용자가 요청한 작업 범위 내에서만.

## Compaction Instructions

컨텍스트 압축 시 반드시 보존할 것:

- 수정된 파일 목록
- 현재 진행 중인 마이그레이션 단계 (어느 화면/기능까지 옮겼는지)
- 실패한 빌드 또는 미해결 오류
