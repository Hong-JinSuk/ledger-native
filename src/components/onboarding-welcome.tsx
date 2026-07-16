import { Check, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountInput } from '@/components/amount-input';
import { FadeIn } from '@/components/fade-in';
import { FixedExpenseCard } from '@/components/fixed-expense-card';
import {
  FixedExpenseDrawer,
  type FixedExpenseDrawerRef,
} from '@/components/fixed-expense-drawer';
import { Palette } from '@/constants/palette';
import { isNewSignup } from '@/lib/auth/is-new-signup';
import { isFreshLedger } from '@/lib/ledger/selectors';
import {
  loadOnboardingSeen,
  markOnboardingSeen,
} from '@/lib/storage/onboarding-storage';
import { useAuthStore } from '@/store/auth-store';
import { useLedgerStore } from '@/store/ledger-store';
import { useSyncStore } from '@/store/sync-store';

/** Max content width on wide screens — mobile is narrower than this, so it just fills the screen. */
const ONBOARDING_MAX_WIDTH = 700;
const STEP_COUNT = 2;
const STEP_LABELS = ['기본 예산', '고정 지출'];

/**
 * First-run welcome (onboarding item 2). Gently invites a brand-new user to set their DEFAULT budget +
 * fixed expenses BEFORE recording, so every month's "이 기본값으로 적용" prompt is meaningful instead of
 * empty. Skippable. Mounted in the tabs layout as a full-screen overlay.
 *
 * Shows only when: not seen on this device (local flag) AND the first sync has SETTLED to 'synced' AND
 * the account looks brand-new (no budget, no fixed expenses, no records). Gating on a successful sync is
 * what stops it flashing at a returning user on a fresh device — their Drive data pulls in first, so
 * they no longer look "new". (First login is always online, so a genuinely-new user reaches 'synced'
 * with an empty ledger and sees this.)
 */
export function OnboardingGate() {
  const [seen, setSeen] = useState<boolean | null>(null); // null = still loading the flag
  useEffect(() => {
    void loadOnboardingSeen().then(setSeen);
  }, []);

  // Stable boolean from the store → re-renders only when "fresh" flips. isFreshLedger short-circuits
  // on budget, so an existing user never pays the record scan.
  const isFresh = useLedgerStore((s) => isFreshLedger(s.settings, s.records));
  const syncStatus = useSyncStore((s) => s.status);
  const session = useAuthStore((s) => s.session);
  // A brand-new Supabase account has never used the app → its Drive has no ledger file to wait for, so
  // we can open onboarding at once instead of blocking on the first sync settling (the file-creating sync
  // still runs in the background). Returning users keep waiting for 'synced' so their pulled Drive data
  // can prove they're not new — no flash. Computed once per session (now captured at login).
  const newSignup = useMemo(
    () => (session ? isNewSignup(session.user, Date.now()) : false),
    [session],
  );

  // Latch the decision ONCE. The show conditions are checked only until we open; after that, live store
  // changes must NOT tear the overlay down mid-setup — adding a fixed expense makes the ledger no longer
  // "fresh", and a background sync flips status away from 'synced'. Either would otherwise unmount the
  // overlay (losing the typed budget). Only the user's 시작/나중에 closes it.
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (
      !show &&
      !dismissed &&
      seen === false &&
      isFresh &&
      (newSignup || syncStatus === 'synced')
    ) {
      setShow(true);
    }
  }, [show, dismissed, seen, isFresh, newSignup, syncStatus]);

  const markDone = useCallback(() => {
    void markOnboardingSeen();
    setDismissed(true);
    setShow(false);
  }, []);

  if (!show) return null;
  return <OnboardingWelcome onDone={markDone} />;
}

