import React, { useState } from 'react';
import { CustomFieldConfig, Company, Contact, Transaction } from '../types';
import { 
  Sliders, Plus, Trash2, Tag, Building2, UserCircle, Settings,
  Download, Upload, ShieldCheck, Check, AlertCircle, X
} from 'lucide-react';

interface CustomFieldsManagerProps {
  fields: CustomFieldConfig[];
  onCreateField: (field: CustomFieldConfig) => void;
  onDeleteField: (id: string) => void;
  companies?: Company[];
  contacts?: Contact[];
  transactions?: Transaction[];
  onRestoreBackup?: (backupData: { 
    companies: Company[]; 
    contacts: Contact[]; 
    transactions: Transaction[]; 
    customFields: CustomFieldConfig[] 
  }) => Promise<boolean>;
}

export default function CustomFieldsManager({ 
  fields, 
  onCreateField, 
  onDeleteField,
  companies = [],
  contacts = [],
  transactions = [],
  onRestoreBackup
}: CustomFieldsManagerProps) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState<'company' | 'contact'>('company');
  const [type, setType] = useState<'string' | 'number' | 'boolean' | 'select'>('string');
  const [optionsStr, setOptionsStr] = useState(''); // comma-separated options for select fields

  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const id = `f_${name.toLowerCase().trim().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36).substr(-4)}`;
    const options = type === 'select' 
      ? optionsStr.split(',').map(o => o.trim()).filter(Boolean) 
      : undefined;

    onCreateField({
      id,
      name: name.trim(),
      type,
      target,
      options
    });

    setName('');
    setOptionsStr('');
  };

  const handleExportBackup = () => {
    try {
      const backupData = {
        companies,
        contacts,
        transactions,
        customFields: fields
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `backup_rampup_crm_${dateStr}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setImportStatus({ 
        type: 'success', 
        message: 'Backup do banco de dados (JSON) gerado e baixado com sucesso!' 
      });
    } catch (err: any) {
      setImportStatus({ type: 'error', message: `Erro ao exportar backup: ${err.message}` });
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Basic verification
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('O arquivo de backup é inválido ou está corrompido.');
        }
        if (!Array.isArray(parsed.companies) || !Array.isArray(parsed.contacts) || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.customFields)) {
          throw new Error('A estrutura do arquivo JSON não contém as tabelas necessárias do CRM (empresas, contatos, transações e customFields).');
        }

        if (onRestoreBackup) {
          const success = await onRestoreBackup(parsed);
          if (success) {
            setImportStatus({
              type: 'success',
              message: `Sucesso! O backup completo do CRM foi restaurado. Carregados: ${parsed.companies.length} empresas, ${parsed.contacts.length} contatos e ${parsed.transactions.length} transações.`
            });
          } else {
            setImportStatus({ type: 'error', message: 'O servidor encontrou um erro ao aplicar a restauração.' });
          }
        } else {
          throw new Error('A ação de restauração de backup não está disponível.');
        }
      } catch (err: any) {
        setImportStatus({ type: 'error', message: `Falha ao importar backup: ${err.message}` });
      }
    };
    reader.readAsText(file);
    // Reset file input value so same file can be loaded again if needed
    e.target.value = '';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="custom_fields_view">
      {/* Coluna da Esquerda: Formulários Administrativos e Backup */}
      <div className="lg:col-span-1 space-y-6">
        
        {/* Card 1: Criar Campos Customizados */}
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="space-y-1">
            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider inline-block">
              Dinamicidade CRM
            </span>
            <h4 className="text-lg font-black font-display text-slate-800 dark:text-white tracking-tight">Novos Campos</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500">Adicione campos customizados instantâneos às fichas de perfil do ecossistema.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Nome do Campo</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: LinkedIn, Website, CNPJ..."
                className="w-full text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 font-medium text-slate-800 dark:text-slate-100 shadow-3xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Onde Adicionar (Destino)</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTarget('company')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border flex items-center justify-center space-x-1.5 transition-colors cursor-pointer ${
                    target === 'company'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Empresas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTarget('contact')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border flex items-center justify-center space-x-1.5 transition-colors cursor-pointer ${
                    target === 'contact'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <UserCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>Contatos</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tipo de Dado</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 font-bold text-slate-700 dark:text-slate-300 shadow-3xs cursor-pointer"
              >
                <option value="string" className="bg-slate-900 text-white">Texto Livre (String)</option>
                <option value="number" className="bg-slate-900 text-white">Número (Integer/Float)</option>
                <option value="boolean" className="bg-slate-900 text-white">Caixa de Seleção (Sim/Não)</option>
                <option value="select" className="bg-slate-900 text-white">Lista de Opções (Dropdown)</option>
              </select>
            </div>

            {type === 'select' && (
              <div className="space-y-1.5 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-850 animate-fadeIn">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Opções da Lista</label>
                <input
                  type="text"
                  required
                  value={optionsStr}
                  onChange={(e) => setOptionsStr(e.target.value)}
                  placeholder="Ex: Opção A, Opção B, Opção C"
                  className="w-full text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100"
                />
                <p className="text-[9px] text-slate-400 dark:text-slate-500">Separe as opções por vírgulas.</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Criar Campo Customizado</span>
            </button>
          </form>
        </div>

        {/* Card 2: Backup & Segurança Completa (JSON Export / Restore) */}
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="space-y-1">
            <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider inline-block">
              Segurança Física dos Dados
            </span>
            <h4 className="text-lg font-black font-display text-slate-800 dark:text-white tracking-tight flex items-center space-x-1.5">
              <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
              <span>Backup Geral</span>
            </h4>
            <p className="text-xs text-slate-400 dark:text-slate-500">Garante que você nunca perca o histórico de empresas, decisores e transações registrando snapshots locais.</p>
          </div>

          <div className="space-y-3.5 pt-1">
            
            {/* Status alerts */}
            {importStatus.type && (
              <div className={`p-3.5 rounded-xl text-xs flex items-start space-x-2.5 border font-medium leading-relaxed relative ${
                importStatus.type === 'success'
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-850 dark:text-emerald-400'
                  : 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-850 dark:text-rose-400'
              }`}>
                {importStatus.type === 'success' ? (
                  <Check className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">{importStatus.message}</div>
                <button 
                  onClick={() => setImportStatus({ type: null, message: '' })}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 shrink-0 absolute top-1 right-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Export action */}
            <button
              onClick={handleExportBackup}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-800 bg-white dark:bg-slate-900 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-slate-700 dark:text-slate-200 font-extrabold text-xs flex items-center justify-center space-x-2 transition-all shadow-3xs cursor-pointer"
            >
              <Download className="h-4 w-4 text-indigo-500" />
              <span>Exportar Snapshot Completo (JSON)</span>
            </button>

            {/* Import/Restore action */}
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="backup-upload-input"
                title="Carregar snapshot JSON anterior"
              />
              <button
                type="button"
                className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/30 hover:bg-slate-50 dark:hover:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-extrabold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Upload className="h-4 w-4 text-emerald-500" />
                <span>Restaurar de Snapshot (.json)</span>
              </button>
            </div>

            <p className="text-[9.5px] text-slate-400 dark:text-slate-500 leading-normal italic text-center">
              * Nota: A restauração de um snapshot substituirá integralmente as tabelas locais de empresas, contatos e check-ins pelo conteúdo contido no arquivo.
            </p>

          </div>
        </div>

      </div>

      {/* Coluna da Direita: Campos Ativos Cadastrados */}
      <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 lg:col-span-2 shadow-xs space-y-5">
        <div>
          <h4 className="font-black font-display text-slate-800 dark:text-white text-base">Campos Personalizados Ativos</h4>
          <p className="text-xs text-slate-400 dark:text-slate-500">Abaixo estão listados todos os campos adicionados dinamicamente ao CRM para segmentação de leads</p>
        </div>

        <div className="space-y-3.5">
          {fields.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500 space-y-3 border border-dashed border-slate-250 dark:border-slate-800 rounded-2xl bg-slate-50/30 dark:bg-slate-950/10">
              <Sliders className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700 animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-wider">Nenhum campo personalizado cadastrado</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto">Use o formulário ao lado para criar campos adicionais como Website, CNPJ ou Nível de Interesse.</p>
            </div>
          ) : (
            fields.map((field) => (
              <div key={field.id} className="flex items-center justify-between p-4 bg-slate-50/70 dark:bg-slate-950/30 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors">
                <div className="flex items-start space-x-3.5 min-w-0">
                  <div className={`p-2.5 rounded-xl shrink-0 ${
                    field.target === 'company' 
                      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/20' 
                      : 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/20'
                  }`}>
                    {field.target === 'company' ? <Building2 className="h-5 w-5" /> : <UserCircle className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <p className="text-xs font-black text-slate-800 dark:text-white truncate">{field.name}</p>
                      <span className="text-[9px] bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded-md font-mono font-bold uppercase">
                        {field.type === 'string' ? 'Texto' : field.type === 'number' ? 'Número' : field.type === 'boolean' ? 'Booleano' : 'Dropdown'}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-450 dark:text-slate-400 mt-0.5">
                      Disponível em: <strong className="text-slate-650 dark:text-slate-300">{field.target === 'company' ? 'Perfil da Empresa' : 'Ficha de Contatos'}</strong>
                    </p>
                    {field.options && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {field.options.map(opt => (
                          <span key={opt} className="text-[9px] bg-indigo-50/60 dark:bg-indigo-950/55 text-indigo-700 dark:text-indigo-450 px-2 py-0.5 rounded-full font-bold border border-indigo-100/40 dark:border-indigo-900/30">
                            {opt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onDeleteField(field.id)}
                  className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer border-none shrink-0"
                  title="Excluir campo e apagar dados associados"
                >
                  <Trash2 className="h-4.5 w-4.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
