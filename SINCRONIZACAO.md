# Guia de Sincronização do FinApp

Este documento descreve a arquitetura de sincronização entre a aplicação FinApp e o Firestore, incluindo o suporte para operações offline.

## Arquitetura Geral

A sincronização do FinApp é construída em torno de três componentes principais:

1. **Listeners em Tempo Real**: Usam a funcionalidade de snapshot do Firestore para sincronizar dados em tempo real.
2. **Fila de Operações Offline**: Um sistema baseado em IndexedDB para armazenar operações pendentes quando o dispositivo está offline.
3. **Atualizações Otimistas**: Atualizações locais imediatas para melhorar a experiência do usuário, com sincronização em segundo plano.

## Serviços de Sincronização

### 1. Firebase Config

O arquivo `src/config/firebase.ts` configura a persistência offline do Firebase, permitindo que o aplicativo funcione mesmo quando desconectado.

### 2. Serviço de Sincronização

O arquivo `src/services/syncService.ts` contém:

- **Listeners para Dados**: Configuração de listeners para diferentes tipos de dados (contas, transações, categorias, metas)
- **Monitoramento de Conexão**: Detecta quando a aplicação está offline ou online
- **Resolução de Conflitos**: Lógica para lidar com atualizações conflitantes

### 3. Serviço de Fila

O arquivo `src/services/queueService.ts` implementa:

- **Banco de Dados IndexedDB**: Armazena operações pendentes quando offline
- **Sistema de Fila**: Ordenado por timestamp para garantir a sequência correta de operações
- **Processamento Automático**: Executa operações pendentes quando a conexão é restabelecida
- **Gerenciamento de Falhas**: Mecanismo de retry para operações que falham

### 4. Integração com Contexto

O `FinanceContext` integra todos esses serviços oferecendo:

- **API Unificada**: Interface simples para componentes React, abstraindo a complexidade da sincronização
- **Atualizações Otimistas**: Mudanças imediatas na UI com reconciliação posterior
- **Indicadores de Status**: Informações sobre o estado atual da sincronização

## Fluxo de Operações

### Quando Online

1. Operações são enviadas diretamente ao Firestore
2. A UI é atualizada através dos listeners em tempo real
3. Tokens de servidor (serverTimestamp) são usados para ordenação consistente

### Quando Offline

1. Operações são armazenadas no IndexedDB
2. A UI é atualizada otimisticamente
3. Itens são marcados como "pendentes" na interface
4. Quando a conexão é restabelecida, operações são processadas em ordem

## Componente de Status

O componente `SyncStatus` exibe o estado atual da sincronização:

- **Sincronizado**: Todas as operações foram enviadas ao servidor
- **Offline**: Dispositivo está desconectado (com contador de operações pendentes)
- **Pendente**: Há operações na fila para sincronização (com botão para sincronizar manualmente)

## Resolução de Conflitos

O sistema implementa uma estratégia básica de resolução de conflitos:

1. **Last Write Wins**: Por padrão, a última operação prevalece
2. **Validação de Propriedade**: Verificação que o usuário tem permissão para modificar dados
3. **Campos de Versão**: Timestamps de atualização para detectar modificações concorrentes

## Uso no Código

### Exemplo de Operações com Suporte Offline

```typescript
// Adicionar transação com suporte a offline
const addTransaction = async (transaction) => {
  if (navigator.onLine) {
    try {
      // Tentar diretamente se online
      return await firestoreService.createTransaction(transaction, userId);
    } catch (error) {
      // Em caso de erro, usar fila
      await queueService.addToQueue({
        type: 'create',
        collection: 'transactions',
        data: transaction,
        userId
      });
      return `temp-${Date.now()}`;
    }
  } else {
    // Se offline, usar fila e ID temporário
    await queueService.addToQueue({
      type: 'create',
      collection: 'transactions',
      data: transaction,
      userId
    });
    return `temp-${Date.now()}`;
  }
};
```

## Limitações e Considerações

1. **Operações em Lote**: Transações que afetam múltiplos documentos podem apresentar problemas se executadas offline
2. **Conflitos Complexos**: A resolução de conflitos é básica e pode necessitar aprimoramentos para casos de negócio mais complexos
3. **Tamanho da Fila**: O IndexedDB tem limitações de tamanho, o que pode ser um problema para muitas operações offline

## Melhorias Futuras

1. **Compressão de Operações**: Combinar múltiplas operações na mesma entidade para reduzir o tamanho da fila
2. **Política de Expiração**: Limpar operações muito antigas que podem já não ser relevantes
3. **Resolução de Conflitos Avançada**: Implementar estratégias mais sofisticadas baseadas em regras de negócio
4. **Sincronização Seletiva**: Permitir que o usuário escolha quais dados sincronizar primeiro 