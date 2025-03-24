import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Despesas } from './pages/Despesas';
import { Orcamento } from './pages/Orcamento';
import { Metas } from './pages/Metas';
import { Relatorios } from './pages/Relatorios';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/despesas" element={<Despesas />} />
          <Route path="/orcamento" element={<Orcamento />} />
          <Route path="/metas" element={<Metas />} />
          <Route path="/relatorios" element={<Relatorios />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
