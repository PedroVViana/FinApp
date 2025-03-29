import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export function Planos() {
  const { userData } = useAuth();

  const planos = [
    {
      nome: 'Gratuito',
      preco: 'R$ 0',
      periodo: '/mês',
      recursos: [
        'Até 2 contas',
        '5 categorias predefinidas',
        'Histórico de 30 dias',
        'Relatórios básicos',
      ],
      atual: userData?.planType === 'free',
    },
    {
      nome: 'Pro',
      preco: 'R$ 29,90',
      periodo: '/mês',
      recursos: [
        'Contas ilimitadas',
        'Categorias personalizadas',
        'Histórico completo',
        'Relatórios avançados',
        'Metas financeiras',
        'Suporte prioritário',
      ],
      atual: userData?.planType === 'pro',
      destaque: true,
    },
    {
      nome: 'Empresarial',
      preco: 'Sob consulta',
      periodo: '',
      recursos: [
        'Todas as funcionalidades Pro',
        'Múltiplos usuários',
        'API dedicada',
        'Suporte 24/7',
        'Treinamento personalizado',
        'Relatórios customizados',
      ],
      atual: userData?.planType === 'enterprise',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Planos e Preços</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {planos.map((plano) => (
          <div
            key={plano.nome}
            className={`relative bg-white rounded-lg shadow-sm overflow-hidden ${
              plano.destaque ? 'ring-2 ring-rose-500' : 'border border-gray-200'
            }`}
          >
            {plano.destaque && (
              <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2">
                <span className="inline-flex items-center rounded-full bg-rose-100 px-3 py-0.5 text-sm font-medium text-rose-800">
                  Popular
                </span>
              </div>
            )}
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900">{plano.nome}</h3>
              <div className="mt-4">
                <span className="text-3xl font-bold text-gray-900">{plano.preco}</span>
                <span className="text-base font-medium text-gray-500">{plano.periodo}</span>
              </div>
              <ul className="mt-6 space-y-4">
                {plano.recursos.map((recurso) => (
                  <li key={recurso} className="flex items-start">
                    <span className="h-6 flex items-center">
                      <svg
                        className="h-5 w-5 text-green-500"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                    <span className="ml-3 text-base text-gray-700">{recurso}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <button
                  type="button"
                  disabled={plano.atual}
                  className={`w-full rounded-lg px-4 py-2 text-sm font-semibold ${
                    plano.atual
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-rose-600 text-white hover:bg-rose-700'
                  }`}
                >
                  {plano.atual ? 'Plano Atual' : 'Escolher Plano'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 