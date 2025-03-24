import { useState } from 'react';

export function Dashboard() {
  const [periodo, setPeriodo] = useState('mes');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
        >
          <option value="mes">Este Mês</option>
          <option value="trimestre">Este Trimestre</option>
          <option value="ano">Este Ano</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">💰</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Saldo Total
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    R$ 5.000,00
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">📈</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Receitas do Mês
                  </dt>
                  <dd className="text-lg font-semibold text-green-600">
                    R$ 3.500,00
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">📉</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Despesas do Mês
                  </dt>
                  <dd className="text-lg font-semibold text-red-600">
                    R$ 2.300,00
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">🎯</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Meta de Economia
                  </dt>
                  <dd className="text-lg font-semibold text-blue-600">
                    70%
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Despesas por Categoria
          </h2>
          <div className="space-y-4">
            {/* Aqui você pode adicionar um gráfico de pizza ou barras */}
            <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
              Gráfico de Despesas
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Evolução do Saldo
          </h2>
          <div className="space-y-4">
            {/* Aqui você pode adicionar um gráfico de linha */}
            <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
              Gráfico de Evolução
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 