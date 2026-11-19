import {
  pickCardColors_,
  pickTrialColor_,
  pickTrialColors_,
} from '../src/schedule-logic';

describe('pickTrialColor_', () => {
  const palette = ['#1', '#2', '#3'];

  it('色が付いていない試験名のセルには、行番号に応じてパレットから順番に色を選ぶ', () => {
    expect(pickTrialColor_(2, 'A', '#ffffff', palette)).toBe('#1');
    expect(pickTrialColor_(3, 'B', '#FFFFFF', palette)).toBe('#2');
    expect(pickTrialColor_(5, 'C', '#ffffff', palette)).toBe('#1');
  });
  it('試験名が空欄、または既に色が付いているセルは変えない', () => {
    expect(pickTrialColor_(2, '', '#ffffff', palette)).toBeNull();
    expect(pickTrialColor_(2, 'A', '#ff0000', palette)).toBeNull();
  });
});

describe('pickCardColors_', () => {
  it('試験のバーは試験一覧の同じ試験名の色（重複時は最初の行）、DLPは共通の色、空の行・該当なしは白にする', () => {
    expect(
      pickCardColors_(
        [
          {name: 'A', type: '★DLP'},
          {name: 'A', type: ''},
          {name: 'B', type: ''},
          {name: 'X', type: ''},
          {name: '', type: ''},
        ],
        ['A', 'B', 'A'],
        ['#aaa', '#bbb', '#ccc'],
        '#red',
      ),
    ).toEqual(['#red', '#aaa', '#bbb', '#ffffff', '#ffffff']);
  });
});

describe('pickTrialColors_', () => {
  const palette = ['#1', '#2', '#3'];

  it('同じ試験名の2つ目以降の行は、既に色が付いていても最初の行の色にそろえる', () => {
    expect(
      pickTrialColors_(
        ['A', 'B', 'A', '', 'A'],
        ['#ffffff', '#ff0000', '#ffffff', '#ffffff', '#00ff00'],
        palette,
      ),
    ).toEqual(['#1', '#ff0000', '#1', '#ffffff', '#1']);
  });
  it('最初の行の色が手動で変えられていれば、その色にそろえる', () => {
    expect(pickTrialColors_(['A', 'A'], ['#abcdef', '#1'], palette)).toEqual([
      '#abcdef',
      '#abcdef',
    ]);
  });
});
