import { getSocketOrigin } from '@/lib/api-config';
import type { SessionStatePayload } from '@/lib/realtime-api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

type UseQuizSocketOptions = {
  token: string | null;
  enabled: boolean;
  onState: (payload: SessionStatePayload) => void;
};

export function useQuizSocket({ token, enabled, onState }: UseQuizSocketOptions) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const onStateRef = useRef(onState);
  onStateRef.current = onState;

  useEffect(() => {
    if (!enabled || !token) {
      setConnected(false);
      return;
    }

    const socket = io(getSocketOrigin(), {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 8,
    });

    socketRef.current = socket;

    const handler = (payload: SessionStatePayload) => {
      onStateRef.current(payload);
    };

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('session:state', handler);

    return () => {
      socket.off('session:state', handler);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [enabled, token]);

  const emitJoin = useCallback(
    (sessionCode: string): Promise<SessionStatePayload | undefined> => {
      return new Promise((resolve, reject) => {
        const s = socketRef.current;
        if (!s || !token) {
          resolve(undefined);
          return;
        }
        s.emit(
          'session:join',
          { token, sessionCode: sessionCode.trim().toUpperCase() },
          (response: SessionStatePayload | { message?: string }) => {
            if (response && 'session' in response) {
              resolve(response);
            } else {
              reject(new Error('Falha ao entrar na sala em tempo real'));
            }
          },
        );
      });
    },
    [token],
  );

  return { connected, emitJoin };
}
