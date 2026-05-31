import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SplashPage } from './pages/SplashPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { CreateHostPage } from './pages/CreateHostPage';
import { HostDetailPage } from './pages/HostDetailPage';
import { CreateContainerPage } from './pages/CreateContainerPage';
import { ManageNetworksPage } from './pages/ManageNetworksPage';
import { CreateNetworkPage } from './pages/CreateNetworkPage';
import { ManageVolumesPage } from './pages/ManageVolumesPage';
import { CreateVolumePage } from './pages/CreateVolumePage';
import { ManageImagesPage } from './pages/ManageImagesPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SplashPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/hosts/create" element={<CreateHostPage />} />
          <Route path="/hosts/:hostId" element={<HostDetailPage />} />
          <Route path="/hosts/:hostId/containers/create" element={<CreateContainerPage />} />
          <Route path="/hosts/:hostId/containers/:containerId" element={<HostDetailPage />} />
          <Route path="/hosts/:hostId/networks" element={<ManageNetworksPage />} />
          <Route path="/hosts/:hostId/networks/create" element={<CreateNetworkPage />} />
          <Route path="/hosts/:hostId/volumes" element={<ManageVolumesPage />} />
          <Route path="/hosts/:hostId/volumes/create" element={<CreateVolumePage />} />
          <Route path="/hosts/:hostId/images" element={<ManageImagesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;