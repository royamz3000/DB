import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginGate from './components/LoginGate';
import Sidebar from './components/Sidebar';
import { ListsProvider } from './context/ListsContext';
import { RoleProvider, useRole } from './context/RoleContext';
import { fetchSession } from './api/auth';
import { registerUnauthorizedHandler } from './api/client';

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
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out

  useEffect(() => {
    registerUnauthorizedHandler(() => setUser(null));
    fetchSession()
      .then((data) => setUser(data.authenticated ? data.user : null))
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) return null;
  if (!user) return <LoginGate onAuthenticated={setUser} />;

  return (
    <RoleProvider user={user}>
      <ListsProvider>
        <Shell />
      </ListsProvider>
    </RoleProvider>
  );
}
