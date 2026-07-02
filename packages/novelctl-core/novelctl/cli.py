#!/usr/bin/env python3
import argparse, json, pathlib, sys, shutil, hashlib, datetime, re

WATCH = ["시선","침묵","숨","어깨","고개","미소","눈빛","공기","순간","말없이","입을 열었다","고개를 끄덕였다"]

def envelope(ok=True, command=None, stdout='', stderr='', output_files=None, data=None, exit_code=0):
    return {"ok": ok, "command": command or [], "stdout": stdout, "stderr": stderr, "exitCode": exit_code, "outputFiles": output_files or [], "data": data or {}}

def write_json(obj):
    print(json.dumps(obj, ensure_ascii=False, indent=2))

def ensure_ep(root, ep='ep001'):
    d = root / 'story' / 'chapters' / ep
    d.mkdir(parents=True, exist_ok=True)
    (d / 'index.md').write_text('# Pipeline Manifest\n\n- manuscript: manuscript.md\n', encoding='utf-8') if not (d/'index.md').exists() else None
    (d / 'manuscript.md').write_text('# Manuscript\n\n', encoding='utf-8') if not (d/'manuscript.md').exists() else None
    return d

def cmd_status(args):
    root = pathlib.Path(args.project)
    data = {
        "root": str(root),
        "hasConfig": (root/'.novelctl/config.yaml').exists(),
        "hasGemini": (root/'.gemini').exists(),
        "episodes": sorted([p.name for p in (root/'story/chapters').glob('ep*')]) if (root/'story/chapters').exists() else []
    }
    write_json(envelope(command=['status'], stdout='status ok', data=data))

def write_stage(args, name, content):
    root = pathlib.Path(args.project)
    ep = args.episode if hasattr(args, 'episode') and args.episode else 'ep001'
    d = ensure_ep(root, ep)
    out = d / f'{name}.md'
    out.write_text(content, encoding='utf-8')
    write_json(envelope(command=[name, ep], stdout=f'wrote {out}', output_files=[str(out.relative_to(root))]))

def cmd_context(args): write_stage(args, 'context', '# Context Pack\n\n- story-state: loaded\n- canon: locked facts only\n- creativity: balanced\n')
def cmd_draft(args): write_stage(args, 'draft', '# Draft Candidate\n\n에이라는 시선을 돌리지 않고 자료를 밀어 넣었다. 주인공은 침묵 끝에 고개를 끄덕였다.\n')
def cmd_summarize(args): write_stage(args, 'summary', '# Episode Summary\n\n- one-line: 후보 검증과 의료 리스크 노출.\n- changed: 에이라 실무 판단 강화.\n')
def cmd_canon(args): write_stage(args, 'canon-delta', '# Canon Delta\n\n## Provisional\n- 의료 디렉터 부재는 운영 리스크.\n')
def cmd_qa(args): write_stage(args, 'qa', '# QA Report\n\n| Gate | Score | Verdict |\n|---|---:|---|\n| Plot | 86 | PASS |\n| Lexicon | 62 | WARN |\n')
def cmd_revise(args): write_stage(args, 'revision', '# Revision Plan\n\n- 반복 반응 묘사를 업무 행동으로 전환.\n')
def cmd_commit(args): write_stage(args, 'commit-journal', '# Commit Journal\n\n- state updated atomically.\n')

def cmd_write(args):
    for f in [cmd_context, cmd_draft, cmd_summarize, cmd_canon, cmd_qa, cmd_revise, cmd_commit]:
        f(args)

def cmd_analyze(args):
    root = pathlib.Path(args.project)
    path = root / args.path
    text = path.read_text(encoding='utf-8')
    terms = []
    for term in WATCH:
        pos = [m.start() for m in re.finditer(re.escape(term), text)]
        if pos:
            c = len(pos)
            terms.append({"term": term, "count": c, "positions": pos, "judgment": "overused" if c >= 8 else "watch" if c >= 4 else "ok"})
    toks = re.findall(r'[\w가-힣]{2,}', text)
    counts = {}
    for i,t in enumerate(toks): counts.setdefault(t, [0, []]); counts[t][0]+=1; counts[t][1].append(i)
    for t,(c,pos) in counts.items():
        if c >= 3 and t not in {x['term'] for x in terms}:
            terms.append({"term": t, "count": c, "positions": pos[:20], "judgment": "overused" if c >= 8 else "watch" if c >= 4 else "ok"})
    terms.sort(key=lambda x: (-x['count'], x['term']))
    data = {"path": args.path, "terms": terms[:40], "rhythm": {"paragraphs": len([p for p in text.split('\n\n') if p.strip()]), "chars": len(text)}}
    write_json(envelope(command=['analyze', args.path], stdout='analysis ok', data=data))

def cmd_snapshot(args):
    root = pathlib.Path(args.project)
    src = root / args.path
    ts = datetime.datetime.now(datetime.UTC).strftime('%Y%m%d-%H%M%S')
    label = (args.label or 'snapshot').replace(' ', '-')
    sid = f'{ts}-{label}'
    dst = root / '.snapshots' / sid / args.path
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    sha = hashlib.sha256(dst.read_bytes()).hexdigest()
    meta = {"id": sid, "createdAt": datetime.datetime.now(datetime.UTC).isoformat().replace('+00:00','Z'), "label": args.label, "targetPath": args.path, "snapshotPath": str(dst), "sha256": sha}
    (dst.parent/'metadata.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
    write_json(envelope(command=['snapshot', args.path], stdout=f'snapshot {sid}', output_files=[str(dst.relative_to(root))], data=meta))

def main(argv=None):
    parser = argparse.ArgumentParser(prog='novelctl')
    sub = parser.add_subparsers(dest='cmd', required=True)
    for name, fn in [('status',cmd_status)]:
        p=sub.add_parser(name); p.add_argument('project'); p.add_argument('--json', action='store_true'); p.set_defaults(func=fn)
    for name, fn in [('context',cmd_context),('draft',cmd_draft),('summarize',cmd_summarize),('canon-delta',cmd_canon),('qa',cmd_qa),('revise',cmd_revise),('commit',cmd_commit),('write',cmd_write)]:
        p=sub.add_parser(name); p.add_argument('project'); p.add_argument('episode', nargs='?', default='ep001'); p.add_argument('--json', action='store_true'); p.set_defaults(func=fn)
    p=sub.add_parser('analyze'); p.add_argument('project'); p.add_argument('path'); p.add_argument('--json', action='store_true'); p.set_defaults(func=cmd_analyze)
    p=sub.add_parser('snapshot'); p.add_argument('project'); p.add_argument('path'); p.add_argument('--label'); p.add_argument('--json', action='store_true'); p.set_defaults(func=cmd_snapshot)
    args = parser.parse_args(argv)
    args.func(args)

if __name__ == '__main__': main()
