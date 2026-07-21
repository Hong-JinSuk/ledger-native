import { useRouter } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/palette';
import { useSearchStore } from '@/store/search-store';

/**
 * 모바일/좁은 화면 검색바. 웹 ⌘K 오버레이(칩·AND/OR·⌘Enter)와 달리 단순하게 — 단어를 치고 Enter면 바로 검색.
 * (모바일에선 Enter와 ⌘Enter를 구분할 수 없어 연산자/칩 기능을 끈다.) 헤더 검색 아이콘을 탭하면 화면 위에서
 * 내려오고, 결과는 웹과 같은 /search 페이지로 보낸다. 공백은 AND(둘 다 포함) — 보통은 단어 하나를 친다.
 */
export function MobileSearchBar({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const slide = useRef(new Animated.Value(0)).current;

  // 위에서 살짝 내려오며 페이드 인 (감성 톤).
  useEffect(() => {
    if (!visible) return;
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  if (!visible) return null;

  const submit = () => {
    const terms = query.trim().split(/\s+/).filter(Boolean); // 공백 = AND. 보통 단어 하나.
    onClose();
    setQuery('');
    if (!terms.length) return;
    // 웹과 동일한 저장 구조: OR-of-AND 그룹 1개 + 라벨(| 로 구분). 결과는 /search가 소비.
    useSearchStore.getState().setQuery([terms], terms.join(' | '));
    router.push('/search');
  };

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* 배경 dim 없음 — 뒤 화면 그대로(가장 밝음). 배경색이 없어도 이 전체화면 Pressable이 바깥 탭을 잡아 닫는다. */}
      <Pressable onPress={onClose} className="flex-1">
        <SafeAreaView edges={['top']}>
          <Animated.View
            style={{ opacity: slide, transform: [{ translateY }] }}
          >
            {/* 내부 탭은 흡수해 닫히지 않게. */}
            <Pressable
              onPress={() => {}}
              className="mx-3 mt-16 rounded-2xl bg-paper px-4 py-3"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.12,
                shadowRadius: 20,
                elevation: 8,
              }}
            >
              <View className="flex-row items-center gap-3">
                <Search size={20} color={Palette.muted} />
                <TextInput
                  autoFocus
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={submit}
                  returnKeyType="search"
                  placeholder="메모·거래처 검색"
                  placeholderTextColor={Palette.muted}
                  className="flex-1 py-1 text-base text-ink font-sans"
                />
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  className="active:opacity-60"
                >
                  <X size={18} color={Palette.muted} />
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}
