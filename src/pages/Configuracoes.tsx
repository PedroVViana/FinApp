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
    </div>
  );
} 