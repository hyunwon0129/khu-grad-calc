# 세로로 합쳐진 이수구분 칸: 라벨은 그룹 가운데에 있으므로, 그룹 경계 = 2*라벨위치 - 그룹시작 으로 차례로 계산
import re, json, sys
pages = open('../book/all.txt').read().split('\f')
d = json.load(open(sys.argv[1]))
CODE = re.compile(r'\b([A-Z]{2,6}\d{3,6})\b')
FULL = {'전공기초': '전기', '전공필수': '전필', '전공선택': '전선', '산학필수': '전선', '교직': '교직'}
SECOND = {'기초': '전기', '필수': '전필', '선택': '전선'}
fixed = {}
for pi, p in enumerate(pages):
    lines = p.split('\n')
    rows = []
    labels = []
    for k, l in enumerate(lines):
        m = CODE.search(l)
        head = l[:m.start()] if m else l
        toks = head.split()
        # 라벨 토큰 찾기 (앞쪽 열)
        lab_full = [FULL[t] for t in toks if t in FULL]
        if m and re.match(r'^\s*\d{1,3}\s', l):
            rows.append((k, m.group(1), lab_full[0] if lab_full else None))
            if lab_full: continue
        # 쪼개진 라벨: '전공' 다음 줄(±2)에 '기초/필수/선택'
        if '전공' in toks[:3] or '산학' in toks[:3]:
            for j in range(k + 1, min(k + 3, len(lines))):
                t2 = lines[j].split()
                cand = [SECOND[t] for t in t2[:3] if t in SECOND]
                if cand:
                    labels.append(((k + j) / 2, cand[0])); break
    if not rows or not labels: continue
    # 이미 줄에 라벨이 붙은 행은 그대로, 나머지는 경계 계산
    labels.sort()
    ln = [r[0] for r in rows]
    def pos(c):  # 줄 번호 → 행 순번(소수)
        if c <= ln[0]: return 0 - (ln[0] - c) / 2
        for i in range(len(ln) - 1):
            if ln[i] <= c <= ln[i + 1]: return i + (c - ln[i]) / (ln[i + 1] - ln[i])
        return len(ln) - 1 + (c - ln[-1]) / 2
    start = -0.5
    bounds = []
    for c, cat in labels:
        p = pos(c); end = 2 * p - start
        bounds.append((start, end, cat)); start = end
    for idx, (k, code, cat) in enumerate(rows):
        if cat: fixed[(pi + 1, code)] = cat; continue
        g = [b for b in bounds if b[0] <= idx < b[1] + 0.01]
        if g: fixed[(pi + 1, code)] = g[0][2]
        else:
            near = min(labels, key=lambda t: abs(t[0] - k)); fixed[(pi + 1, code)] = near[1]
n = 0
for r in d['rows']:
    key = (r['page'], r['code'])
    if key in fixed and fixed[key] != r['cat']:
        r['cat'] = fixed[key]; n += 1
json.dump(d, open(sys.argv[2], 'w'), ensure_ascii=False, indent=0)
print('changed', n)
