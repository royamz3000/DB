import { useNavigate } from 'react-router-dom';
import { MagnifyingGlass, UploadSimple } from '@phosphor-icons/react';
import AccountMenu from './AccountMenu';
import Button from './Button';
import { useRole } from '../context/RoleContext';

export default function PageHeader({ kicker, title, subtitle, actions }) {
  const { isOps } = useRole();
  const navigate = useNavigate();

  return (
    <div className="page-header">
      <div className="page-header-text">
        {kicker && <span className="text-label">{kicker}</span>}
        <h1 className="text-title">{title}</h1>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      <div className="page-header-actions">
        <AccountMenu />
        {actions}
        {isOps && (
          <Button variant="secondary" icon={<UploadSimple size={14} />} onClick={() => navigate('/upload')}>
            Upload list
          </Button>
        )}
        <Button variant="primary" icon={<MagnifyingGlass size={14} />} onClick={() => navigate('/check')}>
          Check emails
        </Button>
      </div>
    </div>
  );
}
