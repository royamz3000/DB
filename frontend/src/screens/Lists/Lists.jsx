import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash } from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { useLists } from '../../context/ListsContext';
import { useToast } from '../../context/ToastContext';
import { createList, deleteList } from '../../api/lists';
import './Lists.css';

export default function Lists() {
  const { lists, setSelectedListId, refreshLists } = useLists();
  const navigate = useNavigate();
  const showToast = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (list) => {
    const ok = window.confirm(
      `Delete the list "${list.name}" and all ${list.entry_count.toLocaleString()} addresses in it?\n\n` +
      'This permanently removes the list and its entries. This cannot be undone.',
    );
    if (!ok) return;
    setDeletingId(list.id);
    try {
      const { entriesDeleted } = await deleteList(list.id);
      showToast(`Deleted "${list.name}" (${entriesDeleted.toLocaleString()} addresses removed)`);
      refreshLists();
    } catch (err) {
      showToast(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const browse = (list) => {
    setSelectedListId(String(list.id));
    navigate('/suppressions');
  };

  const uploadInto = (list) => {
    navigate('/upload', { state: { presetListId: list.id } });
  };

  const submitNewList = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createList({ name: name.trim(), description: description.trim() || null });
    setName('');
    setDescription('');
    setCreating(false);
    refreshLists();
  };

  return (
    <>
      <PageHeader
        kicker="Lists"
        title="Suppression lists"
        subtitle="System lists are written to automatically. Manual lists are yours to curate — upload into any of them."
      />

      <div className="lists-grid">
        {lists.map((list) => (
          <Card key={list.id}>
            <div className="list-card-head">
              <div>
                <div className="text-label">{list.kind}</div>
                <div className="text-panel">{list.name}</div>
              </div>
              <button
                type="button"
                className="list-card-delete"
                title="Delete this list and its addresses"
                onClick={() => handleDelete(list)}
                disabled={deletingId === list.id}
              >
                <Trash size={16} />
              </button>
            </div>
            <div className="list-card-stats">
              <div>
                <div className="list-card-stat-value">{list.entry_count.toLocaleString()}</div>
                <div className="text-caption muted">addresses</div>
              </div>
              <div>
                <div className="list-card-stat-value">{list.added_this_week.toLocaleString()}</div>
                <div className="text-caption muted">added this week</div>
              </div>
            </div>
            <p className="text-secondary muted">{list.description}</p>
            <div className="list-card-footer">
              <Button variant="primary" onClick={() => browse(list)} style={{ flex: 1 }}>Browse</Button>
              <Button variant="secondary" onClick={() => uploadInto(list)} style={{ flex: 1 }}>Upload into</Button>
            </div>
          </Card>
        ))}

        <div className="new-list-tile" onClick={() => !creating && setCreating(true)}>
          {creating ? (
            <form className="new-list-form" onSubmit={submitNewList} onClick={(e) => e.stopPropagation()}>
              <input className="input" placeholder="List name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
              <input className="input" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" dense type="button" onClick={() => setCreating(false)} style={{ flex: 1 }}>Cancel</Button>
                <Button variant="primary" dense type="submit" style={{ flex: 1 }}>Create</Button>
              </div>
            </form>
          ) : (
            <>
              <Plus size={22} />
              <span>New suppression list</span>
            </>
          )}
        </div>
      </div>
    </>
  );
}
