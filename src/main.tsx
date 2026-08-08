import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthGate } from './components/AuthGate';
import { SelectedMonthProvider } from './context/SelectedMonthContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <SelectedMonthProvider>
        <App />
      </SelectedMonthProvider>
    </AuthGate>
  </StrictMode>,
);


