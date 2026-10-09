export type StartupSessionResult =
  | { kind: "response"; response: Response }
  | { kind: "unauthenticated" }
  | { kind: "unavailable"; network: boolean }
  | { kind: "aborted" };

type CheckStartupSessionOptions = {
  signal: AbortSignal;
  requestSession: (signal: AbortSignal) => Promise<Response>;
  wait: (signal: AbortSignal) => Promise<void>;
};

export async function checkStartupSession({
  signal,
  requestSession,
  wait,
}: CheckStartupSessionOptions): Promise<StartupSessionResult> {
  let sawNetworkError = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (signal.aborted) return { kind: "aborted" };
    try {
      let response = await requestSession(signal);
      if (signal.aborted) return { kind: "aborted" };
      if (response.status === 401) {
        response = await requestSession(signal);
        if (signal.aborted) return { kind: "aborted" };
        if (response.status === 401) return { kind: "unauthenticated" };
      }
      if (response.ok) return { kind: "response", response };
    } catch {
      if (signal.aborted) return { kind: "aborted" };
      sawNetworkError = true;
    }

    if (attempt < 2) {
      await wait(signal);
      if (signal.aborted) return { kind: "aborted" };
    }
  }
  return { kind: "unavailable", network: sawNetworkError };
}
