import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export function Configuracoes() {
  // Removendo variáveis não utilizadas
  // const { currentUser, userData } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Configurações da Conta</h1>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="space-y-6">
            {/* Perfil */}
            <div>
              <h3 className="text-lg font-medium leading-6 text-gray-900">Perfil</h3>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Informações do seu perfil e preferências.</p>
              </div>
            </div>

            {/* Notificações */}
            <div>
              <h3 className="text-lg font-medium leading-6 text-gray-900">Notificações</h3>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Gerencie suas preferências de notificação.</p>
              </div>
            </div>

            {/* Segurança */}
            <div>
              <h3 className="text-lg font-medium leading-6 text-gray-900">Segurança</h3>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Configurações de segurança e privacidade.</p>
              </div>
            </div>

            {/* Integração */}
            <div>
              <h3 className="text-lg font-medium leading-6 text-gray-900">Integrações</h3>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Conecte suas contas e serviços.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card CTA para Plano Pro */}
      <div className="mt-8 bg-gradient-to-r from-rose-500 to-purple-600 rounded-2xl shadow-lg p-8 text-white">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-4">
              Configurações Avançadas com Plano Pro
            </h2>
            <p className="text-rose-100 mb-6">
              Personalize sua experiência com recursos exclusivos.
            </p>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Temas personalizados
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Backup automático
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Integrações personalizadas
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Suporte prioritário
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
  );
} 