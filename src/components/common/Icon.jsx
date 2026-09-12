import { iconSvg } from '../../utils/iconPaths';

export default function Icon({ name, className = 'icon', ...rest }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: iconSvg(name) }}
      {...rest}
    />
  );
}