function OnboardingWelcome({ onDone }: { onDone: () => void }) {
  const [budget, setBudget] = useState(0);
  const updateSettings = useLedgerStore((s) => s.updateSettings);
  const currency = useLedgerStore((s) => s.settings.currency);
  const fixedExpenses = useLedgerStore((s) => s.settings.fixedExpenses);
  const visibleFixed = fixedExpenses.filter((e) => !e.deleted);

  const fixedRef = useRef<FixedExpenseDrawerRef>(null);

  // Two-step carousel: 기본 예산 → 고정 지출. Buttons move between the steps; the panes slide horizontally
  // via translateX. `vw` is the pane width, seeded from the window (min the max column) and corrected on
  // layout so the maxWidth clamp is exact.
  const [step, setStep] = useState(0);
  const [vw, setVw] = useState(() =>
    Math.min(Dimensions.get('window').width, ONBOARDING_MAX_WIDTH),
  );
  const translateX = useRef(new Animated.Value(0)).current;
  const lineProgress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(translateX, {
      toValue: -vw * step,
      duration: 360,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    // The stepper line fills as we advance. It animates `width`, which the native driver can't do, so
    // drive it separately in JS.
    Animated.timing(lineProgress, {
      toValue: step,
      duration: 360,
      useNativeDriver: false,
    }).start();
  }, [step, vw, translateX, lineProgress]);

  // Final commit: save the budget (fixed expenses are already saved as they're added), then close.
  const finish = () => {
    if (budget > 0) updateSettings({ budget });
    onDone();
  };

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: Palette.paper,
        zIndex: 50,
      }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: ONBOARDING_MAX_WIDTH,
            alignSelf: 'center',
          }}
        >
          {/* Numbered-circle stepper joined by a line that fills as you advance (see StepProgress). */}
          <StepProgress step={step} lineProgress={lineProgress} />

          {/* Carousel viewport — clips the off-screen step; the row slides via translateX. */}
          <View
            style={{ flex: 1, overflow: 'hidden' }}
            onLayout={(e) => setVw(e.nativeEvent.layout.width)}
          >
            <Animated.View
              style={{
                flex: 1,
                flexDirection: 'row',
                width: vw * STEP_COUNT,
                transform: [{ translateX }],
              }}
            >
              {/* Step 1 — 기본 예산 */}
              <StepPane width={vw}>
                <FadeIn>
                  <Text className="text-4xl text-ink font-serif">환영해요</Text>
                  <Text className="mt-4 text-base leading-7 text-ink/70 font-sans">
                    먼저, 매달 기본 예산을 정해볼까요?{'\n'}남은 예산이 한눈에
                    보여요.
                  </Text>
                </FadeIn>

                <FadeIn delay={140} style={{ marginTop: 36 }}>
                  <Text className="mb-2 text-[11px] uppercase tracking-[2px] text-muted font-sans-semibold">
                    기본 예산
                  </Text>
                  <View className="rounded-2xl border border-line bg-white/60 px-5 py-6">
                    <View className="flex-row items-end justify-center gap-1">
                      <AmountInput plain autoFocus value={budget} onChangeValue={setBudget} />
                      <Text className="pb-1 text-xl text-muted font-serif">원</Text>
                    </View>
                  </View>
                </FadeIn>

                <View style={{ flex: 1, minHeight: 24 }} />

                <View>
                  <Pressable
                    onPress={() => setStep(1)}
                    className="items-center rounded-full bg-ink py-4 active:opacity-80"
                  >
                    <Text className="text-base text-paper font-sans-bold">다음</Text>
                  </Pressable>
                  <Pressable
                    onPress={onDone}
                    className="mt-2 items-center py-3 active:opacity-60"
                  >
                    <Text className="text-sm text-muted font-sans-medium">
                      나중에 할게요
                    </Text>
                  </Pressable>
                </View>
              </StepPane>

              {/* Step 2 — 고정 지출 */}
              <StepPane width={vw}>
                <FadeIn>
                  <Text className="text-4xl text-ink font-serif">고정 지출</Text>
                  <Text className="mt-4 text-base leading-7 text-ink/70 font-sans">
                    통신비·구독료처럼 매달 나가는 지출을{'\n'}더해두면 남은
                    예산이 더 정확해져요. (선택)
                  </Text>
                </FadeIn>

                <FadeIn delay={140} style={{ marginTop: 28 }}>
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-[11px] uppercase tracking-[2px] text-muted font-sans-semibold">
                      고정 지출
                    </Text>
                    <Pressable
                      onPress={() => fixedRef.current?.present()}
                      hitSlop={8}
                      className="flex-row items-center gap-1 rounded-full bg-fill px-3 py-1.5 active:opacity-70"
                    >
                      <Plus size={14} color={Palette.ink} />
                      <Text className="text-[11px] uppercase tracking-wider text-ink font-sans-bold">
                        추가
                      </Text>
                    </Pressable>
                  </View>
                  {visibleFixed.length === 0 ? (
                    <Text className="rounded-2xl border border-dashed border-line px-5 py-6 text-center text-sm leading-5 text-muted font-sans">
                      아직 없어요.{'\n'}매달 나가는 고정 지출을 더해보세요.
                    </Text>
                  ) : (
                    <View className="gap-2.5">
                      {visibleFixed.map((expense) => (
                        <FixedExpenseCard
                          key={expense.id}
                          expense={expense}
                          currency={currency}
                          onPress={() => fixedRef.current?.present(expense)}
                        />
                      ))}
                    </View>
                  )}
                </FadeIn>

                <View style={{ flex: 1, minHeight: 24 }} />

                <View>
                  <Pressable
                    onPress={finish}
                    className="items-center rounded-full bg-ink py-4 active:opacity-80"
                  >
                    <Text className="text-base text-paper font-sans-bold">
                      시작하기
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setStep(0)}
                    className="mt-2 items-center py-3 active:opacity-60"
                  >
                    <Text className="text-sm text-muted font-sans-medium">뒤로</Text>
                  </Pressable>
                </View>
              </StepPane>
            </Animated.View>
          </View>
        </View>
      </SafeAreaView>

      {/* No `month` → adds to the DEFAULT fixed-expense template (settings.fixedExpenses). Presents as a
          sheet ABOVE this overlay via the root BottomSheetModalProvider. */}
      <FixedExpenseDrawer ref={fixedRef} />
    </View>
  );
}

