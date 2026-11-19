// スプレッドシート操作（GAS API に依存する部分）
import {
  AUTO_COLUMNS_PROTECTION_DESCRIPTION,
  CARD_END_COLUMN,
  CARD_HEADERS,
  CARD_NAME_COLUMN,
  CARD_SHEET_NAME,
  CARD_START_COLUMN,
  CARD_TYPE_COLUMN,
  DATE_FORMAT,
  DLP_COLOR,
  END_DATE_HELP_TEXT,
  MISSING_START_BACKGROUND,
  README_SHEET_NAME,
  README_URL,
  RESEARCH_SYSTEM_URL_DUMMY,
  RESEARCH_SYSTEM_URL_PROPERTY,
  TRIAL_COLORS,
  TRIAL_DLP_COLUMN,
  TRIAL_TIMELINE_END_COLUMN,
  TRIAL_TIMELINE_START_COLUMN,
  TRIAL_END_COLUMN,
  TRIAL_INFO_DATE_FIRST_COLUMN,
  TRIAL_INFO_DATE_LAST_COLUMN,
  TRIAL_INFO_SHEET_NAME,
  TRIAL_MASTER_HEADERS,
  TRIAL_MASTER_SHEET_NAME,
  TRIAL_NAME_COLUMN,
  TRIAL_START_COLUMN,
  TRIAL_VISIBILITY_COLUMN,
  VISIBILITY_HIDDEN,
} from './constants';
import {
  buildCardsFormula_,
  buildMissingStartCondition_,
  buildTimelineEndFormula_,
  buildTimelineStartFormula_,
  buildTrialInfoFormula_,
} from './formula-builder';
import {pickCardColors_, pickTrialColors_} from './schedule-logic';

type Sheet = GoogleAppsScript.Spreadsheet.Sheet;
type Spreadsheet = GoogleAppsScript.Spreadsheet.Spreadsheet;

// ---- 共通 ----

/**
 * 指定名のシートを取得する。存在しなければ作成する。
 */
function getOrCreateSheet_(ss: Spreadsheet, name: string): Sheet {
  return ss.getSheetByName(name) ?? ss.insertSheet(name);
}

/**
 * ヘッダー行を除いた、指定列（から width 列分）の最終行までの範囲を返す（入力規則・書式の設定用）。
 */
function getColumnBody_(sheet: Sheet, column: number, width = 1) {
  return sheet.getRange(2, column, sheet.getMaxRows() - 1, width);
}

// ---- 初期設定 ----

/**
 * 研究管理システムのURLをスクリプトプロパティから取得する。
 * 未設定ならダミー値を設定して返す（設定すべきプロパティがエディタ上で分かるようにするため）。
 */
function getResearchSystemUrl_(): string {
  const properties = PropertiesService.getScriptProperties();
  const url = properties.getProperty(RESEARCH_SYSTEM_URL_PROPERTY);
  if (url) {
    return url;
  }
  properties.setProperty(
    RESEARCH_SYSTEM_URL_PROPERTY,
    RESEARCH_SYSTEM_URL_DUMMY,
  );
  return RESEARCH_SYSTEM_URL_DUMMY;
}

/**
 * 試験情報マスタシートに、研究管理システムから取り込む数式を書き込む。
 * URL がダミー値のままなら書き込まずに設定を促す。
 */
function setupTrialInfoSheet_(ss: Spreadsheet): Sheet {
  const sheet = getOrCreateSheet_(ss, TRIAL_INFO_SHEET_NAME);
  const url = getResearchSystemUrl_();
  if (url === RESEARCH_SYSTEM_URL_DUMMY) {
    SpreadsheetApp.getUi().alert(
      `スクリプトプロパティ「${RESEARCH_SYSTEM_URL_PROPERTY}」に研究管理システムのURLを設定してから、もう一度「初期設定」を実行してください。`,
    );
    return sheet;
  }
  // QUERY の結果が展開される範囲に値が残っているとエラーになるため、シートを空にしてから書き込む
  sheet.clearContents();
  // Stat シートの取り込み・Datacenter シートの結合・並べ替えを1つの数式で行う
  sheet.getRange('A1').setFormula(buildTrialInfoFormula_(url));
  sheet.setFrozenRows(1);
  // FPI〜追跡終了の列を日付表示にする
  getColumnBody_(
    sheet,
    TRIAL_INFO_DATE_FIRST_COLUMN,
    TRIAL_INFO_DATE_LAST_COLUMN - TRIAL_INFO_DATE_FIRST_COLUMN + 1,
  ).setNumberFormat(DATE_FORMAT);
  return sheet;
}

/**
 * README へのリンクを置いたシートを、一番左に作成する。
 */
function setupReadmeSheet_(ss: Spreadsheet): void {
  const sheet = getOrCreateSheet_(ss, README_SHEET_NAME);
  sheet
    .getRange('A1')
    .setFormula(`=HYPERLINK("${README_URL}","README（使い方）")`);
  // 一番左に移動する（moveActiveSheet はアクティブなシートを動かすため、先にアクティブにする）
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1);
}

