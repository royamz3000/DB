import { useEffect, useState } from 'react';
import { Copy, PlugsConnected } from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader';
import Card, { PanelHead } from '../../components/Card';
import Button from '../../components/Button';
import IconButton from '../../components/IconButton';
import CheckboxRow from '../../components/Checkbox';
import { SelectField } from '../../components/Field';
import { fetchApiKeys, createApiKey } from '../../api/apiKeys';
import { fetchWebhookSettings, updateWebhookSettings } from '../../api/settings';
import { fetchUsers, createUser, deleteUser } from '../../api/users';
import {
  fetchConstantContactConnections, updateConnectionList, syncConnectionNow,
  disconnectConnection, constantContactConnectUrl,
} from '../../api/integrations';
import { useRole } from '../../context/RoleContext';
import { useLists } from '../../context/ListsContext';
import { useToast } from '../../context/ToastContext';
import './Settings.css';

function maskKey(value) {
  return `${value.slice(0, 8)}${'•'.repeat(14)}${value.slice(-4)}`;
}

function relativeTime(iso) {
  if (!iso) return 'never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `used ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `used ${hours} hr ago`;
  return `used ${new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

const emptyNewUser = { name: '', email: '', password: '', role: 'sales' };

export default function Settings() {
  const showToast = useToast();
  const { user: currentUser } = useRole();
  const { lists } = useLists();
  const [keys, setKeys] = useState([]);
  const [revealed, setRevealed] = useState(new Set());
  const [webhooks, setWebhooks] = useState(null);

  const [ccConnections, setCcConnections] = useState(null);
  const [ccBusyId, setCcBusyId] = useState(null);

  const loadCcConnections = () => fetchConstantContactConnections().then((d) => setCcConnections(d.connections));

  const [teamMembers, setTeamMembers] = useState([]);
  const [addingMember, setAddingMember] = useState(false);
  const [newUser, setNewUser] = useState(emptyNewUser);
  const [teamError, setTeamError] = useState('');

  const loadTeam = () => fetchUsers().then((d) => setTeamMembers(d.users));

  useEffect(() => {
    fetchApiKeys().then((d) => setKeys(d.keys));
    fetchWebhookSettings().then(setWebhooks);
    loadTeam();
    loadCcConnections();
  }, []);

  const changeCcDestination = async (connectionId, listId) => {
    setCcBusyId(connectionId);
    try {
      await updateConnectionList(connectionId, Number(listId));
      await loadCcConnections();
    } finally {
      setCcBusyId(null);
    }
  };

  const runCcSyncNow = async (connectionId) => {
    setCcBusyId(connectionId);
    try {
      const result = await syncConnectionNow(connectionId);
      showToast(`Synced — ${result.added} new suppression${result.added === 1 ? '' : 's'} added`);
    } catch (err) {
      showToast(err.message);
    } finally {
      setCcBusyId(null);
      loadCcConnections();
    }
  };

  const disconnectCc = async (connectionId) => {
    setCcBusyId(connectionId);
    try {
      await disconnectConnection(connectionId);
      await loadCcConnections();
    } finally {
      setCcBusyId(null);
    }
  };

  const submitNewUser = async (e) => {
    e.preventDefault();
    setTeamError('');
    try {
      await createUser(newUser);
      setNewUser(emptyNewUser);
      setAddingMember(false);
      loadTeam();
    } catch (err) {
      setTeamError(err.message);
    }
  };

  const removeMember = async (member) => {
    try {
      await deleteUser(member.id);
      loadTeam();
    } catch (err) {
      showToast(err.message);
    }
  };

  const toggleReveal = (id) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyKey = (value) => {
    navigator.clipboard.writeText(value);
    showToast('API key copied');
  };

  const addKey = async () => {
    const { key } = await createApiKey({ name: 'New key', scope: 'check_only', env: 'live' });
    setKeys((prev) => [...prev, key]);
  };

  const patchWebhooks = (patch) => {
    setWebhooks((prev) => ({ ...prev, ...patch }));
    updateWebhookSettings(patch);
  };

  const exampleKey = keys.find((k) => k.scope === 'check_and_suppress') || keys[0];

  return (
    <>
      <PageHeader kicker="API & settings" title="API keys & automation" subtitle="Check addresses from your own app, and decide what happens when an import finishes." />

      <Card>
        <PanelHead
          title="Team"
          meta="Who can sign in, and what they can do"
          actions={<Button variant="primary" onClick={() => setAddingMember((v) => !v)}>Add teammate</Button>}
        />

        {addingMember && (
          <form
            onSubmit={submitNewUser}
            style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}
          >
            <label className="field">
              <span className="field-label">Name</span>
              <input className="input" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} required />
            </label>
            <label className="field">
              <span className="field-label">Email</span>
              <input type="email" className="input" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
            </label>
            <label className="field">
              <span className="field-label">Password</span>
              <input type="password" className="input" minLength={8} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
            </label>
            <SelectField label="Role" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
              <option value="sales">Sales rep</option>
              <option value="ops">Email ops</option>
            </SelectField>
            <Button type="submit">Create account</Button>
          </form>
        )}
        {teamError && <p className="text-caption" style={{ color: 'oklch(0.66 0.125 25)', marginBottom: 12 }}>{teamError}</p>}

        <div>
          {teamMembers.map((member) => (
            <div key={member.id} className="keys-row" style={{ gridTemplateColumns: '1.3fr 1.3fr 0.7fr 130px' }}>
              <div className="text-table">{member.name}</div>
              <div className="text-secondary muted">{member.email}</div>
              <div className="text-caption">{member.role === 'ops' ? 'Email ops' : 'Sales rep'}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="ghost"
                  dense
                  onClick={() => removeMember(member)}
                  disabled={member.id === currentUser.id}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {ccConnections && (
        <Card className="settings-section">
          <PanelHead
            title="Constant Contact"
            meta="Automatically pull unsubscribes (and, best-effort, bounces) into a suppression list — connect as many accounts as you need"
            actions={
              <Button variant="primary" icon={<PlugsConnected size={14} />} onClick={() => { window.location.href = constantContactConnectUrl; }}>
                {ccConnections.length === 0 ? 'Connect Constant Contact' : 'Connect another account'}
              </Button>
            }
          />

          {ccConnections.length === 0 ? (
            <p className="text-secondary muted">
              Not connected. Connecting requires a Constant Contact developer app (Client ID/Secret set as
              server environment variables) and a deployed HTTPS URL for the OAuth redirect.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {ccConnections.map((conn) => {
                const busy = ccBusyId === conn.id;
                return (
                  <div key={conn.id} style={{ paddingBottom: 18, borderBottom: '1px solid var(--row-rule)' }}>
                    <div className="text-table" style={{ marginBottom: 10 }}>{conn.label}</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                      <SelectField
                        label="Sync new suppressions into"
                        value={conn.destination_list_id || ''}
                        onChange={(e) => changeCcDestination(conn.id, e.target.value)}
                        disabled={busy}
                      >
                        <option value="" disabled>Choose a list…</option>
                        {lists.map((l) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </SelectField>
                      <Button variant="primary" onClick={() => runCcSyncNow(conn.id)} disabled={busy || !conn.destination_list_id}>
                        Sync now
                      </Button>
                      <Button variant="secondary" onClick={() => disconnectCc(conn.id)} disabled={busy}>
                        Disconnect
                      </Button>
                    </div>
                    <p className="text-caption muted" style={{ marginTop: 10 }}>
                      Connected {new Date(conn.connected_at).toLocaleDateString()} ·{' '}
                      {conn.last_synced_at
                        ? `last synced ${new Date(conn.last_synced_at).toLocaleString()} (${conn.last_sync_added_count} added)`
                        : 'not synced yet'}
                      {conn.last_sync_status === 'error' && (
                        <span style={{ color: 'oklch(0.66 0.125 25)' }}> · last sync failed: {conn.last_sync_error}</span>
                      )}
                    </p>
                  </div>
                );
              })}
              <p className="text-caption faint">
                Every connected account also syncs automatically every 30 minutes in the background.
              </p>
            </div>
          )}
        </Card>
      )}

      <Card className="settings-section">
        <PanelHead title="API keys" actions={<Button variant="primary" onClick={addKey}>Create key</Button>} />
        <div>
          {keys.map((key) => {
            const isRevealed = revealed.has(key.id);
            return (
              <div key={key.id} className="keys-row">
                <div>
                  <div className="text-table">{key.name}</div>
                  <div className="text-caption faint">{key.scope === 'check_and_suppress' ? 'check + suppress' : 'check only'}</div>
                </div>
                <div className="mono text-secondary">{isRevealed ? key.key_value : maskKey(key.key_value)}</div>
                <div className="text-caption muted">{relativeTime(key.last_used_at)}</div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <Button variant="ghost" dense onClick={() => toggleReveal(key.id)}>{isRevealed ? 'Hide' : 'Reveal'}</Button>
                  <IconButton size={28} onClick={() => copyKey(key.key_value)} aria-label="Copy key">
                    <Copy size={14} />
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="settings-section">
        <h2 className="text-section">Check an address from your app</h2>
        <div className="code-block" style={{ marginTop: 12 }}>
{`curl https://api.bizcap.email/v1/check \\
  -H "Authorization: Bearer ${exampleKey ? maskKey(exampleKey.key_value) : 'sk_live_••••••'}" \\
  -d email="maria.chen@northgate.io"

{ "suppressed": true, "reason": "hard_bounce", "list": "Global bounces",
  "risk_score": 96, "added_at": "2026-07-24T09:12:00Z" }`}
        </div>
        <p className="text-caption muted" style={{ marginTop: 10 }}>
          Batch endpoint takes up to 10,000 addresses per call. <a href="#" style={{ color: 'var(--accent)' }} onClick={(e) => e.preventDefault()}>Full API reference</a>
        </p>
      </Card>

      {webhooks && (
        <Card className="settings-section">
          <h2 className="text-section">Webhooks & automation</h2>
          <div className="webhook-field" style={{ marginTop: 14 }}>
            <span className="field-label">Webhook URL</span>
            <input
              className="input mono"
              style={{ marginTop: 6 }}
              value={webhooks.webhook_url}
              onChange={(e) => setWebhooks((prev) => ({ ...prev, webhook_url: e.target.value }))}
              onBlur={(e) => patchWebhooks({ webhook_url: e.target.value })}
            />
          </div>

          <div className="webhook-field">
            <CheckboxRow
              checked={Boolean(webhooks.auto_suppress_hard_bounces)}
              onChange={(e) => patchWebhooks({ auto_suppress_hard_bounces: e.target.checked })}
              label="Auto-suppress hard bounces from the ESP webhook"
              note="Recommended. Entries are added within seconds of the bounce."
            />
          </div>
          <div className="webhook-field">
            <CheckboxRow
              checked={Boolean(webhooks.email_summary_on_import)}
              onChange={(e) => patchWebhooks({ email_summary_on_import: e.target.checked })}
              label="Email me a summary when an import finishes"
              note="Sent to ops@workspace and two other recipients."
            />
          </div>
          <div className="webhook-field">
            <CheckboxRow
              checked={Boolean(webhooks.auto_remove_soft_bounces_90d)}
              onChange={(e) => patchWebhooks({ auto_remove_soft_bounces_90d: e.target.checked })}
              label="Auto-remove soft bounces after 90 clean days"
              note="Off by default — soft bounces stay suppressed until you clear them."
            />
          </div>
        </Card>
      )}
    </>
  );
}
