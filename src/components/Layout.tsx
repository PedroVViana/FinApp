import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FiUser, FiLogOut, FiSettings } from 'react-icons/fi';
import SyncStatus from './SyncStatus';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, userData, logout } = useAuth();

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/despesas', label: 'Despesas', icon: '💰' },
    { path: '/orcamento', label: 'Orçamento', icon: '📋' },
    { path: '/metas', label: 'Metas', icon: '🎯' },
    { path: '/relatorios', label: 'Relatórios', icon: '📈' },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Fundo com gradiente e padrão */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {/* Círculos decorativos animados */}
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute top-1/3 right-1/3 w-32 h-32 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-1/3 left-1/2 w-32 h-32 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Conteúdo */}
      <div className="relative">
        {/* Header com nav */}
        <header className="sticky top-0 z-50">
          <nav className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                {/* Logo e Menu Principal */}
                <div className="flex items-center">
                  <div className="flex-shrink-0 flex items-center">
                    <Link to="/" className="flex items-center space-x-2">
                      <span className="text-2xl font-bold text-gradient">
                        FinApp
                      </span>
                    </Link>
                  </div>
                  <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
                    {menuItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                          location.pathname === item.path
                            ? 'bg-rose-50 text-rose-700'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="mr-2">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Menu de Perfil */}
                <div className="hidden md:flex md:items-center md:gap-4">
                  <SyncStatus />
                  <Menu as="div" className="relative inline-block text-left">
                    <Menu.Button className="flex items-center px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500">
                      <div className="h-8 w-8 rounded-full bg-gradient flex items-center justify-center text-white font-medium">
                        {currentUser?.displayName?.[0]?.toUpperCase() || '👤'}
                      </div>
                      <span className="ml-2 hidden sm:block">{currentUser?.displayName}</span>
                      <svg
                        className="ml-2 h-5 w-5 text-gray-400"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </Menu.Button>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute right-0 mt-2 w-72 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none divide-y divide-gray-100">
                        {/* Cabeçalho do Menu */}
                        <div className="px-4 py-4">
                          <p className="text-sm font-medium text-gray-900">{currentUser?.displayName}</p>
                          <p className="text-sm text-gray-500 mt-1">{currentUser?.email}</p>
                          <div className="mt-2 flex items-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              userData?.planType === 'pro' 
                                ? 'bg-gradient text-white'
                                : userData?.planType === 'enterprise'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {userData?.planType === 'free' ? '🌱 Plano Gratuito' : 
                               userData?.planType === 'pro' ? '⭐ Plano Pro' : 
                               '💎 Plano Empresarial'}
                            </span>
                          </div>
                        </div>

                        {/* Links de Navegação */}
                        <div className="py-2">
                          <Menu.Item>
                            {({ active }) => (
                              <Link
                                to="/configuracoes"
                                className={`${
                                  active ? 'bg-gray-50' : ''
                                } flex px-4 py-3 text-sm text-gray-700 items-center hover:bg-gray-50 transition-colors duration-150`}
                              >
                                <span className="mr-3 text-xl">⚙️</span>
                                <div>
                                  <p className="font-medium">Configurações</p>
                                  <p className="text-gray-500">Personalize sua experiência</p>
                                </div>
                              </Link>
                            )}
                          </Menu.Item>

                          <Menu.Item>
                            {({ active }) => (
                              <Link
                                to="/planos"
                                className={`${
                                  active ? 'bg-gray-50' : ''
                                } flex px-4 py-3 text-sm text-gray-700 items-center hover:bg-gray-50 transition-colors duration-150`}
                              >
                                <span className="mr-3 text-xl">⭐</span>
                                <div>
                                  <p className="font-medium">Alterar Plano</p>
                                  <p className="text-gray-500">Conheça nossos planos premium</p>
                                </div>
                              </Link>
                            )}
                          </Menu.Item>
                        </div>

                        {/* Botão de Logout */}
                        <div className="py-2">
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={handleLogout}
                                className={`${
                                  active ? 'bg-gray-50' : ''
                                } flex w-full px-4 py-3 text-sm text-gray-700 items-center hover:bg-gray-50 transition-colors duration-150`}
                              >
                                <span className="mr-3 text-xl">🚪</span>
                                <div>
                                  <p className="font-medium">Sair da conta</p>
                                  <p className="text-gray-500">Encerrar sessão atual</p>
                                </div>
                              </button>
                            )}
                          </Menu.Item>
                        </div>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                </div>
              </div>
            </div>
          </nav>
        </header>

        <main className="relative max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="[&>*]:bg-white/80 [&>*]:backdrop-blur-sm">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
} 