import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '../context/RoleContext';
import { useToast } from '../context/ToastContext';
import { logout, changePassword } from '../api/auth';
import Button from './Button';

const ROLE_LABEL = { ops: 'Email ops', sales: 'Sales rep' };

export default function AccountMenu() {
  const { user } = useRole();
  const navigate = useNavigate();
  const showToast = useToast();
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  const submitChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      showToast('Password updated');
      setChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div className="text-secondary muted">
        Signed in as <span style={{ color: 'var(--text)', fontWeight: 500 }}>{user.name}</span> · {ROLE_LABEL[user.role]}
      </div>
      <Button variant="ghost" dense onClick={() => setChangingPassword((v) => !v)}>
        Change password
      </Button>
      <Button variant="secondary" dense onClick={handleLogout}>
        Log out
      </Button>

      {changingPassword && (
        <form
          onSubmit={submitChangePassword}
          className="card card-solid"
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 260, zIndex: 20,
            display: 'flex', flexDirection: 'column', gap: 10, padding: 16,
          }}
        >
          <input
            type="password"
            className="input"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <input
            type="password"
            className="input"
            placeholder="New password (min 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
          {error && <p className="text-caption" style={{ color: 'oklch(0.66 0.125 25)' }}>{error}</p>}
          <Button type="submit" dense disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </form>
      )}
    </div>
  );
}