/**
 * 数式で自動計算する範囲に、編集しようとすると警告を表示する保護をかける（編集自体は可能）。
 * 初期設定を再実行しても重複しないよう、そのシートで以前にかけた同じ保護は外してからかけ直す。
 */
function protectAutoRange_(range: GoogleAppsScript.Spreadsheet.Range): void {
  range
    .getSheet()
    .getProtections(SpreadsheetApp.ProtectionType.RANGE)
    .filter(
      protection =>
        protection.getDescription() === AUTO_COLUMNS_PROTECTION_DESCRIPTION,
    )
    .forEach(protection => protection.remove());
  range
    .protect()
    .setDescription(AUTO_COLUMNS_PROTECTION_DESCRIPTION)
    .setWarningOnly(true);
}

/**
 * 試験名があり非表示でないのに開始日が空欄のとき、開始日のセルに色を付ける条件付き書式を設定する。
 * 初期設定を再実行しても重複しないよう、同じ数式の既存ルールは置き換える。
 */
function highlightMissingStart_(sheet: Sheet): void {
  const condition = buildMissingStartCondition_();
  const rules = sheet
    .getConditionalFormatRules()
    .filter(
      rule => rule.getBooleanCondition()?.getCriteriaValues()[0] !== condition,
    );
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(condition)
      .setBackground(MISSING_START_BACKGROUND)
      .setRanges([getColumnBody_(sheet, TRIAL_START_COLUMN)])
      .build(),
  );
  sheet.setConditionalFormatRules(rules);
}

/**
 * 試験一覧シートを作成し、ヘッダー・入力規則・自動計算の列（タイムライン開始・終了）の数式を設定する。
 * 既に入力されたデータは上書きしない（ヘッダーと自動計算の列の数式は設定し直す）。
 */
function setupTrialSheet_(ss: Spreadsheet, trialInfo: Sheet): Sheet {
  const sheet = getOrCreateSheet_(ss, TRIAL_MASTER_SHEET_NAME);
  sheet
    .getRange(1, 1, 1, TRIAL_MASTER_HEADERS.length)
    .setValues([TRIAL_MASTER_HEADERS])
    .setFontWeight('bold');
  sheet.setFrozenRows(1);

  // 試験名は試験情報マスタのプロトコルIDを候補に出す（マスタにない値も入力できる）
  getColumnBody_(sheet, TRIAL_NAME_COLUMN).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInRange(trialInfo.getRange('A2:A'), true)
      .setAllowInvalid(true)
      .build(),
  );
  // 表示状態は非表示にしたいときだけ選ぶ（空欄なら表示）
  getColumnBody_(sheet, TRIAL_VISIBILITY_COLUMN).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList([VISIBILITY_HIDDEN])
      .setAllowInvalid(false)
      .build(),
  );
  // データロックポイント・開始日・終了日は手入力の日付
  getColumnBody_(sheet, TRIAL_DLP_COLUMN)
    .setNumberFormat(DATE_FORMAT)
    .setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireDate()
        .setAllowInvalid(false)
        .build(),
    );
  getColumnBody_(sheet, TRIAL_START_COLUMN)
    .setNumberFormat(DATE_FORMAT)
    .setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireDate()
        .setAllowInvalid(false)
        .build(),
    );
  // 終了日は任意入力。セルを選んだときに、空欄のときの扱いを説明として表示する
  getColumnBody_(sheet, TRIAL_END_COLUMN)
    .setNumberFormat(DATE_FORMAT)
    .setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireDate()
        .setAllowInvalid(false)
        .setHelpText(END_DATE_HELP_TEXT)
        .build(),
    );
  getColumnBody_(
    sheet,
    TRIAL_TIMELINE_START_COLUMN,
    TRIAL_TIMELINE_END_COLUMN - TRIAL_TIMELINE_START_COLUMN + 1,
  ).setNumberFormat(DATE_FORMAT);

  // タイムライン開始・終了は数式で自動計算する（ARRAYFORMULA が下に展開されるよう、2行目以降は空にしてから書き込む）
  const autoBody = getColumnBody_(
    sheet,
    TRIAL_TIMELINE_START_COLUMN,
    TRIAL_TIMELINE_END_COLUMN - TRIAL_TIMELINE_START_COLUMN + 1,
  );
  autoBody.clearContent();
  sheet
    .getRange(2, TRIAL_TIMELINE_START_COLUMN)
    .setFormula(buildTimelineStartFormula_());
  sheet
    .getRange(2, TRIAL_TIMELINE_END_COLUMN)
    .setFormula(buildTimelineEndFormula_());
  protectAutoRange_(
    sheet.getRange(
      1,
      TRIAL_TIMELINE_START_COLUMN,
      sheet.getMaxRows(),
      TRIAL_TIMELINE_END_COLUMN - TRIAL_TIMELINE_START_COLUMN + 1,
    ),
  );

  // 自動計算の列（タイムライン開始・終了）は普段見る必要がないので、列ごと非表示にする
  sheet.hideColumns(
    TRIAL_TIMELINE_START_COLUMN,
    TRIAL_TIMELINE_END_COLUMN - TRIAL_TIMELINE_START_COLUMN + 1,
  );

  // 開始日が未入力の試験を目立たせる
  highlightMissingStart_(sheet);

  // 既に入力済みの試験名にも色を付ける
  colorTrialNames_(sheet);
  return sheet;
}

