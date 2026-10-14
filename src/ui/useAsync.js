import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data for a page. `fn` should be stable (define outside the component or useCallback).
 * Returns { data, setData, loading, error, reload }.
 */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const alive = useRef(true);
  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    return Promise.resolve()
      .then(fn)
      .then((data) => alive.current && setState({ data, loading: false, error: '' }))
      .catch((e) => alive.current && setState((s) => ({ ...s, loading: false, error: e.message || 'Something went wrong' })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    alive.current = true;
    run();
    return () => { alive.current = false; };
  }, [run]);
  const setData = useCallback((next) => setState((s) => ({ ...s, data: typeof next === 'function' ? next(s.data) : next })), []);
  return { ...state, setData, reload: run };
}
