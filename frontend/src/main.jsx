import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/tokens.css';
import './styles/global.css';
import './styles/components.css';
import App from './App.jsx';
import { ToastProvider } from './context/ToastContext';
import { RoleProvider } from './context/RoleContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <RoleProvider>
          <App />
        </RoleProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
