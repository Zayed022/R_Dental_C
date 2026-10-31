import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { setApiDepartment } from './api';
import { PublicSite } from './pages/dental/DentalPage';
import { SkinHairPage } from './pages/skin/SkinHairPage';
import { AdminApp } from './admin/AdminApp';
import './styles.css';
import './skin.css';
import './dental-theme.css';

function App() {
  const pathname = window.location.pathname;
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const isSkin = pathname === '/skin-hair' || pathname.startsWith('/skin-hair/');
  const department = isSkin ? 'skin' : 'dental';
  setApiDepartment(department);
  useEffect(() => {
    document.title = isAdmin ? 'Admin Workspace · R Dental Clinic' : isSkin ? 'Skin & Hair · R Dental Clinic' : 'R Dental Clinic';
  }, [isAdmin, isSkin]);
  if (isAdmin) return <AdminApp/>;
  return isSkin ? <SkinHairPage/> : <PublicSite/>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
