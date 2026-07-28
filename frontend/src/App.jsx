import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginGate from './components/LoginGate';
import Sidebar from './components/Sidebar';
import { ListsProvider } from './context/ListsContext';
import { fetchSession } from './api/auth';
import { registerUnauthorizedHandler } from './api/client';
import { useRole } from './context/RoleContext';

import Overview from './screens/Overview/Overview';
import UploadWizard from './screens/Upload/UploadWizard';
import CheckEmails from './screens/CheckEmails/CheckEmails';
import SuppressionList from './screens/Suppressions/SuppressionList';
import Lists from './screens/Lists/Lists';
import Settings from './screens/Settings/Settings';
import MyRecentChecks from './screens/Checks/MyRecentChecks';

function Shell() {
  const { isOps } = useRole();

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <div className="app-content">
          <Routes>
            <Route path="/" element={isOps ? <Overview /> : <Navigate to="/check" replace />} />
            <Route path="/upload" element={isOps ? <UploadWizard /> : <Navigate to="/check" replace />} />
            <Route path="/check" element={<CheckEmails />} />
            <Route path="/suppressions" element={<SuppressionList />} />
            <Route path="/lists" element={isOps ? <Lists /> : <Navigate to="/check" replace />} />
            <Route path="/settings" element={isOps ? <Settings /> : <Navigate to="/check" replace />} />
            <Route path="/checks" element={<MyRecentChecks />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(null);

  useEffect(() => {
    registerUnauthorizedHandler(() => setAuthenticated(false));
    fetchSession()
      .then((data) => setAuthenticated(data.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  if (authenticated === null) return null;
  if (!authenticated) return <LoginGate onAuthenticated={() => setAuthenticated(true)} />;

  return (
    <ListsProvider>
      <Shell />
    </ListsProvider>
  );
}
