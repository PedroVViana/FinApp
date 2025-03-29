import React, { useState, useEffect } from 'react';
import { FiCheck, FiX, FiInfo, FiAlertTriangle } from 'react-icons/fi';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface NotificationProps {
  type: NotificationType;
  message: string;
  visible: boolean;
  onClose: () => void;
  duration?: number; // Duração em ms (padrão: 5000ms)
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export const Notification: React.FC<NotificationProps> = ({
  type,
  message,
  visible,
  onClose,
  duration = 5000,
  position = 'top-right'
}) => {
  // Fechar automaticamente após a duração especificada
  useEffect(() => {
    if (visible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onClose]);

  // Se não estiver visível, não renderizar nada
  if (!visible) return null;

  // Definir classes e ícones com base no tipo de notificação
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          icon: <FiCheck />,
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          borderColor: 'border-green-300'
        };
      case 'error':
        return {
          icon: <FiX />,
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          borderColor: 'border-red-300'
        };
      case 'warning':
        return {
          icon: <FiAlertTriangle />,
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          borderColor: 'border-yellow-300'
        };
      case 'info':
      default:
        return {
          icon: <FiInfo />,
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-300'
        };
    }
  };

  // Obter estilos com base na posição
  const getPositionStyles = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-right':
      default:
        return 'top-4 right-4';
    }
  };

  const { icon, bgColor, textColor, borderColor } = getTypeStyles();
  const positionClasses = getPositionStyles();

  return (
    <div 
      className={`fixed ${positionClasses} flex items-center p-4 rounded-md border shadow-lg z-50 transition-all duration-300 ease-in-out ${bgColor} ${textColor} ${borderColor}`}
      role="alert"
    >
      <span className="flex-shrink-0 mr-2">{icon}</span>
      <p className="flex-grow">{message}</p>
      <button 
        onClick={onClose}
        className="ml-4 text-gray-600 hover:text-gray-800 focus:outline-none"
        aria-label="Fechar"
      >
        <FiX />
      </button>
    </div>
  );
};

// Hook para gerenciar notificações facilmente em componentes
export const useNotification = () => {
  const [notifications, setNotifications] = useState<{
    type: NotificationType;
    message: string;
    visible: boolean;
    id: string;
  }[]>([]);

  const showNotification = (type: NotificationType, message: string) => {
    const id = Date.now().toString();
    setNotifications(prev => [
      ...prev,
      { type, message, visible: true, id }
    ]);

    return id;
  };

  const hideNotification = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, visible: false } 
          : notification
      )
    );

    // Remover do array após a animação
    setTimeout(() => {
      setNotifications(prev => 
        prev.filter(notification => notification.id !== id)
      );
    }, 300);
  };

  return {
    notifications,
    showNotification,
    hideNotification,
    success: (message: string) => showNotification('success', message),
    error: (message: string) => showNotification('error', message),
    info: (message: string) => showNotification('info', message),
    warning: (message: string) => showNotification('warning', message)
  };
};

export default Notification; 