import re, json, sys
import pdfplumber
PDF, OUT, TOC, PAGES = sys.argv[1:5]
toc = open(TOC).read()
ents = []
for m in re.finditer(r'^\s*(?:◆\s*)?(.+?)\s*[·\.]{3,}\s*(\d{2,4})\s*$', toc, re.M):
    name, pg = re.sub(r'\s*교육과정$', '', m.group(1).strip()), int(m.group(2))
    if pg >= 127: ents.append((name, pg))
ents.sort(key=lambda x: x[1])
CODE = re.compile(r'^[A-Z]{2,6}\d{3,6}$')
LABEL_TOK = {'(Basic)','(Required)','(Elective)','(Major','전공','기초','필수','선택','산학','교직','심화','전공기초','전공필수','전공선택','산학필수','교직전선','전공심화','구분','이수'}
def norm_cat(s):
    s = s.replace(' ', '')
    for k, v in [('Basic','전기'),('Required','전필'),('Elective','전선'),('전공기초','전기'),('전공필수','전필'),('산학필수','전선'),('전공선택','전선'),('교직','교직'),('전공심화','전선')]:
        if k in s: return v, k
    return None, None
rows = []
pages = [int(x) for x in PAGES.split(',')]
with pdfplumber.open(PDF) as pdf:
    for pno in pages:
        page = pdf.pages[pno]
        words = page.extract_words(x_tolerance=1.5, y_tolerance=2)
        codes = sorted([w for w in words if CODE.match(w['text'])], key=lambda w: w['top'])
        if not codes: continue
        first_top = codes[0]['top']
        head = [w for w in words if w['bottom'] < first_top]
        code_x0 = min(c['x0'] for c in codes)
        # 학기 칸
        sem = sorted([w for w in head if w['text'] in ('1학기', '2학기')], key=lambda w: w['x0'])
        if len(sem) >= 2:
            x1 = (sem[0]['x0'] + sem[0]['x1']) / 2; x2 = (sem[1]['x0'] + sem[1]['x1']) / 2
        else:
            hk = sorted([w for w in head if w['text'] == '학기'], key=lambda w: w['x0'])
            if len(hk) >= 2:
                x1 = (hk[0]['x0'] + hk[0]['x1']) / 2; x2 = (hk[1]['x0'] + hk[1]['x1']) / 2
            else:
                ones = [w for w in head if w['text'] == '1' and w['x0'] > code_x0]
                pair = None
                for o in ones:
                    tw = [w for w in head if w['text'] == '2' and abs(w['top'] - o['top']) < 3 and 5 < w['x0'] - o['x1'] < 40]
                    if tw: pair = (o, tw[0])
                if not pair: continue
                x1 = (pair[0]['x0'] + pair[0]['x1']) / 2; x2 = (pair[1]['x0'] + pair[1]['x1']) / 2
        code_x = min(c['x0'] for c in codes)
        # 이수구분 라벨 (세로로 쪼개진 것 포함)
        labs = [w for w in words if w['top'] >= first_top - 40 and w['x1'] < code_x - 20 and (w['text'] in LABEL_TOK or norm_cat(w['text'])[0]) and w['x0'] < page.width * 0.3]
        labs.sort(key=lambda w: (w['top'], w['x0']))
        merged = []
        for w in labs:
            if merged and abs(merged[-1]['x0'] - w['x0']) < 25 and 0 <= w['top'] - merged[-1]['bottom'] < 14 and not norm_cat(merged[-1]['text'])[0]:
                m = merged[-1]; m['text'] += w['text']; m['bottom'] = w['bottom']
            elif merged and abs(merged[-1]['top'] - w['top']) < 3 and w['x0'] - merged[-1]['x1'] < 6:
                m = merged[-1]; m['text'] += w['text']; m['x1'] = w['x1']
            else:
                merged.append(dict(w))
        cats = [(norm_cat(m['text']), (m['top'] + m['bottom']) / 2) for m in merged if norm_cat(m['text'])[0]]
        # 순번
        for i, c in enumerate(codes):
            y = (c['top'] + c['bottom']) / 2
            prev_y = (codes[i-1]['top'] + codes[i-1]['bottom']) / 2 if i else y - 40
            next_y = (codes[i+1]['top'] + codes[i+1]['bottom']) / 2 if i + 1 < len(codes) else y + 40
            lo, hi = (prev_y + y) / 2, (y + next_y) / 2
            row = [w for w in words if abs((w['top'] + w['bottom']) / 2 - y) < 4]
            seq = [w for w in row if re.match(r'^\d{1,3}$', w['text']) and w['x1'] < page.width * 0.17]
            cat_lab = [(cc, cy) for cc, cy in cats if lo - 2 <= cy <= hi + 2]
            label_right = max([m['x1'] for m in merged] + [page.width * 0.12])
            namew = [w for w in words if lo < (w['top'] + w['bottom']) / 2 < hi and w['x0'] >= label_right - 2 and w['x1'] <= c['x0'] + 1
                     and not re.match(r'^(\d+|택\d?|\d)$', w['text']) and not norm_cat(w['text'])[0]]
            namew.sort(key=lambda w: (round(w['top'] / 3), w['x0']))
            name = ''
            for w in namew:
                t = w['text']
                if name and (re.search(r'[A-Za-z0-9,:\)]$', name) and re.match(r'^[A-Za-z(&]', t)): name += ' '
                name += t
            right = sorted([w for w in row if w['x0'] > c['x1']], key=lambda w: w['x0'])
            if not name:
                nm = []
                for w in right:
                    if re.match(r'^\d+(\.\d+)?$', w['text']): break
                    nm.append(w['text'])
                name = ' '.join(nm)
                name = re.sub(r'(?<=[가-힣]) (?=[가-힣])', '', name)
            rcat = [norm_cat(w['text'])[0] for w in right if norm_cat(w['text'])[0]]
            lcat = [norm_cat(w['text'])[0] for w in row if w['x1'] < c['x0'] and norm_cat(w['text'])[0]]
            credit = None
            for w in right:
                if re.match(r'^\d+(\.\d+)?$', w['text']): credit = float(w['text']); break
                if re.match(r'^\d+/\d+$', w['text']): credit = None; break
            yr = [w for w in right if re.match(r'^\d(-\d)?$|^\d,\d$|^\d~\d$', w['text']) and w['x1'] < x1 - 4]
            year = yr[-1]['text'] if yr else ''
            marks = [w for w in right if re.search(r'[◯○●]', w['text'])]
            near = lambda x: any(abs((m['x0'] + m['x1']) / 2 - x) < 9 for m in marks)
            rows.append(dict(page=pno + 1, seq=int(seq[0]['text']) if seq else None, code=c['text'], cat=(lcat[0] if lcat else cat_lab[0][0][0] if cat_lab else rcat[0] if rcat else None),
                             catY=None, name=name, credit=credit, year=year, s1=near(x1), s2=near(x2),
                             _cats=[(cc[0], cy) for cc, cy in cats], _y=y))
