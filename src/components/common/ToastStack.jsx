import { useUiStore } from '../../store/uiStore';
import Icon from './Icon';

export default function ToastStack() {
  const toasts = useUiStore((s) => s.toasts);
  const dismissToast = useUiStore((s) => s.dismissToast);

  return (
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind || 'ok'}`}>
          <span className="tico">
            <Icon name={t.kind === 'err' ? 'alert' : t.kind === 'info' ? 'info' : 'check'} className="icon icon-sm" />
          </span>
          <span className="tx">
            <b>{t.title}</b>
            {t.subtitle && <span>{t.subtitle}</span>}
          </span>
          <button className="x-btn" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
            <Icon name="x" className="icon icon-sm" />
          </button>
        </div>
      ))}
    </div>
  );
}
