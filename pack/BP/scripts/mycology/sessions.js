// Ephemeral locks only. Never persist an open form across disconnect or restart.
export const sessions = new Map();
export function hasNpcSession(npcId) {for (const s of sessions.values()) if(s.npcId===npcId) return true;return false;}
