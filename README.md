# FinApp - Controle Inteligente de Finanças

Uma aplicação web moderna para gerenciamento de finanças pessoais, desenvolvida com React, TypeScript e Tailwind CSS, com recursos avançados de IA para auxiliar no planejamento financeiro.

## 🌟 Funcionalidades

### Recursos Básicos (Plano Gratuito)
- 📊 Dashboard com visão geral das finanças
- 💰 Controle de despesas e receitas
- 📋 Orçamento mensal por categoria
- 🎯 Metas de economia básicas
- 📈 Relatórios e análises financeiras simples

### Recursos Pro (Plano Pago)
- 🤖 Assistente Financeiro IA
  - Análise personalizada de gastos
  - Recomendações inteligentes de economia
  - Dicas de investimento baseadas no perfil
  - Chat interativo para dúvidas financeiras
- 📊 Relatórios avançados e personalizados
- 🎯 Metas avançadas com projeções
- 📱 Aplicativo mobile
- 🔄 Sincronização com contas bancárias
- 📧 Alertas personalizados

### Recursos Empresariais
- 👥 Múltiplos usuários
- 📊 Relatórios empresariais
- 🤝 Suporte prioritário
- 🔐 Recursos avançados de segurança
- 🎓 Treinamentos exclusivos

## 🤖 Assistente Financeiro IA

O Assistente Financeiro IA é um recurso exclusivo para assinantes dos planos pagos, oferecendo:

- **Análise Personalizada**: Avaliação detalhada do comportamento financeiro
- **Recomendações Inteligentes**: Sugestões baseadas em machine learning
- **Educação Financeira**: Conteúdo personalizado e interativo
- **Suporte 24/7**: Respostas instantâneas para dúvidas financeiras
- **Projeções Futuras**: Análise preditiva de cenários financeiros

## 🛠️ Tecnologias Utilizadas

- React 18
- TypeScript
- Tailwind CSS
- Firebase (Auth & Firestore)
- OpenAI API (Chatbot IA)
- React Router
- Headless UI
- Recharts
- Date-fns

## ⚙️ Pré-requisitos

- Node.js 18 ou superior
- npm ou yarn
- Chave de API da OpenAI (para recursos de IA)
- Projeto Firebase configurado

## 🚀 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/finapp.git
cd finapp
```

2. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite o arquivo .env com suas chaves do Firebase
```

3. Instale as dependências:
```bash
npm install
# ou
yarn install
```

4. Inicie o servidor de desenvolvimento:
```bash
npm run dev
# ou
yarn dev
```

5. Acesse a aplicação em `http://localhost:5173`

> **Nota**: Para instruções detalhadas sobre configuração, consulte o arquivo [SETUP.md](SETUP.md).

## 📁 Estrutura do Projeto

```
src/
  ├── components/     # Componentes reutilizáveis
  ├── pages/         # Páginas da aplicação
  ├── features/      # Funcionalidades específicas
  │   └── ai/        # Componentes e lógica do chatbot
  ├── hooks/         # Custom hooks
  ├── utils/         # Funções utilitárias
  ├── types/         # Definições de tipos TypeScript
  ├── services/      # Serviços externos (API, Firebase)
  └── contexts/      # Contextos React
```

## 💰 Planos e Preços

### Plano Gratuito
- Recursos básicos de controle financeiro
- Limite de 100 transações/mês
- Relatórios básicos

### Plano Pro (R$29,90/mês)
- Todos os recursos do plano gratuito
- Assistente Financeiro IA
- Relatórios avançados
- Sincronização bancária
- Transações ilimitadas

### Plano Empresarial (R$99,90/mês)
- Todos os recursos do plano Pro
- Múltiplos usuários
- Suporte prioritário
- Treinamentos exclusivos
- Personalização da marca

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/NovaFuncionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/NovaFuncionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Contato

Seu Nome - [@seu_twitter](https://twitter.com/seu_twitter) - email@exemplo.com

Link do Projeto: [https://github.com/seu-usuario/finapp](https://github.com/seu-usuario/finapp) 