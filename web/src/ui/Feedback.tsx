export function Feedback({ loading, error, retry }: { loading?: boolean; error?: Error | null; retry?: () => void }) {
  if (loading) return <p role="status" aria-live="polite">載入中…</p>;
  if (error) return <div className="notice error" role="alert"><p>{error.message}</p>{retry && <button onClick={retry}>重新載入</button>}</div>;
  return null;
}
