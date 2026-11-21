import {
  NCEngine,
  AreaCode,
  DirectChannel,
  DirectChannelIdentifier,
  SendTextMessageParams,
} from '@nexconn/chat';

let initialized = false;
let guardAttached = false;
const SYNC_CHANNEL_NAME = 'dealroom_nexconn_sync_v1';

export interface DealRoomSyncPayload {
  sender: string;
  text?: string;
  quote?: any;
}

function getEngine(): any {
  return NCEngine;
}

function attachBrowserGuard(): void {
  if (guardAttached || typeof window === 'undefined') return;
  guardAttached = true;

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const joined = args
      .map((a) => (typeof a === 'object' && a !== null && 'message' in a ? (a as any).message : String(a)))
      .join(' ');
    if (joined.includes('onOfflineMessageSyncCompleted')) {
      return;
    }
    originalError(...args);
  };

  window.addEventListener(
    'error',
    (event: ErrorEvent) => {
      const text = `${event?.message || ''} ${event?.error?.message || ''}`;
      if (text.includes('onOfflineMessageSyncCompleted')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event?.reason as any;
    const text = `${reason?.message || ''} ${String(reason || '')}`;
    if (text.includes('onOfflineMessageSyncCompleted')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

function attachSafeStatusListeners(engine: any): void {
  const noop = () => {};
  const statusHandler = {
    onConnectionStatusChanged: noop,
    onOfflineMessageSyncStarted: noop,
    onOfflineMessageSyncProgress: noop,
    onOfflineMessageSyncCompleted: noop,
    onOfflineMessageSyncFailed: noop,
  };

  if (typeof engine?.addConnectionStatusListener === 'function') {
    engine.addConnectionStatusListener('deal-room-status', statusHandler);
  } else if (typeof engine?.setConnectionStatusListener === 'function') {
    engine.setConnectionStatusListener(statusHandler);
  }
}

export async function connectNexconn(
  appKey: string,
  token: string
): Promise<string> {
  attachBrowserGuard();
  const engine = getEngine();

  try {
    if (!initialized) {
      const areaCode = (AreaCode as any)?.SG ?? (AreaCode as any)?.SINGAPORE;
      const initConfig: Record<string, unknown> =
        areaCode !== undefined ? { appKey, areaCode } : { appKey };

      if (typeof engine?.initialize === 'function') {
        await engine.initialize(initConfig);
      } else if (typeof engine?.init === 'function') {
        await engine.init(initConfig);
      }

      attachSafeStatusListeners(engine);
      initialized = true;
    }
  } catch (initErr: any) {
    if (!String(initErr?.message || '').includes('onOfflineMessageSyncCompleted')) {
      throw initErr;
    }
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const doneResolve = (val: string) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };
    const doneReject = (err: Error) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };

    const onComplete = (userId: string, error: any) => {
      if (error && error.code !== 0 && error.isSuccess === false) {
        const msg = error.message || `Nexconn connect failed (${error.code})`;
        if (msg.includes('onOfflineMessageSyncCompleted')) {
          doneResolve('connected');
        } else {
          doneReject(new Error(msg));
        }
      } else {
        doneResolve(userId || 'connected');
      }
    };

    try {
      if (typeof engine?.connect !== 'function') {
        doneReject(new Error('NCEngine.connect is unavailable'));
        return;
      }

      const connectArg = engine.connect.length >= 2 ? token : { token };
      const result = engine.connect(connectArg, onComplete);

      if (result && typeof result.then === 'function') {
        result
          .then((res: any) => {
            if (res?.code && res.code !== 0) {
              const msg = res.msg || res.message || `Connect failed: ${res.code}`;
              if (msg.includes('onOfflineMessageSyncCompleted')) {
                doneResolve('connected');
              } else {
                doneReject(new Error(msg));
              }
            } else {
              doneResolve(res?.userId || res?.data?.userId || 'connected');
            }
          })
          .catch((err: any) => {
            if (String(err?.message || '').includes('onOfflineMessageSyncCompleted')) {
              doneResolve('connected');
            } else {
              doneReject(err instanceof Error ? err : new Error(String(err)));
            }
          });
      }
    } catch (err: any) {
      if (String(err?.message || '').includes('onOfflineMessageSyncCompleted')) {
        doneResolve('connected');
      } else {
        doneReject(err instanceof Error ? err : new Error(String(err)));
      }
    }
  });
}

export function subscribeDealRoomEvents(
  currentRole: string,
  onRemotePayload: (payload: DealRoomSyncPayload) => void
): () => void {
  const engine = getEngine();

  try {
    if (typeof engine?.addMessageHandler === 'function') {
      engine.addMessageHandler('deal-room-listener', {
        onMessageReceived: (event: any) => {
          const msg = event?.message || event;
          const sender = msg?.senderUserId || msg?.senderId || 'peer';
          if (sender === currentRole) return;

          const rawText: string =
            msg?.content?.content ||
            msg?.content?.text ||
            msg?.messageParams?.text ||
            msg?.text ||
            '';

          if (rawText) {
            onRemotePayload({ sender, text: rawText });
          }
        },
      });
    }
  } catch {
    // Ignore SDK handler registration error in local test mode
  }

  let bc: BroadcastChannel | null = null;
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
    bc.onmessage = (event: MessageEvent<DealRoomSyncPayload>) => {
      const data = event.data;
      if (!data || data.sender === currentRole) return;
      onRemotePayload(data);
    };
  }

  return () => {
    bc?.close();
  };
}

export async function sendNexconnMessage(
  targetUserId: string,
  senderRole: string,
  payload: { text?: string; quote?: any }
): Promise<void> {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    const bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
    bc.postMessage({ sender: senderRole, ...payload });
    bc.close();
  }

  if (!payload.text) return;

  try {
    const IdentifierClass: any = DirectChannelIdentifier;
    const ChannelClass: any = DirectChannel;
    const ParamsClass: any = SendTextMessageParams;

    const identifier =
      typeof IdentifierClass === 'function'
        ? new IdentifierClass(targetUserId)
        : IdentifierClass?.create?.(targetUserId) || { targetId: targetUserId };

    const channel =
      typeof ChannelClass?.obtainChannel === 'function'
        ? ChannelClass.obtainChannel(identifier)
        : new ChannelClass(identifier);

    const params =
      typeof ParamsClass === 'function'
        ? new ParamsClass(payload.text)
        : { text: payload.text, content: payload.text };

    await channel.sendMessage(params);
  } catch (err) {
    console.debug('Nexconn DirectChannel sendMessage debug:', err);
  }
}