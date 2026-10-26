"""
회귀 테스트용 가상 졸업사정표 PDF 생성기.
실제 사정표와 같은 배치(상단 요건 표, 왼쪽 교양·오른쪽 전공 2단, 병합 셀 이수구분, 금학기 구역)와
같은 한글 글꼴 인코딩(UniKS-UCS2-H)을 쓴다. 모든 값은 가상이다.

실행: python3 scripts/fixtures/make_reports.py  → src/test-fixtures/*.pdf, *.expected.json
"""
import json
import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

pdfmetrics.registerFont(UnicodeCIDFont('HYSMyeongJo-Medium'))
FONT = 'HYSMyeongJo-Medium'
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'test-fixtures')
NOW_TERM = '2026-2'

CODE_OF = {'전공기초': '11', '전공필수': '04', '전공선택': '05', '교양필수': '16', '배분이수': '15', '자유이수': '17', '일반선택': '08'}
MAJOR = ['전공기초', '전공필수', '전공선택']
LIBERAL_HEADER = {'교양필수': '필수교과', '배분이수': '배분이수', '자유이수': '자유이수', '일반선택': '일반선택'}


def course(code, name, credit, term, cat):
    return {'code': code, 'name': name, 'credit': credit, 'term': term, 'cat': cat}


class Writer:
    def __init__(self, path):
        self.c = canvas.Canvas(path, pagesize=A4)
        self.c.setFont(FONT, 7)
        self.page = 1

    def t(self, x, y, s):
        self.c.drawString(x, y, str(s))

    def new_page(self):
        self.c.showPage()
        self.c.setFont(FONT, 7)
        self.page += 1

    def save(self):
        self.c.save()


