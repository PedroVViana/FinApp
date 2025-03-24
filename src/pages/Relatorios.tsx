import { useState } from 'react';

interface DadosRelatorio {
  categoria: string;
  valor: number;
  percentual: number;
}

export function Relatorios() {
  const [periodo, setPeriodo] = useState('mes');
  const [tipoRelatorio, setTipoRelatorio] = useState('despesas');

  const dadosDespesas: DadosRelatorio[] = [
    { categoria: 'Moradia', valor: 1500, percentual: 30 },
    { categoria: 'Alimentação', valor: 800, percentual: 16 },
    { categoria: 'Transporte', valor: 400, percentual: 8 },
    { categoria: 'Saúde', valor: 600, percentual: 12 },
    { categoria: 'Educação', valor: 1000, percentual: 20 },
    { categoria: 'Lazer', valor: 500, percentual: 10 },
    { categoria: 'Outros', valor: 200, percentual: 4 },
  ];

  const dadosReceitas: DadosRelatorio[] = [
    { categoria: 'Salário', valor: 5000, percentual: 80 },
    { categoria: 'Freelance', valor: 1000, percentual: 16 },
    { categoria: 'Investimentos', valor: 200, percentual: 4 },
  ];

  const dados = tipoRelatorio === 'despesas' ? dadosDespesas : dadosReceitas;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Relatórios</h1>
      <div className="mt-6">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Relatórios</h2>
            <div className="flex space-x-4">
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
              >
                <option value="mes">Este Mês</option>
                <option value="trimestre">Este Trimestre</option>
                <option value="ano">Este Ano</option>
              </select>

              <select
                value={tipoRelatorio}
                onChange={(e) => setTipoRelatorio(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
              >
                <option value="despesas">Despesas</option>
                <option value="receitas">Receitas</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Distribuição por Categoria
              </h2>
              <div className="space-y-4">
                {dados.map((item) => (
                  <div key={item.categoria}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{item.categoria}</span>
                      <span className="text-sm text-gray-500">
                        R$ {item.valor.toFixed(2)} ({item.percentual}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-rose-500 h-2.5 rounded-full"
                        style={{ width: `${item.percentual}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Evolução Mensal</h2>
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                Gráfico de Evolução
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Resumo Financeiro</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500">
                  {tipoRelatorio === 'despesas' ? 'Total de Despesas' : 'Total de Receitas'}
                </h3>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  R$ {dados.reduce((acc, item) => acc + item.valor, 0).toFixed(2)}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500">Maior Valor</h3>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  R$ {Math.max(...dados.map((item) => item.valor)).toFixed(2)}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500">Menor Valor</h3>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  R$ {Math.min(...dados.map((item) => item.valor)).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Tendências</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500">Categoria com Maior Crescimento</h3>
                <p className="mt-1 text-lg font-semibold text-green-600">Alimentação (+15%)</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500">Categoria com Maior Redução</h3>
                <p className="mt-1 text-lg font-semibold text-red-600">Transporte (-8%)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 