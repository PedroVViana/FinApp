import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { Transaction, Category } from '../types';
// import { useNavigation } from '../contexts/NavigationContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement
);

interface DadosDashboard {
  saldoAtual: number;
  receitasMes: number;
  despesasMes: number;
  despesasPorCategoria: Record<string, number>;
  ultimasTransacoes: Transaction[];
  totalTransacoes: number;
  mediaGastosDiarios: number;
  evolucaoSaldo: { data: string; saldo: number }[];
}

export default function Dashboard() {
  // const { transactions, accounts } = useFinance();
  const isMountedRef = useRef(true);
  const { transactions, categories, isLoading } = useFinance();
  const { userData } = useAuth();

  // Estado para o componente - removendo o estado que causava loop infinito
  // const [someDashboardState, setSomeDashboardState] = useState({});

  // Função de limpeza de UI - corrigida para não atualizar estado
  const resetUI = () => {
    if (isMountedRef.current) {
      // Não atualizamos o estado aqui mais
      console.log('Estado do Dashboard limpo');
    }
  };

  // Registrar função de limpeza no contexto de navegação
  useEffect(() => {
    // Marcar como montado
    isMountedRef.current = true;
    
    console.log('Dashboard montado');
    
    // Limpeza ao desmontar
    return () => {
      isMountedRef.current = false;
      console.log('Dashboard desmontado');
    };
  }, []);

  const [periodo, setPeriodo] = useState('mes');

  const dadosDashboard = useMemo<DadosDashboard>(() => {
    const hoje = new Date();
    const inicioMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
    const fimMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    // Filtra transações do mês atual
    const transacoesMes = transactions.filter(t => {
      const dataTransacao = new Date(t.date);
      return dataTransacao >= inicioMes && dataTransacao <= fimMes;
    });

    // Calcula receitas e despesas do mês
    const receitasMes = transacoesMes
      .filter(t => t.type === 'income' && t.status !== 'cancelled')
      .reduce((acc, t) => acc + t.amount, 0);

    const despesasMes = transacoesMes
      .filter(t => t.type === 'expense' && t.status !== 'cancelled')
      .reduce((acc, t) => acc + t.amount, 0);

    // Calcula despesas por categoria
    const despesasPorCategoria = transacoesMes
      .filter(t => t.type === 'expense' && t.status !== 'cancelled')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);

    // Pega as últimas 5 transações
    const ultimasTransacoes = [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    // Calcula evolução do saldo
    const evolucaoSaldo = Array.from({ length: 30 }, (_, i) => {
      const data = new Date(inicioMes);
      data.setDate(data.getDate() + i);
      const transacoesAteData = transacoesMes.filter(t => {
        const dataTransacao = new Date(t.date);
        return dataTransacao <= data;
      });
      const saldo = transacoesAteData.reduce((acc, t) => {
        if (t.status === 'cancelled') return acc;
        return acc + (t.type === 'income' ? t.amount : -t.amount);
      }, 0);
      return {
        data: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        saldo
      };
    });

    return {
      saldoAtual: receitasMes - despesasMes,
      receitasMes,
      despesasMes,
      despesasPorCategoria,
      ultimasTransacoes,
      totalTransacoes: transacoesMes.length,
      mediaGastosDiarios: despesasMes / 30,
      evolucaoSaldo
    };
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header com Saldo */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">
                Visão geral das suas finanças
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Saldo Atual</p>
              <p className={`text-2xl font-bold ${dadosDashboard.saldoAtual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                R$ {dadosDashboard.saldoAtual.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm font-medium">Receitas do Mês</h3>
              <span className="text-green-500">📈</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              R$ {dadosDashboard.receitasMes.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm font-medium">Despesas do Mês</h3>
              <span className="text-red-500">📉</span>
            </div>
            <p className="text-2xl font-bold text-red-600">
              R$ {dadosDashboard.despesasMes.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm font-medium">Média Diária</h3>
              <span className="text-blue-500">📊</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              R$ {dadosDashboard.mediaGastosDiarios.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Evolução do Saldo */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Evolução do Saldo</h3>
            <Line
              data={{
                labels: dadosDashboard.evolucaoSaldo.map(d => d.data),
                datasets: [{
                  label: 'Saldo',
                  data: dadosDashboard.evolucaoSaldo.map(d => d.saldo),
                  borderColor: '#EF4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  tension: 0.4,
                  fill: true
                }]
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: {
                      display: false
                    }
                  },
                  x: {
                    grid: {
                      display: false
                    }
                  }
                }
              }}
            />
          </div>

          {/* Despesas por Categoria */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Despesas por Categoria</h3>
            {Object.keys(dadosDashboard.despesasPorCategoria).length > 0 ? (
              <Bar
                data={{
                  labels: categories
                    .filter(c => dadosDashboard.despesasPorCategoria[c.id])
                    .map(c => c.name),
                  datasets: [{
                    data: categories
                      .filter(c => dadosDashboard.despesasPorCategoria[c.id])
                      .map(c => dadosDashboard.despesasPorCategoria[c.id]),
                    backgroundColor: '#EF4444'
                  }]
                }}
                options={{
                  indexAxis: 'y' as const,
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (context) => `R$ ${Number(context.raw).toFixed(2)}`
                      }
                    }
                  },
                  scales: {
                    x: {
                      beginAtZero: true,
                      grid: {
                        display: false
                      },
                      ticks: {
                        callback: (value) => `R$ ${value}`
                      }
                    },
                    y: {
                      grid: {
                        display: false
                      }
                    }
                  }
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-48">
                <p className="text-gray-500">Nenhuma despesa registrada neste mês</p>
              </div>
            )}
          </div>
        </div>

        {/* Últimas Transações */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Últimas Receitas */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Últimas Receitas</h3>
              <span className="text-sm text-gray-500">
                {dadosDashboard.ultimasTransacoes.filter(t => t.type === 'income').length} receitas
              </span>
            </div>
            <div className="space-y-4">
              {dadosDashboard.ultimasTransacoes
                .filter(transaction => transaction.type === 'income')
                .map(transaction => {
                  const categoria = categories.find(c => c.id === transaction.category);
                  return (
                    <div 
                      key={transaction.id}
                      className="flex items-center justify-between p-4 bg-green-50 rounded-xl hover:bg-green-100 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: `${categoria?.color}20` }}
                        >
                          <span className="text-lg" style={{ color: categoria?.color }}>
                            {categoria?.name?.[0] || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {categoria?.name || 'Categoria não encontrada'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(transaction.date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          + R$ {transaction.amount.toFixed(2)}
                        </p>
                        <div className="flex items-center justify-end space-x-2">
                          <p className="text-sm text-gray-500">
                            {transaction.description || 'Sem descrição'}
                          </p>
                          {transaction.status && (
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              transaction.status === 'pending' 
                                ? 'bg-yellow-100 text-yellow-800'
                                : transaction.status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {transaction.status === 'pending' ? 'Pendente' : 
                               transaction.status === 'paid' ? 'Pago' : 'Cancelado'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Últimas Despesas */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Últimas Despesas</h3>
              <span className="text-sm text-gray-500">
                {dadosDashboard.ultimasTransacoes.filter(t => t.type === 'expense').length} despesas
              </span>
            </div>
            <div className="space-y-4">
              {dadosDashboard.ultimasTransacoes
                .filter(transaction => transaction.type === 'expense')
                .map(transaction => {
                  const categoria = categories.find(c => c.id === transaction.category);
                  return (
                    <div 
                      key={transaction.id}
                      className="flex items-center justify-between p-4 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: `${categoria?.color}20` }}
                        >
                          <span className="text-lg" style={{ color: categoria?.color }}>
                            {categoria?.name?.[0] || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {categoria?.name || 'Categoria não encontrada'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(transaction.date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-red-600">
                          - R$ {transaction.amount.toFixed(2)}
                        </p>
                        <div className="flex items-center justify-end space-x-2">
                          <p className="text-sm text-gray-500">
                            {transaction.description || 'Sem descrição'}
                          </p>
                          {transaction.status && (
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              transaction.status === 'pending' 
                                ? 'bg-yellow-100 text-yellow-800'
                                : transaction.status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {transaction.status === 'pending' ? 'Pendente' : 
                               transaction.status === 'paid' ? 'Pago' : 'Cancelado'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Card CTA para Plano Pro */}
        <div className="mt-8 bg-gradient-to-r from-rose-500 to-purple-600 rounded-2xl shadow-lg p-8 text-white">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-4">
                Dashboard Avançado com Plano Pro
              </h2>
              <p className="text-rose-100 mb-6">
                Tenha uma visão completa e inteligente das suas finanças.
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Gráficos interativos e personalizáveis
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Análise preditiva de gastos
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Exportação de relatórios em PDF
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Integração com múltiplas contas
                </li>
              </ul>
            </div>
            <div className="flex flex-col items-center lg:items-end">
              <button className="bg-white text-purple-600 px-8 py-3 rounded-lg font-semibold hover:bg-purple-50 transition-colors duration-200 shadow-lg">
                Conhecer Plano Pro
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 