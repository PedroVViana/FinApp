import React, { useEffect, memo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { FinanceProvider } from './contexts/FinanceContext';
import { PrivateRoute } from './components/PrivateRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import Dashboard from './pages/Dashboard';
import Metas from './pages/Metas';
import { Despesas } from './pages/Despesas';
import { Receitas } from './pages/Receitas';
import { Orcamento } from './pages/Orcamento';
import { Relatorios } from './pages/Relatorios';
import { Configuracoes } from './pages/Configuracoes';
import { TermosServico } from './pages/TermosServico';
import { Privacidade } from './pages/Privacidade';

// Componente para rolar para o topo automaticamente quando a rota muda
const ScrollToTop = memo(function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
});

// O Layout não será recriado quando as rotas mudarem
const ProtectedLayout = memo(function ProtectedLayout() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
});

// Componentes de página memoizados para melhor performance
const MemoizedDashboard = memo(Dashboard);
const MemoizedDespesas = memo(Despesas);
const MemoizedReceitas = memo(Receitas);
const MemoizedMetas = memo(Metas);
const MemoizedOrcamento = memo(Orcamento);
const MemoizedRelatorios = memo(Relatorios);
const MemoizedConfiguracoes = memo(Configuracoes);

function App() {
  return (
    <Router>
      <AuthProvider>
        <FinanceProvider>
          <ScrollToTop />
          <Routes>
            {/* Rotas Públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/termos" element={<TermosServico />} />
            <Route path="/privacidade" element={<Privacidade />} />
            
            {/* Rota Dashboard via rota raiz */}
            <Route path="/" element={
              <PrivateRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </PrivateRoute>
            } />
            
            {/* Redirecionamento de /dashboard para / */}
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            
            <Route path="/despesas" element={
              <PrivateRoute>
                <Layout>
                  <Despesas />
                </Layout>
              </PrivateRoute>
            } />
            <Route path="/receitas" element={
              <PrivateRoute>
                <Layout>
                  <Receitas />
                </Layout>
              </PrivateRoute>
            } />
            <Route path="/orcamento" element={
              <PrivateRoute>
                <Layout>
                  <Orcamento />
                </Layout>
              </PrivateRoute>
            } />
            <Route path="/metas" element={
              <PrivateRoute>
                <Layout>
                  <Metas />
                </Layout>
              </PrivateRoute>
            } />
            <Route path="/relatorios" element={
              <PrivateRoute>
                <Layout>
                  <Relatorios />
                </Layout>
              </PrivateRoute>
            } />
            <Route path="/configuracoes" element={
              <PrivateRoute>
                <Layout>
                  <Configuracoes />
                </Layout>
              </PrivateRoute>
            } />
          </Routes>
        </FinanceProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
