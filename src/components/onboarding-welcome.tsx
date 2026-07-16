import { Plus } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountInput } from '@/components/amount-input';
import { FadeIn } from '@/components/fade-in';
import { FixedExpenseCard } from '@/components/fixed-expense-card';
import { FixedExpenseDrawer, type FixedExpenseDrawerRef } from '@/components/fixed-expense-drawer';
import { Palette } from '@/constants/palette';
import { isNewSignup } from '@/lib/auth/is-new-signup';
import { isFreshLedger } from '@/lib/ledger/selectors';
import { loadOnboardingSeen, markOnboardingSeen } from '@/lib/storage/onboarding-storage';
import { useAuthStore } from '@/store/auth-store';
import { useLedgerStore } from '@/store/ledger-store';
import { useSyncStore } from '@/store/sync-store';

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
  const newSignup = useMemo(() => (session ? isNewSignup(session.user, Date.now()) : false), [session]);

  // Latch the decision ONCE. The show conditions are checked only until we open; after that, live store
  // changes must NOT tear the overlay down mid-setup — adding a fixed expense makes the ledger no longer
  // "fresh", and a background sync flips status away from 'synced'. Either would otherwise unmount the
  // overlay (losing the typed budget). Only the user's 시작/나중에 closes it.
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!show && !dismissed && seen === false && isFresh && (newSignup || syncStatus === 'synced')) {
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

  // "시작하기" commits the budget (fixed expenses are already saved as they're added); "나중에" skips it.
  const onStart = () => {
    if (budget > 0) updateSettings({ budget });
    onDone();
  };

  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Palette.paper, zIndex: 50 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }}
          keyboardShouldPersistTaps="handled">
          {/* Compact centered column on wide screens; full-width (with edge padding) on mobile, where
              width:100% < maxWidth so it just fills the screen. */}
          <View
            style={{
              width: '100%',
              maxWidth: 480,
              flexGrow: 1,
              paddingHorizontal: 28,
              paddingTop: 40,
              paddingBottom: 32,
            }}>
            <FadeIn>
              <Text className="text-4xl text-ink font-serif">환영해요</Text>
            <Text className="mt-4 text-base leading-7 text-ink/70 font-sans">
              매달 예산과 고정 지출을 정해두면,{'\n'}남은 예산이 한눈에 보여요.{'\n'}언제든 설정에서 바꿀 수 있어요.
            </Text>
          </FadeIn>

          {/* Default budget */}
          <FadeIn delay={140} style={{ marginTop: 36 }}>
            <Text className="mb-2 text-[11px] uppercase tracking-[2px] text-muted font-sans-semibold">
              기본 예산
            </Text>
            <View className="rounded-2xl border border-line bg-white/60 px-5 py-6">
              <View className="flex-row items-end justify-center gap-1">
                <AmountInput plain value={budget} onChangeValue={setBudget} />
                <Text className="pb-1 text-xl text-muted font-serif">원</Text>
              </View>
            </View>
          </FadeIn>

          {/* Default fixed expenses (optional) — reuses the real drawer, so it writes the live template */}
          <FadeIn delay={220} style={{ marginTop: 28 }}>
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-[11px] uppercase tracking-[2px] text-muted font-sans-semibold">
                고정 지출 (선택)
              </Text>
              <Pressable
                onPress={() => fixedRef.current?.present()}
                hitSlop={8}
                className="flex-row items-center gap-1 rounded-full bg-fill px-3 py-1.5 active:opacity-70">
                <Plus size={14} color={Palette.ink} />
                <Text className="text-[11px] uppercase tracking-wider text-ink font-sans-bold">추가</Text>
              </Pressable>
            </View>
            {visibleFixed.length === 0 ? (
              <Text className="rounded-2xl border border-dashed border-line px-5 py-6 text-center text-sm leading-5 text-muted font-sans">
                통신비 · 구독료처럼 매달 나가는 지출을{'\n'}더해두면 남은 예산이 더 정확해져요.
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

          {/* Spacer pushes the actions to the bottom when the content is short. */}
          <View style={{ flex: 1, minHeight: 24 }} />

          <FadeIn delay={300}>
            <Pressable
              onPress={onStart}
              className="items-center rounded-full bg-ink py-4 active:opacity-80">
              <Text className="text-base text-paper font-sans-bold">시작하기</Text>
            </Pressable>
            <Pressable onPress={onDone} className="mt-2 items-center py-3 active:opacity-60">
              <Text className="text-sm text-muted font-sans-medium">나중에 할게요</Text>
            </Pressable>
          </FadeIn>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* No `month` → adds to the DEFAULT fixed-expense template (settings.fixedExpenses). Presents as a
          sheet ABOVE this overlay via the root BottomSheetModalProvider. */}
      <FixedExpenseDrawer ref={fixedRef} />
    </View>
  );
}
