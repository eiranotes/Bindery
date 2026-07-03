#!/usr/bin/env python3
import argparse, json, pathlib, sys, shutil, hashlib, datetime, re
try:
    from .style_system import (
        classify_scene, to_plain, load_style_payload, _scene_classification_from_dict,
        _style_stack_from_dict, _router_from_dict, _preset_from_dict, StyleRouteContext, ActiveStyleStack, StyleProfile, _router_rule_from_dict, _rules_from_dict, _rules_map,
        resolve_active_style_stack, build_prompt_capsule, score_style_match,
        export_style_skill_pack, SQLITE_SCHEMA, STRUCTURED_OUTPUT_SCHEMAS,
        analyze_korean_surface, sync_style_repository, validate_style_skill_pack, zip_style_skill_pack
    )
except ImportError:  # direct script execution
    from style_system import (
        classify_scene, to_plain, load_style_payload, _scene_classification_from_dict,
        _style_stack_from_dict, _router_from_dict, _preset_from_dict, StyleRouteContext, ActiveStyleStack, StyleProfile, _router_rule_from_dict, _rules_from_dict, _rules_map,
        resolve_active_style_stack, build_prompt_capsule, score_style_match,
        export_style_skill_pack, SQLITE_SCHEMA, STRUCTURED_OUTPUT_SCHEMAS,
        analyze_korean_surface, sync_style_repository, validate_style_skill_pack, zip_style_skill_pack
    )

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


def _text_arg(args):
    root = pathlib.Path(args.project)
    if getattr(args, 'text', None):
        return args.text
    if getattr(args, 'path', None):
        return (root / args.path).read_text(encoding='utf-8')
    data = sys.stdin.read()
    if data.strip():
        return data
    raise SystemExit('provide --text, --path, or stdin')

def cmd_style_classify(args):
    cls = classify_scene(_text_arg(args), {'scene_id': args.scene_id, 'chapter_id': args.chapter_id, 'manual_override': args.manual_override})
    write_json(envelope(command=['style-classify'], stdout='style classification ok', data=to_plain(cls)))

def cmd_style_sql(args):
    write_json(envelope(command=['style-sql'], stdout=SQLITE_SCHEMA, data={'schema': SQLITE_SCHEMA}))

def cmd_style_sync(args):
    summary = sync_style_repository(pathlib.Path(args.project))
    write_json(envelope(command=['style-sync'], stdout='style repository sync ok', output_files=['styles/style-repository.json', '.bindery/style-system.sqlite3'], data=summary))

def cmd_style_structured_schemas(args):
    write_json(envelope(command=['style-structured-schemas'], stdout='structured schemas ok', data={'schemas': STRUCTURED_OUTPUT_SCHEMAS}))

def cmd_style_korean_nlp(args):
    report = analyze_korean_surface(_text_arg(args), args.speaker or [])
    write_json(envelope(command=['style-korean-nlp'], stdout='korean surface analysis ok', data=report))

def cmd_style_route(args):
    payload = load_style_payload(pathlib.Path(args.context_json))
    classification = _scene_classification_from_dict(payload['classification'])
    context = StyleRouteContext(
        scene_id=payload.get('scene_id', classification.scene_id),
        classification=classification,
        project_id=payload.get('project_id'),
        arc_id=payload.get('arc_id'),
        chapter_id=payload.get('chapter_id') or classification.chapter_id,
        character_id=payload.get('character_id'),
        dialogue_speakers=payload.get('dialogue_speakers', []),
        manual_override_stack_id=payload.get('manual_override_stack_id'),
        revision_pass=payload.get('revision_pass'),
    )
    router = _router_from_dict(load_style_payload(pathlib.Path(args.router_json)))
    active = resolve_active_style_stack(context, router)
    write_json(envelope(command=['style-route'], stdout='style route ok', data=to_plain(active)))

def cmd_style_capsule(args):
    payload = load_style_payload(pathlib.Path(args.payload_json))
    active_raw = payload['active_stack']
    from_obj = active_raw if hasattr(active_raw, 'primary_stack_id') else type('ActiveRaw', (), {})
    if isinstance(active_raw, dict):
        active = ActiveStyleStack(active_raw['primary_stack_id'], active_raw.get('overlay_stack_ids', []), [_router_rule_from_dict(r) for r in active_raw.get('matched_rules', [])], active_raw.get('routing_reason', 'loaded'))
    else:
        active = from_obj
    capsule = build_prompt_capsule(payload['context'], active, args.max_rules, args.token_budget)
    write_json(envelope(command=['style-capsule'], stdout='prompt capsule ok', data=to_plain(capsule)))

def cmd_style_score(args):
    text = _text_arg(args)
    style_raw = load_style_payload(pathlib.Path(args.style_json))
    if 'stack_id' in style_raw:
        style = _style_stack_from_dict(style_raw)
    elif 'preset_id' in style_raw:
        style = _preset_from_dict(style_raw)
    else:
        style = StyleProfile(
            profile_id=style_raw.get('profile_id', 'profile_cli'),
            language=style_raw.get('language', 'ko'),
            global_rules=_rules_from_dict(style_raw.get('global_rules')),
            register_rules=_rules_map(style_raw.get('register_rules')),
            overlay_rules=_rules_map(style_raw.get('overlay_rules')),
            negative_rules=style_raw.get('negative_rules', []),
            content_terms=style_raw.get('content_terms', []),
            metrics_baseline=style_raw.get('metrics_baseline', {}),
        )
    classification = _scene_classification_from_dict(load_style_payload(pathlib.Path(args.classification_json))) if args.classification_json else None
    report = score_style_match(text, style, classification)
    write_json(envelope(command=['style-score'], stdout='style score ok', data=to_plain(report)))