def build(spec):
    name = spec['name']
    courses = spec['courses']
    taken = [c for c in courses if c['term'] != NOW_TERM]
    ip = [c for c in courses if c['term'] == NOW_TERM]
    w = Writer(os.path.join(OUT, f'{name}.pdf'))

    # 머리 (학생 정보: 개인정보 제거 대상)
    w.t(22, 815, f"학번 {spec['admission']}000123 성명 가상학생 {spec['college']} {spec['dept']} 주전공")
    w.t(22, 768, '자료생성일시')
    w.t(146, 768, '2026/09/28 17:58:46')
    w.t(420, 768, '사정처리')
    w.t(480, 768, '2026/10/25 02:24:50')

    # 상단 요건 표
    for x, s in [(22, '졸업판정'), (350, '한국어능력인증'), (412, '졸업능력인증'), (490, 'SW인증')]:
        w.t(x, 757, s)
    for x, s in [(31, '구분'), (62, '수강학점'), (103, '취득학점'), (151, '전공'), (193, '교양'), (228, '졸업평점'),
                 (270, '영어강의'), (319, '논문'), (369, 'TOPIK'), (424, '구분'), (463, '판정'), (500, '구분'), (539, '판정')]:
        w.t(x, 745, s)
    req = spec['top']
    taken_sum = sum(c['credit'] for c in taken)
    ip_sum = sum(c['credit'] for c in ip)
    for x, s in [(31, '기준'), (73, 0), (110, spec['grad_required']), (156, 0), (198, 0), (237, '1.7'), (282, 3), (324, 1),
                 (365, '해당없음'), (420, '토익'), (463, req['exit_required']), (490, '필수+선택'), (544, req['sw_required'])]:
        w.t(x, 734, s)
    for x, s in [(31, '취득'), (71, ip_sum), (106, f'{taken_sum}({taken_sum + ip_sum})'), (156, 0), (198, 0), (233, req['gpa']),
                 (280, req['english']), (324, req['thesis']), (414, req['exit_kind']), (463, req['exit']), (500, '필수'), (542, req['sw'])]:
        w.t(x, 723, s)

    # 영역별 소계 (영역 취득에는 이번 학기 수강분 포함)
    sums = {cat: sum(c['credit'] for c in courses if c['cat'] == cat) for cat in CODE_OF}
    lib = spec['liberal_required']
    w.t(22, 690, '교양영역 (2024~)')
    w.t(22, 680, f"필수교과 1 / 1 {sums['교양필수']} / {lib['교양필수']} 충족")
    w.t(22, 670, f"배분이수교과(2024~) 2 / 3 {sums['배분이수']} / {lib['배분이수']}")
    w.t(300, 670, f"자유이수 1 / 1 {sums['자유이수']} / {lib['자유이수']}")

    # 과목 영역 머리글
    for x in (55, 297):
        w.t(x, 600, '학수번호')
        w.t(x + 50, 600, '과목명')
        w.t(x + 140, 600, '학점')

    # 왼쪽: 교양 (머리글 묶음, 01·02는 영역 번호)
    y = 590
    left_cats = ['교양필수', '배분이수', '자유이수', '일반선택']
    for cat in left_cats:
        rows = [c for c in courses if c['cat'] == cat]
        if not rows:
            continue
        w.t(10, y, LIBERAL_HEADER[cat])
        for i, c in enumerate(rows):
            w.t(28, y - 8, f'0{1 + i % 2}')
            w.t(55, y - 8, c['code'])
            w.t(105, y - 8, c['name'])
            w.t(195, y - 8, c['credit'])
            w.t(215, y - 8, c['term'].replace('-', ' / '))
            y -= 9
        y -= 10

    # 오른쪽: 전공 (이수구분 코드는 묶음 첫 행에만 = 병합 셀)
    ry = 590
    page_break_after = spec.get('right_page_break_after')  # 오른쪽 단 n번째 과목 뒤 다음 쪽
    right_rows = [c for cat in MAJOR for c in courses if c['cat'] == cat]
    count = 0
    pending_page = False
    for cat in MAJOR:
        rows = [c for c in courses if c['cat'] == cat]
        for i, c in enumerate(rows):
            if pending_page:
                break
            if i == 0 or (count == page_break_after):
                w.t(251, ry, CODE_OF[cat])
            w.t(297, ry, c['code'])
            w.t(340, ry, c['name'])
            w.t(435, ry, c['credit'])
            w.t(455, ry, c['term'].replace('-', ' / '))
            ry -= 8
            count += 1
            if page_break_after and count == page_break_after:
                # 남은 오른쪽 과목과 이후 내용은 다음 쪽
                w.new_page()
                ry = 780
                for x in (55, 297):
                    w.t(x, 790, '학수번호')
                rest = right_rows[count:]
                prev_cat = cat
                first = True
                for r in rest:
                    if first or r['cat'] != prev_cat:
                        w.t(251, ry, CODE_OF[r['cat']])
                    w.t(297, ry, r['code'])
                    w.t(340, ry, r['name'])
                    w.t(435, ry, r['credit'])
                    w.t(455, ry, r['term'].replace('-', ' / '))
                    ry -= 8
                    prev_cat = r['cat']
                    first = False
                pending_page = True
                y = 700
                break
        if pending_page:
            break

    # 전공계 (취득/기준)
    mr = spec['major_required']
    w.t(297, ry - 10, f"전공계: {sums['전공기초'] + sums['전공필수'] + sums['전공선택']} ( 전필: {sums['전공필수']}/{mr['전공필수']} "
                      f"전선: {sums['전공선택']}/{mr['전공선택']} 전기: {sums['전공기초']}/{mr['전공기초']} )")

    # 금학기 수강 (행마다 이수구분 코드, 학기 없음)
    if ip:
        y = min(y, ry - 30) if w.page > 1 else y
        w.t(10, y, '[금학기수강학점]')
        for c in ip:
            w.t(25, y - 9, CODE_OF[c['cat']])
            w.t(70, y - 9, c['code'])
            w.t(115, y - 9, c['name'])
            w.t(200, y - 9, c['credit'])
            y -= 9

    w.t(297, 60, '연락처 : 031-000-0000')
    w.save()

    grad_earned = taken_sum
    expected = {
        'department': spec['dept'],
        'admissionYear': spec['admission'],
        'courseCount': len(courses),
        'inProgress': len(ip),
        'categories': {c['code']: c['cat'] for c in courses},
        'areas': {
            '졸업학점': [grad_earned, spec['grad_required']],
            **{cat: [sums[cat], mr[cat]] for cat in MAJOR},
            **{cat: [sums[cat], lib[cat]] for cat in ['교양필수', '배분이수', '자유이수']},
        },
        'checks': spec['expect_checks'],
    }
    with open(os.path.join(OUT, f'{name}.expected.json'), 'w', encoding='utf-8') as f:
        json.dump(expected, f, ensure_ascii=False, indent=1)


