import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Category, DEFAULT_CATEGORIES } from '../types';

/**
 * Verifica se o usuário já tem categorias e cria as categorias padrão se necessário
 * @param userId ID do usuário
 */
export const setupDefaultCategories = async (userId: string): Promise<void> => {
  try {
    // Verificar se o usuário já tem categorias
    const categoriesRef = collection(db, 'categories');
    const q = query(categoriesRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('Criando categorias padrão para o usuário:', userId);
      
      // Criar categorias padrão
      const batch = [];
      for (const category of DEFAULT_CATEGORIES) {
        const newCategory = {
          ...category,
          userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        batch.push(addDoc(categoriesRef, newCategory));
      }

      // Adicionar todas as categorias em paralelo
      await Promise.all(batch);
      console.log('Categorias padrão criadas com sucesso');
    } else {
      console.log('Usuário já possui categorias');
    }
  } catch (error) {
    console.error('Erro ao configurar categorias padrão:', error);
    throw error;
  }
}; 