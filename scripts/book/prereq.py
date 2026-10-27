import re, json, sys
pages = open(sys.argv[1]).read().split('\f')
toc = json.load(open(sys.argv[2]))['toc']
def dept_of(p):
    cur = None
    for n, pg in toc:
        if pg <= p: cur = n
    return cur
CODE = re.compile(r'\b[A-Z]{2,6}\d{3,6}\b')
out = []
for i, p in enumerate(pages):
    if i < 126 or '선수과목' not in p or len(CODE.findall(p)) < 2: continue
    lines = p.split('\n')
    # 표 시작: '선수과목 지정표' 다음
    start = next((k for k, l in enumerate(lines) if '선수과목' in l and '지정표' in l), None)
    if start is None: continue
    hdr = next((l for l in lines[start:start + 12] if '선수' in l and '후수' in l), None)
    order = 'pre_first'
    if hdr and hdr.index('후수') < hdr.index('선수'): order = 'post_first'
    pending = []  # 택1 처리용: 한 줄에 코드 1개만 있는 줄
    for k in range(start, len(lines)):
        l = lines[k]
        if re.search(r'별표\s*\d', l) and k > start + 2 and '선수' not in l: break
        cs = CODE.findall(l)
        if len(cs) == 2:
            a, b = cs
            pre, post = (a, b) if order == 'pre_first' else (b, a)
            out.append(dict(page=i + 1, dept=dept_of(i + 1), pre=pre, post=post, alt=[]))
        elif len(cs) == 1:
            pending.append((k, cs[0], l.index(cs[0])))
    # 택1: '택' 이 있는 1코드 줄 = 후수과목, 바로 위·아래 1코드 줄 = 둘 중 하나인 선수과목
    singles = {k: c for (k, c, x) in pending}
    for (k, c, x) in pending:
        if '택' not in lines[k]: continue
        alts = [singles[j] for j in (k - 1, k - 2, k + 1, k + 2) if j in singles and '택' not in lines[j]][:2]
        if len(alts) >= 1:
            out.append(dict(page=i + 1, dept=dept_of(i + 1), pre='|'.join(sorted(set(alts))), post=c, alt=[]))
    # 2코드 줄에 '택' 이 있으면 바로 위/아래 1코드 줄(같은 열)을 대체 선수과목으로
    for o in [o for o in out if o['page'] == i + 1 and '|' not in o['pre']]:
        ln = next((kk for kk, l in enumerate(lines) if o['pre'] in l and o['post'] in l), None)
        if ln is None or '택' not in lines[ln]: continue
        x = lines[ln].index(o['pre'])
        for j in (ln - 1, ln + 1):
            if j in singles and abs(lines[j].index(singles[j]) - x) < 6: o['alt'].append(singles[j])
json.dump(out, open(sys.argv[3], 'w'), ensure_ascii=False, indent=0)
print(len(out))
import collections; print(collections.Counter(o['dept'] for o in out))
print([o for o in out if o['dept'] and '산업경영' in o['dept']])
