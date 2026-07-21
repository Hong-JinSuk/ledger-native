/**
 * Chip-based search query model + edit logic (web command-bar search).
 *
 * A query is a list of tokens: a keyword `term`, or an `and`/`or` operator. Adjacent terms are an
 * implicit AND; `and`/`or` operators are the ONLY reserved words — typing them commits an operator chip
 * instead of a term. So:
 *   [할부][생활]              → 할부 AND 생활  (adjacency)
 *   [할부] and [생활]         → 할부 AND 생활  (explicit — same result)
 *   [월세] or [생활]          → 월세 OR 생활
 *   [할부][생활] or [월세]     → (할부 AND 생활) OR 월세
 *
 * The overlay edits tokens through these pure helpers; {@link toQueryGroups} turns it into the
 * OR-of-AND structure the filter consumes. Pure + unit-tested so the rules are proven before the UI.
 */
export type QueryToken = { kind: 'term'; value: string } | { kind: 'and' } | { kind: 'or' };

/** The only reserved words. Typing one (case-insensitive) inserts an operator, not a term. */
export function reservedOp(word: string): 'and' | 'or' | null {
  const w = word.trim().toLowerCase();
  return w === 'and' ? 'and' : w === 'or' ? 'or' : null;
}

/** Append an operator — only after a term (blocks a leading or consecutive operator). */
export function appendOp(tokens: QueryToken[], kind: 'and' | 'or'): QueryToken[] {
  const last = tokens[tokens.length - 1];
  if (!last || last.kind !== 'term') return tokens;
  return [...tokens, { kind }];
}

/** 검색어 최소 길이. 1글자는 너무 광범위해 막는다 — 2글자 이상만 term 칩이 된다. */
export const MIN_TERM_LEN = 2;

/**
 * Commit the current input on Enter: a reserved word (and/or) becomes an operator chip, anything else a
 * term chip. Blank/1글자 ⇒ no-op(칩 안 생김). (Space no longer commits — the UI only calls this on Enter.)
 */
export function commitDraft(tokens: QueryToken[], draft: string): QueryToken[] {
  const op = reservedOp(draft);
  if (op) return appendOp(tokens, op);
  const value = draft.trim();
  if (value.length < MIN_TERM_LEN) return tokens; // 1글자 이하는 칩으로 확정하지 않는다
  return [...tokens, { kind: 'term', value }];
}

/** OR button: commit the draft first, then add OR. */
export function appendOr(tokens: QueryToken[], draft: string): QueryToken[] {
  return appendOp(commitDraft(tokens, draft), 'or');
}

/** Backspace on an empty input: drop the last token, then normalize (clean a now-trailing operator). */
export function popToken(tokens: QueryToken[]): QueryToken[] {
  return normalizeTokens(tokens.slice(0, -1));
}

/** Remove the token at `index` (× on a chip), then normalize. */
export function removeTokenAt(tokens: QueryToken[], index: number): QueryToken[] {
  return normalizeTokens(tokens.filter((_, i) => i !== index));
}

/**
 * Fold to a valid `term (op term)*` shape: drop a leading operator, drop an operator that follows another
 * operator, and drop a trailing operator. Terms pass through. Idempotent.
 */
export function normalizeTokens(tokens: QueryToken[]): QueryToken[] {
  const out: QueryToken[] = [];
  for (const t of tokens) {
    if (t.kind === 'term') {
      out.push(t);
    } else {
      const prev = out[out.length - 1];
      if (prev && prev.kind === 'term') out.push(t); // operator only right after a term
    }
  }
  while (out.length && out[out.length - 1].kind !== 'term') out.pop(); // no trailing operator
  return out;
}

/**
 * Split on OR into AND-groups. Each inner array's terms must ALL match (AND); a record matches if ANY
 * group matches (OR). `and` chips are folded away (adjacency already means AND). Empty ⇒ [].
 *   [할부][생활]           → [['할부','생활']]
 *   [월세] or [생활]        → [['월세'], ['생활']]
 *   [할부] and [생활] or [월세] → [['할부','생활'], ['월세']]
 */
export function toQueryGroups(tokens: QueryToken[]): string[][] {
  const groups: string[][] = [];
  let cur: string[] = [];
  for (const t of normalizeTokens(tokens)) {
    if (t.kind === 'or') {
      if (cur.length) groups.push(cur);
      cur = [];
    } else if (t.kind === 'term') {
      cur.push(t.value);
    }
    // 'and' → folded away: adjacent terms are already AND within the same group.
  }
  if (cur.length) groups.push(cur);
  return groups;
}

/**
 * Serialize tokens to a readable one-line query for the results header. AND terms are joined by " | "
 * (so each keyword reads as its own term, not one phrase); OR groups by " or ".
 *   [해화][전골]            → "해화 | 전골"
 *   [월세] or [생활]         → "월세 or 생활"
 *   [할부][생활] or [월세]    → "할부 | 생활 or 월세"
 */
export function tokensToText(tokens: QueryToken[]): string {
  return toQueryGroups(tokens)
    .map((group) => group.join(' | '))
    .join(' or ');
}

/**
 * Rebuild an editable token list from executed OR-of-AND groups — restores the overlay to the last
 * *searched* query when it reopens. Inverse of {@link toQueryGroups}: adjacency = AND, OR between groups.
 *   [['할부','생활'], ['월세']] → [할부][생활] or [월세]
 */
export function groupsToTokens(groups: string[][]): QueryToken[] {
  const tokens: QueryToken[] = [];
  groups.forEach((group, gi) => {
    if (gi > 0) tokens.push({ kind: 'or' });
    group.forEach((value) => tokens.push({ kind: 'term', value }));
  });
  return tokens;
}
