// Plot Grid model (design_v0.2/docs/14_plot_canvas.md §3).
// Rows are scenes, columns are plotlines, cells carry beat labels, plus a
// tension track. QA-style warnings are derived from the grid.

export type Tension = 'low' | 'mid' | 'high';

export type Plotline = { id: string; label: string; color: string };

export type PlotRow = {
  scene: string;
  title: string;
  episode: string;
  tension: Tension;
  /** plotlineId -> beat label ('' means the subplot is absent in this scene) */
  beats: Record<string, string>;
};

export type PlotGrid = {
  plotlines: Plotline[];
  rows: PlotRow[];
};

export type PlotWarning = {
  severity: 'warn' | 'info';
  message: string;
  scene?: string;
  plotline?: string;
};

export const MOCK_PLOT_GRID: PlotGrid = {
  plotlines: [
    { id: 'main', label: '주 플롯', color: '#315e63' },
    { id: 'eira-arc', label: '에이라 아크', color: '#22d3ee' },
    { id: 'medical-risk', label: '의료 리스크', color: '#fb7185' },
    { id: 'guild-politics', label: '길드 정치', color: '#fbbf24' }
  ],
  rows: [
    { scene: 'scene-01', title: '후보 자료 검토', episode: 'ep001', tension: 'low', beats: { main: '도입', 'eira-arc': '관찰', 'medical-risk': '언급', 'guild-politics': '' } },
    { scene: 'scene-02', title: '숫자와 침묵', episode: 'ep001', tension: 'mid', beats: { main: '전개', 'eira-arc': '주장', 'medical-risk': '표면화', 'guild-politics': '' } },
    { scene: 'scene-03', title: '각주의 균열', episode: 'ep001', tension: 'high', beats: { main: '전환', 'eira-arc': '위험 인식', 'medical-risk': '폭로', 'guild-politics': '암시' } },
    { scene: 'scene-04', title: '계약 보류', episode: 'ep002', tension: 'mid', beats: { main: '여파', 'eira-arc': '', 'medical-risk': '확대', 'guild-politics': '압박' } },
    { scene: 'scene-05', title: '대안 후보', episode: 'ep002', tension: 'low', beats: { main: '재정렬', 'eira-arc': '관찰', 'medical-risk': '', 'guild-politics': '공작' } }
  ]
};

const TENSION_VALUE: Record<Tension, number> = { low: 1, mid: 2, high: 3 };
export function tensionValue(t: Tension): number { return TENSION_VALUE[t]; }

/** Derive Plot Grid QA warnings (subplot gaps, tension flatline, repeated beats). */
export function analyzePlotGrid(grid: PlotGrid): PlotWarning[] {
  const warnings: PlotWarning[] = [];

  // 1. subplot vanished for too many consecutive scenes
  for (const pl of grid.plotlines) {
    let gap = 0;
    let gapStart = '';
    for (const row of grid.rows) {
      if (!row.beats[pl.id]) {
        if (gap === 0) gapStart = row.scene;
        gap++;
      } else {
        if (gap >= 2) warnings.push({ severity: 'warn', plotline: pl.id, scene: gapStart, message: `${pl.label} 서브플롯이 ${gap}개 장면 동안 사라졌습니다.` });
        gap = 0;
      }
    }
    if (gap >= 2) warnings.push({ severity: 'warn', plotline: pl.id, scene: gapStart, message: `${pl.label} 서브플롯이 마지막 ${gap}개 장면 동안 사라졌습니다.` });
  }

  // 2. tension flatline
  const uniqueTension = new Set(grid.rows.map((r) => r.tension));
  if (grid.rows.length >= 3 && uniqueTension.size === 1) {
    warnings.push({ severity: 'warn', message: '긴장도가 평탄합니다. 장면 사이의 기복을 주세요.' });
  }

  // 3. same beat repeated for a plotline
  for (const pl of grid.plotlines) {
    const beats = grid.rows.map((r) => r.beats[pl.id]).filter(Boolean);
    for (let i = 2; i < beats.length; i++) {
      if (beats[i] && beats[i] === beats[i - 1] && beats[i] === beats[i - 2]) {
        warnings.push({ severity: 'info', plotline: pl.id, message: `${pl.label}이(가) 같은 기능('${beats[i]}')을 반복합니다.` });
        break;
      }
    }
  }

  return warnings;
}
