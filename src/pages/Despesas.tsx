import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { FiPlus, FiEdit2, FiTrash2, FiFilter, FiDownload, FiLock, FiCheck, FiX, FiTag, FiHash, FiSave } from 'react-icons/fi';
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

// Manter constantes fora do componente para evitar recriações desnecessárias
const DEFAULT_TAGS = [
  'Mercado', 'Restaurante', 'Lazer', 'Essencial', 'Trabalho', 
  'Casa', 'Saúde', 'Educação', 'Presente', 'Viagem'
];

// Estado inicial para nova despesa
const getInitialDespesaState = () => ({
  amount: '',
  category: '',
  description: '',
  date: new Date().toISOString().split('T')[0], // Formato YYYY-MM-DD
  isRecurrent: false,
  tags: [] as string[],
  pending: true,
});

// Interfaces para funcionalidades PRO
interface DespesaAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadDate: string;
  fileType: string;
}

interface DespesaReminder {
  id: string;
  dueDate: string;
  notifyBefore: number; // dias
  notificationType: 'email' | 'push' | 'both';
  status: 'pending' | 'sent' | 'cancelled';
}

export function Despesas() {
  // Referências para rastrear o estado do componente
  const componentMounted = useRef(true);
  const transactionsProcessed = useRef(false);
  const debouncedFilterTimer = useRef<NodeJS.Timeout | null>(null);

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
  const [novaDespesa, setNovaDespesa] = useState(getInitialDespesaState());

  // Estados para o sistema de tags avançado (versão premium)
  const [availableTags, setAvailableTags] = useState<string[]>(DEFAULT_TAGS);
  const [newTagName, setNewTagName] = useState('');
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagFrequency, setTagFrequency] = useState<Record<string, number>>({});
  const [tagFilter, setTagFilter] = useState<string[]>([]);

  // Estados para funcionalidades PRO
  const [showProBanner, setShowProBanner] = useState(false);
  const [isProDialogOpen, setIsProDialogOpen] = useState(false);
  const [anexos, setAnexos] = useState<DespesaAttachment[]>([]);
  const [lembretes, setLembretes] = useState<DespesaReminder[]>([]);

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
    setNotification(prev => ({ ...prev, visible: false }));
  }, []);

  // Efeito de limpeza
  useEffect(() => {
    // Obter dados necessários quando o componente montar
    console.log('Componente Despesas montado');
    componentMounted.current = true;
    
    // Limpar na desmontagem
    return () => {
      // Garantir que qualquer atualização de estado pendente é cancelada
      componentMounted.current = false;
      console.log('Componente Despesas desmontado, recursos limpos');
      
      // Limpar timer de debounce
      if (debouncedFilterTimer.current) {
        clearTimeout(debouncedFilterTimer.current);
        debouncedFilterTimer.current = null;
      }
    };
  }, []);

  // Resetar formulário
  const resetForm = useCallback(() => {
    if (!componentMounted.current) return;
    
    const despesaCategories = categories.filter(c => c.type === 'expense');
    const defaultCategory = despesaCategories.length > 0 ? despesaCategories[0].id : '';
    
    setNovaDespesa({
      ...getInitialDespesaState(),
      category: defaultCategory
    });
    setEditingId(null);
  }, [categories]);

  // Efeito para inicializar o formulário com valores padrão quando as categorias estiverem disponíveis
  useEffect(() => {
    if (!componentMounted.current) return;
    
    if (categories.length > 0) {
      resetForm();
    }
  }, [categories, resetForm]);

  // Verificar se existem contas e criar uma conta padrão se necessário
  useEffect(() => {
    if (!componentMounted.current) return;
    
    const criarContaPadrao = async () => {
      if (accounts.length === 0 && currentUser && !isLoading) {
        try {
          console.log("Criando conta padrão porque nenhuma conta foi encontrada");
          const novaConta = {
            name: "Conta Principal",
            type: "wallet" as const,
            balance: 0,
          };
          
          // Criar conta usando o queueService diretamente
          const contaId = await queueService.addAccount(novaConta, currentUser.uid);
          console.log(`Conta padrão criada com sucesso. ID: ${contaId}`);
        } catch (error) {
          console.error("Erro ao criar conta padrão:", error);
        }
      }
    };
    
    criarContaPadrao();
  }, [accounts, currentUser, isLoading]);

  // Efeito para calcular a frequência de uso das tags - otimizado
  useEffect(() => {
    if (!componentMounted.current || transactionsProcessed.current || despesas.length === 0) return;
    
    // Processar as tags apenas uma vez quando as transações carregarem
    const tagMap: Record<string, number> = {};
    
    despesas.forEach(despesa => {
      if (despesa.tags && Array.isArray(despesa.tags)) {
        despesa.tags.forEach(tag => {
          tagMap[tag] = (tagMap[tag] || 0) + 1;
        });
      }
    });
    
    // Usar as tags mais frequentes como disponíveis
    const sortedTags = Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
    
    // Combinar com as tags padrão, mantendo a ordem
    const combinedTags = [...new Set([...sortedTags, ...DEFAULT_TAGS])].slice(0, 20);
    
    if (componentMounted.current) {
      setAvailableTags(combinedTags);
      setTagFrequency(tagMap);
      transactionsProcessed.current = true;
    }
  }, [despesas]);

  // Função para editar uma despesa existente
  const handleEdit = useCallback((transaction: Transaction) => {
    if (!componentMounted.current) return;
    
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
  }, []);

  // Função para salvar uma transação (nova ou editada)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!componentMounted.current) return;
    
    try {
      console.log("Salvando despesa:", novaDespesa);
      
      if (!currentUser) {
        error("Erro: Usuário não autenticado!");
        return;
      }
      
      // Usar a primeira conta disponível
      const accountId = accounts.length > 0 ? accounts[0].id : "conta_principal";
      
      // Formatação da data
      let formattedDate;
      try {
        if (typeof novaDespesa.date === 'string' && novaDespesa.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          formattedDate = novaDespesa.date;
        } else {
          formattedDate = new Date(novaDespesa.date).toISOString().split('T')[0];
        }
      } catch (error) {
        console.error("Erro ao processar data:", error);
        formattedDate = new Date().toISOString().split('T')[0];
      }
      
      // Garantir que tags é sempre um array
      const tags = Array.isArray(novaDespesa.tags) ? novaDespesa.tags : [];
      
      // Dados da transação
      const transactionData = {
        accountId,
        type: 'expense' as const,
        amount: Number(novaDespesa.amount),
        category: novaDespesa.category,
        description: novaDespesa.description,
        date: formattedDate,
        isRecurrent: novaDespesa.isRecurrent,
        tags,
        pending: novaDespesa.pending,
        userId: currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        // Atualizando despesa existente
        await updateTransaction(editingId, transactionData);
        success("Despesa atualizada com sucesso!");
      } else {
        // Adicionando nova despesa
        await addTransaction(transactionData);
        console.log("Nova despesa adicionada");
        success("Despesa adicionada com sucesso!");
      }
      
      // Resetar o formulário
      resetForm();
      setFormOpen(false);
      
    } catch (err) {
      console.error('Erro ao salvar despesa:', err);
      error(`Erro ao salvar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  };

  // Função para excluir uma transação
  const handleDelete = async (id: string) => {
    if (!componentMounted.current) return;
    
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
    if (!componentMounted.current) return;
    
    try {
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

  // Função para adicionar uma nova tag
  const handleAddTag = () => {
    if (!componentMounted.current) return;
    
    if (newTagName.trim() && !availableTags.includes(newTagName.trim())) {
      setAvailableTags(prev => [...prev, newTagName.trim()]);
      setNewTagName('');
      
      // Adicionar à despesa atual também se estiver editando
      if (isEditingTags) {
        handleTagToggle(newTagName.trim());
      }
    }
  };

  // Função para remover uma tag disponível
  const handleRemoveAvailableTag = (tag: string) => {
    if (!componentMounted.current) return;
    
    setAvailableTags(prev => prev.filter(t => t !== tag));
    
    // Remover da despesa atual se estiver lá
    if (novaDespesa.tags.includes(tag)) {
      handleTagToggle(tag);
    }
  };

  // Função para adicionar ou remover uma tag
  const handleTagToggle = (tag: string) => {
    if (!componentMounted.current) return;
    
    setNovaDespesa(prev => {
      const tags = prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag];
      return { ...prev, tags };
    });
  };

  // Função para filtrar despesas por tag
  const handleTagFilter = (tag: string) => {
    if (!componentMounted.current) return;
    
    setTagFilter(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag) 
        : [...prev, tag]
    );
  };

  // Calcular despesas filtradas usando useMemo
  const filteredDespesas = React.useMemo(() => {
    return despesas
      .filter(despesa => {
        // Filtro por status
        if (filterStatus === 'pendentes' && despesa.pending !== true) {
          return false;
        }
        if (filterStatus === 'pagas' && despesa.pending === true) {
          return false;
        }
        
        // Filtro por termo de busca
        if (searchTerm && !despesa.description.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
        
        // Filtros avançados (premium)
        if (isPremium && showAdvancedFilters) {
          // Filtro por categorias
          if (selectedCategories.length > 0 && !selectedCategories.includes(despesa.category)) {
            return false;
          }
          
          // Filtro por intervalo de datas
          const despesaDate = new Date(despesa.date);
          if (dateRange.start && new Date(dateRange.start) > despesaDate) {
            return false;
          }
          if (dateRange.end) {
            const endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59);
            if (endDate < despesaDate) {
              return false;
            }
          }
          
          // Filtro por tags (se houver tags selecionadas)
          if (tagFilter.length > 0) {
            if (!despesa.tags || despesa.tags === undefined || !tagFilter.some(tag => despesa.tags && despesa.tags.includes(tag))) {
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
    despesas, 
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

  // Funções para funcionalidades PRO
  const handleAttachmentUpload = async (file: File) => {
    if (!isPremium) {
      setShowProBanner(true);
      return;
    }
    // TODO: Implementar upload de anexos quando o usuário for premium
    console.log("Upload de anexo seria implementado aqui");
  };

  const handleReminderCreate = (reminder: DespesaReminder) => {
    if (!isPremium) {
      setShowProBanner(true);
      return;
    }
    setLembretes(prev => [...prev, reminder]);
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

            {/* Sistema de Tags (Premium) */}
            <div className={`${isPremium ? '' : 'opacity-50'}`}>
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                  {!isPremium && (
                    <span className="inline-flex items-center ml-2 text-yellow-600">
                      <FiLock size={14} />
                      <span className="text-xs ml-1">Pro</span>
                    </span>
                  )}
                </label>
                {isPremium && (
                  <button 
                    type="button"
                    onClick={() => setIsEditingTags(!isEditingTags)}
                    className="text-sm text-rose-600 hover:underline flex items-center"
                  >
                    <FiTag className="mr-1" />
                    {isEditingTags ? 'Concluir Edição' : 'Gerenciar Tags'}
                  </button>
                )}
              </div>
              
              {!isEditingTags ? (
                <div className="flex flex-wrap gap-2">
                  {novaDespesa.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                      {tag}
                      {isPremium && (
                        <button 
                          type="button" 
                          onClick={() => handleTagToggle(tag)}
                          className="ml-1 text-rose-500 hover:text-rose-700"
                        >
                          <FiX size={14} />
                        </button>
                      )}
                    </span>
                  ))}
                  {novaDespesa.tags.length === 0 && (
                    <span className="text-sm text-gray-500 italic">
                      {isPremium ? 'Nenhuma tag selecionada' : 'Recurso disponível apenas em planos pagos'}
                    </span>
                  )}
                </div>
              ) : (
                <div className="border rounded-lg p-3 bg-gray-50">
                  <div className="mb-3 flex">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Nova tag..."
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
                      disabled={!isPremium}
                    />
                    <button 
                      type="button" 
                      onClick={handleAddTag}
                      disabled={!isPremium || !newTagName.trim()}
                      className="ml-2 px-3 py-1 bg-rose-600 text-white rounded disabled:bg-gray-300"
                    >
                      <FiPlus />
                    </button>
                  </div>
                  
                  <p className="text-sm font-medium mb-2">Tags disponíveis:</p>
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                    {availableTags.map(tag => {
                      const isSelected = novaDespesa.tags.includes(tag);
                      const count = tagFrequency[tag] || 0;
                      
                      return (
                        <div key={tag} className="flex items-center">
                          <button
                            type="button"
                            onClick={() => handleTagToggle(tag)}
                            disabled={!isPremium}
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium 
                              ${isSelected 
                                ? 'bg-rose-500 text-white' 
                                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                              }`}
                          >
                            {tag}
                            {count > 0 && (
                              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs 
                                ${isSelected ? 'bg-rose-700' : 'bg-gray-400 text-white'}`}
                              >
                                {count}
                              </span>
                            )}
                          </button>
                          {isEditingTags && (
                            <button 
                              type="button"
                              onClick={() => handleRemoveAvailableTag(tag)}
                              className="ml-1 text-red-500 hover:text-red-700"
                            >
                              <FiX size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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

      {/* Sistema de Anexos */}
      <div>
        <div className="flex items-center mb-3">
          <h4 className="font-medium text-gray-900">Anexos</h4>
          {!isPremium && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
              <FiLock className="mr-1" /> PRO
            </span>
          )}
        </div>
        
        {isPremium ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <div className="flex flex-col items-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="mt-4 flex text-sm text-gray-600">
                  <label 
                    htmlFor="file-upload" 
                    className="relative cursor-pointer bg-white rounded-md font-medium text-rose-600 hover:text-rose-500"
                  >
                    <span>Faça upload de um arquivo</span>
                    <input 
                      id="file-upload" 
                      name="file-upload" 
                      type="file" 
                      className="sr-only" 
                      onChange={(e) => e.target.files && handleAttachmentUpload(e.target.files[0])}
                    />
                  </label>
                  <p className="pl-1">ou arraste e solte</p>
                </div>
                <p className="text-xs text-gray-500">
                  PNG, JPG, PDF até 10MB
                </p>
              </div>
            </div>

            {/* Lista de anexos */}
            {anexos.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200">
                <ul className="divide-y divide-gray-200">
                  {anexos.map(anexo => (
                    <li key={anexo.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="bg-gray-100 rounded-md p-2 mr-3">
                          {anexo.fileType.includes('image') ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                            </svg>
                          ) : anexo.fileType.includes('pdf') ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{anexo.fileName}</h4>
                          <p className="text-xs text-gray-500">{new Date(anexo.uploadDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => window.open(anexo.fileUrl, '_blank')}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Visualizar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            // Lógica para remover anexo
                            setAnexos(prev => prev.filter(a => a.id !== anexo.id));
                          }}
                          className="text-red-600 hover:text-red-900"
                          title="Remover"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div 
            className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center opacity-75 relative"
            onClick={() => setShowProBanner(true)}
          >
            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
              <div className="bg-white/70 rounded-full p-3 shadow-md">
                <FiLock size={28} className="text-gray-500" />
              </div>
            </div>
            <svg className="mx-auto h-12 w-12 text-gray-300" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="mt-4 text-sm text-gray-500">
              Faça upgrade para o plano PRO para adicionar anexos às suas despesas
            </p>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowProBanner(true);
              }}
              className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              Conhecer o plano PRO
            </button>
          </div>
        )}
      </div>

      {/* Sistema de Lembretes */}
      <div>
        <div className="flex items-center mb-3">
          <h4 className="font-medium text-gray-900">Lembretes</h4>
          {!isPremium && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
              <FiLock className="mr-1" /> PRO
            </span>
          )}
        </div>
        
        {isPremium ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data
                </label>
                <input 
                  type="date" 
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de notificação
                </label>
                <select 
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500"
                >
                  <option value="email">Email</option>
                  <option value="push">Push</option>
                  <option value="both">Ambos</option>
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  type="button" 
                  onClick={() => {
                    // Será implementado posteriormente
                    const newReminder: DespesaReminder = {
                      id: Date.now().toString(),
                      dueDate: new Date().toISOString().split('T')[0],
                      notifyBefore: 3,
                      notificationType: 'email',
                      status: 'pending'
                    };
                    handleReminderCreate(newReminder);
                  }}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
                >
                  Adicionar lembrete
                </button>
              </div>
            </div>
            
            {/* Lista de lembretes */}
            {lembretes.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200">
                <ul className="divide-y divide-gray-200">
                  {lembretes.map(lembrete => (
                    <li key={lembrete.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            lembrete.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            lembrete.status === 'sent' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {lembrete.status === 'pending' ? 'Pendente' :
                            lembrete.status === 'sent' ? 'Enviado' : 'Cancelado'}
                          </span>
                          <span className="ml-2 text-sm text-gray-500">
                            {new Date(lembrete.dueDate).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          Notificar via {lembrete.notificationType === 'email' ? 'Email' : 
                                      lembrete.notificationType === 'push' ? 'Push' : 'Email e Push'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          // Lógica para remover lembrete
                          setLembretes(prev => prev.filter(l => l.id !== lembrete.id));
                        }}
                        className="text-red-600 hover:text-red-900"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div 
            className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center opacity-75 relative"
            onClick={() => setShowProBanner(true)}
          >
            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
              <div className="bg-white/70 rounded-full p-3 shadow-md">
                <FiLock size={28} className="text-gray-500" />
              </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="mt-4 text-sm text-gray-500">
              Faça upgrade para o plano PRO para criar lembretes para suas despesas
            </p>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowProBanner(true);
              }}
              className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              Conhecer o plano PRO
            </button>
          </div>
        )}
      </div>

      {/* ProFeaturesBanner seria implementado aqui */}

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
              onClick={() => isPremium ? setShowAdvancedFilters(!showAdvancedFilters) : alert('Filtros avançados disponíveis apenas nos planos pagos')}
              className={`inline-flex items-center px-3 py-1.5 border text-xs font-medium rounded-md ${
                isPremium
                  ? 'border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100'
                  : 'border-gray-300 text-gray-500 bg-gray-50 cursor-not-allowed'
              }`}
            >
              <FiFilter className="mr-1" />
              Filtros Avançados
              {!isPremium && <FiLock className="ml-1" />}
            </button>
            
            <button
              type="button"
              onClick={() => isPremium ? handleExportData() : alert('Exportação disponível apenas nos planos pagos')}
              className={`inline-flex items-center px-3 py-1.5 border text-xs font-medium rounded-md ${
                isPremium
                  ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                  : 'border-gray-300 text-gray-500 bg-gray-50 cursor-not-allowed'
              }`}
            >
              <FiDownload className="mr-1" />
              Exportar
              {!isPremium && <FiLock className="ml-1" />}
            </button>
          </div>
        </div>
        
        {/* Exibir tags selecionadas para filtro (Premium) */}
        {isPremium && tagFilter.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-500">Filtrar por tags:</span>
            {tagFilter.map(tag => (
              <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                {tag}
                <button 
                  type="button" 
                  onClick={() => handleTagFilter(tag)}
                  className="ml-1 text-rose-500 hover:text-rose-700"
                >
                  <FiX size={14} />
                </button>
              </span>
            ))}
            <button 
              onClick={() => setTagFilter([])}
              className="text-xs text-rose-600 hover:underline"
            >
              Limpar filtros
            </button>
          </div>
        )}
        
        {/* Filtros avançados (Premium) */}
        {isPremium && showAdvancedFilters && (
          <div className="mt-4 border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Filtrar por Categoria</h3>
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
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        selectedCategories.includes(category.id)
                          ? 'bg-rose-500 text-white'
                          : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                      }`}
                      style={{
                        backgroundColor: selectedCategories.includes(category.id)
                          ? undefined
                          : category.color || undefined
                      }}
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
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 text-sm"
                  />
                </div>
                <div className="w-1/2">
                  <label className="block text-xs text-gray-500 mb-1">Até</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 text-sm"
                  />
                </div>
              </div>
            </div>
            
            <div className="md:col-span-2">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Filtrar por Tags</h3>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagFilter(tag)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      tagFilter.includes(tag)
                        ? 'bg-rose-500 text-white'
                        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                    }`}
                  >
                    {tag}
                    {tagFrequency[tag] > 0 && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${tagFilter.includes(tag) ? 'bg-rose-700' : 'bg-gray-400 text-white'}`}>
                        {tagFrequency[tag]}
                      </span>
                    )}
                  </button>
                ))}
                {availableTags.length === 0 && (
                  <span className="text-sm text-gray-500 italic">
                    Nenhuma tag disponível. Adicione tags às suas despesas primeiro.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lista de despesas */}
      <div className="mt-6 bg-white shadow-sm rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Carregando despesas...</p>
          </div>
        ) : filteredDespesas.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">Nenhuma despesa encontrada.</p>
            <button 
              onClick={() => { resetForm(); setFormOpen(true); }}
              className="mt-2 inline-flex items-center px-3 py-1.5 border border-rose-300 text-xs font-medium rounded-md text-rose-700 bg-rose-50 hover:bg-rose-100"
            >
              <FiPlus className="mr-1" /> Adicionar Despesa
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
                {filteredDespesas.map((despesa) => {
                  const categoria = categories.find(c => c.id === despesa.category);
                  return (
                    <tr key={despesa.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {despesa.description}
                            </div>
                            {/* Tags display - Premium Feature */}
                            {isPremium && despesa.tags && despesa.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1 max-w-xs">
                                {despesa.tags.map(tag => (
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
                        {new Date(despesa.date).toLocaleDateString()}
                    </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(despesa.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(despesa)}
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            despesa.pending
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {despesa.pending ? 'Pendente' : 'Pago'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(despesa)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <FiEdit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(despesa.id)}
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

      {/* Card CTA para Plano Pro */}
      <div className="mt-8 bg-gradient-to-r from-rose-500 to-purple-600 rounded-2xl shadow-lg p-8 text-white">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-4">
              Gestão Avançada de Despesas com Plano Pro
            </h2>
            <p className="text-rose-100 mb-6">
              Controle suas despesas com mais eficiência e inteligência.
            </p>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Categorização automática por IA
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Importação automática de faturas
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Alertas de gastos excessivos
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Análise de padrões de consumo
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