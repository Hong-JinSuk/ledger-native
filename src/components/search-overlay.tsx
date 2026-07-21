import { Search, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { Palette } from '@/constants/palette';
import {
  appendOr,
  commitDraft,
  popToken,
  removeTokenAt,
  tokensToText,
  toQueryGroups,
  type QueryToken,
} from '@/lib/search/chip-query';

/**
 * 웹 커맨드바 검색 오버레이 (프로토타입 — 칩 입력까지 동작, 실제 필터/⌘단축키는 다음 단계).
 *
 * 앱 크림 톤 그대로: 배경만 살짝 dim, 패널은 페이퍼. macOS Spotlight의 "큰 중앙 바 + 오른쪽 연산자 버튼"
 * 구조만 차용했다(다크 글래스 X). 입력 규칙은 {@link chip-query}:
 *  - 타이핑 → Enter 또는 띄어쓰기 → 키워드 칩(인접 칩끼리는 AND)
 *  - OR 버튼 → 칩 사이에 OR 삽입
 *  - 빈 입력창에서 ⌫ → 마지막 칩 삭제, 칩 × → 그 칩 삭제
 */
export function SearchOverlay({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  /** ⌘Enter로 검색 실행 — OR-of-AND 그룹 + 사람이 읽을 라벨을 넘긴다(결과 페이지가 소비). */
  onSubmit: (groups: string[][], label: string) => void;
}) {
  const [tokens, setTokens] = useState<QueryToken[]>([]);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<TextInput>(null);
  // draft/tokens의 최신값을 keydown 리스너(클로저)가 읽도록 ref로 미러링.
  const latest = useRef({ draft, tokens, onSubmit });
  latest.current = { draft, tokens, onSubmit };

  // 웹: 한글 IME 대응 keydown 리스너. RN의 onKeyPress는 isComposing을 안 줘서, 조합 확정 Enter가
  // 칩 확정으로 이중 처리됨("검색" Enter → [검색][색]). DOM 이벤트로 isComposing을 직접 보고 조합 중이면 건너뛴다.
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    // web에서 TextInput ref는 실제 <input> DOM 노드. (any: RN 타입엔 addEventListener가 없음 — 웹 전용이라 불가피)
    const node = inputRef.current as any;
    if (!node || typeof node.addEventListener !== 'function') return;
    const onKeyDown = (e: any) => {
      if (e.isComposing || e.keyCode === 229) return; // IME 조합 중 Enter/Backspace는 '조합 확정'이라 무시
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        // ⌘Enter / Ctrl+Enter → 검색 실행: 입력 중 draft까지 확정한 뒤 결과 페이지로 넘긴다.
        e.preventDefault();
        const committed = commitDraft(latest.current.tokens, latest.current.draft);
        const groups = toQueryGroups(committed);
        if (groups.length) latest.current.onSubmit(groups, tokensToText(committed));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        setTokens((t) => commitDraft(t, latest.current.draft)); // 예약어 and/or면 연산자, 아니면 term
        setDraft('');
      } else if (e.key === 'Backspace' && latest.current.draft === '') {
        setTokens((t) => popToken(t)); // 빈 입력창 백스페이스 → 마지막 칩 삭제
      }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [visible]);

  if (!visible) return null;

  const onChangeText = (text: string) => {
    // Space는 더 이상 칩을 만들지 않는다 — IME 조합 중 잘린 자모가 칩이 되던 문제. 칩 확정은 Enter로만.
    setDraft(text);
  };

  const addOr = () => {
    setTokens((t) => appendOr(t, draft));
    setDraft('');
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        className="flex-1 items-center px-5"
        // 배경을 아주 살짝만 어둡게(요청: 밝게). 큰 흰 패널은 그림자로 이미 떠 보인다.
        style={{ backgroundColor: 'rgba(26,26,26,0.1)' }}>
        {/* Inner press absorbs taps so clicking the panel doesn't dismiss. */}
        <Pressable
          onPress={() => {}}
          style={{
            marginTop: 120,
            width: '100%',
            maxWidth: 640,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.14,
            shadowRadius: 28,
            elevation: 12,
          }}
          className="rounded-3xl bg-paper px-5 py-4">
          {/* 검색 행: 돋보기 + [칩들 + draft 입력] + OR 버튼 */}
          <View className="flex-row items-center gap-3">
            <Search size={20} color={Palette.muted} />
            <View className="flex-1 flex-row flex-wrap items-center gap-1.5">
              {tokens.map((t, i) => {
                if (t.kind === 'term') {
                  return (
                    <Pressable
                      key={i}
                      onPress={() => setTokens((cur) => removeTokenAt(cur, i))}
                      className="flex-row items-center gap-1 rounded-full bg-fill px-2.5 py-1 active:opacity-70">
                      <Text className="text-sm text-ink font-sans-medium">{t.value}</Text>
                      <X size={13} color={Palette.muted} />
                    </Pressable>
                  );
                }
                // 연산자 칩: OR은 초록, AND는 은은한 회색.
                const isOr = t.kind === 'or';
                return (
                  <View
                    key={i}
                    className="rounded-full px-2.5 py-1"
                    style={{ backgroundColor: isOr ? Palette.income : Palette.line }}>
                    <Text
                      className={`text-xs font-sans-bold ${isOr ? 'text-paper' : 'text-muted'}`}>
                      {isOr ? 'OR' : 'AND'}
                    </Text>
                  </View>
                );
              })}
              <TextInput
                ref={inputRef}
                value={draft}
                onChangeText={onChangeText}
                autoFocus
                placeholder={tokens.length ? '' : '메모·거래처 검색'}
                placeholderTextColor={Palette.muted}
                className="min-w-[100px] flex-1 py-1.5 text-base text-ink font-sans"
              />
            </View>
            <Pressable
              onPress={addOr}
              className="rounded-full border px-3 py-1.5 active:opacity-70"
              style={{ borderColor: Palette.income }}>
              <Text className="text-xs font-sans-bold" style={{ color: Palette.income }}>
                OR
              </Text>
            </Pressable>
          </View>

          {/* 조작 힌트 — 직관적으로 노출 */}
          <View className="mt-3 flex-row flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-3">
            <Hint keys="Enter" label="칩 확정" />
            <Hint keys="and · or" label="입력 시 연산자" />
            <Hint keys="⌫" label="삭제" />
            <Hint keys="⌘Enter" label="검색" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="rounded-md bg-fill px-1.5 py-0.5">
        <Text className="text-[11px] text-muted font-sans-medium">{keys}</Text>
      </View>
      <Text className="text-[11px] text-muted font-sans">{label}</Text>
    </View>
  );
}
