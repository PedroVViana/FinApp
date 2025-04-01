import { ReactNode, useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FiUser, FiLogOut, FiSettings, FiHome, FiList, FiArrowDown, FiArrowUp, FiCreditCard, FiTag, FiTarget } from 'react-icons/fi';
import SyncStatus from './SyncStatus';
import { notifyNavigationStart, notifyNavigationEnd } from '../services/syncService';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, userData, logout } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Usar ref para rastrear o temporizador para limpar na desmontagem
  const navigationTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref para rastrear a última navegação para evitar cliques repetidos no mesmo destino
  const lastNavigationRef = useRef<{path: string, time: number} | null>(null);

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/despesas', label: 'Despesas', icon: '��' },
    { path: '/receitas', label: 'Receitas', icon: '💸' },
    { path: '/orcamento', label: 'Orçamento', icon: '📋' },
    { path: '/metas', label: 'Metas', icon: '🎯' },
    { path: '/relatorios', label: 'Relatórios', icon: '📈' },
  ];

  // Limpar o estado de navegação quando a rota mudar
  useEffect(() => {
    setIsNavigating(false);
    
    // Limpar temporizadores pendentes
    if (navigationTimerRef.current) {
      clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }
  }, [location.pathname]);
  
  // Limpar temporizadores na desmontagem
  useEffect(() => {
    return () => {
      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);
  
  // Antes de navegar para a página de Despesas, purge listeners ou notifique outros componentes
  const prepareNavigationMaybeHeavyPage = (path: string) => {
    // Se estivermos indo para a página de despesas, emitir um evento para que o contexto se prepare
    if (path === '/despesas') {
      const navigationEvent = new CustomEvent('prepareForDespesasNavigation', {
        detail: { timestamp: Date.now() }
      });
      window.dispatchEvent(navigationEvent);
      console.log("Notifying Finance Context to prepare for navigation to Despesas");
      
      // Dar um pequeno tempo para o contexto preparar a transição
      return new Promise<void>(resolve => setTimeout(resolve, 100));
    }
    
    return Promise.resolve();
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  // Função melhorada para navegação
  const handleNavigate = async (event: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    // Prevenir o comportamento padrão para usar nossa navegação controlada
    event.preventDefault();
    
    // Permitir o comportamento padrão do Link apenas se não estivermos já navegando
    if (isNavigating) {
      // Prevenir múltiplos cliques durante navegação
      console.log('Já está navegando, ignorando clique adicional');
      return;
    }
    
    // Verificar se o usuário clicou várias vezes no mesmo link em um curto período
    const now = Date.now();
    if (lastNavigationRef.current && 
        lastNavigationRef.current.path === path && 
        now - lastNavigationRef.current.time < 1000) { // Dentro de 1 segundo
      console.log('Clique repetido muito rápido, ignorando');
      return;
    }
    
    // Atualizar o último clique
    lastNavigationRef.current = { path, time: now };

    // Se estivermos na mesma página, apenas fazer scroll
    if (location.pathname === path) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Para navegação real, marcar que estamos navegando
    console.log(`Navegando para: ${path}`);
    setIsNavigating(true);
    
    try {
      // Preparar a navegação, especialmente para páginas com muitos dados
      await prepareNavigationMaybeHeavyPage(path);
      
      // Forçar o restabelecimento de state após um curto período
      // Isso ajuda a resolver problemas quando a navegação "trava"
      navigationTimerRef.current = setTimeout(() => {
        // Tentar a navegação
        navigate(path);
        
        // Configurar um timeout de segurança para resetar o estado de navegação se algo falhar
        setTimeout(() => {
          if (isNavigating) {
            console.log('Navigação parece estar travada, resetando estado');
            setIsNavigating(false);
          }
        }, 3000); // 3 segundos para timeout de segurança
      }, 50);
    } catch (error) {
      console.error('Erro durante navegação:', error);
      setIsNavigating(false); // Resetar estado em caso de erro
    }
  };

  // No final da navegação, adicionar:
  useEffect(() => {
    // Notificar o fim da navegação quando o componente for montado
    notifyNavigationEnd();

    return () => {
      // Notificar o início da navegação quando o componente for desmontado
      notifyNavigationStart();
    };
  }, [location.pathname]);

  // Modificar a função de navegação:
  const handleNavLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, to: string) => {
    if (location.pathname === to) {
      // Evitar recarregar a mesma página
      e.preventDefault();
      return;
    }
    
    // Notificar o início da navegação
    notifyNavigationStart();
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
                    <NavLink
                      to="/"
                      className={({ isActive }) =>
                        `flex items-center px-4 py-2 text-sm rounded-md transition-colors ${
                          isActive
                            ? 'text-rose-600 bg-rose-50 font-medium'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`
                      }
                      onClick={(e) => handleNavLinkClick(e, "/")}
                    >
                      <FiHome className="mr-3" /> Dashboard
                    </NavLink>
                    <NavLink
                      to="/despesas"
                      className={({ isActive }) =>
                        `flex items-center px-4 py-2 text-sm rounded-md transition-colors ${
                          isActive
                            ? 'text-rose-600 bg-rose-50 font-medium'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`
                      }
                      onClick={(e) => handleNavLinkClick(e, "/despesas")}
                    >
                      <FiArrowDown className="mr-3" /> Despesas
                    </NavLink>
                    <NavLink
                      to="/receitas"
                      className={({ isActive }) =>
                        `flex items-center px-4 py-2 text-sm rounded-md transition-colors ${
                          isActive
                            ? 'text-rose-600 bg-rose-50 font-medium'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`
                      }
                      onClick={(e) => handleNavLinkClick(e, "/receitas")}
                    >
                      <FiArrowUp className="mr-3" /> Receitas
                    </NavLink>
                    <NavLink
                      to="/orcamento"
                      className={({ isActive }) =>
                        `flex items-center px-4 py-2 text-sm rounded-md transition-colors ${
                          isActive
                            ? 'text-rose-600 bg-rose-50 font-medium'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`
                      }
                      onClick={(e) => handleNavLinkClick(e, "/orcamento")}
                    >
                      <FiList className="mr-3" /> Orçamento
                    </NavLink>
                    <NavLink
                      to="/metas"
                      className={({ isActive }) =>
                        `flex items-center px-4 py-2 text-sm rounded-md transition-colors ${
                          isActive
                            ? 'text-rose-600 bg-rose-50 font-medium'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`
                      }
                      onClick={(e) => handleNavLinkClick(e, "/metas")}
                    >
                      <FiTarget className="mr-3" /> Metas
                    </NavLink>
                    <NavLink
                      to="/relatorios"
                      className={({ isActive }) =>
                        `flex items-center px-4 py-2 text-sm rounded-md transition-colors ${
                          isActive
                            ? 'text-rose-600 bg-rose-50 font-medium'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`
                      }
                      onClick={(e) => handleNavLinkClick(e, "/relatorios")}
                    >
                      <FiArrowUp className="mr-3" /> Relatórios
                    </NavLink>
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
          {children}
        </main>
      </div>
    </div>
  );
} 