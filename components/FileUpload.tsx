import React, { useRef, useState } from 'react';
import { FileSpreadsheet, FileText, LayoutList, Calendar } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File, date: string | null) => void;
  isLoading: boolean;
  title?: string;
  subtitle?: string;
  variant?: 'blue' | 'purple' | 'orange';
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileSelect, 
  isLoading, 
  title = "Importar Planilha de Auditoria",
  subtitle = "Clique para selecionar ou arraste o arquivo .xls aqui.",
  variant = 'blue'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0], selectedDate || null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
        onFileSelect(file, selectedDate || null);
      } else {
        alert('Por favor, envie um arquivo Excel (.xls ou .xlsx)');
      }
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const handleDateClick = (e: React.MouseEvent) => {
    // Prevent the click from bubbling up to the dropzone
    e.stopPropagation();
  };

  const openDatePicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (dateInputRef.current) {
      try {
        if (typeof dateInputRef.current.showPicker === 'function') {
          dateInputRef.current.showPicker();
        } else {
          dateInputRef.current.focus();
        }
      } catch (error) {
        dateInputRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      // Only trigger file input if focus is not on the date input
      if (document.activeElement !== dateInputRef.current) {
        fileInputRef.current?.click();
      }
    }
  };

  let borderClass = 'border-blue-200 hover:border-blue-500';
  let iconBgClass = 'bg-blue-50 group-hover:bg-blue-100 text-blue-600';
  let spinnerClass = 'border-blue-600';
  let Icon = FileSpreadsheet;

  if (variant === 'purple') {
    borderClass = 'border-purple-200 hover:border-purple-500';
    iconBgClass = 'bg-purple-50 group-hover:bg-purple-100 text-purple-600';
    spinnerClass = 'border-purple-600';
    Icon = FileText;
  } else if (variant === 'orange') {
    borderClass = 'border-orange-200 hover:border-orange-500';
    iconBgClass = 'bg-orange-50 group-hover:bg-orange-100 text-orange-600';
    spinnerClass = 'border-orange-600';
    Icon = LayoutList;
  }

  const inputId = `date-input-${variant}`;

  return (
    <div 
      className={`flex flex-col items-center justify-center w-full h-full min-h-[300px] p-8 border-2 border-dashed rounded-xl bg-white shadow-sm transition-all cursor-pointer group relative ${borderClass}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label={title}
      onKeyDown={handleKeyDown}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleInputChange} 
        accept=".xls,.xlsx" 
        className="hidden" 
      />
      
      <div className={`p-4 rounded-full mb-4 transition-colors ${iconBgClass}`}>
        {isLoading ? (
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${spinnerClass}`}></div>
        ) : (
          <Icon className="w-8 h-8" />
        )}
      </div>
      
      <h3 className="text-lg font-semibold text-slate-700 mb-2 text-center">
        {isLoading ? 'Processando...' : title}
      </h3>
      
      <p className="text-slate-500 text-sm text-center mb-6">
        {subtitle}
      </p>

      {/* Date Picker Container */}
      <div 
        className="w-full max-w-[200px] relative z-20 cursor-auto" 
        onClick={handleDateClick}
      >
        <label 
          htmlFor={inputId}
          className="block text-xs font-medium text-slate-400 mb-1 text-center hover:text-blue-500 transition-colors cursor-text"
        >
          Data da Auditoria (Opcional)
        </label>
        <div className="relative group/date">
          <div 
            className="absolute inset-y-0 left-0 pl-3 flex items-center cursor-pointer z-10"
            onClick={openDatePicker}
            title="Abrir calendário"
            aria-hidden="true"
          >
            <Calendar className="h-4 w-4 text-slate-400 group-hover/date:text-blue-500 transition-colors" />
          </div>
          <input
            id={inputId}
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="block w-full pl-10 pr-2 py-2 sm:text-sm border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 border text-slate-600 bg-slate-50 hover:bg-white transition-colors"
          />
        </div>
      </div>
    </div>
  );
};

export default FileUpload;