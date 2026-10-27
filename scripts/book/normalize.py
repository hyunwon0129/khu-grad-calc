# rows_all.json + prereq.json → data-src/intl-2026.json
import json, re, sys, collections
rows = json.load(open(sys.argv[1]))['rows']
pre = json.load(open(sys.argv[2]))
OUT = sys.argv[3]
MAP = {
 '기계공학부': ['기계공학', '지능로봇공학', '항공우주모빌리티'],
 '환경학및환경공학과': ['환경학', '환경공학'],
 '전자공학부 전자공학과': ['전자공학과'], '전자공학부 반도체공학과': ['반도체공학과'],
 '컴퓨터공학부 컴퓨터공학과': ['컴퓨터공학과'], '컴퓨터공학부 인공지능학과': ['인공지능학과'],
 '한국어학과 한국어학전공': ['한국어학과'], '한국어학과 한국콘텐츠학전공': [],
 '글로벌커뮤니케이션학부 영미어문전공': ['영미어문전공'], '글로벌커뮤니케이션학부 영미문화전공': ['영미문화전공'],
 '첨단바이오소재 융합전공': ['첨단바이오신소재'], '웨어러블 디자인 테크놀로지 융합전공': [], '우주탐사 융합전공': [], 'h-STEM 융합전공': [],
 '체육대학': [], '자유전공학부': [],
}
good = [r for r in rows if r['credit'] is not None and (r['s1'] or r['s2']) and r['year'] and r['dept']]
names = collections.Counter()
for r in good:
    if r['name'] and not re.search(r'학과$', r['name']): names[(r['code'], r['name'])] += 1
best_name = {}
# pdfplumber가 글자를 놓친 줄은 pdftotext 결과에서 '과목명  학수번호' 형태로 보충
import os
txt = open(os.path.join(os.path.dirname(sys.argv[1]), '..', 'book', 'all.txt')).read()
text_name = {}
for m in re.finditer(r'(?:전공(?:기초|필수|선택)|산학필수)\s+(\S[^\n]*?\S)\s{2,}([A-Z]{2,6}\d{3,6})\s+\d', txt):
    text_name.setdefault(m.group(2), m.group(1).replace(' ', ''))
for (c, n), k in sorted(names.items(), key=lambda x: -x[1]):
    best_name.setdefault(c, n)
by = collections.defaultdict(dict)
for r in good:
    d = r['dept']; cur = by[d].get(r['code'])
    if cur is None or (cur['cat'] is None and r['cat']): by[d][r['code']] = r
out = []
for d, cm in by.items():
    app = MAP.get(d, [re.sub(r'\s*융합전공$', '', d)])
    if not app: continue
    lst = []
    seen_order = sorted(cm.values(), key=lambda r: (r['page'], 0))
    for r in seen_order:
        if r['cat'] in (None, '교직'): continue
        y = r['year']; m = re.match(r'^(\d)', y)
        year = int(m.group(1)) if m else 0
        nm = (best_name.get(r['code']) or r['name'] or text_name.get(r['code'], '')).replace('  ', ' ').strip()
        nm = re.sub(r'(?<=[가-힣\)]) ?[‘\'].*$', '', nm)  # 비고가 붙은 경우 잘라냄
        cr = r['credit']
        lst.append(dict(code=r['code'], name=nm[:40], credit=int(cr) if cr == int(cr) else cr, cat=r['cat'], year=year, s1=r['s1'], s2=r['s2']))
    pr = []
    allc = {r['code']: r for r in good}
    for p in pre:
        if p['dept'] != d: continue
        codes = set(x['code'] for x in lst)
        pres = p['pre'].split('|') + p['alt']
        # '둘 중 하나' 선수과목 중 이 학과 편성표에 없는 과목(타전공 인정 과목)은 짝 과목과 같은 구분으로 넣는다
        if len(pres) > 1 and any(x in codes for x in pres):
            mate = next(x for x in lst if x['code'] in pres)
            for x in pres:
                if x not in codes and x in allc:
                    o = allc[x]
                    lst.append(dict(code=x, name=(best_name.get(x) or o['name'])[:40], credit=int(o['credit']), cat=mate['cat'], year=0, s1=o['s1'], s2=o['s2']))
                    codes.add(x)
        if p['post'] in codes and all(x in codes for x in pres):
            pr.append(['|'.join(dict.fromkeys(pres)), p['post']])
    out.append(dict(book=d, app=app, courses=lst, prereqs=pr, pages=sorted(set(r['page'] for r in cm.values()))[:3]))
json.dump(dict(source='2026학년도 교육과정(국제캠퍼스) 책자', departments=out), open(OUT, 'w'), ensure_ascii=False, indent=1)
print(len(out), 'depts', sum(len(x['courses']) for x in out), 'courses', sum(len(x['prereqs']) for x in out), 'prereqs')
