import Icon from './Icon';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

export default function Modal({ open, onClose, title, kicker, children, foot, width }) {
  useEscapeToClose(open, onClose);
  if (!open) return null;
  return (
    <div className="overlay open" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={width ? { maxWidth: width } : undefined}>
        <div className="modal-head">
          <div>
            {kicker && <span className="kicker">{kicker}</span>}
            {title && <h3 style={{ marginTop: kicker ? 6 : 0 }}>{title}</h3>}
          </div>
          <button className="x-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}
