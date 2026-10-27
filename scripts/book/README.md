# 교육과정 책자 → data-src/intl-2026.json

원본: 「2026학년도 교육과정(국제캠퍼스)」 PDF (1,628쪽, 저장소에 넣지 않음)

1. `pdftotext -layout 책자.pdf all.txt` — 쪽마다 글자 레이어 (페이지 구분 \f)
2. `python3 parse_tables.py 책자.pdf rows.json 목차.txt <쪽번호들>` — [별표1] 교육과정 편성표의 학수번호·과목명·학점·이수구분·학년·개설학기를 좌표로 읽음
3. `python3 recategorize.py rows.json rows_fix.json` — 세로로 합쳐진 이수구분 칸(라벨이 그룹 가운데) 다시 계산
4. `python3 prereq.py all.txt rows_fix.json prereq.json` — 선수과목 지정표 ('택1'은 'A|B')
5. `python3 normalize.py rows_fix.json prereq.json ../../data-src/intl-2026.json`
6. 저장소 루트에서 `npm run build:data && npm run validate`

검증: validate가 학과마다 영역별 과목 학점 합이 기본구조표 기준 이상인지 확인하고, 모자라면 해당 과정을 '일부 과목 확인 중'으로 표시한다.

## 서울캠퍼스 (data-src/seoul-2026.json)
원본: 학과별 교육과정 시행세칙 PDF (사용자 '공모전/교육과정파일' 폴더). `pdfunite`로 합친 뒤 위와 같은 순서로 처리하고,
`normalize.py ... map.json "출처"` 로 학과명 매핑을 넘긴다. 의과대학은 HWP를 `hwp5html`로 바꿔 표를 읽었다.
간호학과 HWP 편성표는 학수번호가 없어 넣지 않았다.
