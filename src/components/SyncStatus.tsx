import React, { useState } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { FiRefreshCw, FiWifi, FiWifiOff } from 'react-icons/fi';

const SyncStatus: React.FC = () => {
  const { isOffline, pendingOperationsCount, processPendingOperations } = useFinance();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const handleSync = async () => {
    if (isOffline) {
      setSyncMessage('Não é possível sincronizar. Verifique sua conexão.');
      setTimeout(() => setSyncMessage(''), 3000);
      return;
    }

    if (pendingOperationsCount === 0) {
      setSyncMessage('Tudo já está sincronizado!');
      setTimeout(() => setSyncMessage(''), 3000);
      return;
    }

    try {
      setSyncing(true);
      setSyncMessage('Sincronizando...');
      const processed = await processPendingOperations();
      setSyncMessage(`${processed} operações sincronizadas com sucesso!`);
      setTimeout(() => setSyncMessage(''), 3000);
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      setSyncMessage('Erro ao sincronizar. Tente novamente.');
      setTimeout(() => setSyncMessage(''), 5000);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="relative flex items-center">
      {isOffline ? (
        <FiWifiOff className="text-red-500 mr-2" />
      ) : (
        <FiWifi className="text-green-500 mr-2" />
      )}
      
      {pendingOperationsCount > 0 && (
        <button
          onClick={handleSync}
          disabled={syncing || isOffline}
          className={`flex items-center text-sm font-medium px-2 py-1 rounded-md ${
            isOffline 
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
          }`}
        >
          <span className="mr-1">{pendingOperationsCount} pendentes</span>
          <FiRefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
        </button>
      )}
      
      {syncMessage && (
        <div className="absolute top-full right-0 mt-1 bg-white shadow-md rounded-md py-1 px-2 text-xs text-gray-700 whitespace-nowrap">
          {syncMessage}
        </div>
      )}
    </div>
  );
};

export default SyncStatus; 