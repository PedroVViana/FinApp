import { useState } from 'react';

interface Despesa {
  id: number;
  descricao: string;
  valor: number;
  categoria: string;
  data: string;
  status: 'pago' | 'pendente';
}

export function Despesas() {
  const [despesas, setDespesas] = useState<Despesa[]>([
    {
      id: 1,
      descricao: 'Aluguel',
      valor: 1500,
      categoria: 'Moradia',
      data: '2024-03-15',
      status: 'pago',
    },
    {
      id: 2,
      descricao: 'Supermercado',
      valor: 450,
      categoria: 'Alimentação',
      data: '2024-03-20',
      status: 'pendente',
    },
  ]);

  const [novaDespesa, setNovaDespesa] = useState({
    descricao: '',
    valor: '',
    categoria: '',
    data: '',
    status: 'pendente' as const,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const despesa: Despesa = {
      id: despesas.length + 1,
      ...novaDespesa,
      valor: Number(novaDespesa.valor),
    };
    setDespesas([...despesas, despesa]);
    setNovaDespesa({
      descricao: '',
      valor: '',
      categoria: '',
      data: '',
      status: 'pendente',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Despesas</h1>
        <button
          type="button"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
        >
          Nova Despesa
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="descricao" className="block text-sm font-medium text-gray-700">
                Descrição
              </label>
              <input
                type="text"
                id="descricao"
                value={novaDespesa.descricao}
                onChange={(e) => setNovaDespesa({ ...novaDespesa, descricao: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
                required
              />
            </div>

            <div>
              <label htmlFor="valor" className="block text-sm font-medium text-gray-700">
                Valor
              </label>
              <input
                type="number"
                id="valor"
                value={novaDespesa.valor}
                onChange={(e) => setNovaDespesa({ ...novaDespesa, valor: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
                required
              />
            </div>

            <div>
              <label htmlFor="categoria" className="block text-sm font-medium text-gray-700">
                Categoria
              </label>
              <select
                id="categoria"
                value={novaDespesa.categoria}
                onChange={(e) => setNovaDespesa({ ...novaDespesa, categoria: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
                required
              >
                <option value="">Selecione uma categoria</option>
                <option value="Moradia">Moradia</option>
                <option value="Alimentação">Alimentação</option>
                <option value="Transporte">Transporte</option>
                <option value="Saúde">Saúde</option>
                <option value="Educação">Educação</option>
                <option value="Lazer">Lazer</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div>
              <label htmlFor="data" className="block text-sm font-medium text-gray-700">
                Data
              </label>
              <input
                type="date"
                id="data"
                value={novaDespesa.data}
                onChange={(e) => setNovaDespesa({ ...novaDespesa, data: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
            >
              Adicionar Despesa
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Lista de Despesas</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoria
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {despesas.map((despesa) => (
                  <tr key={despesa.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {despesa.descricao}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      R$ {despesa.valor.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {despesa.categoria}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(despesa.data).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          despesa.status === 'pago'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {despesa.status === 'pago' ? 'Pago' : 'Pendente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
} 