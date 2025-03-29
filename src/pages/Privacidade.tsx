import React from 'react';
import { Link } from 'react-router-dom';

export function Privacidade() {
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl card-glass p-8 space-y-8">
        {/* Cabeçalho */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gradient mb-2">Política de Privacidade</h1>
          <p className="text-gray-600">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>

        {/* Conteúdo */}
        <div className="space-y-6 text-gray-700">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gradient">1. Coleta de Informações</h2>
            <p>
              Coletamos as seguintes informações para fornecer e melhorar nossos serviços:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Informações de cadastro (nome, email)</li>
              <li>Dados financeiros inseridos por você</li>
              <li>Informações de uso do aplicativo</li>
              <li>Dados de dispositivo e navegador</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gradient">2. Uso das Informações</h2>
            <p>
              Utilizamos suas informações para:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Fornecer e manter nossos serviços</li>
              <li>Personalizar sua experiência</li>
              <li>Melhorar nosso aplicativo</li>
              <li>Enviar atualizações importantes</li>
              <li>Fornecer suporte ao cliente</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gradient">3. Proteção de Dados</h2>
            <p>
              Implementamos medidas de segurança rigorosas para proteger suas informações:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Criptografia de ponta a ponta</li>
              <li>Autenticação de dois fatores</li>
              <li>Monitoramento contínuo</li>
              <li>Backups regulares</li>
              <li>Atualizações de segurança</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gradient">4. Compartilhamento de Dados</h2>
            <p>
              Não vendemos, alugamos ou compartilhamos suas informações pessoais com terceiros,
              exceto quando:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Você autorizar expressamente</li>
              <li>For necessário para prestação do serviço</li>
              <li>For exigido por lei</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gradient">5. Seus Direitos</h2>
            <p>
              Você tem direito a:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir informações imprecisas</li>
              <li>Solicitar exclusão de dados</li>
              <li>Exportar suas informações</li>
              <li>Revogar consentimentos dados</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gradient">6. Cookies e Tecnologias Similares</h2>
            <p>
              Utilizamos cookies e tecnologias similares para melhorar sua experiência,
              lembrar suas preferências e entender como você usa nosso aplicativo.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gradient">7. Menores de Idade</h2>
            <p>
              Nossos serviços não são destinados a menores de 18 anos. Não coletamos
              intencionalmente informações de menores de idade.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gradient">8. Alterações na Política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Notificaremos você sobre
              alterações significativas por email ou através de nosso site.
            </p>
          </section>
        </div>

        {/* Rodapé */}
        <div className="text-center mt-8 pt-6 border-t border-gray-200">
          <p className="text-gray-600">
            Para exercer seus direitos ou tirar dúvidas, entre em contato com nosso{' '}
            <a href="mailto:privacidade@finapp.com" className="text-gradient-hover">
              Encarregado de Proteção de Dados
            </a>
          </p>
          <div className="mt-4 space-x-4">
            <Link to="/termos" className="text-gradient-hover">
              Termos de Serviço
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/" className="text-gradient-hover">
              Voltar para o início
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 