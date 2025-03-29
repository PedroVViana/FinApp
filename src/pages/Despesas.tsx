import React, { useState, useEffect } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { FiPlus, FiEdit2, FiTrash2, FiFilter, FiDownload, FiLock, FiCheck, FiX } from 'react-icons/fi';
import { Transaction, Account } from '../types';
import * as queueService from '../services/queueService';
import { useNotification, Notification } from '../components/Notification';

type FilterType = 'todas' | 'pendentes' | 'pagas';
type SortType = 'data' | 'valor' | 'categoria';
type SortOrder = 'asc' | 'desc';

// Interface para o estado da notificação
interface Notification {
  type: 'success' | 'error';
  message: string;
  visible: boolean;
}

export function Despesas() {
  const { transactions, accounts, categories, addTransaction, updateTransaction, deleteTransaction, isLoading, addAccount } = useFinance();
  const { userData, currentUser } = useAuth();
  const isPremium = userData?.planType === 'pro' || userData?.planType === 'enterprise';
  const { notifications, success, error, hideNotification } = useNotification();

  // Estado para filtrar apenas despesas (não receitas)
  const despesas = transactions.filter(t => t.type === 'expense');

  // Estados para o formulário
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estado para notificações
  const [notification, setNotification] = useState<Notification>({
    type: 'success',
    message: '',
    visible: false
  });

  // Estados para filtros e ordenação (recursos básicos disponíveis no plano gratuito)
  const [filterStatus, setFilterStatus] = useState<FilterType>('todas');
  const [sortBy, setSortBy] = useState<SortType>('data');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para funcionalidades premium
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Estado para nova transação
  const [novaDespesa, setNovaDespesa] = useState({
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().slice(0, 10),
    isRecurrent: false,
    tags: [] as string[],
    pending: true,
  });

  // Resetar formulário
  const resetForm = () => {
    const despesaCategories = categories.filter(c => c.type === 'expense');
    const defaultCategory = despesaCategories.length > 0 ? despesaCategories[0].id : '';
    
    console.log('Categorias disponíveis:', categories);
    console.log('Categorias de despesa:', despesaCategories);
    console.log('Categoria padrão selecionada:', defaultCategory);
    
    setNovaDespesa({
      amount: '',
      category: defaultCategory,
      description: '',
      date: new Date().toISOString().slice(0, 10),
      isRecurrent: false,
      tags: [],
      pending: true,
    });
    setEditingId(null);
  };

  // Efeito para inicializar o formulário com valores padrão quando as contas e categorias estiverem disponíveis
  useEffect(() => {
    if (accounts.length > 0 && categories.length > 0) {
      console.log('Inicializando formulário com categorias:', categories);
      resetForm();
    } else {
      console.log('Aguardando carregar categorias. Status atual:', { 
        accountsLoaded: accounts.length > 0, 
        categoriesLoaded: categories.length > 0,
        categoriesData: categories
      });
    }
  }, [accounts, categories]);

  // Verificar se existem contas e criar uma conta padrão se necessário
  useEffect(() => {
    const criarContaPadrao = async () => {
      if (accounts.length === 0 && currentUser && !isLoading) {
        try {
          console.log("Criando conta padrão porque nenhuma conta foi encontrada");
          const novaConta = {
            name: "Conta Principal",
            type: "wallet" as const,
            balance: 0,
          };
          
          // Criar conta usando o queueService diretamente, que lida com o formato do objeto
          const contaId = await queueService.addAccount(novaConta, currentUser.uid);
          console.log(`Conta padrão criada com sucesso. ID: ${contaId}`);
        } catch (error) {
          console.error("Erro ao criar conta padrão:", error);
        }
      }
    };
    
    criarContaPadrao();
  }, [accounts, currentUser, isLoading]);

  // Função para editar uma despesa existente
  const handleEdit = (transaction: Transaction) => {
    setNovaDespesa({
      amount: transaction.amount.toString(),
      category: transaction.category,
      description: transaction.description,
      date: typeof transaction.date === 'string' 
        ? transaction.date.slice(0, 10) 
        : new Date(transaction.date).toISOString().slice(0, 10),
      isRecurrent: transaction.isRecurrent || false,
      tags: transaction.tags || [],
      pending: transaction.pending !== undefined ? transaction.pending : true,
    });
    setEditingId(transaction.id);
    setFormOpen(true);
  };

  // Função para exibir uma notificação
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message, visible: true });
    
    // Esconder a notificação após 5 segundos
    setTimeout(() => {
      setNotification(prev => ({ ...prev, visible: false }));
    }, 5000);
  };

  // Função para salvar uma transação (nova ou editada)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      console.log("Salvando despesa:", novaDespesa);
      
      if (!currentUser) {
        error("Erro: Usuário não autenticado!");
        return;
      }
      
      // Usar ID fixo para a conta principal ou a primeira conta disponível
      const contaPrincipalId = "conta_principal";
      const accountId = accounts.length > 0 ? accounts[0].id : contaPrincipalId;
      
      const transactionData = {
        accountId: accountId,
        type: 'expense' as const,
        amount: Number(novaDespesa.amount),
        category: novaDespesa.category,
        description: novaDespesa.description,
        date: novaDespesa.date,
        isRecurrent: novaDespesa.isRecurrent,
        tags: novaDespesa.tags,
        pending: novaDespesa.pending,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: currentUser.uid
      };

      console.log("Dados da transação com userId:", transactionData);
      
      if (editingId) {
        // Atualizando despesa existente
        await updateTransaction(editingId, transactionData);
        setEditingId(null);
        success("Despesa atualizada com sucesso!");
      } else {
        // Adicionando nova despesa
        console.log("Adicionando nova despesa:", transactionData);
        const id = await addTransaction(transactionData);
        console.log("Nova despesa adicionada com id:", id);
        success("Despesa adicionada com sucesso!");
      }
      
      // Resetar o formulário
      setNovaDespesa({
        amount: '',
        category: '',
        description: '',
        date: new Date().toISOString().slice(0, 10),
        isRecurrent: false,
        tags: [],
        pending: true
      });
      
      setFormOpen(false);
      
      // Verificar se a transação foi salva no estado local após 1 segundo
      setTimeout(() => {
        const saved = transactions.some(t => 
          (editingId && t.id === editingId) || 
          (!editingId && t.description === transactionData.description && 
          t.amount === transactionData.amount && 
          t.category === transactionData.category)
        );
        console.log("Verificação após 1 segundo - Despesa existe no estado?", saved);
      }, 1000);
      
    } catch (err) {
      console.error('Erro ao salvar despesa:', err);
      error(`Erro ao salvar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  };

  // Função para excluir uma transação
  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta despesa?')) {
      try {
        await deleteTransaction(id);
        success('Despesa excluída com sucesso!');
      } catch (err) {
        console.error('Erro ao excluir despesa:', err);
        error(`Erro ao excluir despesa: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }
    }
  };

  // Função para alternar o status pendente/pago de uma transação
  const handleToggleStatus = async (transaction: Transaction) => {
    try {
      // Remover referência a pendingOperation e copiar apenas os dados necessários
      // para evitar conflitos com o sistema de sincronização
      await updateTransaction(transaction.id, {
        pending: !transaction.pending,
        updatedAt: new Date().toISOString()
      });
      success(`Despesa marcada como ${!transaction.pending ? 'pendente' : 'paga'}!`);
    } catch (err) {
      console.error('Erro ao atualizar status da despesa:', err);
      error(`Erro ao atualizar status: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  };

  // Função para adicionar ou remover uma tag da lista de tags selecionadas
  const handleTagToggle = (tag: string) => {
    setNovaDespesa(prev => {
      const tags = prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag];
      return { ...prev, tags };
    });
  };

  // Filtrar e ordenar despesas
  const filteredDespesas = despesas
    .filter(despesa => {
      // Filtro básico por status (disponível no plano gratuito)
      if (filterStatus === 'pendentes' && despesa.pending !== true) {
        return false;
      }
      if (filterStatus === 'pagas' && despesa.pending === true) {
        return false;
      }
      
      // Filtro básico por termo de busca (disponível no plano gratuito)
      if (searchTerm && !despesa.description.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Filtros avançados (disponíveis apenas no plano premium)
      if (isPremium && showAdvancedFilters) {
        // Filtro por categorias selecionadas
        if (selectedCategories.length > 0 && !selectedCategories.includes(despesa.category)) {
          return false;
        }
        
        // Filtro por intervalo de datas
        const despesaDate = new Date(despesa.date);
        if (dateRange.start && new Date(dateRange.start) > despesaDate) {
          return false;
        }
        if (dateRange.end && new Date(dateRange.end) < despesaDate) {
          return false;
        }
      }
      
      return true;
    })
    .sort((a, b) => {
      // Ordenação básica (disponível no plano gratuito)
      if (sortBy === 'data') {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return sortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
      }
      if (sortBy === 'valor') {
        return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
      }
      if (sortBy === 'categoria') {
        const catA = categories.find(c => c.id === a.category)?.name || '';
        const catB = categories.find(c => c.id === b.category)?.name || '';
        return sortOrder === 'asc' ? catA.localeCompare(catB) : catB.localeCompare(catA);
      }
      return 0;
    });

  // Função para exportar despesas (disponível apenas no plano premium)
  const handleExportData = () => {
    if (!isPremium) {
      alert('Recursos de exportação disponíveis apenas nos planos pagos');
      return;
    }
    
    // Implementação básica de exportação para CSV
    const headers = ['Data', 'Descrição', 'Categoria', 'Valor', 'Tags'];
    const csvContent = [
      headers.join(','),
      ...filteredDespesas.map(d => {
        const date = new Date(d.date).toLocaleDateString();
        const catName = categories.find(c => c.id === d.category)?.name || '';
        const tags = d.tags ? d.tags.join(';') : '';
        return [date, d.description, catName, d.amount.toFixed(2), tags].join(',');
      })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `despesas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Renderizar todas as notificações */}
      {notifications.map(notification => (
        <Notification
          key={notification.id}
          type={notification.type}
          message={notification.message}
          visible={notification.visible}
          onClose={() => hideNotification(notification.id)}
          position="top-right"
        />
      ))}

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Despesas</h1>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setFormOpen(!formOpen);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
        >
          <FiPlus className="mr-2" />
          Nova Despesa
        </button>
      </div>

      {formOpen && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {editingId ? 'Editar Despesa' : 'Nova Despesa'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Descrição
                </label>
                <input
                  type="text"
                  id="description"
                  value={novaDespesa.description}
                  onChange={(e) => setNovaDespesa({ ...novaDespesa, description: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                  Valor
                </label>
                <input
                  type="number"
                  id="amount"
                  step="0.01"
                  value={novaDespesa.amount}
                  onChange={(e) => setNovaDespesa({ ...novaDespesa, amount: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                  Categoria
                </label>
                <select
                  id="category"
                  value={novaDespesa.category}
                  onChange={(e) => setNovaDespesa({ ...novaDespesa, category: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
                  required
                >
                  <option value="">Selecione uma categoria</option>
                  {categories.length === 0 && (
                    <option value="" disabled>Nenhuma categoria disponível</option>
                  )}
                  {categories
                    .filter(cat => cat.type === 'expense')
                    .map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
                {categories.length === 0 && (
                  <p className="mt-1 text-sm text-red-600">
                    Nenhuma categoria disponível. As categorias padrão devem aparecer automaticamente.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                  Data
                </label>
                <input
                  type="date"
                  id="date"
                  value={novaDespesa.date}
                  onChange={(e) => setNovaDespesa({ ...novaDespesa, date: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
                  required
                />
              </div>

              <div className="flex items-center">
                <input
                  id="isRecurrent"
                  type="checkbox"
                  checked={novaDespesa.isRecurrent}
                  onChange={(e) => setNovaDespesa({ ...novaDespesa, isRecurrent: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                />
                <label htmlFor="isRecurrent" className="ml-2 block text-sm text-gray-700">
                  Despesa recorrente
                </label>
                {!isPremium && (
                  <div className="flex items-center ml-2 text-yellow-600">
                    <FiLock size={16} />
                    <span className="text-xs ml-1">Pro</span>
                  </div>
                )}
              </div>

              <div className="flex items-center">
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mr-4">
                  Status:
                </label>
                <div className="flex items-center">
                  <input
                    id="pendente"
                    type="radio"
                    checked={novaDespesa.pending === true}
                    onChange={() => setNovaDespesa({ ...novaDespesa, pending: true })}
                    className="h-4 w-4 border-gray-300 text-rose-600 focus:ring-rose-500"
                  />
                  <label htmlFor="pendente" className="ml-2 mr-4 block text-sm text-gray-700">
                    Pendente
                  </label>
                  
                  <input
                    id="paga"
                    type="radio"
                    checked={novaDespesa.pending === false}
                    onChange={() => setNovaDespesa({ ...novaDespesa, pending: false })}
                    className="h-4 w-4 border-gray-300 text-rose-600 focus:ring-rose-500"
                  />
                  <label htmlFor="paga" className="ml-2 block text-sm text-gray-700">
                    Paga
                  </label>
                </div>
              </div>
            </div>

            {/* Tags (disponíveis apenas no plano premium) */}
            <div className={`${isPremium ? '' : 'opacity-50'}`}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
                {!isPremium && (
                  <span className="inline-flex items-center ml-2 text-yellow-600">
                    <FiLock size={14} />
                    <span className="text-xs ml-1">Pro</span>
                  </span>
                )}
              </label>
              <div className="flex flex-wrap gap-2">
                {['Casa', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => isPremium && handleTagToggle(tag)}
                    className={`px-3 py-1 rounded-full text-xs font-medium
                      ${isPremium
                        ? novaDespesa.tags.includes(tag)
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    disabled={!isPremium}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
              >
                {editingId ? 'Atualizar' : 'Adicionar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Barra de ferramentas com filtros */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex space-x-2 items-center">
            <input
              type="text"
              placeholder="Buscar despesas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 text-sm"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterType)}
              className="rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 text-sm"
            >
              <option value="todas">Todas</option>
              <option value="pendentes">Pendentes</option>
              <option value="pagas">Pagas</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              className="rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 text-sm"
            >
              <option value="data">Ordenar por Data</option>
              <option value="valor">Ordenar por Valor</option>
              <option value="categoria">Ordenar por Categoria</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              {sortOrder === 'asc' ? '↑ Crescente' : '↓ Decrescente'}
            </button>
          </div>
          
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`inline-flex items-center px-3 py-1.5 border ${isPremium ? 'border-gray-300 hover:bg-gray-50' : 'border-gray-200'} text-xs font-medium rounded-md ${isPremium ? 'text-gray-700 bg-white' : 'text-gray-400 bg-gray-50 cursor-not-allowed'}`}
              disabled={!isPremium}
            >
              <FiFilter className="mr-1" />
              Filtros Avançados
              {!isPremium && <FiLock className="ml-1" size={12} />}
            </button>
            <button
              type="button"
              onClick={handleExportData}
              className={`inline-flex items-center px-3 py-1.5 border ${isPremium ? 'border-gray-300 hover:bg-gray-50' : 'border-gray-200'} text-xs font-medium rounded-md ${isPremium ? 'text-gray-700 bg-white' : 'text-gray-400 bg-gray-50 cursor-not-allowed'}`}
              disabled={!isPremium}
            >
              <FiDownload className="mr-1" />
              Exportar
              {!isPremium && <FiLock className="ml-1" size={12} />}
            </button>
          </div>
        </div>
        
        {/* Filtros avançados (disponíveis apenas no plano premium) */}
        {isPremium && showAdvancedFilters && (
          <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Filtros Avançados</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Categorias</label>
                <div className="flex flex-wrap gap-2">
                  {categories
                    .filter(cat => cat.type === 'expense')
                    .map(category => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategories(prev => 
                            prev.includes(category.id)
                              ? prev.filter(id => id !== category.id)
                              : [...prev, category.id]
                          );
                        }}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          selectedCategories.includes(category.id)
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                        style={{
                          backgroundColor: selectedCategories.includes(category.id) 
                            ? `${category.color}30` 
                            : undefined,
                          color: selectedCategories.includes(category.id) 
                            ? category.color 
                            : undefined
                        }}
                      >
                        {category.name}
                      </button>
                    ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Período</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 text-sm"
                  />
                  <span className="text-gray-500">até</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lista de despesas pendentes */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="px-4 py-5 sm:p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Despesas Pendentes</h2>
          
          {isLoading ? (
            <div className="py-10 text-center text-gray-500">Carregando despesas...</div>
          ) : filteredDespesas.filter(d => d.pending).length === 0 ? (
            <div className="py-10 text-center text-gray-500">Nenhuma despesa pendente encontrada</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categoria
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDespesas.filter(d => d.pending).map((despesa) => {
                    const categoria = categories.find(c => c.id === despesa.category);
                    return (
                      <tr key={despesa.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {typeof despesa.date === 'string' 
                            ? new Date(despesa.date + 'T00:00:00').toLocaleDateString()
                            : despesa.date.toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {despesa.description}
                          {despesa.isRecurrent && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              Recorrente
                            </span>
                          )}
                          {isPremium && despesa.tags && despesa.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {despesa.tags.map(tag => (
                                <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span 
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" 
                            style={{ 
                              backgroundColor: `${categoria?.color}20`, 
                              color: categoria?.color 
                            }}
                          >
                            {categoria?.name || 'Sem categoria'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          R$ {despesa.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              despesa.pendingOperation
                                ? 'bg-gray-100 text-gray-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                            role="button"
                            onClick={() => handleToggleStatus(despesa)}
                            style={{ cursor: 'pointer' }}
                            title="Clique para marcar como paga"
                          >
                            {despesa.pendingOperation 
                              ? 'Sincronizando...' 
                              : 'Pendente'
                            }
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            type="button"
                            onClick={() => handleEdit(despesa)}
                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(despesa.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <FiTrash2 />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Lista de despesas pagas */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Despesas Pagas</h2>
          
          {isLoading ? (
            <div className="py-10 text-center text-gray-500">Carregando despesas...</div>
          ) : filteredDespesas.filter(d => !d.pending).length === 0 ? (
            <div className="py-10 text-center text-gray-500">Nenhuma despesa paga encontrada</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categoria
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDespesas.filter(d => !d.pending).map((despesa) => {
                    const categoria = categories.find(c => c.id === despesa.category);
                    return (
                      <tr key={despesa.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {typeof despesa.date === 'string' 
                            ? new Date(despesa.date + 'T00:00:00').toLocaleDateString()
                            : despesa.date.toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {despesa.description}
                          {despesa.isRecurrent && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              Recorrente
                            </span>
                          )}
                          {isPremium && despesa.tags && despesa.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {despesa.tags.map(tag => (
                                <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span 
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" 
                            style={{ 
                              backgroundColor: `${categoria?.color}20`, 
                              color: categoria?.color 
                            }}
                          >
                            {categoria?.name || 'Sem categoria'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          R$ {despesa.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              despesa.pendingOperation
                                ? 'bg-gray-100 text-gray-800' 
                                : 'bg-green-100 text-green-800'
                            }`}
                            role="button"
                            onClick={() => handleToggleStatus(despesa)}
                            style={{ cursor: 'pointer' }}
                            title="Clique para marcar como pendente"
                          >
                            {despesa.pendingOperation 
                              ? 'Sincronizando...' 
                              : 'Paga'
                            }
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            type="button"
                            onClick={() => handleEdit(despesa)}
                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(despesa.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <FiTrash2 />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 