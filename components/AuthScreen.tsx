
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Lock, User, Loader2, LogIn, AlertCircle } from 'lucide-react';

interface AuthScreenProps {
  onLoginSuccess: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const cleanUsername = usernameInput.trim().toLowerCase();
      
      if (!cleanUsername || !password) {
        throw new Error('Por favor, informe o usuário e a senha.');
      }

      // 1. Verificar se o usuário existe na tabela de perfis (opcional para exibição, não para bloqueio)
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', cleanUsername)
        .maybeSingle();

      // Determinar o identificador de login
      // Se tiver @, é um e-mail direto. Se não, é o formato sintético do sistema.
      const isEmail = cleanUsername.includes('@');
      const loginEmail = isEmail ? cleanUsername : `${cleanUsername}@sistema.local`;

      // 2. Tentar autenticação direta no Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password,
      });
      
      if (authError) {
        const msg = authError.message.toLowerCase();
        
        if (msg.includes('invalid login credentials')) {
          // Se não encontramos o perfil E o auth falhou, o usuário provavelmente não existe
          if (!profile && !isEmail) {
            throw new Error('Usuário não encontrado ou senha incorreta.');
          }
          throw new Error('Senha incorreta para este usuário.');
        } 
        
        if (msg.includes('email not confirmed')) {
          throw new Error('Esta conta ainda não foi confirmada no sistema.');
        }
        
        throw new Error(authError.message);
      }

      if (data.user) {
        onLoginSuccess();
      }
    } catch (err: any) {
      // Prevenção robusta contra [object Object]
      let finalMessage = 'Erro ao realizar login.';
      
      if (typeof err === 'string') {
        finalMessage = err;
      } else if (err instanceof Error) {
        finalMessage = err.message;
      } else if (err.error_description) {
        finalMessage = err.error_description;
      } else if (err.message) {
        finalMessage = err.message;
      }

      setError(finalMessage);
      console.error('Auth Error Detail:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200">
        <div className="text-center mb-10">
          <div className="bg-blue-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-100 rotate-3 hover:rotate-0 transition-transform duration-300">
            <Lock className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            AUDITORIA LOJAS
          </h1>
          <p className="text-slate-500 font-bold text-sm mt-2 uppercase tracking-widest">
            Acesso por Usuário
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-700 font-bold leading-tight">
              {error}
            </div>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Nome de Usuário</label>
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors w-5 h-5" />
              <input
                type="text"
                required
                autoComplete="username"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700"
                placeholder="Ex: pablo.silva"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Senha</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors w-5 h-5" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4.5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4 text-sm tracking-widest"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <LogIn className="w-6 h-6" /> ENTRAR NO SISTEMA
              </>
            )}
          </button>
        </form>
        
        <div className="mt-12 pt-8 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">
            autoria de Marcos Silva
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
