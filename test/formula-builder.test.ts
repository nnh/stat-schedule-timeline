import {
  buildCardsFormula_,
  buildMissingStartCondition_,
  buildTimelineEndFormula_,
  buildTimelineStartFormula_,
  buildTrialInfoFormula_,
} from '../src/formula-builder';

describe('buildTrialInfoFormula_', () => {
  it('Stat の取り込み・Datacenter の left join・追跡終了→登録終了の昇順ソートを1つの数式で行う', () => {
    expect(buildTrialInfoFormula_('https://example.com/x')).toBe(
      '=LET(' +
        'stat,QUERY(IMPORTRANGE("https://example.com/x","Stat!A2:Q"),' +
        '"select Col1, Col3, Col6, Col14, Col16, Col17 where Col1 is not null and ' +
        "(Col14 is null or not (Col14 = 'Completed' or Col14 = 'Stop' or Col14 = 'No Support'))\",0)," +
        'joined,ARRAYFORMULA(IFERROR(VLOOKUP(INDEX(stat,0,1),' +
        'IMPORTRANGE("https://example.com/x","Datacenter!A:W"),{20,21,22,23},FALSE),"")),' +
        'VSTACK({"プロトコルID","試験名","研究種別","状態","FPI","LPO",' +
        '"登録開始","登録終了","中間用データ固定","追跡終了"},' +
        'SORT(HSTACK(stat,joined),10,TRUE,8,TRUE)))',
    );
  });
  it('URL 内のダブルクォートをエスケープする', () => {
    expect(buildTrialInfoFormula_('a"b')).toContain('IMPORTRANGE("a""b"');
  });
});

describe('試験一覧の自動計算の列', () => {
  it('タイムライン開始は開始日（空欄なら今日）。試験名が空欄・非表示なら空欄', () => {
    expect(buildTimelineStartFormula_()).toBe(
      '=ARRAYFORMULA(IF((A2:A="")+(B2:B="非表示"),"",IF(D2:D="",TODAY(),D2:D)))',
    );
  });
  it('タイムライン終了は終了日を優先し、空欄なら開始日の4か月後（開始日も空欄ならタイムライン開始と同じ）', () => {
    expect(buildTimelineEndFormula_()).toBe(
      '=ARRAYFORMULA(IF(F2:F="","",IF(E2:E<>"",E2:E,IF(D2:D="",F2:F,EDATE(D2:D,4)))))',
    );
  });
  it('試験名があり非表示でなく開始日が空欄のときに真になる条件', () => {
    expect(buildMissingStartCondition_()).toBe(
      '=AND($A2<>"",$B2<>"非表示",$D2="")',
    );
  });
});

describe('buildCardsFormula_', () => {
  it('試験一覧を試験名・種別・開始日・終了日・備考に正規化し、試験のバーとデータロックポイントの1日カードを試験一覧の行の順に並べる', () => {
    expect(buildCardsFormula_()).toBe(
      '=IFNA(VSTACK({"試験名","種別","開始日","終了日","備考"},ARRAYFORMULA(LET(' +
        "r,ROW('試験一覧'!A2:A)," +
        "bars,HSTACK(r,IF(r,2),IF(r,\"\"),'試験一覧'!A2:A,'試験一覧'!F2:F,'試験一覧'!G2:G," +
        "IF('試験一覧'!D2:D=\"\",\"（スケジュール未定）\"&'試験一覧'!H2:H,'試験一覧'!H2:H))," +
        'd,IF((\'試験一覧\'!F2:F="")+(\'試験一覧\'!C2:C=""),"",\'試験一覧\'!C2:C),' +
        'dlps,HSTACK(r,IF(r,1),IF(r,"★DLP"),\'試験一覧\'!A2:A,d,d,IF(r,"")),' +
        'all,VSTACK(bars,dlps),' +
        'IFERROR(CHOOSECOLS(SORT(FILTER(all,INDEX(all,0,5)<>""),1,TRUE,2,TRUE),4,3,5,6,7),"")))),"")',
    );
  });
});
