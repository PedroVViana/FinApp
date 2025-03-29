# Guia de Segurança do Firestore para o FinApp

Este documento explica as regras de segurança do Firestore implementadas no FinApp e como aplicá-las corretamente.

## Visão Geral da Segurança

O FinApp utiliza regras de segurança do Firestore para garantir que:

1. Apenas usuários autenticados possam acessar qualquer dado
2. Usuários só podem ler e escrever seus próprios dados
3. Dados relacionados (transações, contas, metas) estão protegidos por verificações de propriedade
4. Somente dados válidos possam ser inseridos ou atualizados

## Como Aplicar as Regras

Para aplicar as regras de segurança:

1. Acesse o [Console do Firebase](https://console.firebase.google.com/)
2. Selecione o projeto FinApp
3. No menu lateral, clique em "Firestore Database"
4. Clique na aba "Regras"
5. Substitua as regras existentes pelas regras definidas no arquivo `firestore.rules`
6. Clique em "Publicar"

## Explicação das Regras

### Funções Auxiliares

- `isAuthenticated()`: Verifica se o usuário está autenticado
- `isOwner(userId)`: Verifica se o usuário autenticado é o proprietário do documento
- `validTransaction(data)`: Valida a estrutura de uma transação

### Regras por Coleção

#### Usuários (`users/{userId}`)

- Leitura/Atualização/Exclusão: Somente pelo próprio usuário
- Criação: Qualquer usuário autenticado pode criar seu próprio perfil

#### Contas Financeiras (`accounts/{accountId}`)

- Acesso permitido apenas ao proprietário da conta
- A propriedade é verificada pelo campo `userId`

#### Transações (`transactions/{transactionId}`)

- Acesso permitido apenas ao proprietário da conta associada
- A propriedade é verificada consultando a conta referenciada
- Validação de dados ao criar ou atualizar transações

#### Categorias (`categories/{categoryId}`)

- Leitura: Todas as categorias são acessíveis por usuários autenticados
- Escrita: Categorias personalizadas só podem ser gerenciadas pelo proprietário

#### Metas Financeiras (`goals/{goalId}`)

- Acesso permitido apenas ao proprietário da meta
- A propriedade é verificada pelo campo `userId`

#### Configurações (`settings/{userId}`)

- Acesso permitido apenas ao proprietário das configurações

### Proteção Padrão

- Por padrão, o acesso a qualquer coleção ou documento não especificado é negado

## Validação de Dados

As regras incluem validação de esquema para garantir a integridade dos dados. Por exemplo, para transações:

- Presença de campos obrigatórios (accountId, type, amount, etc.)
- Valores válidos para o campo `type` (income ou expense)
- Valores numéricos positivos para `amount`

## Teste das Regras

Para testar as regras de segurança, você pode usar o simulador de regras do Firebase:

1. No console do Firebase, vá para "Firestore Database" > "Regras"
2. Clique em "Iniciar simulador de regras"
3. Configure os testes com diferentes usuários e operações
4. Verifique se as permissões estão funcionando conforme esperado

## Estrutura de Dados Recomendada

Para garantir o funcionamento adequado das regras de segurança, mantenha a seguinte estrutura:

- Adicione o campo `userId` em todos os documentos para identificar o proprietário
- Em transações, sempre inclua o campo `accountId` que referencia uma conta válida
- Para categorias personalizadas, inclua o campo `userId`
- Para categorias padrão do sistema, não inclua o campo `userId`

## Observações Importantes

1. **Não confie apenas na segurança do cliente**: As regras do Firestore são a última linha de defesa
2. **Sempre duplique a validação**: Valide dados tanto no cliente quanto nas regras do Firestore
3. **Limite o número de leituras**: As regras que usam `get()` geram operações de leitura adicionais
4. **Monitore o uso**: Verifique regularmente os logs de segurança para identificar tentativas de acesso não autorizado

## Solução de Problemas

Se você encontrar erros de permissão ("Permission denied"):

1. Verifique se o usuário está autenticado
2. Confirme se o usuário é realmente o proprietário do recurso
3. Verifique se todos os campos necessários estão presentes nos documentos
4. Consulte os logs do Firebase para entender a regra específica que está falhando 