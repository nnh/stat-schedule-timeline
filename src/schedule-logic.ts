// GAS API に依存しないロジック
// ※ GAS では関数名末尾が "_" の関数はプライベート扱いになるため、公開不要な関数には "_" を付けている
import {CARD_TYPE_DLP, NO_BACKGROUND} from './constants';

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

/**
 * 試験一覧の試験名の列（2行目から）の背景色を決める。
 * - 試験名ごとに最初の行は pickTrialColor_ で決める（色がなければパレットから付け、あればそのまま）
 * - 同じ試験名の2つ目以降の行は、最初の行の色にそろえる（既に色が付いていても上書きする）
 * - 試験名が空欄の行は変えない
 */
export function pickTrialColors_(
  names: string[],
  backgrounds: string[],
  palette: string[],
): string[] {
  const firstColors = new Map<string, string>();
  return names.map((name, i) => {
    if (name === '') {
      return backgrounds[i];
    }
    const first = firstColors.get(name);
    if (first !== undefined) {
      return first;
    }
    const color =
      pickTrialColor_(i + 2, name, backgrounds[i], palette) ?? backgrounds[i];
    firstColors.set(name, color);
    return color;
  });
}

/**
 * タイムライン用データシートの各行の試験名のセルに付ける色を決める（カードの色になる）。
 * - データロックポイントの行は、全試験共通の色
 * - 試験のバーの行は、試験一覧の同じ試験名のセルの色（同じ試験名が複数あれば最初の行）
 * - 該当する試験名がない行（空の行など）は白
 * trialNames・trialBackgrounds は試験一覧の試験名の列の値と背景色（同じ順）。
 */
export function pickCardColors_(
  cards: {name: string; type: string}[],
  trialNames: string[],
  trialBackgrounds: string[],
  dlpColor: string,
): string[] {
  return cards.map(({name, type}) => {
    if (name === '') {
      return NO_BACKGROUND;
    }
    if (type === CARD_TYPE_DLP) {
      return dlpColor;
    }
    const index = trialNames.indexOf(name);
    return index === -1 ? NO_BACKGROUND : trialBackgrounds[index];
  });
}
