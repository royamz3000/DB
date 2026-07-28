export default function CheckboxRow({ checked, onChange, label, note, disabled }) {
  return (
    <label className="checkbox-row" style={disabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}>
      <input type="checkbox" className="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span>
        <div className="checkbox-row-label">{label}</div>
        {note && <div className="checkbox-row-note">{note}</div>}
      </span>
    </label>
  );
}