/** One carousel pane — fixed width (the viewport width), its own vertical scroll for tall content. */
function StepPane({ width, children }: { width: number; children: ReactNode }) {
  return (
    <View style={{ width }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 28,
          paddingTop: 24,
          paddingBottom: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/**
 * Numbered-circle stepper: two nodes joined by a line that fills (animated) as the step advances.
 * A passed node shows a check, the current one its number, an upcoming one an outline.
 */
function StepProgress({ step, lineProgress }: { step: number; lineProgress: Animated.Value }) {
  const fillWidth = lineProgress.interpolate({
    inputRange: [0, STEP_COUNT - 1],
    outputRange: ['0%', '100%'],
  });
  return (
    <View style={{ paddingHorizontal: 28, paddingTop: 16, paddingBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <StepDot index={0} step={step} />
        <View
          style={{
            flex: 1,
            height: 3,
            marginHorizontal: 10,
            borderRadius: 2,
            backgroundColor: Palette.line,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={{ height: 3, width: fillWidth, backgroundColor: Palette.ink }}
          />
        </View>
        <StepDot index={1} step={step} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        {STEP_LABELS.map((label, i) => (
          <Text
            key={label}
            className={`text-xs font-sans-medium ${i <= step ? 'text-ink' : 'text-muted'}`}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function StepDot({ index, step }: { index: number; step: number }) {
  const reached = index <= step;
  const done = index < step;
  return (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: reached ? Palette.ink : Palette.paper,
        borderWidth: reached ? 0 : 1.5,
        borderColor: Palette.line,
      }}
    >
      {done ? (
        <Check size={15} color={Palette.paper} strokeWidth={3} />
      ) : (
        <Text
          className="text-[13px] font-sans-bold"
          style={{ color: reached ? Palette.paper : Palette.muted }}
        >
          {index + 1}
        </Text>
      )}
    </View>
  );
}
