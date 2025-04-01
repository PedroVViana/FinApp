import React, { useState, useEffect, useRef } from 'react';

interface Meta {
  id: number;
  titulo: string;
  valorAlvo: number;
  valorAtual: number;
  dataLimite: string;
  categoria: string;
  status: 'em_andamento' | 'concluida' | 'atrasada';
}

export default function Metas() {
  // Estado da página
  const [metas, setMetas] = useState<Meta[]>([
    {
      id: 1,
      titulo: 'Férias na Praia',
      valorAlvo: 5000,
      valorAtual: 3000,
      dataLimite: '2024-12-31',
      categoria: 'Lazer',
      status: 'em_andamento',
    },
    {
      id: 2,
      titulo: 'Notebook Novo',
      valorAlvo: 4000,
      valorAtual: 4000,
      dataLimite: '2024-06-30',
      categoria: 'Tecnologia',
      status: 'concluida',
    },
    {
      id: 3,
      titulo: 'Reserva de Emergência',
      valorAlvo: 10000,
      valorAtual: 5000,
      dataLimite: '2024-12-31',
      categoria: 'Segurança',
      status: 'em_andamento',
    },
  ]);

  const [formOpen, setFormOpen] = useState(false);
  
  // Referência para controlar o ciclo de vida
  const isMountedRef = useRef(true);

  // Simplificar a lógica de limpeza para evitar dependências circulares
  useEffect(() => {
    // Marcar como montado
    isMountedRef.current = true;
    
    console.log('Componente Metas montado');
    
    // Limpeza ao desmontar
    return () => {
      isMountedRef.current = false;
      console.log('Componente Metas desmontado');
    };
  }, []); // Sem dependências para evitar problemas de re-montagem

  const [novaMeta, setNovaMeta] = useState({
    titulo: '',
    valorAlvo: '',
    dataLimite: '',
    categoria: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const meta: Meta = {
      id: metas.length + 1,
      ...novaMeta,
      valorAlvo: Number(novaMeta.valorAlvo),
      valorAtual: 0,
      status: 'em_andamento',
    };
    setMetas([...metas, meta]);
    setNovaMeta({
      titulo: '',
      valorAlvo: '',
      dataLimite: '',
      categoria: '',
    });
  };

  const calcularProgresso = (valorAtual: number, valorAlvo: number) => {
    return Math.min((valorAtual / valorAlvo) * 100, 100);
  };

  const getStatusColor = (status: Meta['status']) => {
    switch (status) {
      case 'concluida':
        return 'bg-green-100 text-green-800';
      case 'atrasada':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusText = (status: Meta['status']) => {
    switch (status) {
      case 'concluida':
        return 'Concluída';
      case 'atrasada':
        return 'Atrasada';
      default:
        return 'Em Andamento';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Metas de Economia</h1>
        <button
          type="button"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
        >
          Nova Meta
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Minhas Metas</h2>
          <div className="space-y-6">
            {metas.map((meta) => (
              <div key={meta.id} className="border-b border-gray-200 pb-4 last:border-0">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{meta.titulo}</h3>
                    <p className="text-sm text-gray-500">{meta.categoria}</p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                      meta.status
                    )}`}
                  >
                    {getStatusText(meta.status)}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Progresso</span>
                    <span className="font-medium">
                      R$ {meta.valorAtual.toFixed(2)} / R$ {meta.valorAlvo.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-rose-500 h-2 rounded-full"
                      style={{ width: `${calcularProgresso(meta.valorAtual, meta.valorAlvo)}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Data limite: {new Date(meta.dataLimite).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Adicionar Nova Meta</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="titulo" className="block text-sm font-medium text-gray-700">
                Título da Meta
              </label>
              <input
                type="text"
                id="titulo"
                value={novaMeta.titulo}
                onChange={(e) => setNovaMeta({ ...novaMeta, titulo: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
                required
              />
            </div>

            <div>
              <label htmlFor="valorAlvo" className="block text-sm font-medium text-gray-700">
                Valor Alvo
              </label>
              <input
                type="number"
                id="valorAlvo"
                value={novaMeta.valorAlvo}
                onChange={(e) => setNovaMeta({ ...novaMeta, valorAlvo: e.target.value })}
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
                value={novaMeta.categoria}
                onChange={(e) => setNovaMeta({ ...novaMeta, categoria: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
                required
              >
                <option value="">Selecione uma categoria</option>
                <option value="Lazer">Lazer</option>
                <option value="Tecnologia">Tecnologia</option>
                <option value="Segurança">Segurança</option>
                <option value="Educação">Educação</option>
                <option value="Saúde">Saúde</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div>
              <label htmlFor="dataLimite" className="block text-sm font-medium text-gray-700">
                Data Limite
              </label>
              <input
                type="date"
                id="dataLimite"
                value={novaMeta.dataLimite}
                onChange={(e) => setNovaMeta({ ...novaMeta, dataLimite: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
                required
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
              >
                Adicionar Meta
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Resumo das Metas</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Total de Metas</h3>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{metas.length}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Valor Total Alvo</h3>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              R$ {metas.reduce((acc, meta) => acc + meta.valorAlvo, 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Valor Total Economizado</h3>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              R$ {metas.reduce((acc, meta) => acc + meta.valorAtual, 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 