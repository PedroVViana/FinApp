import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { FiPlus, FiEdit2, FiTrash2, FiCheck, FiTarget, FiDollarSign, FiCalendar, FiTag } from 'react-icons/fi';
import { Goal } from '../types';
import { useNotification } from '../components/Notification';

type GoalStatus = 'all' | 'active' | 'completed';
type SortOption = 'deadline' | 'progress' | 'amount';
type SortOrder = 'asc' | 'desc';

export function Metas() {
  // Contextos e recursos
  const { goals, addGoal, updateGoal, deleteGoal, isLoading, categories } = useFinance();
  const { userData, currentUser } = useAuth();
  const { showNotification } = useNotification();
  const componentMounted = useRef(true);

  // Depuração para metas
  useEffect(() => {
    console.log('[DEBUG METAS] Metas atualizadas no componente:', goals);
    
    // Verificar se há IDs temporários
    const tempGoals = goals.filter(g => g.id.startsWith('temp-'));
    if (tempGoals.length > 0) {
      console.log('[DEBUG METAS] Detectadas metas temporárias:', tempGoals);
    }
    
    // Verificar metas com formato de data inválido
    const goalsWithInvalidDate = goals.filter(g => {
      try {
        const date = new Date(g.deadline);
        return isNaN(date.getTime());
      } catch {
        return true;
      }
    });
    
    if (goalsWithInvalidDate.length > 0) {
      console.warn('[DEBUG METAS] Detectadas metas com formato de data inválido:', goalsWithInvalidDate);
    }
  }, [goals]);

  // Estados da UI
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<GoalStatus>('all');
  const [sortBy, setSortBy] = useState<SortOption>('deadline');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [searchTerm, setSearchTerm] = useState('');

  // Estado do formulário de meta
  const [novaMeta, setNovaMeta] = useState({
    name: '',
    description: '',
    targetAmount: '',
    currentAmount: '',
    deadline: new Date().toISOString().split('T')[0],
    category: ''
  });

  // Ordenar e filtrar metas
  const filteredGoals = React.useMemo(() => {
    return goals
      .filter(goal => {
        // Filtro por status
        if (statusFilter === 'active' && goal.isCompleted) {
          return false;
        }
        if (statusFilter === 'completed' && !goal.isCompleted) {
          return false;
        }
        
        // Filtro por termo de busca
        if (searchTerm && 
            !goal.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
            !goal.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        // Ordenação
        switch (sortBy) {
          case 'deadline':
            const dateA = new Date(a.deadline).getTime();
            const dateB = new Date(b.deadline).getTime();
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            
          case 'progress':
            const progressA = a.currentAmount / a.targetAmount;
            const progressB = b.currentAmount / b.targetAmount;
            return sortOrder === 'asc' ? progressA - progressB : progressB - progressA;
            
          case 'amount':
            return sortOrder === 'asc' 
              ? a.targetAmount - b.targetAmount 
              : b.targetAmount - a.targetAmount;
            
          default:
            return 0;
        }
      });
  }, [goals, statusFilter, searchTerm, sortBy, sortOrder]);

  // Função de limpeza
  useEffect(() => {
    componentMounted.current = true;
    
    return () => {
      componentMounted.current = false;
    };
  }, []);

  // Função para resetar o formulário
  const resetForm = useCallback(() => {
    setNovaMeta({
      name: '',
      description: '',
      targetAmount: '',
      currentAmount: '',
      deadline: new Date().toISOString().split('T')[0],
      category: ''
    });
    setEditingId(null);
  }, []);

  // Função para adicionar ou atualizar uma meta
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!componentMounted.current || !currentUser) return;
    
    try {
      // Validar dados
      if (!novaMeta.name || !novaMeta.targetAmount || !novaMeta.deadline) {
        showNotification('error', 'Por favor, preencha todos os campos obrigatórios');
        return;
      }
      
      // Garantir que os valores são números
      const targetAmount = Number(novaMeta.targetAmount);
      const currentAmount = Number(novaMeta.currentAmount || 0);
      
      if (isNaN(targetAmount) || targetAmount <= 0) {
        showNotification('error', 'Valor alvo deve ser um número positivo');
        return;
      }
      
      if (isNaN(currentAmount) || currentAmount < 0) {
        showNotification('error', 'Valor atual deve ser um número não negativo');
        return;
      }
      
      const deadlineDate = new Date(novaMeta.deadline);
      if (isNaN(deadlineDate.getTime())) {
        showNotification('error', 'Data limite inválida');
        return;
      }
      
      // Verificar se atingiu a meta
      const isCompleted = currentAmount >= targetAmount;
      
      if (editingId) {
        // Atualizar meta existente
        await updateGoal(editingId, {
          name: novaMeta.name,
          description: novaMeta.description,
          targetAmount,
          currentAmount,
          deadline: novaMeta.deadline,
          category: novaMeta.category || undefined,
          isCompleted,
          updatedAt: new Date().toISOString()
        });
        
        showNotification('success', 'Meta atualizada com sucesso!');
      } else {
        // Criar nova meta
        await addGoal({
          name: novaMeta.name,
          description: novaMeta.description,
          targetAmount,
          currentAmount,
          deadline: novaMeta.deadline,
          category: novaMeta.category || undefined,
          isCompleted,
          userId: currentUser.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        
        showNotification('success', 'Meta criada com sucesso!');
      }
      
      // Limpar formulário e fechar
      resetForm();
      setFormOpen(false);
      
    } catch (err) {
      console.error('Erro ao salvar meta:', err);
      showNotification('error', `Erro ao salvar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  };

  // Função para editar uma meta
  const handleEdit = (goal: Goal) => {
    if (!componentMounted.current) return;
    
    setNovaMeta({
      name: goal.name,
      description: goal.description || '',
      targetAmount: goal.targetAmount.toString(),
      currentAmount: goal.currentAmount.toString(),
      deadline: typeof goal.deadline === 'string' 
        ? goal.deadline.slice(0, 10) 
        : new Date(goal.deadline).toISOString().slice(0, 10),
      category: goal.category || ''
    });
    
    setEditingId(goal.id);
    setFormOpen(true);
  };

  // Calcular dias restantes
  const getDaysRemaining = (dateString: string | Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const deadline = new Date(dateString);
    deadline.setHours(0, 0, 0, 0);
    
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  // Renderizar dias restantes com formatação
  const renderDaysRemaining = (goal: Goal) => {
    if (goal.isCompleted) {
      return (
        <span className="text-green-600 flex items-center">
          <FiCheck className="mr-1" />
          Concluída
        </span>
      );
    }
    
    const days = getDaysRemaining(goal.deadline);
    
    if (days < 0) {
      return <span className="text-red-600">{Math.abs(days)} dias atrasada</span>;
    }
    
    if (days === 0) {
      return <span className="text-orange-600">Vence hoje</span>;
    }
    
    if (days === 1) {
      return <span className="text-orange-600">Vence amanhã</span>;
    }
    
    return <span className="text-gray-600">{days} dias restantes</span>;
  };

  // Calcular informações do dashboard de forma dinâmica
  const dashboardData = React.useMemo(() => {
    // Total de metas
    const totalMetas = goals.length;
    
    // Metas por status
    const metasConcluidas = goals.filter(g => g.isCompleted).length;
    const metasEmAndamento = goals.filter(g => !g.isCompleted && new Date(g.deadline) >= new Date()).length;
    const metasAtrasadas = goals.filter(g => !g.isCompleted && new Date(g.deadline) < new Date()).length;
    
    // Valores totais
    const valorTotalMetas = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
    const valorAtualMetas = goals.reduce((sum, goal) => sum + goal.currentAmount, 0);
    const valorRestante = valorTotalMetas - valorAtualMetas;
    
    // Progresso geral
    const progressoGeral = valorTotalMetas > 0 
      ? Math.min((valorAtualMetas / valorTotalMetas) * 100, 100) 
      : 0;
    
    // Próximas metas a vencer (em até 30 dias)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const proximasVencer = goals
      .filter(g => !g.isCompleted)
      .filter(g => {
        const deadline = new Date(g.deadline);
        deadline.setHours(0, 0, 0, 0);
        
        const diffDays = Math.ceil((deadline.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 30;
      })
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 3);
    
    return {
      totalMetas,
      metasConcluidas,
      metasEmAndamento,
      metasAtrasadas,
      valorTotalMetas,
      valorAtualMetas,
      valorRestante,
      progressoGeral,
      proximasVencer
    };
  }, [goals]);

  // Função aprimorada para excluir uma meta
  const handleDelete = async (id: string, name: string) => {
    if (!componentMounted.current) return;
    
    // Encontrar a meta a ser excluída
    const goalToDelete = goals.find(g => g.id === id);
    
    if (!goalToDelete) {
      showNotification('error', 'Meta não encontrada');
      return;
    }
    
    // Mensagem de confirmação mais detalhada
    const isCompleted = goalToDelete.isCompleted;
    const message = isCompleted
      ? `Deseja realmente excluir a meta concluída "${name}"?`
      : `Deseja realmente excluir a meta "${name}"? Todo o progresso será perdido.`;
    
    if (window.confirm(message)) {
      try {
        await deleteGoal(id);
        showNotification('success', `Meta "${name}" excluída com sucesso!`);
      } catch (err) {
        console.error('Erro ao excluir meta:', err);
        showNotification('error', `Erro ao excluir: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }
    }
  };

  // Função para atualizar o valor atual de uma meta
  const handleUpdateCurrentAmount = async (goalId: string, goal: Goal, newAmount: number) => {
    if (!componentMounted.current) return;
    
    try {
      // Validar valor
      if (isNaN(newAmount) || newAmount < 0) {
        showNotification('error', 'Valor atual deve ser um número não negativo');
        return;
      }
      
      // Verificar se atingiu a meta
      const isCompleted = newAmount >= goal.targetAmount;
      
      await updateGoal(goalId, {
        currentAmount: newAmount,
        isCompleted,
        updatedAt: new Date().toISOString()
      });
      
      showNotification('success', 'Valor atualizado com sucesso!');
      
      if (isCompleted && newAmount !== goal.currentAmount) {
        showNotification('success', 'Parabéns! Você atingiu esta meta!');
      }
    } catch (err) {
      console.error('Erro ao atualizar valor:', err);
      showNotification('error', `Erro ao atualizar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  };

  // Calcular progresso
  const calculateProgress = (currentAmount: number, targetAmount: number) => {
    return Math.min((currentAmount / targetAmount) * 100, 100);
  };

  // Formatar data
  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  // Verificar status da meta
  const getGoalStatus = (goal: Goal) => {
    if (goal.isCompleted) {
      return { label: 'Concluída', bgColor: 'bg-green-100', textColor: 'text-green-800' };
    }
    
    const today = new Date();
    const deadline = new Date(goal.deadline);
    
    if (deadline < today) {
      return { label: 'Atrasada', bgColor: 'bg-red-100', textColor: 'text-red-800' };
    }
    
    return { label: 'Em andamento', bgColor: 'bg-blue-100', textColor: 'text-blue-800' };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Metas de Economia</h1>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setFormOpen(!formOpen);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <FiPlus className="mr-2" />
          Nova Meta
        </button>
      </div>

      {formOpen && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {editingId ? 'Editar Meta' : 'Nova Meta'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Nome da Meta*
                </label>
                <input
                  type="text"
                  id="name"
                  value={novaMeta.name}
                  onChange={(e) => setNovaMeta({ ...novaMeta, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="targetAmount" className="block text-sm font-medium text-gray-700">
                  Valor Alvo*
                </label>
                <input
                  type="number"
                  id="targetAmount"
                  min="0.01"
                  step="0.01"
                  value={novaMeta.targetAmount}
                  onChange={(e) => setNovaMeta({ ...novaMeta, targetAmount: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="currentAmount" className="block text-sm font-medium text-gray-700">
                  Valor Atual
                </label>
                <input
                  type="number"
                  id="currentAmount"
                  min="0"
                  step="0.01"
                  value={novaMeta.currentAmount}
                  onChange={(e) => setNovaMeta({ ...novaMeta, currentAmount: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="deadline" className="block text-sm font-medium text-gray-700">
                  Data Limite*
                </label>
                <input
                  type="date"
                  id="deadline"
                  value={novaMeta.deadline}
                  onChange={(e) => setNovaMeta({ ...novaMeta, deadline: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                  Categoria
                </label>
                <select
                  id="category"
                  value={novaMeta.category}
                  onChange={(e) => setNovaMeta({ ...novaMeta, category: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Selecione uma categoria</option>
                  <option value="Lazer">Lazer</option>
                  <option value="Investimento">Investimento</option>
                  <option value="Educação">Educação</option>
                  <option value="Viagem">Viagem</option>
                  <option value="Moradia">Moradia</option>
                  <option value="Veículo">Veículo</option>
                  <option value="Emergência">Emergência</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Descrição
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={novaMeta.description}
                  onChange={(e) => setNovaMeta({ ...novaMeta, description: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
              placeholder="Buscar metas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as GoalStatus)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="all">Todas as Metas</option>
              <option value="active">Em Andamento</option>
              <option value="completed">Concluídas</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="deadline">Ordenar por Data Limite</option>
              <option value="progress">Ordenar por Progresso</option>
              <option value="amount">Ordenar por Valor</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              {sortOrder === 'asc' ? '↑ Crescente' : '↓ Decrescente'}
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard aprimorado - Resumo das Metas */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Resumo das Metas</h2>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500">Total de Metas</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{dashboardData.totalMetas}</p>
              <div className="mt-1 flex text-xs">
                <span className="text-green-600 font-medium">{dashboardData.metasConcluidas} concluídas</span>
                <span className="mx-1.5 text-gray-500">•</span>
                <span className="text-blue-600 font-medium">{dashboardData.metasEmAndamento} em andamento</span>
                {dashboardData.metasAtrasadas > 0 && (
                  <>
                    <span className="mx-1.5 text-gray-500">•</span>
                    <span className="text-red-600 font-medium">{dashboardData.metasAtrasadas} atrasadas</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500">Valor Total</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dashboardData.valorTotalMetas)}
              </p>
              <div className="mt-1 flex text-xs">
                <span className="text-green-600 font-medium">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dashboardData.valorAtualMetas)} economizado
                </span>
                <span className="mx-1.5 text-gray-500">•</span>
                <span className="text-blue-600 font-medium">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dashboardData.valorRestante)} restante
                </span>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500">Progresso Geral</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{dashboardData.progressoGeral.toFixed(0)}%</p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    dashboardData.progressoGeral >= 75 ? 'bg-green-500' : 
                    dashboardData.progressoGeral >= 50 ? 'bg-green-400' : 
                    dashboardData.progressoGeral >= 25 ? 'bg-blue-500' : 'bg-blue-400'
                  }`}
                  style={{ width: `${dashboardData.progressoGeral}%` }}
                ></div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500">Próximas a Vencer</h3>
              {dashboardData.proximasVencer.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {dashboardData.proximasVencer.map(meta => {
                    const dias = getDaysRemaining(meta.deadline);
                    return (
                      <li key={meta.id} className="flex justify-between items-center text-sm">
                        <span className="truncate max-w-[140px]">{meta.name}</span>
                        <span className={`text-xs font-medium ${
                          dias <= 3 ? 'text-red-600' : 
                          dias <= 7 ? 'text-orange-600' : 'text-blue-600'
                        }`}>
                          {dias === 0 ? 'Hoje' : 
                           dias === 1 ? 'Amanhã' : 
                           `${dias} dias`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-gray-500">Nenhuma meta próxima do vencimento</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Metas */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <h2 className="text-lg font-medium text-gray-900 p-6 pb-4">Minhas Metas</h2>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Carregando metas...</p>
          </div>
        ) : filteredGoals.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">Nenhuma meta encontrada.</p>
            <button 
              onClick={() => { resetForm(); setFormOpen(true); }}
              className="mt-2 inline-flex items-center px-3 py-1.5 border border-blue-300 text-xs font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100"
            >
              <FiPlus className="mr-1" /> Adicionar Meta
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
            {filteredGoals.map((goal) => {
              const status = getGoalStatus(goal);
              const progress = calculateProgress(goal.currentAmount, goal.targetAmount);
              
              return (
                <div key={goal.id} className="border rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{goal.name}</h3>
                      {goal.category && (
                        <div className="flex items-center mt-1">
                          <FiTag className="mr-1 text-gray-500" size={14} />
                          <span className="text-sm text-gray-500">{goal.category}</span>
                        </div>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${status.bgColor} ${status.textColor}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  
                  {goal.description && (
                    <p className="text-sm text-gray-600 mb-3">{goal.description}</p>
                  )}
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Progresso</span>
                      <span className="font-medium">
                        {progress.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full ${
                          progress >= 100 
                            ? 'bg-green-500' 
                            : progress > 60 
                              ? 'bg-blue-500' 
                              : 'bg-blue-400'
                        }`}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center">
                        <FiDollarSign className="mr-1 text-gray-500" />
                        <span className="text-gray-500">Valor:</span>
                      </div>
                      <span className="font-medium">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(goal.currentAmount)}
                        {' / '}
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(goal.targetAmount)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center">
                        <FiCalendar className="mr-1 text-gray-500" />
                        <span className="text-gray-500">Prazo:</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-medium mr-2">
                          {formatDate(goal.deadline)}
                        </span>
                        <span className="text-xs">
                          ({renderDaysRemaining(goal)})
                        </span>
                      </div>
                    </div>
                    
                    {!goal.isCompleted && (
                      <div className="pt-2 mt-2 border-t border-gray-100">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={goal.currentAmount}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          placeholder="Valor atual"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const target = e.target as HTMLInputElement;
                              handleUpdateCurrentAmount(goal.id, goal, Number(target.value));
                              target.blur();
                            }
                          }}
                          onBlur={(e) => {
                            const target = e.target as HTMLInputElement;
                            const newValue = Number(target.value);
                            // Atualizar apenas se o valor for diferente do atual
                            if (newValue !== goal.currentAmount) {
                              handleUpdateCurrentAmount(goal.id, goal, newValue);
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 flex justify-end space-x-2">
                    <button
                      onClick={() => handleEdit(goal)}
                      className="text-blue-600 hover:text-blue-800 p-1.5 hover:bg-blue-50 rounded"
                      title="Editar"
                    >
                      <FiEdit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id, goal.name)}
                      className="text-red-600 hover:text-red-800 p-1.5 hover:bg-red-50 rounded"
                      title="Excluir"
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card CTA para Plano Pro */}
      <div className="mt-8 bg-gradient-to-r from-rose-500 to-purple-600 rounded-2xl shadow-lg p-8 text-white">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-4">
              Gestão Avançada de Metas com Plano Pro
            </h2>
            <p className="text-rose-100 mb-6">
              Alcance seus objetivos financeiros com mais eficiência e precisão.
            </p>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Metas personalizadas com IA
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Acompanhamento em tempo real
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Alertas de progresso
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Relatórios detalhados de metas
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

export default Metas; 