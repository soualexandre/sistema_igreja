"use client";

import { getSocketOrigin } from "@/lib/api-config";
import type { GuestJoinResponse, SessionStatePayload } from "@/lib/realtime-api";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

export type QuizSocketAuth = { mode: "auth"; token: string };

export type QuizSocketGuest = {
  mode: "guest";
  displayName: string;
  guestId: string | null;
};

type UseQuizSocketOptions = {
  enabled: boolean;
  onState: (payload: SessionStatePayload) => void;
} & (QuizSocketAuth | QuizSocketGuest);

export function useQuizSocket(options: UseQuizSocketOptions) {
  const { enabled, onState } = options;
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const onStateRef = useRef(onState);
  onStateRef.current = onState;

  const authRef = useRef(options);
  authRef.current = options;

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    const socket = io(getSocketOrigin(), {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 8,
    });

    socketRef.current = socket;

    const handler = (payload: SessionStatePayload) => {
      onStateRef.current(payload);
    };

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("session:state", handler);

    return () => {
      socket.off("session:state", handler);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [enabled]);

  const emitJoin = useCallback(
    (
      sessionCode: string,
      guestOverride?: { displayName: string; guestId?: string | null },
    ): Promise<SessionStatePayload | GuestJoinResponse | undefined> => {
      return new Promise((resolve, reject) => {
        const s = socketRef.current;
        if (!s) {
          resolve(undefined);
          return;
        }
        const o = authRef.current;
        const code = sessionCode.trim().toUpperCase();
        const payload =
          o.mode === "auth"
            ? { token: o.token, sessionCode: code }
            : {
                sessionCode: code,
                displayName:
                  guestOverride?.displayName ?? o.displayName,
                ...(guestOverride?.guestId
                  ? { guestId: guestOverride.guestId }
                  : o.guestId
                    ? { guestId: o.guestId }
                    : {}),
              };

        s.emit(
          "session:join",
          payload,
          (response: SessionStatePayload | GuestJoinResponse | { message?: string }) => {
            if (response && "session" in response) {
              resolve(response);
            } else {
              reject(new Error("Falha ao entrar na sala em tempo real"));
            }
          },
        );
      });
    },
    [],
  );

  return { connected, emitJoin };
}
