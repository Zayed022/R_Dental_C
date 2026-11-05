import React from 'react';
import { createRoot } from 'react-dom/client';
import { setApiDepartment } from './api';
import { PublicSite } from './pages/dental/DentalPage';
import { ReviewsPage } from './pages/dental/ReviewsPage';
import { SkinHairPage } from './pages/skin/SkinHairPage';
import { AdminApp } from './admin/AdminApp';

import './styles.css';
import './skin.css';
import './dental-theme.css';

function App() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const isSkin = pathname === '/skin-hair' || pathname.startsWith('/skin-hair/');
  const isReviews = pathname === '/reviews' || pathname.startsWith('/reviews/');

  const department = isSkin ? 'skin' : 'dental';
  setApiDepartment(department);

  if (isAdmin) return <AdminApp />;
  if (isSkin) return <SkinHairPage />;
  if (isReviews) return <ReviewsPage />;

  return <PublicSite />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
