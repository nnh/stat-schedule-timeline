// GAS API に依存しないロジック
// ※ GAS では関数名末尾が "_" の関数はプライベート扱いになるため、公開不要な関数には "_" を付けている
import {NO_BACKGROUND} from './constants';

/**
 * 試験名のセルに付ける色を決める。
 * - 試験名が空欄、または既に色が付いている（白以外）セルは変えない（null を返す）
 * - それ以外は行番号に応じてパレットから順番に選ぶ（隣り合う行は別の色になる）
 */
export function pickTrialColor_(
  row: number,
  name: string,
  currentBackground: string,
  palette: string[],
): string | null {
  if (name === '' || currentBackground.toLowerCase() !== NO_BACKGROUND) {
    return null;
  }
  return palette[(row - 2) % palette.length];
}