def T(y, s):
    return f'{y}-{s}'


SPECS = [
    {
        'name': 'report-eng-2025', 'admission': 2025, 'college': '공과대학', 'dept': '산업경영공학과',
        'grad_required': 130,
        'major_required': {'전공기초': 12, '전공필수': 21, '전공선택': 30},
        'liberal_required': {'교양필수': 17, '배분이수': 9, '자유이수': 3},
        'top': {'exit_required': '면제', 'sw_required': 6, 'gpa': '3.10', 'english': 1, 'thesis': 0, 'exit_kind': '토익(면제)', 'exit': '면제', 'sw': 6},
        'expect_checks': {'gpa': 'met', 'english': 'unmet', 'thesis': 'unmet', 'exit': 'exempt', 'sw': 'met'},
        'courses': [
            course('GEC1101', '성찰과표현', 3, T(2025, 1), '교양필수'), course('GEC1102', '대학영어', 2, T(2025, 1), '교양필수'),
            course('GEC1103', '인간의가치탐색', 3, T(2025, 2), '교양필수'), course('GED1101', '생명과우주', 3, T(2025, 2), '배분이수'),
            course('GED1102', '분석과논리', 3, T(2026, 1), '배분이수'), course('GEE1101', '전공탐색세미나', 1, T(2025, 1), '자유이수'),
            course('KHCU1101', '온라인교양', 3, T(2025, 2), '일반선택'),
            course('AMTH1101', '미분적분학', 3, T(2025, 1), '전공기초'), course('APHY1101', '물리학', 3, T(2025, 2), '전공기초'),
            course('IE2101', '경영과학', 3, T(2026, 1), '전공필수'), course('IE2102', '확률통계', 3, T(2026, 2), '전공필수'),
            course('IE2201', '데이터분석', 3, T(2026, 1), '전공선택'), course('IE2202', '생산관리', 3, T(2026, 2), '전공선택'),
            course('SWCON1101', '파이썬프로그래밍', 3, T(2026, 2), '전공선택'),
        ],
    },
    {
        'name': 'report-arts-2024', 'admission': 2024, 'college': '체육대학', 'dept': '태권도학과',
        'grad_required': 130,
        'major_required': {'전공기초': 9, '전공필수': 24, '전공선택': 36},
        'liberal_required': {'교양필수': 17, '배분이수': 9, '자유이수': 3},
        'top': {'exit_required': '실기', 'sw_required': 3, 'gpa': '1.50', 'english': 0, 'thesis': 0, 'exit_kind': '실기', 'exit': '미충족', 'sw': '면제'},
        'expect_checks': {'gpa': 'unmet', 'english': 'unmet', 'thesis': 'unmet', 'exit': 'unmet', 'sw': 'exempt'},
        'courses': [
            course('GEC1201', '글쓰기', 3, T(2024, 1), '교양필수'), course('GED1201', '문화와예술', 3, T(2024, 2), '배분이수'),
            course('TKD1001', '태권도기초', 3, T(2024, 1), '전공기초'), course('TKD1002', '품새1', 2, T(2024, 2), '전공필수'),
            course('TKD2001', '겨루기', 3, T(2025, 1), '전공필수'), course('TKD2101', '태권도지도법', 3, T(2025, 2), '전공선택'),
            course('TKD3001', '시범실습', 2, T(2026, 2), '전공선택'),
        ],
    },
    {
        'name': 'report-fresh-2026', 'admission': 2026, 'college': '소프트웨어융합대학', 'dept': '컴퓨터공학부',
        'grad_required': 130,
        'major_required': {'전공기초': 15, '전공필수': 24, '전공선택': 33},
        'liberal_required': {'교양필수': 17, '배분이수': 9, '자유이수': 3},
        'top': {'exit_required': '토익', 'sw_required': 6, 'gpa': '3.80', 'english': 0, 'thesis': 0, 'exit_kind': '-', 'exit': '미충족', 'sw': 3},
        'expect_checks': {'gpa': 'met', 'english': 'unmet', 'thesis': 'unmet', 'exit': 'unmet', 'sw': 'unmet'},
        'courses': [
            course('GEC1301', '성찰과표현', 3, T(2026, 1), '교양필수'), course('GEE1301', '전공탐색세미나', 1, T(2026, 1), '자유이수'),
            course('CSE1001', '프로그래밍기초', 3, T(2026, 1), '전공기초'),
            course('CSE1002', '자료구조', 3, T(2026, 2), '전공기초'), course('GED1301', '지능과정보', 3, T(2026, 2), '배분이수'),
        ],
    },
    {
        'name': 'report-senior-2022', 'admission': 2022, 'college': '경영대학', 'dept': '경영학과',
        'grad_required': 130,
        'major_required': {'전공기초': 3, '전공필수': 6, '전공선택': 6},
        'liberal_required': {'교양필수': 5, '배분이수': 3, '자유이수': 1},
        'top': {'exit_required': '토익', 'sw_required': 3, 'gpa': '3.20', 'english': 3, 'thesis': 1, 'exit_kind': '토익', 'exit': '충족', 'sw': 3},
        'expect_checks': {'gpa': 'met', 'english': 'met', 'thesis': 'met', 'exit': 'met', 'sw': 'met'},
        'courses': [
            course('GEC1401', '성찰과표현', 3, T(2022, 1), '교양필수'), course('GEC1402', '대학영어', 2, T(2022, 1), '교양필수'),
            course('GED1401', '사회와공동체', 3, T(2022, 2), '배분이수'), course('GEE1401', '전공탐색세미나', 1, T(2022, 1), '자유이수'),
            course('BIZ1001', '경영학원론', 3, T(2022, 2), '전공기초'), course('BIZ2001', '재무관리', 3, T(2023, 1), '전공필수'),
            course('BIZ2002', '마케팅', 3, T(2023, 2), '전공필수'), course('BIZ3001', '경영전략', 3, T(2024, 1), '전공선택'),
            course('BIZ3002', '인사관리', 3, T(2024, 2), '전공선택'), course('KHCU1401', '온라인교양', 6, T(2025, 1), '일반선택'),
        ],
    },
    {
        'name': 'report-twopage-2023', 'admission': 2023, 'college': '공과대학', 'dept': '기계공학과',
        'grad_required': 130, 'right_page_break_after': 5,
        'major_required': {'전공기초': 12, '전공필수': 24, '전공선택': 30},
        'liberal_required': {'교양필수': 17, '배분이수': 9, '자유이수': 3},
        'top': {'exit_required': '토익', 'sw_required': 6, 'gpa': '2.90', 'english': 2, 'thesis': 0, 'exit_kind': '토익', 'exit': '충족', 'sw': 6},
        'expect_checks': {'gpa': 'met', 'english': 'unmet', 'thesis': 'unmet', 'exit': 'met', 'sw': 'met'},
        'courses': [
            course('GEC1501', '성찰과표현', 3, T(2023, 1), '교양필수'), course('GED1501', '생명과우주', 3, T(2023, 2), '배분이수'),
            course('GEE1501', '전공탐색세미나', 1, T(2023, 1), '자유이수'),
            course('MATH1001', '미분적분학', 3, T(2023, 1), '전공기초'), course('MATH1002', '선형대수', 3, T(2023, 2), '전공기초'),
            course('PHYS1001', '물리학', 3, T(2023, 2), '전공기초'),
            course('ME2001', '정역학', 3, T(2024, 1), '전공필수'), course('ME2002', '열역학', 3, T(2024, 1), '전공필수'),
            course('ME2003', '유체역학', 3, T(2024, 2), '전공필수'), course('ME2004', '재료역학', 3, T(2025, 1), '전공필수'),
            course('ME3001', '기계설계', 3, T(2025, 1), '전공선택'), course('ME3002', '제어공학', 3, T(2025, 2), '전공선택'),
            course('ME3003', '진동학', 3, T(2026, 2), '전공선택'),
        ],
    },
]

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for spec in SPECS:
        build(spec)
        print('wrote', spec['name'])