def cmd_style_export_skill(args):
    payload = load_style_payload(pathlib.Path(args.style_json))
    presets = [_preset_from_dict(x) for x in payload.get('presets', [])]
    stacks = [_style_stack_from_dict(x) for x in payload.get('stacks', [])]
    router = _router_from_dict(payload.get('router', {'router_id': 'router_default', 'rules': []}))
    zip_path = pathlib.Path(args.zip_path) if args.zip_path else None
    out = export_style_skill_pack(args.project_id or pathlib.Path(args.project).name, presets, stacks, router, pathlib.Path(args.output_dir), zip_path)
    validation = validate_style_skill_pack(out)
    files = [str(p.relative_to(out)) for p in sorted(out.rglob('*')) if p.is_file()]
    output_files = [str(out)]
    if zip_path:
        output_files.append(str(zip_path))
    write_json(envelope(command=['style-export-skill'], stdout=f'exported {out}', output_files=output_files, data={'path': str(out), 'files': files, 'validation': validation, 'zip_path': str(zip_path) if zip_path else None}))

def cmd_style_validate_skill(args):
    root = pathlib.Path(args.skill_dir)
    validation = validate_style_skill_pack(root)
    if args.zip_path and validation.get('ok'):
        zip_path = zip_style_skill_pack(root, pathlib.Path(args.zip_path))
        validation['zip_path'] = str(zip_path)
    write_json(envelope(ok=bool(validation.get('ok')), command=['style-validate-skill'], stdout='style skill validation ok' if validation.get('ok') else 'style skill validation failed', stderr='\n'.join(validation.get('errors', [])), data=validation, exit_code=0 if validation.get('ok') else 1))
    if not validation.get('ok'):
        raise SystemExit(1)

def main(argv=None):
    parser = argparse.ArgumentParser(prog='novelctl')
    sub = parser.add_subparsers(dest='cmd', required=True)
    for name, fn in [('status',cmd_status)]:
        p=sub.add_parser(name); p.add_argument('project'); p.add_argument('--json', action='store_true'); p.set_defaults(func=fn)
    for name, fn in [('context',cmd_context),('draft',cmd_draft),('summarize',cmd_summarize),('canon-delta',cmd_canon),('qa',cmd_qa),('revise',cmd_revise),('commit',cmd_commit),('write',cmd_write)]:
        p=sub.add_parser(name); p.add_argument('project'); p.add_argument('episode', nargs='?', default='ep001'); p.add_argument('--json', action='store_true'); p.set_defaults(func=fn)
    p=sub.add_parser('analyze'); p.add_argument('project'); p.add_argument('path'); p.add_argument('--json', action='store_true'); p.set_defaults(func=cmd_analyze)
    p=sub.add_parser('snapshot'); p.add_argument('project'); p.add_argument('path'); p.add_argument('--label'); p.add_argument('--json', action='store_true'); p.set_defaults(func=cmd_snapshot)
    p=sub.add_parser('style-classify'); p.add_argument('project'); p.add_argument('--path'); p.add_argument('--text'); p.add_argument('--scene-id', default='S001'); p.add_argument('--chapter-id'); p.add_argument('--manual-override', action='store_true'); p.add_argument('--json', action='store_true'); p.set_defaults(func=cmd_style_classify)
    p=sub.add_parser('style-sql'); p.add_argument('project'); p.add_argument('--json', action='store_true'); p.set_defaults(func=cmd_style_sql)
    p=sub.add_parser('style-sync'); p.add_argument('project'); p.add_argument('--json', action='store_true'); p.set_defaults(func=cmd_style_sync)
    p=sub.add_parser('style-structured-schemas'); p.add_argument('project'); p.add_argument('--json', action='store_true'); p.set_defaults(func=cmd_style_structured_schemas)
    p=sub.add_parser('style-korean-nlp'); p.add_argument('project'); p.add_argument('--path'); p.add_argument('--text'); p.add_argument('--speaker', action='append'); p.add_argument('--json', action='store_true'); p.set_defaults(func=cmd_style_korean_nlp)
    p=sub.add_parser('style-route'); p.add_argument('project'); p.add_argument('--context-json', required=True); p.add_argument('--router-json', required=True); p.add_argument('--json', action='store_true'); p.set_defaults(func=cmd_style_route)
    p=sub.add_parser('style-capsule'); p.add_argument('project'); p.add_argument('--payload-json', required=True); p.add_argument('--max-rules', type=int, default=18); p.add_argument('--token-budget', type=int, default=1200); p.add_argument('--json', action='store_true'); p.set_defaults(func=cmd_style_capsule)
    p=sub.add_parser('style-score'); p.add_argument('project'); p.add_argument('--path'); p.add_argument('--text'); p.add_argument('--style-json', required=True); p.add_argument('--classification-json'); p.add_argument('--json', action='store_true'); p.set_defaults(func=cmd_style_score)
    p=sub.add_parser('style-export-skill'); p.add_argument('project'); p.add_argument('--style-json', required=True); p.add_argument('--output-dir', required=True); p.add_argument('--project-id'); p.add_argument('--zip-path'); p.add_argument('--json', action='store_true'); p.set_defaults(func=cmd_style_export_skill)
    p=sub.add_parser('style-validate-skill'); p.add_argument('project'); p.add_argument('--skill-dir', required=True); p.add_argument('--zip-path'); p.add_argument('--json', action='store_true'); p.set_defaults(func=cmd_style_validate_skill)
    args = parser.parse_args(argv)
    args.func(args)

if __name__ == '__main__': main()
