# Guia de Configuração do Projeto

## Configuração das Variáveis de Ambiente

Para executar este projeto localmente, você precisará configurar as variáveis de ambiente para o Firebase. Siga os passos abaixo:

1. Copie o arquivo `.env.example` para um novo arquivo chamado `.env`:

```bash
cp .env.example .env
```

2. Abra o arquivo `.env` e substitua os valores de exemplo pelas suas próprias credenciais do Firebase.

3. Para obter as credenciais do Firebase:
   - Acesse o [Console do Firebase](https://console.firebase.google.com/)
   - Selecione seu projeto (ou crie um novo)
   - Clique em "Configurações do Projeto" (ícone de engrenagem)
   - Na aba "Geral", role até "Seus aplicativos" e selecione seu aplicativo web
   - Copie os valores do objeto `firebaseConfig`

## Instalação de Dependências

```bash
npm install
# ou
yarn install
```

## Executando o Projeto

```bash
npm run dev
# ou
yarn dev
```

O aplicativo estará disponível em `http://localhost:5173`.

## Considerações de Segurança

- **NUNCA** cometa o arquivo `.env` no controle de versão
- **NUNCA** compartilhe suas credenciais do Firebase publicamente
- Em produção, considere usar um serviço seguro de gerenciamento de segredos 