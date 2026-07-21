import { describe, expect, it } from 'vitest';

import {
  appendOp,
  appendOr,
  commitDraft,
  groupsToTokens,
  normalizeTokens,
  popToken,
  removeTokenAt,
  reservedOp,
  toQueryGroups,
  type QueryToken,
} from '@/lib/search/chip-query';

const term = (value: string): QueryToken => ({ kind: 'term', value });
const OR: QueryToken = { kind: 'or' };
const AND: QueryToken = { kind: 'and' };

describe('reservedOp', () => {
  it('recognises and/or case-insensitively, nothing else', () => {
    expect(reservedOp('or')).toBe('or');
    expect(reservedOp('OR')).toBe('or');
    expect(reservedOp(' And ')).toBe('and');
    expect(reservedOp('생활')).toBeNull();
    expect(reservedOp('order')).toBeNull();
  });
});

describe('commitDraft (Enter)', () => {
  it('commits a normal word as a term chip', () => {
    expect(commitDraft([], '  할부 ')).toEqual([term('할부')]);
  });

  it('commits the reserved word "or" as an OR operator (not a term)', () => {
    expect(commitDraft([term('월세')], 'or')).toEqual([term('월세'), OR]);
  });

  it('commits the reserved word "and" as an AND operator', () => {
    expect(commitDraft([term('할부')], 'AND')).toEqual([term('할부'), AND]);
  });

  it('is a no-op for a blank draft, and an operator can not lead', () => {
    expect(commitDraft([], '   ')).toEqual([]);
    expect(commitDraft([], 'or')).toEqual([]); // no leading operator
  });

  it('adjacent terms are the implicit AND (no operator token needed)', () => {
    expect(commitDraft(commitDraft([], '할부'), '생활')).toEqual([term('할부'), term('생활')]);
  });

  it('rejects a 1-char term (2글자 이상만), leaving tokens unchanged', () => {
    expect(commitDraft([], '가')).toEqual([]);
    expect(commitDraft([term('생활')], 'a')).toEqual([term('생활')]);
  });
});

describe('groupsToTokens (restore overlay from the executed query)', () => {
  it('rebuilds adjacency-AND within a group and OR between groups', () => {
    expect(groupsToTokens([['할부', '생활'], ['월세']])).toEqual([
      term('할부'),
      term('생활'),
      OR,
      term('월세'),
    ]);
  });

  it('round-trips with toQueryGroups', () => {
    const groups = [['해화', '전골'], ['월세']];
    expect(toQueryGroups(groupsToTokens(groups))).toEqual(groups);
  });

  it('empty groups → empty tokens', () => {
    expect(groupsToTokens([])).toEqual([]);
  });
});

describe('appendOp / appendOr', () => {
  it('appendOp only attaches after a term', () => {
    expect(appendOp([term('a')], 'or')).toEqual([term('a'), OR]);
    expect(appendOp([term('a'), OR], 'and')).toEqual([term('a'), OR]); // no consecutive operator
    expect(appendOp([], 'or')).toEqual([]); // no leading operator
  });

  it('OR button commits the draft then adds OR (생활 + OR keeps 생활)', () => {
    expect(appendOr([term('월세')], '생활')).toEqual([term('월세'), term('생활'), OR]);
  });
});

describe('popToken / removeTokenAt', () => {
  it('backspace drops the last chip and cleans a now-trailing operator', () => {
    expect(popToken([term('월세'), OR, term('생활')])).toEqual([term('월세')]);
  });

  it('× on a middle term normalizes the neighbours', () => {
    expect(removeTokenAt([term('할부'), term('생활'), OR, term('월세')], 1)).toEqual([
      term('할부'),
      OR,
      term('월세'),
    ]);
  });
});

describe('normalizeTokens', () => {
  it('drops leading/trailing and collapses consecutive operators (mixed and/or)', () => {
    expect(normalizeTokens([OR, term('a'), OR, AND, term('b'), AND])).toEqual([
      term('a'),
      OR,
      term('b'),
    ]);
  });
});

describe('toQueryGroups (OR-of-AND for the filter)', () => {
  it('adjacent terms → one AND group', () => {
    expect(toQueryGroups([term('할부'), term('생활')])).toEqual([['할부', '생활']]);
  });

  it('explicit AND folds away (same group)', () => {
    expect(toQueryGroups([term('할부'), AND, term('생활')])).toEqual([['할부', '생활']]);
  });

  it('OR → separate groups', () => {
    expect(toQueryGroups([term('월세'), OR, term('생활')])).toEqual([['월세'], ['생활']]);
  });

  it('mixes AND within a group and OR across groups', () => {
    expect(toQueryGroups([term('할부'), AND, term('생활'), OR, term('월세')])).toEqual([
      ['할부', '생활'],
      ['월세'],
    ]);
  });

  it('empty query → no groups', () => {
    expect(toQueryGroups([])).toEqual([]);
  });
});
