
import PocketBase from 'pocketbase';

const pbUrl = import.meta.env.VITE_POCKETBASE_URL || 'http://152.67.62.41:8090';
export const pb = new PocketBase(pbUrl);

// Facilitador para verificar se está logado
export const isLoggedIn = () => pb.authStore.isValid;
