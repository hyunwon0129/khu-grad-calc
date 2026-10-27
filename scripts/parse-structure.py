import re, json, sys
lines = open(sys.argv[1]).read().split('\n')
seoul = lines[1763:1917]; glob = lines[1917:2062]
NUM = re.compile(r'^(\d+(\.\d+)?\*?|-)$')
def parse(block, campus):
    out, bad = [], []
    for l in block:
        toks = l.split()
        i = next((k for k,t in enumerate(toks) if NUM.match(t)), None)
        if i is None or i == 0: continue
        name = toks[i-1]; nums = toks[i:]
        if not all(NUM.match(t) for t in nums): continue
        if re.match(r'^\d+$', name) or name in ('미래정보','융합','◑'): continue
        n = len(nums)
        val = lambda t: None if t == '-' else float(t.rstrip('*'))
        v = [val(t) for t in nums]
        def blk(a): 
            if all(x is None for x in a): return None
            return a
        if campus == 'SEOUL' and n == 13:
            rec = dict(grad=v[0], single=v[1:5], multi=blk(v[5:9]), minor=blk(v[9:13]))
        elif campus == 'INTL' and n == 14:
            rec = dict(grad=v[0], single=v[1:5], otherSingle=v[5], multi=blk(v[6:10]), otherMulti=v[10], minor=blk([None]+v[11:14]))
        elif campus == 'INTL' and n == 13 and all(x is None for x in v[:5]):
            rec = dict(grad=None, single=None, otherSingle=None, multi=blk(v[5:9]), otherMulti=v[9], minor=blk([None]+v[10:13]))
        else:
            bad.append((campus, name, nums)); continue
        # sum check
        ok = True
        for k in ('single','multi','minor'):
            a = rec.get(k)
            if a and a[3] is not None and '*' not in l:
                s = sum(x or 0 for x in a[:3])
                if abs(s - a[3]) > 0.01: ok = False
        rec.update(campus=campus, name=name, sumOk=ok)
        out.append(rec)
    return out, bad
s, b1 = parse(seoul, 'SEOUL'); g, b2 = parse(glob, 'INTL')
allr = s + g
json.dump(allr, open(sys.argv[2], 'w'), ensure_ascii=False, indent=0)
print(len(s), len(g))
for b in b1 + b2: print('BAD', b)
for r in allr:
    if not r['sumOk']: print('SUM', r['campus'], r['name'], r['single'], r['multi'], r['minor'])
