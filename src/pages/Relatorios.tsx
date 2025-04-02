import React, { useMemo, useState } from 'react';
import { useFinance } from '../contexts/FinanceContext';
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
import { Bar } from 'react-chartjs-2';

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

interface ComparativoMensal {
  mes: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

interface AnaliseCategoria {
  categoria: string;
  total: number;
  percentual: number;
  transacoes: number;
  mediaTransacao: number;
}

type Periodo = 'semana' | 'mes' | '6meses' | 'ano';

interface EstatisticasGerais {
  totalTransacoes: number;
  maiorTransacao: number;
  menorTransacao: number;
  transacoesPendentes: number;
  transacoesPagas: number;
  transacoesCanceladas: number;
  despesas: number;
  receitas: number;
}

export function Relatorios() {
  const { transactions, categories, isLoading } = useFinance();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const isPremium = true; // TODO: Implementar verificação real de premium

  const dadosRelatorio = useMemo(() => {
    const hoje = new Date();
    let inicioPeriodo: Date;
    let fimPeriodo: Date;
    let numeroMeses: number;

    switch (periodo) {
      case 'semana':
        inicioPeriodo = new Date(hoje);
        inicioPeriodo.setDate(hoje.getDate() - 7);
        fimPeriodo = new Date(hoje);
        numeroMeses = 1;
        break;
      case 'mes':
        inicioPeriodo = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        fimPeriodo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        numeroMeses = 1;
        break;
      case '6meses':
        inicioPeriodo = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
        fimPeriodo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        numeroMeses = 6;
        break;
      case 'ano':
        inicioPeriodo = new Date(hoje.getFullYear(), 0, 1);
        fimPeriodo = new Date(hoje.getFullYear(), 11, 31);
        numeroMeses = 12;
        break;
      default:
        inicioPeriodo = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        fimPeriodo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        numeroMeses = 1;
    }

    const meses = Array.from({ length: numeroMeses }, (_, i) => {
      const data = new Date(inicioPeriodo.getFullYear(), inicioPeriodo.getMonth() + i, 1);
      return {
        inicio: data,
        fim: new Date(data.getFullYear(), data.getMonth() + 1, 0),
        nome: data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      };
    });

    // Comparativo mensal
    const comparativoMensal: ComparativoMensal[] = meses.map(mes => {
      const transacoesMes = transactions.filter(t => {
        const data = new Date(t.date);
        return data >= mes.inicio && data <= mes.fim && t.status !== 'cancelled';
      });

      const receitas = transacoesMes
        .filter(t => t.type === 'income')
        .reduce((acc, t) => acc + t.amount, 0);

      const despesas = transacoesMes
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => acc + t.amount, 0);

      return {
        mes: mes.nome,
        receitas,
        despesas,
        saldo: receitas - despesas
      };
    });

    // Análise detalhada por categoria
    const analiseCategoria: AnaliseCategoria[] = categories.map(categoria => {
      const transacoesCategoria = transactions.filter(t => 
        t.category === categoria.id && 
        t.status !== 'cancelled' &&
        new Date(t.date) >= inicioPeriodo &&
        new Date(t.date) <= fimPeriodo
      );

      const total = transacoesCategoria.reduce((acc, t) => acc + t.amount, 0);
      const totalGeral = transactions
        .filter(t => t.status !== 'cancelled' && new Date(t.date) >= inicioPeriodo && new Date(t.date) <= fimPeriodo)
        .reduce((acc, t) => acc + t.amount, 0);

      return {
        categoria: categoria.name,
        total,
        percentual: totalGeral > 0 ? (total / totalGeral) * 100 : 0,
        transacoes: transacoesCategoria.length,
        mediaTransacao: transacoesCategoria.length > 0 
          ? total / transacoesCategoria.length 
          : 0
      };
    }).sort((a, b) => b.total - a.total);

    // Estatísticas gerais
    const transacoesPeriodo = transactions.filter(t => {
      const data = new Date(t.date);
      const estaNoPeriodo = data >= inicioPeriodo && data <= fimPeriodo;
      console.log('Transação:', {
        id: t.id,
        data: t.date,
        status: t.status,
        pending: t.pending,
        estaNoPeriodo,
        inicioPeriodo: inicioPeriodo.toISOString(),
        fimPeriodo: fimPeriodo.toISOString()
      });
      return estaNoPeriodo;
    });

    console.log('Transações do período:', transacoesPeriodo);

    const estatisticasGerais: EstatisticasGerais = {
      totalTransacoes: transacoesPeriodo.length,
      maiorTransacao: Math.max(...transacoesPeriodo.map(t => t.amount), 0),
      menorTransacao: Math.min(...transacoesPeriodo.map(t => t.amount), 0),
      transacoesPendentes: transacoesPeriodo.filter(t => t.pending === true).length,
      transacoesPagas: transacoesPeriodo.filter(t => t.pending === false).length,
      transacoesCanceladas: transacoesPeriodo.filter(t => t.status === 'cancelled').length,
      despesas: transacoesPeriodo
        .filter(t => t.type === 'expense' && t.status !== 'cancelled')
        .reduce((acc, t) => acc + t.amount, 0),
      receitas: transacoesPeriodo
        .filter(t => t.type === 'income' && t.status !== 'cancelled')
        .reduce((acc, t) => acc + t.amount, 0)
    };

    console.log('Estatísticas gerais:', estatisticasGerais);

    return {
      comparativoMensal,
      analiseCategoria,
      estatisticasGerais,
      periodo: {
        inicio: inicioPeriodo,
        fim: fimPeriodo
      }
    };
  }, [transactions, categories, periodo]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
            <p className="text-sm text-gray-600 mt-2">
              Período: {dadosRelatorio.periodo.inicio.toLocaleDateString('pt-BR')} até {dadosRelatorio.periodo.fim.toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as Periodo)}
              className="rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
            >
              <option value="semana">Últimos 7 dias</option>
              <option value="mes">Este Mês</option>
              {isPremium && (
                <>
                  <option value="6meses">Últimos 6 Meses</option>
                  <option value="ano">Este Ano</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Cards de Totais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Total de Despesas</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  R$ {dadosRelatorio.estatisticasGerais.despesas.toFixed(2)}
                </p>
              </div>
              <div className="bg-red-100 p-3 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Total de Receitas</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  R$ {dadosRelatorio.estatisticasGerais.receitas.toFixed(2)}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Comparativo Mensal */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Comparativo do Período
          </h2>
          <div className="h-80">
            <Bar
              data={{
                labels: dadosRelatorio.comparativoMensal.map(m => m.mes),
                datasets: [
                  {
                    label: 'Receitas',
                    data: dadosRelatorio.comparativoMensal.map(m => m.receitas),
                    backgroundColor: '#10B981',
                    stack: 'Stack 0'
                  },
                  {
                    label: 'Despesas',
                    data: dadosRelatorio.comparativoMensal.map(m => m.despesas),
                    backgroundColor: '#EF4444',
                    stack: 'Stack 1'
                  }
                ]
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: 'top' as const },
                  tooltip: {
                    callbacks: {
                      label: (context) => `R$ ${Number(context.raw).toFixed(2)}`
                    }
                  }
                },
                scales: {
                  x: { stacked: false },
                  y: { 
                    stacked: false,
                    ticks: {
                      callback: (value) => `R$ ${Number(value).toFixed(2)}`
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Análise por Categoria */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Top 5 Categorias por Volume
            </h2>
            <div className="space-y-4">
              {dadosRelatorio.analiseCategoria.slice(0, 5).map((cat, index) => (
                <div key={cat.categoria} className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      {cat.categoria}
                    </span>
                    <span className="text-sm text-gray-500">
                      R$ {cat.total.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-rose-500 h-2 rounded-full"
                      style={{ width: `${cat.percentual}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{cat.transacoes} transações</span>
                    <span>Média: R$ {cat.mediaTransacao.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Estatísticas Gerais */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Estatísticas Gerais
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">Total de Transações</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dadosRelatorio.estatisticasGerais.totalTransacoes}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">Maior Transação</p>
                <p className="text-2xl font-bold text-gray-900">
                  R$ {dadosRelatorio.estatisticasGerais.maiorTransacao.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">Menor Transação</p>
                <p className="text-2xl font-bold text-gray-900">
                  R$ {dadosRelatorio.estatisticasGerais.menorTransacao.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">Status das Transações</p>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-yellow-600">Pendentes</span>
                    <span className="text-sm font-medium text-gray-900">
                      {dadosRelatorio.estatisticasGerais.transacoesPendentes}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-600">Pagas</span>
                    <span className="text-sm font-medium text-gray-900">
                      {dadosRelatorio.estatisticasGerais.transacoesPagas}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Canceladas</span>
                    <span className="text-sm font-medium text-gray-900">
                      {dadosRelatorio.estatisticasGerais.transacoesCanceladas}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabela de Análise Detalhada */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Análise Detalhada por Categoria
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoria
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    % do Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nº Transações
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Média/Transação
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dadosRelatorio.analiseCategoria.map((cat, index) => (
                  <tr key={cat.categoria} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {cat.categoria}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      R$ {cat.total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {cat.percentual.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {cat.transacoes}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      R$ {cat.mediaTransacao.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Card CTA para Plano Pro */}
        <div className="mt-8 bg-gradient-to-r from-rose-500 to-purple-600 rounded-2xl shadow-lg p-8 text-white">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-4">
                Relatórios Avançados com Plano Pro
              </h2>
              <p className="text-rose-100 mb-6">
                Análises profundas e insights valiosos para suas finanças.
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Relatórios personalizados por período
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Análise comparativa entre períodos
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Exportação em múltiplos formatos
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Insights baseados em IA
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