/**
 * タイムライン用データシートを作成し、試験一覧を正規化する数式を A1 に書き込む（タイムライン表示の元データ）。
 */
function setupCardSheet_(ss: Spreadsheet): Sheet {
  const sheet = getOrCreateSheet_(ss, CARD_SHEET_NAME);
  // 数式の結果が展開される範囲に値が残っているとエラーになるため、シートを空にしてから書き込む
  sheet.clearContents();
  sheet.getRange(1, 1).setFormula(buildCardsFormula_());
  sheet.getRange(1, 1, 1, CARD_HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  getColumnBody_(
    sheet,
    CARD_START_COLUMN,
    CARD_END_COLUMN - CARD_START_COLUMN + 1,
  ).setNumberFormat(DATE_FORMAT);
  protectAutoRange_(
    sheet.getRange(1, 1, sheet.getMaxRows(), CARD_HEADERS.length),
  );
  return sheet;
}

/**
 * README・試験情報マスタ・試験一覧・タイムライン用データの各シートを作成し、書式と数式を設定する。
 */
export function setupSheets_(): void {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // 日付計算がずれないよう、スクリプトと同じタイムゾーンに揃える
  ss.setSpreadsheetTimeZone('Asia/Tokyo');

  setupReadmeSheet_(ss);
  const trialInfo = setupTrialInfoSheet_(ss);
  const trialSheet = setupTrialSheet_(ss, trialInfo);
  const cardSheet = setupCardSheet_(ss);
  syncCardColors_(trialSheet, cardSheet);
}

// ---- 編集時の処理 ----

/**
 * 試験名のセルに淡い色を付ける（タイムラインのバーの色になる）。
 * - 試験名ごとに最初の行は、まだ色が付いていなければ色を付ける（手動で変えた色を含め、既にある色は変えない）
 * - 同じ試験名の2つ目以降の行は、最初の行の色にそろえる
 * 同じ試験名が離れた行にもありうるため、編集した範囲だけでなく列全体を見る。
 */
function colorTrialNames_(sheet: Sheet): void {
  const range = getColumnBody_(sheet, TRIAL_NAME_COLUMN);
  const names = range.getValues().map(row => String(row[0]));
  const backgrounds = range.getBackgrounds().map(row => row[0]);
  const next = pickTrialColors_(names, backgrounds, TRIAL_COLORS);
  // 変更があるときだけまとめて書き込む
  if (next.some((color, i) => color !== backgrounds[i])) {
    range.setBackgrounds(next.map(color => [color]));
  }
}

/**
 * タイムライン用データシートの試験名のセルに色を付ける（タイムラインのカードの色になる）。
 * 試験のバーは試験一覧の試験名のセルの色、データロックポイントは共通の色にする。
 */
function syncCardColors_(trialSheet: Sheet, cardSheet: Sheet): void {
  // 編集内容を数式に反映させてから読む
  SpreadsheetApp.flush();
  const trialRange = trialSheet.getRange(
    2,
    TRIAL_NAME_COLUMN,
    trialSheet.getMaxRows() - 1,
    1,
  );
  const trialNames = trialRange.getValues().map(row => String(row[0]));
  const trialBackgrounds = trialRange.getBackgrounds().map(row => row[0]);
  const numRows = cardSheet.getMaxRows() - 1;
  // 試験名と種別の列を読む（隣り合っている前提で、まとめて取得する）
  const cards = cardSheet
    .getRange(2, CARD_NAME_COLUMN, numRows, CARD_TYPE_COLUMN)
    .getValues()
    .map(row => ({
      name: String(row[CARD_NAME_COLUMN - 1]),
      type: String(row[CARD_TYPE_COLUMN - 1]),
    }));
  const colors = pickCardColors_(
    cards,
    trialNames,
    trialBackgrounds,
    DLP_COLOR,
  );
  cardSheet
    .getRange(2, CARD_NAME_COLUMN, numRows, 1)
    .setBackgrounds(colors.map(color => [color]));
}

/**
 * 試験一覧が編集されたとき、試験名のセルに淡い色を付け、タイムラインのカードの色を付け直す。
 */
export function colorTrialNamesOnEdit_(
  e: GoogleAppsScript.Events.SheetsOnEdit,
): void {
  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== TRIAL_MASTER_SHEET_NAME) {
    return;
  }
  // 見出し行だけの編集は対象外
  if (range.getLastRow() < 2) {
    return;
  }
  // 最初の行の色を手動で変えた場合も、次の編集で同じ試験名の行にそろうよう、どの列の編集でも色を付け直す
  colorTrialNames_(sheet);
  // どの列の編集でもタイムライン用データシートの行の並びが変わりうるため、カードの色を付け直す
  const cardSheet = sheet.getParent().getSheetByName(CARD_SHEET_NAME);
  if (cardSheet) {
    syncCardColors_(sheet, cardSheet);
  }
}