# 병합 셀: 라벨 없는 행은 같은 구분 그룹(순번 연속)의 라벨 중 가장 가까운 것, 없으면 앞 행 값
def dept_of(p):
    cur = None
    for n, pg in ents:
        if pg <= p: cur = n
    return cur
prev = None
for i, r in enumerate(rows):
    if not r['cat']:
        # 같은 페이지 라벨 중, 이 행 이후 다음 '순번 1' 전까지의 그룹 범위에 있는 라벨
        same = [x for x in rows if x['page'] == r['page']]
        idx = same.index(r)
        start = idx
        while start > 0 and same[start]['seq'] and same[start]['seq'] != 1: start -= 1
        end = idx
        while end + 1 < len(same) and same[end + 1]['seq'] and same[end + 1]['seq'] != 1: end += 1
        ylo, yhi = same[start]['_y'] - 12, same[end]['_y'] + 12
        cand = [(c, y) for c, y in r['_cats'] if ylo <= y <= yhi]
        if cand: r['cat'] = min(cand, key=lambda t: abs(t[1] - r['_y']))[0]
        elif prev and prev['page'] in (r['page'], r['page'] - 1): r['cat'] = prev['cat']
    prev = r
for r in rows:
    r['dept'] = dept_of(r['page']); r.pop('_cats'); r.pop('_y'); r.pop('catY')
json.dump(dict(toc=ents, rows=rows), open(OUT, 'w'), ensure_ascii=False, indent=0)
print(len(rows))
