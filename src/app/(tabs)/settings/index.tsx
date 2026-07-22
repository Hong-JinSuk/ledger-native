import { useRouter } from 'expo-router';
import { Bell, ChevronRight, Layers, LogOut, Plus, RefreshCw, User } from 'lucide-react-native';
import { useMemo, useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { useConfirm } from '@/components/confirm-dialog';
import { DefaultBudgetDrawer, type DefaultBudgetDrawerRef } from '@/components/default-budget-drawer';
import { EmptyState } from '@/components/empty-state';
import { FadeIn } from '@/components/fade-in';
import { FixedExpenseCard } from '@/components/fixed-expense-card';
import { FixedExpenseDrawer, type FixedExpenseDrawerRef } from '@/components/fixed-expense-drawer';
import { Screen } from '@/components/screen';
import { webScrollContent } from '@/constants/layout';
import { Palette } from '@/constants/palette';
import { signOut } from '@/lib/auth/auth';
import { formatAmount } from '@/lib/money';
import { alertSyncReauthNeeded } from '@/lib/sync/reauth-alert';
import { syncNow } from '@/lib/sync/sync-service';
import { useAuthStore } from '@/store/auth-store';
import { useLedgerStore } from '@/store/ledger-store';
import { useSyncStore } from '@/store/sync-store';
import type { FixedExpense } from '@/types/ledger';

export default function SettingsView() {
  const router = useRouter();

  const settingsBudget = useLedgerStore((s) => s.settings.budget);
  const currency = useLedgerStore((s) => s.settings.currency);
  const fixedExpenses = useLedgerStore((s) => s.settings.fixedExpenses);
  // Hide tombstoned (soft-deleted) expenses — they linger in the array so the deletion can sync.
  const visibleFixedExpenses = useMemo(() => fixedExpenses.filter((e) => !e.deleted), [fixedExpenses]);
  // Default budget with fixed expenses taken out — the "actually spendable" amount each month.
  const fixedTotal = useMemo(
    () => visibleFixedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    [visibleFixedExpenses],
  );
  const budgetAfterFixed = settingsBudget - fixedTotal;
  const categories = useLedgerStore((s) => s.categories);

  const session = useAuthStore((s) => s.session);
  const syncStatus = useSyncStore((s) => s.status);
  const syncError = useSyncStore((s) => s.error);
  const syncing = syncStatus === 'syncing';
  const confirm = useConfirm();

  const categoryCount = categories.filter((c) => !c.deleted).length;

  const drawerRef = useRef<FixedExpenseDrawerRef>(null);
  const openAdd = () => drawerRef.current?.present();
  const openEdit = (expense: FixedExpense) => drawerRef.current?.present(expense);

  const budgetDrawerRef = useRef<DefaultBudgetDrawerRef>(null);

  const handleSignOut = async () => {
    const ok = await confirm({
      title: '로그아웃할까요?',
      message: '이 기기에서 로그아웃돼요. 기록은 안전하게 보관돼요.',
      confirmLabel: '로그아웃',
      destructive: false,
    });
    if (!ok) return;
    // Flush any unsynced edits to THIS account's Drive BEFORE dropping its tokens — otherwise a
    // different account signing in next resets the local mirror before these reached Drive.
    await syncNow();
    await signOut();
  };

  const syncSubtitle =
    syncStatus === 'error'
      ? (syncError ?? '동기화에 실패했어요.')
      : syncStatus === 'unauthorized'
        ? 'Google Drive 권한이 필요해요. 다시 로그인하면 연결돼요.'
        : syncStatus === 'syncing'
          ? '기록을 동기화하고 있어요…'
          : syncStatus === 'synced'
            ? '기록이 Drive에 안전하게 보관됐어요.'
            : '앱을 켜면 자동으로 동기화돼요.';

  return (
    <Screen webFull>
      {/* Fixed header — stays put like a page header; only the content below scrolls. */}
      <View style={{ backgroundColor: Palette.paper }}>
        <View style={[{ paddingHorizontal: 20, paddingTop: 16 }, webScrollContent]}>
          <AppHeader title="Settings" subtitle="예산 · 카테고리 · 고정 지출" />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          { paddingHorizontal: 20, paddingBottom: 64 },
          webScrollContent,
        ]}
        keyboardShouldPersistTaps="handled">
        {/* Default budget — tap to edit in a sheet (matches every other edit in the app) */}
        <FadeIn>
          <SectionHeader title="기본 예산" />
          <Pressable
            onPress={() => budgetDrawerRef.current?.present()}
            className="rounded-2xl border border-line bg-white/60 px-5 py-4 active:opacity-70">
            <Text className="text-sm text-muted font-sans">매달 기본으로 적용될 예산</Text>
            <View className="mt-2 flex-row items-end justify-end gap-1">
              <Text className="text-3xl text-ink font-mono-semibold">
                {formatAmount(settingsBudget)}
              </Text>
              <Text className="pb-1 text-lg text-muted font-serif">원</Text>
            </View>
            {settingsBudget > 0 && fixedTotal > 0 && (
              <View className="mt-1.5 flex-row items-baseline justify-end gap-1.5">
                <Text className="text-[11px] text-muted font-sans">고정 지출 빼면</Text>
                <Text className="text-base text-muted font-mono-medium">
                  {formatAmount(budgetAfterFixed)}
                </Text>
                <Text className="text-[11px] text-muted font-serif">원</Text>
              </View>
            )}
          </Pressable>
        </FadeIn>

        {/* Categories */}
        <FadeIn delay={60} style={{ marginTop: 28 }}>
          <SectionHeader title="카테고리" />
          <Pressable
            onPress={() => router.push('/settings/categories')}
            className="flex-row items-center rounded-2xl border border-line bg-white/60 px-5 py-4 active:opacity-70">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-fill">
              <Layers size={18} color={Palette.ink} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[15px] text-ink font-sans-medium">카테고리 관리</Text>
              <Text className="mt-0.5 text-xs text-muted font-sans">{categoryCount}개 분류</Text>
            </View>
            <ChevronRight size={20} color={Palette.muted} />
          </Pressable>
        </FadeIn>

        {/* Fixed expenses */}
        <FadeIn delay={120} style={{ marginTop: 28 }}>
          <SectionHeader
            title="고정 지출"
            action={
              <Pressable
                onPress={openAdd}
                hitSlop={8}
                className="flex-row items-center gap-1 rounded-full bg-fill px-3 py-1.5 active:opacity-70">
                <Plus size={14} color={Palette.ink} />
                <Text className="text-[11px] uppercase tracking-wider text-ink font-sans-bold">
                  추가
                </Text>
              </Pressable>
            }
          />
          {visibleFixedExpenses.length === 0 ? (
            <EmptyState message={'아직 등록된 고정 지출이 없어요.\n매달 나가는 지출을 더해보세요.'} />
          ) : (
            <View className="gap-2.5">
              {visibleFixedExpenses.map((expense) => (
                <FixedExpenseCard
                  key={expense.id}
                  expense={expense}
                  currency={currency}
                  onPress={() => openEdit(expense)}
                />
              ))}
            </View>
          )}
        </FadeIn>

        {/* Account */}
        <FadeIn delay={180} style={{ marginTop: 28 }}>
          <SectionHeader title="계정" />
          <View className="rounded-2xl border border-line bg-white/60 px-5 py-4">
            <View className="flex-row items-center">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-fill">
                <User size={18} color={Palette.ink} />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-[15px] text-ink font-sans-medium" numberOfLines={1}>
                  {session?.user.email ?? '로그인됨'}
                </Text>
                <Text className="mt-0.5 text-xs text-muted font-sans">Google 계정으로 로그인</Text>
              </View>
            </View>

            {/* Google Drive sync status + manual trigger (the ledger data lives in the user's Drive). */}
            <View className="mt-4 flex-row items-center justify-between border-t border-line pt-4">
              <View className="flex-1 pr-3">
                <Text className="text-[13px] text-ink font-sans-medium">Google Drive 동기화</Text>
                <Text
                  numberOfLines={2}
                  className={`mt-0.5 text-xs font-sans ${syncStatus === 'error' ? 'text-expense' : 'text-muted'}`}>
                  {syncSubtitle}
                </Text>
              </View>
              <Pressable
                onPress={() => void syncNow()}
                disabled={syncing}
                hitSlop={8}
                style={{ opacity: syncing ? 0.6 : 1 }}
                className="flex-row items-center gap-1.5 rounded-full bg-fill px-3.5 py-2 active:opacity-70">
                {syncing ? (
                  <ActivityIndicator size="small" color={Palette.ink} />
                ) : (
                  <RefreshCw size={13} color={Palette.ink} />
                )}
                <Text className="text-[11px] uppercase tracking-wider text-ink font-sans-bold">
                  {syncing ? '동기화 중' : '지금 동기화'}
                </Text>
              </Pressable>
            </View>

            {/* Dev-only: fire the 3-strike sync-error alert on demand (web → toast, native → OS 알림). */}
            {__DEV__ && (
              <Pressable
                onPress={() => void alertSyncReauthNeeded()}
                className="mt-3 flex-row items-center justify-center gap-1.5 rounded-full border border-line py-2.5 active:opacity-70">
                <Bell size={13} color={Palette.muted} />
                <Text className="text-[11px] uppercase tracking-wider text-muted font-sans-bold">
                  동기화 오류 알림 테스트
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleSignOut}
              className="mt-4 flex-row items-center justify-center gap-2 rounded-full bg-fill py-3 active:opacity-70">
              <LogOut size={15} color={Palette.expense} />
              <Text className="text-sm text-expense font-sans-bold">로그아웃</Text>
            </Pressable>
          </View>
        </FadeIn>
      </ScrollView>

      <FixedExpenseDrawer ref={drawerRef} />
      <DefaultBudgetDrawer ref={budgetDrawerRef} />
    </Screen>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="text-[11px] uppercase tracking-[2px] text-ink font-sans-bold">{title}</Text>
      {action}
    </View>
  );
}

