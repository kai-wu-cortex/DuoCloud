import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

const EvidenceApp = lazy(() => import('./components/EvidenceApp.tsx'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route
          path="/evidence/:id"
          element={(
            <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-800 font-bold">正在加载打样画板工程...</div>}>
              <EvidenceApp />
            </Suspense>
          )}
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
