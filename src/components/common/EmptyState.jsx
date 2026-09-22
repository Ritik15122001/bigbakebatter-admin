import Icon from './Icon';

export default function EmptyState({ icon = 'info', title, message, action, small }) {
  return (
    <div className={small ? 'a-empty small' : 'a-empty'}>
      <span className="eico">
        <Icon name={icon} className="icon icon-md" />
      </span>
      <h4>{title}</h4>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
