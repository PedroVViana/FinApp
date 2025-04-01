import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { FiPlus, FiEdit2, FiTrash2, FiFilter, FiDownload, FiLock, FiCheck, FiX, FiTag, FiHash, FiSave } from 'react-icons/fi';
import { Transaction, Account } from '../types';
import { useNotification } from '../components/Notification';

type FilterType = 'todas' | 'pendentes' | 'pagas';
type SortType = 'data' | 'valor' | 'categoria';
type SortOrder = 'asc' | 'desc';

// Manter constantes fora do componente para evitar recriações desnecessárias
const DEFAULT_TAGS = [
  'Salário', 'Freelance', 'Investimentos', 'Bônus', 'Comissão', 
  'Aluguel', 'Vendas', 'Presente', 'Outros'
];

// Estado inicial para nova receita
const getInitialReceitaState = () => ({
  amount: '',
  category: '',
  description: '',
  date: new Date().toISOString().split('T')[0], // Formato YYYY-MM-DD
  isRecurrent: false,
  tags: [] as string[],
  pending: true,
});

// Interfaces para funcionalidades PRO
interface ReceitaRecorrente {
  frequency: 'monthly' | 'weekly' | 'yearly';
  nextDueDate: string;
  lastProcessedDate: string;
  active: boolean;
}

interface ReceitaAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadDate: string;
  fileType: string;
}

interface ReceitaReminder {
  id: string;
  dueDate: string;
  notifyBefore: number; // dias
  notificationType: 'email' | 'push' | 'both';
  status: 'pending' | 'sent' | 'cancelled';
}

// Estado inicial para funcionalidades PRO
const getInitialProFeaturesState = () => ({
  recorrencia: {
    frequency: 'monthly' as 'monthly' | 'weekly' | 'yearly',
    nextDueDate: '',
    lastProcessedDate: '',
    active: false
  },
  anexos: [] as ReceitaAttachment[],
  lembretes: [] as ReceitaReminder[],
  categoriaPersonalizada: '',
  subcategoria: '',
  notasFiscais: [] as string[],
  metadados: {} as Record<string, any>,
});

