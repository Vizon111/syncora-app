import { RealtimeEvent, RealtimePresenceUser } from '@/lib/types';

// Map of workspaceId -> Set of ReadableStreamDefaultController
type SSEController = ReadableStreamDefaultController<Uint8Array>;

class RealtimeHub {
  private workspaceSubscribers: Map<string, Set<SSEController>> = new Map();
  private presenceStore: Map<string, Map<string, RealtimePresenceUser>> = new Map(); // workspaceId -> (userId -> presence)

  /**
   * Subscribe an SSE client stream
   */
  public subscribe(workspaceId: string, controller: SSEController): () => void {
    if (!this.workspaceSubscribers.has(workspaceId)) {
      this.workspaceSubscribers.set(workspaceId, new Set());
    }
    const set = this.workspaceSubscribers.get(workspaceId)!;
    set.add(controller);

    return () => {
      set.delete(controller);
      if (set.size === 0) {
        this.workspaceSubscribers.delete(workspaceId);
      }
    };
  }

  /**
   * Broadcast an event to all subscribers of a workspace
   */
  public broadcast(workspaceId: string, event: RealtimeEvent, excludeController?: SSEController) {
    const set = this.workspaceSubscribers.get(workspaceId);
    if (!set || set.size === 0) return;

    const payload = `data: ${JSON.stringify(event)}\n\n`;
    const encoder = new TextEncoder();
    const encoded = encoder.encode(payload);

    set.forEach((controller) => {
      if (controller === excludeController) return;
      try {
        controller.enqueue(encoded);
      } catch (err) {
        set.delete(controller);
      }
    });
  }

  /**
   * Update presence for a user in a workspace
   */
  public updatePresence(workspaceId: string, userPresence: RealtimePresenceUser) {
    if (!this.presenceStore.has(workspaceId)) {
      this.presenceStore.set(workspaceId, new Map());
    }
    const map = this.presenceStore.get(workspaceId)!;
    map.set(userPresence.userId, { ...userPresence, lastPing: Date.now() });

    // Clean up stale presences (> 45s without ping)
    const now = Date.now();
    for (const [uid, pres] of map.entries()) {
      if (now - pres.lastPing > 45000) {
        map.delete(uid);
      }
    }

    // Broadcast presence update
    const event: RealtimeEvent = {
      id: `evt_pres_${Date.now()}`,
      workspaceId,
      type: 'presence:update',
      senderId: userPresence.userId,
      senderName: userPresence.name,
      timestamp: Date.now(),
      payload: Array.from(map.values()),
    };
    this.broadcast(workspaceId, event);
  }

  public getOnlineUsers(workspaceId: string): RealtimePresenceUser[] {
    const map = this.presenceStore.get(workspaceId);
    if (!map) return [];
    const now = Date.now();
    return Array.from(map.values()).filter((p) => now - p.lastPing <= 45000);
  }
}

const globalForHub = global as unknown as { realtimeHub?: RealtimeHub };
export const realtimeHub = globalForHub.realtimeHub || new RealtimeHub();
if (process.env.NODE_ENV !== 'production') globalForHub.realtimeHub = realtimeHub;
