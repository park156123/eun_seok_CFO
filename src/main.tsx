import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { SelectedMonthProvider } from './context/SelectedMonthContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SelectedMonthProvider>
      <App />
    </SelectedMonthProvider>
  </StrictMode>,
);