export function Receitas() {
  // Referências para rastrear o estado do componente
  const componentMounted = useRef(true);
  const transactionsProcessed = useRef(false);
  const debouncedFilterTimer = useRef<NodeJS.Timeout | null>(null);

  const { transactions, accounts, categories, addTransaction, updateTransaction, deleteTransaction, isLoading, addAccount } = useFinance();
  const { userData, currentUser } = useAuth();
  const isPremium = userData?.planType === 'pro' || userData?.planType === 'enterprise';
  const { notifications, showNotification } = useNotification();

  // Estado para filtrar apenas receitas (não despesas)
  const receitas = transactions.filter(t => t.type === 'income');

  // Estados para o formulário
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estados para filtros e ordenação
  const [filterStatus, setFilterStatus] = useState<FilterType>('todas');
  const [sortBy, setSortBy] = useState<SortType>('data');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para funcionalidades premium
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Estado para nova transação
  const [novaReceita, setNovaReceita] = useState(getInitialReceitaState());

  // Estados para o sistema de tags
  const [availableTags, setAvailableTags] = useState<string[]>(DEFAULT_TAGS);
  const [newTagName, setNewTagName] = useState('');
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagFrequency, setTagFrequency] = useState<Record<string, number>>({});
  const [tagFilter, setTagFilter] = useState<string[]>([]);

  // Estados para funcionalidades PRO
  const [proFeatures, setProFeatures] = useState(getInitialProFeaturesState());
  const [showProBanner, setShowProBanner] = useState(false);
  const [isProDialogOpen, setIsProDialogOpen] = useState(false);

  // Função memorizada para limpar a UI
  const resetUI = useCallback(() => {
    if (!componentMounted.current) return;
    
    setFormOpen(false);
    setEditingId(null);
    setShowAdvancedFilters(false);
    setSelectedCategories([]);
    setDateRange({ start: '', end: '' });
    setTagFilter([]);
    setIsEditingTags(false);
  }, []);

  // Efeito de limpeza
  useEffect(() => {
    console.log('Componente Receitas montado');
    componentMounted.current = true;
    
    return () => {
      componentMounted.current = false;
      console.log('Componente Receitas desmontado, recursos limpos');
      
      if (debouncedFilterTimer.current) {
        clearTimeout(debouncedFilterTimer.current);
        debouncedFilterTimer.current = null;
      }
    };
  }, []);

  // Resetar formulário
  const resetForm = useCallback(() => {
    if (!componentMounted.current) return;
    
    const receitaCategories = categories.filter(c => c.type === 'income');
    const defaultCategory = receitaCategories.length > 0 ? receitaCategories[0].id : '';
    
    setNovaReceita({
      ...getInitialReceitaState(),
      category: defaultCategory
    });
    setEditingId(null);
    setTagFilter([]);
    setIsEditingTags(false);
  }, [categories]);

  // Efeito para inicializar o formulário
  useEffect(() => {
    if (!componentMounted.current) return;
    
    if (categories.length > 0) {
      resetForm();
    }
  }, [categories, resetForm]);

  // Função para editar uma receita existente
  const handleEdit = useCallback((transaction: Transaction) => {
    if (!componentMounted.current) return;
    
    setNovaReceita({
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
  }, []);

  // Função para salvar uma transação (nova ou editada)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!componentMounted.current) return;
    
    try {
      console.log("Salvando receita:", novaReceita);
      
      if (!currentUser) {
        showNotification('error', "Erro: Usuário não autenticado!");
        return;
      }
      
      // Usar a primeira conta disponível
      const accountId = accounts.length > 0 ? accounts[0].id : "conta_principal";
      
      // Formatação da data
      let formattedDate;
      try {
        if (typeof novaReceita.date === 'string' && novaReceita.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          formattedDate = novaReceita.date;
        } else {
          formattedDate = new Date(novaReceita.date).toISOString().split('T')[0];
        }
      } catch (error) {
        console.error("Erro ao processar data:", error);
        formattedDate = new Date().toISOString().split('T')[0];
      }
      
      // Garantir que tags é sempre um array
      const tags = Array.isArray(novaReceita.tags) ? novaReceita.tags : [];
      
      // Dados da transação
      const transactionData = {
        accountId,
        type: 'income' as const,
        amount: Number(novaReceita.amount),
        category: novaReceita.category,
        description: novaReceita.description,
        date: formattedDate,
        isRecurrent: novaReceita.isRecurrent,
        tags,
        pending: novaReceita.pending,
        userId: currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateTransaction(editingId, transactionData);
        showNotification('success', "Receita atualizada com sucesso!");
      } else {
        await addTransaction(transactionData);
        console.log("Nova receita adicionada");
        showNotification('success', "Receita adicionada com sucesso!");
      }
      
      resetForm();
      setFormOpen(false);
      
    } catch (err) {
      console.error('Erro ao salvar receita:', err);
      showNotification('error', `Erro ao salvar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  };

  // Função para excluir uma transação
  const handleDelete = async (id: string) => {
    if (!componentMounted.current) return;
    
    if (window.confirm('Tem certeza que deseja excluir esta receita?')) {
      try {
        await deleteTransaction(id);
        showNotification('success', 'Receita excluída com sucesso!');
      } catch (err) {
        console.error('Erro ao excluir receita:', err);
        showNotification('error', `Erro ao excluir receita: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }
    }
  };

  // Função para alternar o status
  const handleToggleStatus = async (transaction: Transaction) => {
    if (!componentMounted.current) return;
    
    try {
      await updateTransaction(transaction.id, {
        ...transaction,
        pending: !transaction.pending,
        updatedAt: new Date().toISOString()
      });
      showNotification('success', `Receita marcada como ${!transaction.pending ? 'pendente' : 'recebida'}!`);
    } catch (err) {
      console.error('Erro ao atualizar status da receita:', err);
      showNotification('error', `Erro ao atualizar status: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  };

  // Função para adicionar uma nova tag
  const handleAddTag = () => {
    if (!componentMounted.current) return;
    
    if (newTagName.trim() && !availableTags.includes(newTagName.trim())) {
      setAvailableTags(prev => [...prev, newTagName.trim()]);
      setNewTagName('');
      
      if (isEditingTags) {
        handleTagToggle(newTagName.trim());
      }
    }
  };

  // Função para remover uma tag disponível
  const handleRemoveAvailableTag = (tag: string) => {
    if (!componentMounted.current) return;
    
    setAvailableTags(prev => prev.filter(t => t !== tag));
    
    if (novaReceita.tags.includes(tag)) {
      handleTagToggle(tag);
    }
  };

  // Função para adicionar ou remover uma tag
  const handleTagToggle = (tag: string) => {
    if (!componentMounted.current) return;
    
    setNovaReceita(prev => {
      const tags = prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag];
      return { ...prev, tags };
    });
  };

  // Função para filtrar por tag
  const handleTagFilter = (tag: string) => {
    if (!componentMounted.current) return;
    
    setTagFilter(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag) 
        : [...prev, tag]
    );
  };

  // Calcular receitas filtradas usando useMemo
  const filteredReceitas = React.useMemo(() => {
    return receitas
      .filter(receita => {
        // Filtro por status
        if (filterStatus === 'pendentes' && receita.pending !== true) {
          return false;
        }
        if (filterStatus === 'pagas' && receita.pending === true) {
          return false;
        }
        
        // Filtro por termo de busca
        if (searchTerm && !receita.description.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
        
        // Filtros avançados (premium)
        if (isPremium && showAdvancedFilters) {
          // Filtro por categorias
          if (selectedCategories.length > 0 && !selectedCategories.includes(receita.category)) {
            return false;
          }
          
          // Filtro por intervalo de datas
          const receitaDate = new Date(receita.date);
          if (dateRange.start && new Date(dateRange.start) > receitaDate) {
            return false;
          }
          if (dateRange.end) {
            const endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59);
            if (endDate < receitaDate) {
              return false;
            }
          }
          
          // Filtro por tags
          if (tagFilter.length > 0) {
            if (!receita.tags || receita.tags === undefined || !tagFilter.some(tag => receita.tags && receita.tags.includes(tag))) {
              return false;
            }
          }
        }
        
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'data':
            return sortOrder === 'asc'
              ? new Date(a.date).getTime() - new Date(b.date).getTime()
              : new Date(b.date).getTime() - new Date(a.date).getTime();
          case 'valor':
            return sortOrder === 'asc'
              ? a.amount - b.amount
              : b.amount - a.amount;
          case 'categoria':
            const catA = categories.find(c => c.id === a.category)?.name || '';
            const catB = categories.find(c => c.id === b.category)?.name || '';
            return sortOrder === 'asc'
              ? catA.localeCompare(catB)
              : catB.localeCompare(catA);
          default:
            return 0;
        }
      });
  }, [
    receitas, 
    filterStatus, 
    searchTerm, 
    isPremium, 
    showAdvancedFilters, 
    selectedCategories, 
    dateRange, 
    tagFilter, 
    sortBy, 
    sortOrder, 
    categories
  ]);

  // Exportar dados para CSV
  const handleExportData = () => {
    if (!componentMounted.current || !isPremium) return;
    
    const csvContent = [
      'Data,Descrição,Categoria,Valor,Tags',
      ...filteredReceitas.map(d => {
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
    link.setAttribute('download', `receitas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Funções para funcionalidades PRO
  const handleRecorrenciaChange = (recorrencia: ReceitaRecorrente) => {
    if (!isPremium) {
      setShowProBanner(true);
      return;
    }
    setProFeatures(prev => ({ ...prev, recorrencia }));
  };

  const handleAttachmentUpload = async (file: File) => {
    if (!isPremium) {
      setShowProBanner(true);
      return;
    }
    // TODO: Implementar upload de anexos
  };

  const handleReminderCreate = (reminder: ReceitaReminder) => {
    if (!isPremium) {
      setShowProBanner(true);
      return;
    }
    setProFeatures(prev => ({
      ...prev,
      lembretes: [...prev.lembretes, reminder]
    }));
  };

  const handleCustomCategoryCreate = (categoria: string) => {
    if (!isPremium) {
      setShowProBanner(true);
      return;
    }
    setProFeatures(prev => ({ ...prev, categoriaPersonalizada: categoria }));
  };

  // Componentes PRO
  const ProFeaturesBanner = () => (
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-lg shadow-lg mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Desbloqueie Recursos Premium</h3>
          <p className="text-sm opacity-90">
            Acesse recursos avançados como recorrência, anexos, lembretes e mais!
          </p>
        </div>
        <button
          onClick={() => setIsProDialogOpen(true)}
          className="px-4 py-2 bg-white text-purple-600 rounded-md font-medium hover:bg-opacity-90 transition-colors"
        >
          Upgrade para PRO
        </button>
      </div>
    </div>
  );

  const ProFeaturesDialog = () => (
    <dialog
      open={isProDialogOpen}
      className="fixed inset-0 z-50 overflow-y-auto"
      onClose={() => setIsProDialogOpen(false)}
    >
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
          <h2 className="text-2xl font-bold mb-4">Recursos Premium</h2>
          <ul className="space-y-3 mb-6">
            <li className="flex items-center">
              <FiCheck className="text-emerald-500 mr-2" />
              Receitas Recorrentes
            </li>
            <li className="flex items-center">
              <FiCheck className="text-emerald-500 mr-2" />
              Upload de Anexos
            </li>
            <li className="flex items-center">
              <FiCheck className="text-emerald-500 mr-2" />
              Lembretes Personalizados
            </li>
            <li className="flex items-center">
              <FiCheck className="text-emerald-500 mr-2" />
              Categorias Personalizadas
            </li>
            <li className="flex items-center">
              <FiCheck className="text-emerald-500 mr-2" />
              Relatórios Avançados
            </li>
          </ul>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsProDialogOpen(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Depois
            </button>
            <button
              onClick={() => {
                // TODO: Implementar upgrade
                setIsProDialogOpen(false);
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Fazer Upgrade
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Receitas</h1>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setFormOpen(!formOpen);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
        >
          <FiPlus className="mr-2" />
          Nova Receita
        </button>
      </div>

      {formOpen && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {editingId ? 'Editar Receita' : 'Nova Receita'}
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
                  value={novaReceita.description}
                  onChange={(e) => setNovaReceita({ ...novaReceita, description: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
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
                  value={novaReceita.amount}
                  onChange={(e) => setNovaReceita({ ...novaReceita, amount: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                  Categoria
                </label>
                <select
                  id="category"
                  value={novaReceita.category}
                  onChange={(e) => setNovaReceita({ ...novaReceita, category: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                  required
                >
                  <option value="">Selecione uma categoria</option>
                  {categories.length === 0 && (
                    <option value="" disabled>Nenhuma categoria disponível</option>
                  )}
                  {categories
                    .filter(cat => cat.type === 'income')
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
                  value={novaReceita.date}
                  onChange={(e) => setNovaReceita({ ...novaReceita, date: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="flex items-center">
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mr-4">
                  Status:
                </label>
                <div className="flex items-center">
                  <input
                    id="pendente"
                    type="radio"
                    checked={novaReceita.pending === true}
                    onChange={() => setNovaReceita({ ...novaReceita, pending: true })}
                    className="h-4 w-4 border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="pendente" className="ml-2 mr-4 block text-sm text-gray-700">
                    Pendente
                  </label>
                  
                  <input
                    id="recebida"
                    type="radio"
                    checked={novaReceita.pending === false}
                    onChange={() => setNovaReceita({ ...novaReceita, pending: false })}
                    className="h-4 w-4 border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="recebida" className="ml-2 block text-sm text-gray-700">
                    Recebida
                  </label>
                </div>
              </div>

              {/* Sistema de Tags (Premium) */}
              {isPremium && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleTagToggle(tag)}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                          novaReceita.tags.includes(tag)
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-800'
                        } hover:bg-emerald-200`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  
                  {isEditingTags && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="Nova tag"
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddTag}
                        className="px-3 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                      >
                        Adicionar
                      </button>
                    </div>
                  )}
                  
                  <button
                    type="button"
                    onClick={() => setIsEditingTags(!isEditingTags)}
                    className="mt-2 text-sm text-emerald-600 hover:text-emerald-800"
                  >
                    {isEditingTags ? 'Concluir edição' : 'Gerenciar tags'}
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
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
              placeholder="Buscar receitas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterType)}
              className="rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
            >
              <option value="todas">Todas</option>
              <option value="pendentes">Pendentes</option>
              <option value="pagas">Recebidas</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              className="rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
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
            {isPremium ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <FiFilter className="mr-1" />
                  Filtros Avançados
                </button>
                <button
                  type="button"
                  onClick={handleExportData}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <FiDownload className="mr-1" />
                  Exportar
                </button>
              </>
            ) : (
              <button
                type="button"
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-400 bg-gray-50 cursor-not-allowed"
                title="Disponível apenas para usuários premium"
              >
                <FiLock className="mr-1" />
                Recursos Premium
              </button>
            )}
          </div>
        </div>

        {/* Filtros avançados (Premium) */}
        {isPremium && showAdvancedFilters && (
          <div className="mt-4 border-t pt-4 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Filtrar por Categoria</h3>
              <div className="flex flex-wrap gap-2">
                {categories
                  .filter(cat => cat.type === 'income')
                  .map(category => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedCategories(prev =>
                        prev.includes(category.id)
                          ? prev.filter(id => id !== category.id)
                          : [...prev, category.id]
                      )}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                        selectedCategories.includes(category.id)
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-800'
                      } hover:bg-emerald-200`}
                    >
                      {category.name}
                    </button>
                  ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Filtrar por Data</h3>
              <div className="flex space-x-2">
                <div className="w-1/2">
                  <label className="block text-xs text-gray-500 mb-1">De</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                  />
                </div>
                <div className="w-1/2">
                  <label className="block text-xs text-gray-500 mb-1">Até</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Tags selecionadas */}
            {tagFilter.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Tags Selecionadas</h3>
                <div className="flex flex-wrap gap-2">
                  {tagFilter.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-emerald-100 text-emerald-800"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleTagFilter(tag)}
                        className="ml-1 text-emerald-600 hover:text-emerald-800"
                      >
                        <FiX size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 bg-white shadow-sm rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Carregando receitas...</p>
          </div>
        ) : filteredReceitas.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">Nenhuma receita encontrada.</p>
            <button 
              onClick={() => { resetForm(); setFormOpen(true); }}
              className="mt-2 inline-flex items-center px-3 py-1.5 border border-emerald-300 text-xs font-medium rounded-md text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
            >
              <FiPlus className="mr-1" /> Adicionar Receita
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoria
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReceitas.map((receita) => {
                  const categoria = categories.find(c => c.id === receita.category);
                  return (
                    <tr key={receita.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {receita.description}
                            </div>
                            {/* Tags display - Premium Feature */}
                            {isPremium && receita.tags && receita.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1 max-w-xs">
                                {receita.tags.map(tag => (
                                  <span 
                                    key={tag} 
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                                    onClick={() => handleTagFilter(tag)}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" 
                          style={{
                            backgroundColor: categoria ? `${categoria.color}30` : '#f3f4f6',
                            color: categoria ? categoria.color : '#374151'
                          }}
                        >
                          {categoria ? categoria.name : 'Sem categoria'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(receita.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receita.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(receita)}
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            receita.pending
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {receita.pending ? 'Pendente' : 'Recebido'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(receita)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <FiEdit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(receita.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <FiTrash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showProBanner && <ProFeaturesBanner />}
      <ProFeaturesDialog />

      {/* Adicionar seção de funcionalidades PRO no formulário */}
      {formOpen && isPremium && (
        <div className="mt-4 border-t pt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recursos Premium</h3>
          
          {/* Recorrência */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Recorrência</label>
            <div className="mt-1 flex items-center space-x-3">
              <select
                value={proFeatures.recorrencia.frequency}
                onChange={(e) => handleRecorrenciaChange({
                  ...proFeatures.recorrencia,
                  frequency: e.target.value as 'monthly' | 'weekly' | 'yearly'
                })}
                className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              >
                <option value="monthly">Mensal</option>
                <option value="weekly">Semanal</option>
                <option value="yearly">Anual</option>
              </select>
              <input
                type="date"
                value={proFeatures.recorrencia.nextDueDate}
                onChange={(e) => handleRecorrenciaChange({
                  ...proFeatures.recorrencia,
                  nextDueDate: e.target.value
                })}
                className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              />
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={proFeatures.recorrencia.active}
                  onChange={(e) => handleRecorrenciaChange({
                    ...proFeatures.recorrencia,
                    active: e.target.checked
                  })}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="ml-2 text-sm text-gray-600">Ativo</span>
              </label>
            </div>
          </div>

          {/* Anexos */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Anexos</label>
            <div className="mt-1 flex items-center space-x-3">
              <input
                type="file"
                onChange={(e) => e.target.files && handleAttachmentUpload(e.target.files[0])}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
            </div>
            {proFeatures.anexos.length > 0 && (
              <ul className="mt-2 divide-y divide-gray-200">
                {proFeatures.anexos.map(anexo => (
                  <li key={anexo.id} className="py-2 flex items-center justify-between">
                    <span className="text-sm text-gray-600">{anexo.fileName}</span>
                    <button
                      onClick={() => {
                        // TODO: Implementar remoção de anexo
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Lembretes */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Lembretes</label>
            <div className="mt-1 grid grid-cols-3 gap-3">
              <input
                type="date"
                className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              />
              <select
                className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              >
                <option value="email">Email</option>
                <option value="push">Push</option>
                <option value="both">Ambos</option>
              </select>
              <button
                onClick={() => {
                  // TODO: Implementar criação de lembrete
                }}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                Adicionar
              </button>
            </div>
          </div>

          {/* Categoria Personalizada */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Categoria Personalizada</label>
            <div className="mt-1 flex items-center space-x-3">
              <input
                type="text"
                value={proFeatures.categoriaPersonalizada}
                onChange={(e) => handleCustomCategoryCreate(e.target.value)}
                placeholder="Nova categoria"
                className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              />
              <input
                type="text"
                value={proFeatures.subcategoria}
                onChange={(e) => setProFeatures(prev => ({ ...prev, subcategoria: e.target.value }))}
                placeholder="Subcategoria (opcional)"
                className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 