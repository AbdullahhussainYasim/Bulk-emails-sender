import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './layouts/Layout';
import Dashboard from './pages/Dashboard';
// Import other pages lazily or directly
// For now, placeholders or direct imports if they exist.
// Since I haven't created others yet, I'll add them as I go, or import placeholders.

const queryClient = new QueryClient();

import Accounts from './pages/Accounts';
import Clients from './pages/Clients';
import Template from './pages/Template';
import Logs from './pages/Logs';
import Send from './pages/Send';
import Inbox from './pages/Inbox';
// Placeholder components for routes not implemented yet
const Placeholder = () => <div />;

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
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
    </QueryClientProvider>
  );
}

export default App;
