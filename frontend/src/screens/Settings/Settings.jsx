import { useEffect, useState } from 'react';
import { Copy, Eye, EyeSlash } from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader';
import Card, { PanelHead } from '../../components/Card';
import Button from '../../components/Button';
import IconButton from '../../components/IconButton';
import CheckboxRow from '../../components/Checkbox';
import { fetchApiKeys, createApiKey } from '../../api/apiKeys';
import { fetchWebhookSettings, updateWebhookSettings } from '../../api/settings';
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

export default function Settings() {
  const showToast = useToast();
  const [keys, setKeys] = useState([]);
  const [revealed, setRevealed] = useState(new Set());
  const [webhooks, setWebhooks] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchApiKeys().then((d) => setKeys(d.keys));
    fetchWebhookSettings().then(setWebhooks);
  }, []);

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
{`curl https://api.sieve.email/v1/check \\
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
