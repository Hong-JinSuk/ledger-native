import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, X } from 'lucide-react-native';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { useConfirm } from '@/components/confirm-dialog';
import { SheetTextInput } from '@/components/sheet-text-input';
import { PICKABLE_ICONS } from '@/constants/icons';
import { Palette } from '@/constants/palette';
import { categoryFormSchema, type CategoryFormValues } from '@/schemas/category';
import { useLedgerStore } from '@/store/ledger-store';
import type { CategoryItem, TransactionType } from '@/types/ledger';

const TYPES: TransactionType[] = ['지출', '수입', '이체'];

export type CategoryDrawerRef = {
  /** Open the sheet. Pass a category to edit, or nothing/null (+ optional type) to add a new one. */
  present: (category?: CategoryItem | null, defaultType?: TransactionType) => void;
  dismiss: () => void;
};

type Props = { onClose?: () => void };

function toDefaults(category: CategoryItem | null, defaultType: TransactionType): CategoryFormValues {
  if (!category) {
    return { name: '', icon: 'Tag', type: defaultType, subcategories: ['기타'] };
  }
  return {
    name: category.name,
    icon: category.icon,
    type: category.type,
    subcategories: category.subcategories.length ? category.subcategories : ['기타'],
  };
}

export const CategoryDrawer = forwardRef<CategoryDrawerRef, Props>(function CategoryDrawer(
  { onClose },
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  // The drawer owns "which category" (set at present time) — a fresh add always opens blank.
  const [category, setCategory] = useState<CategoryItem | null>(null);

  const addCategory = useLedgerStore((s) => s.addCategory);
  const updateCategory = useLedgerStore((s) => s.updateCategory);
  const deleteCategory = useLedgerStore((s) => s.deleteCategory);
  const confirm = useConfirm();

  const isEdit = category != null;
  const [subInput, setSubInput] = useState('');
  const { control, handleSubmit, reset } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: toDefaults(null, '지출'),
  });

  useImperativeHandle(ref, () => ({
    present: (cat = null, defaultType = '지출') => {
      setCategory(cat);
      // Reset on every open (form + subcategory input) so a fresh add never carries over prior data.
      reset(toDefaults(cat, defaultType));
      setSubInput('');
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const onSubmit = useCallback(
    (values: CategoryFormValues) => {
      const subcategories = values.subcategories.length ? values.subcategories : ['기타'];
      if (isEdit && category) {
        updateCategory(category.id, { ...values, subcategories });
      } else {
        addCategory({ ...values, subcategories });
      }
      sheetRef.current?.dismiss();
    },
    [isEdit, category, updateCategory, addCategory],
  );

  const onDelete = useCallback(async () => {
    if (!category) return;
    const ok = await confirm({
      title: '이 카테고리를 삭제할까요?',
      message: '이미 기록된 내역은 그대로 남아요.',
    });
    if (!ok) return;
    deleteCategory(category.id);
    sheetRef.current?.dismiss();
  }, [category, deleteCategory, confirm]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.35} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['90%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: Palette.paper }}
      handleIndicatorStyle={{ backgroundColor: Palette.line }}
      onDismiss={onClose}>
      <BottomSheetScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text className="mb-6 text-2xl text-ink font-serif">
          {isEdit ? '카테고리 수정' : '새 카테고리'}
        </Text>

        {/* Name */}
        <Field label="이름">
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <SheetTextInput
                value={field.value}
                onChangeText={field.onChange}
                placeholder="예: 식비, 급여"
                placeholderTextColor={Palette.muted}
                className="rounded-2xl bg-fill px-4 py-3 text-base text-ink font-sans"
              />
            )}
          />
        </Field>

        {/* Type */}
        <Field label="종류">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <View className="flex-row gap-2">
                {TYPES.map((t) => {
                  const active = field.value === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => field.onChange(t)}
                      className={`flex-1 items-center rounded-full py-2.5 ${active ? 'bg-ink' : 'bg-fill'}`}>
                      <Text
                        className={`text-sm font-sans-semibold ${active ? 'text-paper' : 'text-muted'}`}>
                        {t}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        </Field>

        {/* Icon */}
        <Field label="아이콘">
          <Controller
            control={control}
            name="icon"
            render={({ field }) => (
              <View className="flex-row flex-wrap gap-2">
                {PICKABLE_ICONS.map((name) => {
                  const active = field.value === name;
                  return (
                    <Pressable
                      key={name}
                      onPress={() => field.onChange(name)}
                      hitSlop={2}
                      className={`h-12 w-12 items-center justify-center rounded-2xl ${active ? 'bg-ink' : 'bg-fill'} active:opacity-70`}>
                      <CategoryIcon
                        name={name}
                        size={20}
                        color={active ? Palette.paper : Palette.ink}
                      />
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        </Field>

        {/* Subcategories */}
        <Field label="소분류">
          <Controller
            control={control}
            name="subcategories"
            render={({ field }) => {
              const addSub = () => {
                const value = subInput.trim();
                if (!value || field.value.includes(value)) {
                  setSubInput('');
                  return;
                }
                field.onChange([...field.value, value]);
                setSubInput('');
              };
              return (
                <>
                  {field.value.length > 0 && (
                    <View className="mb-2 flex-row flex-wrap gap-2">
                      {field.value.map((sub, i) => (
                        <Pressable
                          key={`${sub}-${i}`}
                          onPress={() => field.onChange(field.value.filter((_, j) => j !== i))}
                          className="flex-row items-center gap-1 rounded-full bg-fill px-3 py-1.5 active:opacity-60">
                          <Text className="text-sm text-ink font-sans-medium">{sub}</Text>
                          <X size={13} color={Palette.muted} strokeWidth={2.5} />
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <View className="flex-row items-center gap-2">
                    <SheetTextInput
                      value={subInput}
                      onChangeText={setSubInput}
                      onSubmitEditing={addSub}
                      placeholder="소분류 추가"
                      placeholderTextColor={Palette.muted}
                      returnKeyType="done"
                      className="flex-1 rounded-2xl bg-fill px-4 py-3 text-base text-ink font-sans"
                    />
                    <Pressable
                      onPress={addSub}
                      className="h-11 w-11 items-center justify-center rounded-2xl bg-ink active:opacity-80">
                      <Plus size={18} color={Palette.paper} />
                    </Pressable>
                  </View>
                </>
              );
            }}
          />
        </Field>

        {/* Actions */}
        <Pressable
          onPress={handleSubmit(onSubmit)}
          className="mt-4 items-center rounded-full bg-ink py-4 active:opacity-80">
          <Text className="text-base text-paper font-sans-bold">
            {isEdit ? '수정 완료' : '추가'}
          </Text>
        </Pressable>

        {isEdit && (
          <Pressable
            onPress={onDelete}
            className="mt-3 flex-row items-center justify-center gap-1.5 py-2 active:opacity-60">
            <Trash2 size={15} color={Palette.expense} />
            <Text className="text-sm text-expense font-sans-medium">삭제</Text>
          </Pressable>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-[11px] uppercase tracking-wider text-muted font-sans-semibold">
        {label}
      </Text>
      {children}
    </View>
  );
}
