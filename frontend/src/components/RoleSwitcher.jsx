import { useNavigate } from 'react-router-dom';
import { useRole, ROLE_DEFAULT_ROUTE } from '../context/RoleContext';
import { cx } from '../lib/cx';

export default function RoleSwitcher() {
  const { role, setRole } = useRole();
  const navigate = useNavigate();

  const switchTo = (next) => {
    if (next === role) return;
    setRole(next);
    navigate(ROLE_DEFAULT_ROUTE[next]);
  };

  return (
    <div className="role-switch">
      <span>Signed in as</span>
      <span className="role-switch-track">
        <button type="button" className={cx('role-switch-option', role === 'ops' && 'is-active')} onClick={() => switchTo('ops')}>
          Email ops
        </button>
        <button type="button" className={cx('role-switch-option', role === 'sales' && 'is-active')} onClick={() => switchTo('sales')}>
          Sales rep
        </button>
      </span>
    </div>
  );
}
