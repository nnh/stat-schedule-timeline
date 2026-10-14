import {pickTrialColor_} from '../src/schedule-logic';

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
