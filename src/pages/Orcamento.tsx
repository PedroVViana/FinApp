import { useState } from 'react';

interface CategoriaOrcamento {
  categoria: string;
  limite: number;
  gasto: number;
  cor: string;
}

export function Orcamento() {
  const [categorias, setCategorias] = useState<CategoriaOrcamento[]>([
    {
      categoria: 'Moradia',
      limite: 2000,
      gasto: 1500,
      cor: 'bg-blue-500',
    },
    {
      categoria: 'Alimentação',
      limite: 1000,
      gasto: 450,
      cor: 'bg-green-500',
    },
    {
      categoria: 'Transporte',
      limite: 500,
      gasto: 300,
      cor: 'bg-yellow-500',
    },
    {
      categoria: 'Saúde',
      limite: 800,
      gasto: 200,
      cor: 'bg-red-500',
    },
    {
      categoria: 'Educação',
      limite: 1000,
      gasto: 800,
      cor: 'bg-purple-500',
    },
    {
      categoria: 'Lazer',
      limite: 500,
      gasto: 600,
      cor: 'bg-pink-500',
    },
  ]);

  const [novaCategoria, setNovaCategoria] = useState({
    categoria: '',
    limite: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const categoria: CategoriaOrcamento = {
      ...novaCategoria,
      limite: Number(novaCategoria.limite),
      gasto: 0,
      cor: `bg-${['blue', 'green', 'yellow', 'red', 'purple', 'pink'][Math.floor(Math.random() * 6)]}-500`,
    };
    setCategorias([...categorias, categoria]);
    setNovaCategoria({
      categoria: '',
      limite: '',
    });
  };

  const calcularProgresso = (gasto: number, limite: number) => {
    return Math.min((gasto / limite) * 100, 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Orçamento</h1>
        <button
          type="button"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
        >
          Nova Categoria
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Visão Geral</h2>
          <div className="space-y-4">
            {categorias.map((cat) => (
              <div key={cat.categoria}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{cat.categoria}</span>
                  <span className="text-sm text-gray-500">
                    R$ {cat.gasto.toFixed(2)} / R$ {cat.limite.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`${cat.cor} h-2.5 rounded-full`}
                    style={{ width: `${calcularProgresso(cat.gasto, cat.limite)}%` }}
                  ></div>
                </div>
                {cat.gasto > cat.limite && (
                  <p className="mt-1 text-sm text-red-600">
                    Excedeu o limite em R$ {(cat.gasto - cat.limite).toFixed(2)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Adicionar Categoria</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="categoria" className="block text-sm font-medium text-gray-700">
                Nome da Categoria
              </label>
              <input
                type="text"
                id="categoria"
                value={novaCategoria.categoria}
                onChange={(e) => setNovaCategoria({ ...novaCategoria, categoria: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
                required
              />
            </div>

            <div>
              <label htmlFor="limite" className="block text-sm font-medium text-gray-700">
                Limite Mensal
              </label>
              <input
                type="number"
                id="limite"
                value={novaCategoria.limite}
                onChange={(e) => setNovaCategoria({ ...novaCategoria, limite: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
                required
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
              >
                Adicionar Categoria
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Resumo do Orçamento</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Total Orçado</h3>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              R$ {categorias.reduce((acc, cat) => acc + cat.limite, 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Total Gasto</h3>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              R$ {categorias.reduce((acc, cat) => acc + cat.gasto, 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Saldo Disponível</h3>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              R$ {(categorias.reduce((acc, cat) => acc + cat.limite, 0) - 
                   categorias.reduce((acc, cat) => acc + cat.gasto, 0)).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 