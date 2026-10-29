# 교육과정 원문(pdftotext -layout)에서 '▣ 마이크로디그리명' 블록을 읽어 과목·학점·이수기준을 뽑는다
import re, json, sys
S = '/tmp/claude-0/-home-claude/67bd4f7f-00fa-5be5-af42-2cf829fc4257/scratchpad'
SRC = [(S + '/book/all.txt', 'INTL'), (S + '/seoul/book/all.txt', 'SEOUL'), (S + '/newsrc/book/all.txt', 'SEOUL'),
       (S + '/music/book/all.txt', 'SEOUL'), (S + '/music2/book/all.txt', 'SEOUL')]
CODE = re.compile(r'\b([A-Z]{2,6}\d{3,6})\b')
out = []
for path, campus in SRC:
    lines = open(path, errors='ignore').read().split('\n')
    idx = [i for i, l in enumerate(lines) if re.search(r'^\s*(?:▣|■|\d\.)?\s*마이크로디그리명\s*(?:\(영문\))?\s*[:：]\s*\S', l)]
    for k, i in enumerate(idx):
        end = idx[k + 1] if k + 1 < len(idx) else min(len(lines), i + 400)
        block = lines[i:end]
        # 다음 문서 시작(교육과정 요약표)에서 끊기
        for j, l in enumerate(block[1:], 1):
            if re.search(r'교육과정 요약표\(|^\s*1\.\s*교육목적|^\s*\[별표\d+\]|^\s*제\s*\d+\s*조', l): block = block[:j]; break
        head = re.sub(r'\s+', ' ', block[0].split(':', 1)[-1]).strip()
        name = re.sub(r'\s*\(.*$', '', head).strip()
        eng = (re.search(r'\(([^)]*)\)', head) or [None, ''])[1]
        # 이수기준 문장
        rule = ''
        for j, l in enumerate(block):
            if re.search(r'이수체계도|이수\s*기준|이수학점', l) and re.search(r'▣|■|^\s*\d\.', l):
                buf = []
                for l2 in block[j + 1:j + 8]:
                    if re.search(r'학수번호|단과대학|교과목명', l2): break
                    if l2.strip(): buf.append(l2.strip().lstrip('-').strip())
                rule = ' '.join(buf)
                break
        courses, seen = [], set()
        total = None
        gap = 0
        for l in block:
            if courses:
                gap = 0 if CODE.search(l) else gap + 1
                if gap > 8 or re.search(r'총\s*계', l):
                    m = re.search(r'총\s*계\s+(\d+)', l)
                    if m: total = int(m.group(1))
                    break
            m = re.search(r'총\s*계\s+(\d+)', l)
            if m: total = int(m.group(1))
            for cm in CODE.finditer(l):
                code = cm.group(1)
                if code in seen: continue
                rest = l[cm.end():]
                mm = re.match(r'\s+(.+?)\s{2,}(\d)(?:\s|$)', rest) or re.match(r'\s+(.+?)\s+(\d)\s*$', rest)
                if not mm: continue
                nm = re.sub(r'\s+', ' ', mm.group(1)).strip()
                left = l[:cm.start()].split()
                dept = left[-1] if left else ''
                seen.add(code); courses.append(dict(code=code, name=nm[:40], credit=int(mm.group(2)), dept=dept))
        m = re.search(r'총\s*(\d+)\s*학점', rule) or re.search(r'(\d+)\s*학점\s*(?:이상)?\s*(?:을|를)?\s*이수', rule) or re.search(r'최저이수학점\s*:\s*(\d+)', rule)
        if m: total = int(m.group(1))
        if courses:
            out.append(dict(name=name, eng=eng, campus=campus, rule=rule[:220], total=total or sum(c['credit'] for c in courses), courses=courses, src=path.split('/')[-3]))
# 같은 이름은 하나로 (과목 목록이 더 긴 쪽)
best = {}
for m in out:
    key = (m['campus'], re.sub(r'\s', '', m['name']))
    if key not in best or len(m['courses']) > len(best[key]['courses']): best[key] = m
res = sorted(best.values(), key=lambda m: (m['campus'], m['name']))
json.dump(res, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
print(len(out), 'blocks →', len(res), 'MD')
for m in res: print(m['campus'], m['name'], '|', m['total'], '학점 |', len(m['courses']), '과목 |', m['rule'][:70])
