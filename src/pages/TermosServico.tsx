import React from 'react';
import { Link } from 'react-router-dom';

export function TermosServico() {
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl card-glass p-8 space-y-8">
        {/* Cabeçalho */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gradient mb-2">Termos de Serviço</h1>
          <p className="text-gray-600">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>

        {/* Conteúdo */}
        <div className="space-y-6 text-gray-700">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gradient">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e usar o FinApp, você concorda em cumprir e estar vinculado aos seguintes termos e condições.
              Se você não concordar com qualquer parte destes termos, não poderá usar nossos serviços.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gradient">2. Descrição do Serviço</h2>
            <p>
              O FinApp é uma plataforma de gerenciamento financeiro pessoal que oferece ferramentas para controle
              de despesas, orçamento, metas financeiras e relatórios.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Dashboard personalizado</li>
              <li>Controle de despesas e receitas</li>
              <li>Gestão de orçamento</li>
              <li>Definição e acompanhamento de metas</li>
              <li>Relatórios detalhados</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gradient">3. Planos e Pagamentos</h2>
            <p>
              Oferecemos diferentes planos de assinatura para atender às suas necessidades:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Plano Gratuito: Funcionalidades básicas sem custo</li>
              <li>Plano Pro: Recursos avançados por R$29,90/mês</li>
              <li>Plano Empresarial: Soluções corporativas por R$99,90/mês</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gradient">4. Privacidade e Segurança</h2>
            <p>
              Levamos sua privacidade e segurança muito a sério. Todas as informações são criptografadas
              e armazenadas com segurança. Para mais detalhes, consulte nossa{' '}
              <Link to="/privacidade" className="text-gradient-hover">
                Política de Privacidade
              </Link>.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gradient">5. Uso do Serviço</h2>
            <p>
              Ao utilizar nosso serviço, você concorda em:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Fornecer informações precisas e atualizadas</li>
              <li>Manter a segurança de suas credenciais de acesso</li>
              <li>Não usar o serviço para atividades ilegais</li>
              <li>Respeitar os direitos de propriedade intelectual</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gradient">6. Cancelamento</h2>
            <p>
              Você pode cancelar sua assinatura a qualquer momento. O cancelamento será efetivo ao final
              do período de faturamento atual. Não fazemos reembolsos proporcionais por períodos parciais.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gradient">7. Alterações nos Termos</h2>
            <p>
              Reservamo-nos o direito de modificar estes termos a qualquer momento. Alterações significativas
              serão notificadas por email ou através de nosso site.
            </p>
          </section>
        </div>

        {/* Rodapé */}
        <div className="text-center mt-8 pt-6 border-t border-gray-200">
          <p className="text-gray-600">
            Dúvidas? Entre em contato com nosso{' '}
            <a href="mailto:suporte@finapp.com" className="text-gradient-hover">
              suporte
            </a>
          </p>
          <Link to="/" className="inline-block mt-4 text-gradient-hover">
            Voltar para o início
          </Link>
        </div>
      </div>
    </div>
  );
} 