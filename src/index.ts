/* eslint-disable @typescript-eslint/no-unused-vars */
// エントリポイント（トリガー関数・メニューから呼ぶ関数）
import {colorTrialNamesOnEdit_, setupSheets_} from './sheet-service';

/**
 * スプレッドシートを開いたときにメニューを追加する（シンプルトリガー）。
 */
function onOpen(): void {
  SpreadsheetApp.getUi()
    .createMenu('初期設定')
    .addItem('初期設定を実行', 'setupSheets')
    .addToUi();
}

/**
 * セルを編集したときに、試験一覧の試験名に淡い色を付ける（シンプルトリガー）。
 */
function onEdit(e: GoogleAppsScript.Events.SheetsOnEdit): void {
  colorTrialNamesOnEdit_(e);
}

/**
 * メニュー「初期設定」: シートの作成と書式・数式の設定を行う。
 */
function setupSheets(): void {
  setupSheets_();
}
