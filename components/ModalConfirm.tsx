
import React from 'react';
import { X, AlertTriangle, Trash2, Info, Loader2, Check } from 'lucide-react';

interface ModalConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'info' | 'warning';
  isLoading?: boolean;
}

const ModalConfirm: React.FC<ModalConfirmProps> = ({ 
  isOpen, onClose, onConfirm, title, message, confirmLabel = "Confirmar", variant = 'danger', isLoading = false 
}) => {
  if (!isOpen) return null;

  const themes = {
    danger: {
      bg: 'bg-red-50/50',
      iconBg: 'bg-red-600',
      icon: <Trash2 className="w-8 h-8 text-white" />,
      button: 'bg-red-600 hover:bg-red-700 shadow-red-200',
      border: 'border-red-100'
    },
    warning: {
      bg: 'bg-amber-50/50',
      iconBg: 'bg-amber-500',
      icon: <AlertTriangle className="w-8 h-8 text-white" />,
      button: 'bg-amber-500 hover:bg-amber-600 shadow-amber-200',
      border: 'border-amber-100'
    },
    info: {
      bg: 'bg-blue-50/50',
      iconBg: 'bg-blue-600',
      icon: <Info className="w-8 h-8 text-white" />,
      button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200',
      border: 'border-blue-100'
    }
  };

  const theme = themes[variant];

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-400 border border-slate-100">
        <div className={`p-12 ${theme.bg} flex flex-col items-center text-center relative`}>
          <button onClick={onClose} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600 p-2 hover:bg-white rounded-full transition-all">
            <X className="w-6 h-6" />
          </button>
          
          <div className={`${theme.iconBg} p-6 rounded-[32px] shadow-2xl mb-8 scale-110`}>
            {theme.icon}
          </div>
          
          <h3 className="text-3xl font-black text-slate-800 uppercase tracking-tight mb-4">{title}</h3>
          <p className="text-slate-500 font-bold text-sm leading-relaxed px-2">{message}</p>
        </div>
        
        <div className="p-10 flex gap-4 bg-white">
          <button 
            disabled={isLoading}
            onClick={onClose} 
            className="flex-1 px-6 py-5 rounded-3xl font-black text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all uppercase text-[10px] tracking-[0.2em]"
          >
            Cancelar
          </button>
          <button 
            disabled={isLoading}
            onClick={onConfirm}
            className={`flex-[1.5] px-6 py-5 rounded-3xl font-black text-white transition-all shadow-2xl active:scale-95 uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 ${theme.button}`}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                <Check className="w-5 h-5" />
                {confirmLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalConfirm;
