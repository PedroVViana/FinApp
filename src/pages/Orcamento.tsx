import React, { useState, useEffect } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { FiPlus, FiEdit2, FiTrash2, FiSave, FiX } from 'react-icons/fi';
import { Category } from '../types';

export function Orcamento() {
  const { categories, addCategory, updateCategory, deleteCategory, isLoading } = useFinance();
  const { userData } = useAuth();
  const isPremium = userData?.planType === 'pro' || userData?.planType === 'enterprise';

  // Estados para o formulário de categoria
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  
  // Selecionar categorias do tipo ativo
  const filteredCategories = categories.filter(cat => cat.type === activeTab);
  
  // Estado para nova categoria
  const [novaCategoria, setNovaCategoria] = useState({
    name: '',
    type: 'expense' as 'expense' | 'income',
    color: '#FF5722',
  });

  // Lista de cores para seleção
  const colorOptions = [
    '#FF5722', // Laranja
    '#4CAF50', // Verde
    '#2196F3', // Azul
    '#9C27B0', // Roxo
    '#F44336', // Vermelho
    '#FFC107', // Amarelo
    '#3F51B5', // Índigo
    '#607D8B', // Azul acinzentado
    '#E91E63', // Rosa
    '#00BCD4', // Ciano
  ];

  // Resetar formulário
  const resetForm = () => {
    setNovaCategoria({
      name: '',
      type: activeTab,
      color: '#FF5722',
    });
    setEditingId(null);
  };

  // Atualizar tipo da nova categoria quando a aba muda
  useEffect(() => {
    setNovaCategoria(prev => ({
      ...prev,
      type: activeTab,
    }));
  }, [activeTab]);

  // Função para editar uma categoria existente
  const handleEdit = (category: Category) => {
    setNovaCategoria({
      name: category.name,
      type: category.type,
      color: category.color,
    });
    setEditingId(category.id);
    setFormOpen(true);
  };

  // Função para salvar uma categoria (nova ou editada)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        await updateCategory(editingId, novaCategoria);
        console.log(`Categoria ${editingId} atualizada com sucesso`);
      } else {
        const id = await addCategory(novaCategoria);
        console.log(`Nova categoria adicionada com id: ${id}`);
      }

      resetForm();
      setFormOpen(false);
    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
      alert(`Erro ao salvar categoria: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  // Função para excluir uma categoria
  const handleDelete = async (id: string, isDefault: boolean) => {
    // Impedir exclusão de categorias padrão
    if (isDefault) {
      alert('Categorias padrão não podem ser excluídas');
      return;
    }
    
    if (window.confirm('Tem certeza que deseja excluir esta categoria?')) {
      try {
        await deleteCategory(id);
      } catch (error) {
        console.error('Erro ao excluir categoria:', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Orçamento e Categorias</h1>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setFormOpen(!formOpen);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <FiPlus className="mr-2" />
          Nova Categoria
        </button>
      </div>

      {/* Formulário para criar/editar categoria */}
      {formOpen && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {editingId ? 'Editar Categoria' : 'Nova Categoria'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Nome da Categoria
                </label>
                <input
                  type="text"
                  id="name"
                  value={novaCategoria.name}
                  onChange={(e) => setNovaCategoria({ ...novaCategoria, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                  Tipo
                </label>
                <select
                  id="type"
                  value={novaCategoria.type}
                  onChange={(e) => setNovaCategoria({ 
                    ...novaCategoria, 
                    type: e.target.value as 'expense' | 'income' 
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                >
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </select>
              </div>

              <div>
                <label htmlFor="color" className="block text-sm font-medium text-gray-700">
                  Cor
                </label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNovaCategoria({ ...novaCategoria, color })}
                      className={`w-6 h-6 rounded-full border ${
                        novaCategoria.color === color ? 'ring-2 ring-offset-2 ring-blue-500' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Cor ${color}`}
                    />
                  ))}
                </div>
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

      {/* Tabs para alternar entre categorias de despesas e receitas */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('expense')}
            className={`${
              activeTab === 'expense'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Despesas
          </button>
          <button
            onClick={() => setActiveTab('income')}
            className={`${
              activeTab === 'income'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Receitas
          </button>
        </nav>
      </div>

      {/* Lista de categorias */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {activeTab === 'expense' ? 'Categorias de Despesas' : 'Categorias de Receitas'}
          </h2>
          
          {isLoading ? (
            <div className="py-10 text-center text-gray-500">Carregando categorias...</div>
          ) : filteredCategories.length === 0 ? (
            <div className="py-10 text-center text-gray-500">
              Nenhuma categoria {activeTab === 'expense' ? 'de despesa' : 'de receita'} encontrada
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filteredCategories.map((category) => {
                const isDefault = category.id.startsWith('default-');
                
                return (
                  <li key={category.id} className="py-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <span 
                        className="inline-block w-4 h-4 rounded-full mr-3" 
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-sm font-medium text-gray-900">
                        {category.name}
                        {isDefault && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            Padrão
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(category)}
                        className="text-indigo-600 hover:text-indigo-900"
                        disabled={isDefault}
                        title={isDefault ? "Categorias padrão não podem ser editadas" : "Editar categoria"}
                      >
                        <FiEdit2 className={isDefault ? "opacity-50" : ""} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(category.id, isDefault)}
                        className="text-red-600 hover:text-red-900"
                        disabled={isDefault}
                        title={isDefault ? "Categorias padrão não podem ser excluídas" : "Excluir categoria"}
                      >
                        <FiTrash2 className={isDefault ? "opacity-50" : ""} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Instruções e dicas para usuários */}
      <div className="bg-blue-50 shadow rounded-lg p-6">
        <h3 className="text-md font-medium text-blue-900 mb-2">Dicas para categorias</h3>
        <ul className="list-disc pl-5 text-sm text-blue-800 space-y-1">
          <li>Use categorias bem definidas para facilitar o acompanhamento de suas despesas e receitas</li>
          <li>Categorias padrão não podem ser editadas ou excluídas</li>
          <li>Você pode criar categorias personalizadas de acordo com suas necessidades</li>
          <li>
            As cores das categorias facilitam a identificação nos relatórios e gráficos
            {!isPremium && " (disponíveis no plano Premium)"}
          </li>
        </ul>
      </div>
    </div>
  );
} 