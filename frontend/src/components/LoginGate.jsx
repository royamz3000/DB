import { useState } from 'react';
import Button from './Button';
import { login } from '../api/auth';

export default function LoginGate({ onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { user } = await login(email, password);
      onAuthenticated(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form
        onSubmit={submit}
        className="card card-solid"
        style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="brand-mark" />
          <span className="text-panel">Sieve</span>
        </div>
        <p className="text-secondary muted">Sign in with your account to continue.</p>
        <input
          type="email"
          className="input"
          placeholder="Email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          className="input"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Log in'}
        </Button>
        {error && <p className="text-caption" style={{ color: 'oklch(0.66 0.125 25)' }}>{error}</p>}
      </form>
    </div>
  );
}
