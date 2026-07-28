import { NavLink } from 'react-router-dom';
import {
  ChartLineUp,
  UploadSimple,
  MagnifyingGlass,
  ListChecks,
  Stack,
  GearSix,
  ClockCounterClockwise,
  CaretDown,
} from '@phosphor-icons/react';
import { useRole } from '../context/RoleContext';
import { useLists } from '../context/ListsContext';
import { cx } from '../lib/cx';

const OPS_NAV = [
  { to: '/', label: 'Overview', icon: ChartLineUp, end: true },
  { to: '/upload', label: 'Upload lists', icon: UploadSimple },
  { to: '/check', label: 'Check emails', icon: MagnifyingGlass },
  { to: '/suppressions', label: 'Suppression list', icon: ListChecks },
  { to: '/lists', label: 'Lists', icon: Stack },
  { to: '/settings', label: 'API & settings', icon: GearSix },
];

const SALES_NAV = [
  { to: '/check', label: 'Check a list', icon: MagnifyingGlass },
  { to: '/checks', label: 'My recent checks', icon: ClockCounterClockwise },
  { to: '/suppressions', label: 'Search suppressions', icon: ListChecks },
];

export default function Sidebar() {
  const { isOps } = useRole();
  const { lists, selectedListId, setSelectedListId } = useLists();
  const nav = isOps ? OPS_NAV : SALES_NAV;

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" />
        <span className="brand-word">Sieve</span>
      </div>

      <label className="field">
        <span className="field-label">Suppression list</span>
        <span className="select-wrap">
          <select className="select" value={selectedListId} onChange={(e) => setSelectedListId(e.target.value)}>
            <option value="">All lists</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <CaretDown size={13} weight="bold" />
        </span>
      </label>

      <nav className="sidebar-nav">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('nav-btn', isActive && 'is-active')}>
            <span className="nav-btn-icon">
              <Icon size={17} weight="regular" />
            </span>
            <span className="nav-btn-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      {isOps && (
        <div className="sidebar-footer">
          <div className="credits-card">
            <span className="text-label-sm">API credits</span>
            <span className="credits-value">184,220</span>
            <div className="credits-track">
              <div className="credits-fill" style={{ width: '63%' }} />
            </div>
            <span className="text-caption faint">of 500,000 · resets Aug 1</span>
          </div>
        </div>
      )}
    </aside>
  );
}
