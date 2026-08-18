import React, { useState } from 'react';
import { Company, CustomFieldConfig } from '../types';
import { Plus, X, Building2 } from 'lucide-react';
import { classifyCompanySize } from '../utils/strategicHelpers';

interface CompanyFormProps {
  customFields: CustomFieldConfig[];
  onClose: () => void;
  onSubmit: (company: Company) => void;
}

export default function CompanyForm({ customFields, onClose, onSubmit }: CompanyFormProps) {
  const [name, setName] = useState('');
  const [segment, setSegment] = useState('Tecnologia & Telecom');
  const [vidas, setVidas] = useState(1);
  const [location, setLocation] = useState('Fortaleza, CE');
  const [description, setDescription] = useState('');
  const [activity, setActivity] = useState('');
  
  // Custom field inputs
  const [customVals, setCustomVals] = useState<Record<string, any>>({});

  const handleCustomChange = (cfId: string, val: any) => {
    setCustomVals(prev => ({
      ...prev,
      [cfId]: val
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const companyId = `comp_${name.toLowerCase().trim().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36).substr(-4)}`;
    
    onSubmit({
      id: companyId,
      name: name.trim(),
      segment,
      vidas,
      location,
      description: description.trim() || 'Empresa participante do ecossistema Rampup.',
      activity: activity.trim() || 'Geradora de negócios e conexões.',
      customFields: customVals
    });
  };

  const segmentOptions = [
    'Tecnologia & Telecom',
    'Construção Civil & Imobiliário',
    'Saúde, Estética & Bem-estar',
    'Finanças & Investimentos',
    'Contabilidade & Consultoria',
    'Marketing, Comunicação & Mídia',
    'Alimentos & Bebidas',
    'Indústria / Manufatura',
    'Comércio & Varejo',
    'Seguros',
    'Educação',
    'Logística & Transportes',
    'Energia',
    'Jurídico / Advocacia',
    'Outros'
  ];

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" id="new_company_modal">
      <div className="bg-white rounded-xl shadow-xl border border-gray-100 max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center space-x-2.5">
            <Building2 className="h-5 w-5 text-blue-600" />
            <h4 className="font-bold text-gray-800 text-lg">Registrar Nova Empresa</h4>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">Nome da Empresa</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Comercial Maia, Somapay..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">Segmento</label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:border-blue-500"
              >
                {segmentOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">Localização</label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Fortaleza, CE"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">Colaboradores / Vidas</label>
              <input
                type="number"
                required
                min={1}
                value={vidas}
                onChange={(e) => setVidas(parseInt(e.target.value) || 1)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:border-blue-500"
              />
              
              {/* Dynamic Payroll & Size Classification Preview */}
              {vidas > 0 && (() => {
                const sizeInfo = classifyCompanySize(vidas);
                return (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-fadeIn mt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Custo de Folha Estimado:</span>
                      <span className="font-bold text-indigo-600 font-mono">
                        {sizeInfo.custoFolha > 0 ? `R$ ${sizeInfo.custoFolha.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não informado'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Porte da Empresa:</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${sizeInfo.badgeBg} ${sizeInfo.badgeBorder} ${sizeInfo.badgeText}`}>
                        {sizeInfo.porte}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 italic">
                      *Média salarial base do Nordeste de R$ 2.475,00/mês por colaborador.
                    </p>
                  </div>
                );
              })()}
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase">Resumo da Empresa (O que faz)</label>
              <textarea
                rows={2}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Fabricante líder de esquadrias de alumínio para construção de grande porte."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase">Atividade Principal (O que vende e para quem)</label>
              <textarea
                rows={2}
                required
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                placeholder="Ex: Vende perfis de alumínio e fachadas de vidro sob medida para construtoras civis."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Custom fields inputs */}
            {customFields.filter(cf => cf.target === 'company').map((cf) => {
              const currentVal = customVals[cf.id] || '';
              return (
                <div key={cf.id} className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase">{cf.name}</label>
                  {cf.type === 'select' ? (
                    <select
                      value={currentVal}
                      onChange={(e) => handleCustomChange(cf.id, e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Selecione...</option>
                      {cf.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : cf.type === 'boolean' ? (
                    <div className="flex items-center space-x-2 py-2">
                      <input
                        type="checkbox"
                        checked={!!currentVal}
                        onChange={(e) => handleCustomChange(cf.id, e.target.checked)}
                        className="h-4 w-4 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600">Sim, habilitado</span>
                    </div>
                  ) : (
                    <input
                      type={cf.type === 'number' ? 'number' : 'text'}
                      value={currentVal}
                      onChange={(e) => handleCustomChange(cf.id, e.target.value)}
                      placeholder={`Preencher ${cf.name}...`}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:border-blue-500"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Registrar Empresa</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
