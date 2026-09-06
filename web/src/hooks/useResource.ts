import { useCallback, useEffect, useState } from 'react';
import { request } from '../api/client';

export function useResource<T>(path: string, pollMs = 0) {
  const [state, setState] = useState<{ data: T | null; error: Error | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(value => value + 1), []);
  const updateData = useCallback((update: (current: T) => T) => {
    setState(current => current.data === null ? current : { ...current, data: update(current.data) });
  }, []);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    setState({ data: null, error: null, loading: true });
    const load = async () => {
      try {
        const data = await request<T>(path, { signal: controller.signal });
        if (active) setState({ data, error: null, loading: false });
      } catch (error) {
        if (active) setState(previous => ({ ...previous, error: error as Error, loading: false }));
      }
      if (active && pollMs) timer = setTimeout(load, pollMs);
    };
    void load();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [path, version, pollMs]);
  return { ...state, reload, updateData };
}
