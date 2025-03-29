import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { FinanceProvider } from './contexts/FinanceContext';
import { PrivateRoute } from './components/PrivateRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Despesas } from './pages/Despesas';
import { Orcamento } from './pages/Orcamento';
import { Metas } from './pages/Metas';
import { Relatorios } from './pages/Relatorios';
import { Configuracoes } from './pages/Configuracoes';
import { Planos } from './pages/Planos';
import { TermosServico } from './pages/TermosServico';
import { Privacidade } from './pages/Privacidade';

const ProtectedLayout = () => {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <FinanceProvider>
          <Routes>
            {/* Rotas Públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/termos" element={<TermosServico />} />
            <Route path="/privacidade" element={<Privacidade />} />
            
            {/* Rotas Protegidas */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <ProtectedLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="despesas" element={<Despesas />} />
              <Route path="metas" element={<Metas />} />
              <Route path="relatorios" element={<Relatorios />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="planos" element={<Planos />} />
              <Route path="orcamento" element={<Orcamento />} />
            </Route>

            {/* Redireciona qualquer rota não encontrada para o dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </FinanceProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
