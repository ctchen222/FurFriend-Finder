import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, Link } from 'react-router-dom';
import { SessionProvider, Protected } from './features/auth/SessionProvider';
import { AuthPage } from './features/auth/AuthPage';
import { HomePage } from './pages/HomePage';
import { Layout } from './ui/Layout';
import { ProfilePage } from './pages/ProfilePage';
import { CreateReportPage } from './pages/CreateReportPage';
import { ReportDetailPage } from './pages/ReportDetailPage';
import { QuickMatchPage } from './pages/QuickMatchPage';
import { AnimalsPage, AnimalDetailPage } from './pages/AnimalsPage';
import './styles.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><SessionProvider><Routes>
  <Route element={<Layout />}>
    <Route index element={<HomePage />} />
    <Route path="login" element={<AuthPage key="login" mode="login" />} />
    <Route path="register" element={<AuthPage key="register" mode="register" />} />
    <Route path="forgot-password" element={<AuthPage key="forgot" mode="forgot" />} />
    <Route path="reset-password" element={<AuthPage key="reset" mode="reset" />} />
    <Route path="profile" element={<Protected><ProfilePage /></Protected>} />
    <Route path="report-lost" element={<Protected><CreateReportPage /></Protected>} />
    <Route path="reports/:id" element={<Protected><ReportDetailPage /></Protected>} />
    <Route path="quick-use" element={<QuickMatchPage />} />
    <Route path="shelter-animals" element={<AnimalsPage />} />
    <Route path="shelter-animals/:id" element={<AnimalDetailPage />} />
    <Route path="*" element={<section className="section"><h1>找不到這個頁面</h1><Link to="/">返回首頁</Link></section>} />
  </Route>
</Routes></SessionProvider></BrowserRouter></React.StrictMode>);
