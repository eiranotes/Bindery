// 활성 브리지 선택 — Tauri 런타임이면 tauri, dev 서버(/__bridge 응답)가 있으면 dev, 없으면 memory.
// 테스트는 memoryBridge를 직접 주입한다.
import type { Bridge } from './types';
import { devBridge } from './devBridge';
import { tauriBridge } from './tauriBridge';
import { memoryBridge } from './memoryBridge';

export type { Bridge, FileNode, AgentResult, AgentSettings, ProviderUsageCommandResult } from './types';
export { memoryBridge, setAgentScript, resetMemoryBridge } from './memoryBridge';
export { devBridge } from './devBridge';
export { tauriBridge } from './tauriBridge';

let active: Bridge | null = null;

export function setBridge(bridge: Bridge): void {
  active = bridge;
}

export function bridge(): Bridge {
  if (!active) throw new Error('bridge not initialised — call detectBridge() or setBridge() first');
  return active;
}

/** 앱 시작 시 1회 — Tauri/dev 브리지 가용성을 확인한다. */
export async function detectBridge(): Promise<Bridge> {
  if (active) return active;
  if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
    active = tauriBridge;
    return active;
  }
  try {
    const res = await fetch('/__bridge/env');
    if (res.ok) {
      active = devBridge;
      return active;
    }
  } catch {
    /* dev 서버 아님 */
  }
  active = memoryBridge;
  return active;
}
