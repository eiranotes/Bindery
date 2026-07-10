// 프로젝트 생성/열기 — local-first 스켈레톤을 실제 파일로 깐다.
// 모든 폴더에 역할 설명 문서를 함께 둬서, 앱 없이 폴더만 봐도 구조가 읽히게 한다.
import { LAYOUT, episodePaths } from '$lib/core/layout';
import { nowIso } from '$lib/core/text';
import type { Bridge, FileNode } from '$lib/bridge';
import type { Ctx } from './types';

export type ProjectMeta = {
  title: string;
  author: string;
  createdAt: string;
  root: string;
};

function templateFiles(title: string, author: string): Array<[string, string]> {
  const ep1 = episodePaths('ep001');
  return [
    [LAYOUT.projectMeta, `schema: bindery.project.v1\ntitle: "${title}"\nauthor: "${author}"\nlanguage: ko-KR\ncreated: ${nowIso()}\n`],
    ['ideas/README.md', '# ideas — 소재 작업장\n\n- inbox/: AI·수동으로 만든 소재 후보가 처음 들어오는 곳\n- seeds/: 살려두고 발전시킬 씨앗\n- selected/: 채택 — 세계관 확장의 입력\n- discarded/: 폐기 (삭제하지 않고 남긴다)\n\n각 소재는 frontmatter가 있는 Markdown 파일이며 직접 수정해도 된다.\n'],
    [`${LAYOUT.ideas.inbox}/.keep.md`, '<!-- 폴더 유지용 -->\n'],
    [`${LAYOUT.ideas.seeds}/.keep.md`, '<!-- 폴더 유지용 -->\n'],
    [`${LAYOUT.ideas.selected}/.keep.md`, '<!-- 폴더 유지용 -->\n'],
    [`${LAYOUT.ideas.discarded}/.keep.md`, '<!-- 폴더 유지용 -->\n'],
    [LAYOUT.canon.bible, `# 설정 바이블 — ${title}\n\n> 아직 조립되지 않았습니다. 소재 채택 → 세계관 확장 승인 → 바이블 조립 순서로 채워집니다.\n> 직접 작성해도 됩니다. 이 파일이 집필·QA의 기준(canon)입니다.\n\n## 전제\n\n## 세계 규칙 (어기면 안 되는 것)\n\n## 주요 인물\n\n## 용어\n\n## 미확정 (열어둔 것)\n`],
    [`${LAYOUT.canon.summaries}/.keep.md`, '<!-- 회차 요약이 ep001.md 형식으로 쌓입니다 -->\n'],
    ['characters/README.md', '# characters — 인물 자산\n\n세계관 확장에서 승인된 인물이 파일로 생성됩니다. 직접 추가해도 됩니다.\n'],
    ['relationships/README.md', '# relationships — 관계 자산\n'],
    ['world/README.md', '# world — 세계 자산 (장소·기관·체계·규칙·용어)\n'],
    [LAYOUT.plot.seriesOutline, `# 시리즈 아웃라인 — ${title}\n\n> 플롯 설계 단계가 승인된 회차 계획을 이 문서와 plot-board.json에 반영합니다.\n`],
    [LAYOUT.plot.openThreads, '# 열린 떡밥\n\n- (회수해야 할 질문·복선을 여기 관리합니다. 요약/정사 갱신 단계가 갱신을 제안합니다.)\n'],
    [LAYOUT.style.guide, '# 스타일 지침\n\n- 시점:\n- 문장 호흡:\n- 금지 표현:\n- 대사 톤:\n\n> 초안·수정 후보 생성과 문체 QA가 이 문서를 기준으로 삼습니다.\n'],
    [LAYOUT.status.resume, `# 재개 상태 (resume state)\n\n> 아직 픽스된 회차가 없습니다. 회차 기록·픽스 단계가 이 문서를 자동 갱신합니다.\n\n- 다음 회차: ep001\n- 최근 요약: 없음\n- 열린 떡밥: plot/open-threads.md 참조\n- 보류 중 결정: 없음\n`],
    [LAYOUT.status.story, `# 작품 상태\n\n- 제목: ${title}\n- 진행: 기획 단계\n- 회차: 0화 픽스\n`],
    [ep1.index, `# ep001 작업 노트\n\n- 상태: 기획\n- 원고: manuscript.md\n- 브리프: brief.md (회차 브리프 단계가 생성)\n- 장면 계획: scene-plan.md\n`],
    [ep1.manuscript, `---\nepisode: ep001\nstatus: planned\n---\n\n# ep001\n\n(원고가 아직 없습니다. 초안 후보를 생성해 diff로 적용하거나 직접 쓰세요.)\n`],
    ['notes/README.md', '# notes — 자유 메모\n']
  ];
}

export async function createProject(bridge: Bridge, base: string, title: string, author: string): Promise<ProjectMeta> {
  const root = await bridge.scaffold(base, title);
  for (const [path, content] of templateFiles(title, author)) {
    const exists = await bridge.exists(root, path);
    if (!exists) await bridge.writeFile(root, path, content);
  }
  return { title, author, createdAt: nowIso(), root };
}

export async function openProject(bridge: Bridge, root: string): Promise<ProjectMeta> {
  let title = root.split('/').filter(Boolean).pop() ?? '작품';
  let author = '';
  let createdAt = '';
  try {
    const meta = await bridge.readFile(root, LAYOUT.projectMeta);
    title = /title:\s*"?([^"\n]+)"?/.exec(meta)?.[1]?.trim() ?? title;
    author = /author:\s*"?([^"\n]+)"?/.exec(meta)?.[1]?.trim() ?? '';
    createdAt = /created:\s*(\S+)/.exec(meta)?.[1] ?? '';
  } catch {
    /* project.yaml 없는 폴더도 열 수 있다 */
  }
  return { title, author, createdAt, root };
}

export async function listProjectTree(ctx: Ctx): Promise<FileNode[]> {
  return ctx.bridge.listTree(ctx.root);
}

/** 존재하면 읽고 없으면 빈 문자열 — 컨텍스트 조립에서 반복되는 패턴. */
export async function readOptional(ctx: Ctx, path: string): Promise<string> {
  try {
    if (!(await ctx.bridge.exists(ctx.root, path))) return '';
    return await ctx.bridge.readFile(ctx.root, path);
  } catch {
    return '';
  }
}

/** story/chapters 아래의 회차 id 목록 (ep001, ep002…). */
export async function listEpisodes(ctx: Ctx, tree?: FileNode[]): Promise<string[]> {
  const nodes = tree ?? await ctx.bridge.listTree(ctx.root);
  const chapters = nodes.find((n) => n.path === 'story')?.children?.find((n) => n.path === LAYOUT.story.chapters);
  return (chapters?.children ?? [])
    .filter((n) => n.kind === 'directory' && /^ep\d{3}$/.test(n.name))
    .map((n) => n.name)
    .sort();
}
