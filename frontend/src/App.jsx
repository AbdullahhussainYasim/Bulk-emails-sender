import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './layouts/Layout';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Clients from './pages/Clients';
import Template from './pages/Template';
import Logs from './pages/Logs';
import Send from './pages/Send';
import Inbox from './pages/Inbox';
import Login from './pages/Login';
import Register from './pages/Register';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return children;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="inbox" element={<Inbox />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="clients" element={<Clients />} />
              <Route path="template" element={<Template />} />
              <Route path="send" element={<Send />} />
              <Route path="logs" element={<Logs />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
