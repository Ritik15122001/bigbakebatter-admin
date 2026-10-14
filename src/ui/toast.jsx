import Icon from '../components/common/Icon';
import { useUiStore } from '../store/uiStore';

const push = (kind) => (title, subtitle) => useUiStore.getState().pushToast({ title, subtitle, kind });

/** toast.success('Saved') · toast.error('Could not save', err.message) · toast.info('…') */
export const toast = { success: push('ok'), error: push('err'), info: push('info') };
export const useToast = () => toast;

const ICON = { ok: ['check', 'green'], err: ['alert', 'red'], info: ['info', 'blue'] };

export function Toasts() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);
  return (
    <div className="u-app u-toasts" aria-live="polite">
      {toasts.map((t) => {
        const [icon, tone] = ICON[t.kind] || ICON.ok;
        return (
          <div key={t.id} className="u-toast" role="status">
            <span className={`u-toast-ico tone-${tone}`}><Icon name={icon} /></span>
            <div className="u-toast-tx">
              <b>{t.title}</b>
              {t.subtitle && <span>{t.subtitle}</span>}
            </div>
            <button className="u-iconbtn" style={{ width: 28, height: 28 }} aria-label="Dismiss" onClick={() => dismiss(t.id)}><Icon name="x" /></button>
          </div>
        );
      })}
    </div>
  );
}
