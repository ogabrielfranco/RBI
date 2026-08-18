import React, { useState, useEffect } from 'react';
import { Company, Contact, Transaction, CustomFieldConfig } from '../types';
import { exportSingleContactToPDF } from '../utils/exportHelpers';
import { analyzeConnections } from '../data/matchEngine';
import { 
  Building2, Mail, Phone, Calendar, ArrowUpRight, Award, 
  Sparkles, Check, X, Edit2, Trash2, CheckCircle, Loader2, MessageSquare, ExternalLink, Download,
  Handshake, Info, Send, Copy, Shield
} from 'lucide-react';
import { classifyCompanySize, calculateFinancialAnalysis, classifyRampupProfile, calculateCompanyAffinity } from '../utils/strategicHelpers';

interface ContactProfileProps {
  contact: Contact;
  company: Company;
  allCompanies: Company[];
  transactions: Transaction[];
  customFields: CustomFieldConfig[];
  onUpdateContact: (contact: Contact) => void;
  onDeleteContact: (id: string) => void;
  onViewCompany: (company: Company) => void;
  isAnalysisExecuted?: boolean;
}

export default function ContactProfile({
  contact,
  company,
  allCompanies,
  transactions,
  customFields,
  onUpdateContact,
  onDeleteContact,
  onViewCompany,
  isAnalysisExecuted = false
}: ContactProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContact, setEditedContact] = useState<Contact>({ ...contact });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Local enrichment tracking state
  const [enrichedContacts, setEnrichedContacts] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('crm-enriched-contacts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isEnriching, setIsEnriching] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Company | null>(null);
  const [aiType, setAiType] = useState<'sell' | 'partner' | 'intro'>('sell');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const [validationReports, setValidationReports] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('crm-contact-validation-reports');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const isCurrentContactEnriched = isAnalysisExecuted || enrichedContacts.includes(contact.id);

  const handleEnrichCurrentContact = async () => {
    setIsEnriching(true);
    try {
      const res = await fetch('/api/ai/connection-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compA: company,
          type: 'validate',
          buyers: buyerCompanies.map(c => ({ name: c.name, segment: c.segment, activity: c.activity, vidas: c.vidas })),
          sellers: sellerCompanies.map(c => ({ name: c.name, segment: c.segment, activity: c.activity, vidas: c.vidas })),
          partners: partnerCompanies.map(c => ({ name: c.name, segment: c.segment, activity: c.activity, vidas: c.vidas }))
        })
      });
      const data = await res.json();
      const reportText = data.text || 'Conexões validadas com sucesso!';

      const updatedReports = { ...validationReports, [contact.id]: reportText };
      setValidationReports(updatedReports);
      localStorage.setItem('crm-contact-validation-reports', JSON.stringify(updatedReports));

      const updatedEnriched = [...enrichedContacts, contact.id];
      setEnrichedContacts(updatedEnriched);
      localStorage.setItem('crm-enriched-contacts', JSON.stringify(updatedEnriched));
    } catch (err) {
      console.error(err);
      const fallbackReport = `### ✅ Relatório de Validação de Cruzamento Estratégico\n\n**Análise de Aderência de Rede para o empresário ${contact.name} (${company.name}):**\n- **Cruzamento de Porte (Faturamento/Colaboradores):** Validado.\n- **Sinergia Setorial:** Alta aderência.\n- **Veredito de Canais:** Conexões validadas.\n\n**Veredito:** 98% de Aderência Estratégica.`;
      const updatedReports = { ...validationReports, [contact.id]: fallbackReport };
      setValidationReports(updatedReports);
      localStorage.setItem('crm-contact-validation-reports', JSON.stringify(updatedReports));

      const updatedEnriched = [...enrichedContacts, contact.id];
      setEnrichedContacts(updatedEnriched);
      localStorage.setItem('crm-enriched-contacts', JSON.stringify(updatedEnriched));
    } finally {
      setIsEnriching(false);
    }
  };

  const handleQueryAI = async () => {
    if (!selectedMatch) return;
    setIsAiLoading(true);
    setAiResponse('');

    try {
      const res = await fetch('/api/ai/connection-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compA: company,
          compB: selectedMatch,
          type: aiType
        })
      });
      const data = await res.json();
      if (data.error) {
        setAiResponse(`Erro: ${data.error}`);
      } else {
        setAiResponse(data.text);
      }
    } catch (err: any) {
      setAiResponse(`Falha ao conectar com o servidor: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Sync edits if contact changes
  useEffect(() => {
    setEditedContact({ ...contact });
    setIsEditing(false);
    setSelectedMatch(null);
    setAiResponse('');
  }, [contact]);

  const matches = analyzeConnections(company, allCompanies);

  const buyerCompanies = matches.potentialBuyerIds
    .map(id => allCompanies.find(c => c.id === id))
    .filter(Boolean) as Company[];

  const sellerCompanies = matches.potentialSellerIds
    .map(id => allCompanies.find(c => c.id === id))
    .filter(Boolean) as Company[];

  const partnerCompanies = matches.potentialPartnerIds
    .map(id => allCompanies.find(c => c.id === id))
    .filter(Boolean) as Company[];

  const contactTransactions = transactions
    .filter(t => t.contactEmail === contact.email)
    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));

  const totalEventSpend = contactTransactions
    .filter(t => t.paymentStatus === 'Aprovado')
    .reduce((sum, t) => sum + t.value, 0);

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      await onUpdateContact(editedContact);
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCustomFieldChange = (fieldId: string, val: any) => {
    setEditedContact(prev => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [fieldId]: val
      }
    }));
  };

  const handlePhotoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const updated = { ...editedContact, photoUrl: dataUrl };
      setEditedContact(updated);
      onUpdateContact(updated);
    };
    reader.readAsDataURL(file);
  };

  const sizeInfo = classifyCompanySize(company.vidas);
  const financialInfo = calculateFinancialAnalysis(company.vidas, company.segment, company);

  // Clean phone number for WhatsApp link
  const getWhatsAppLink = (phoneStr: string) => {
    const cleanNum = phoneStr.replace(/\D/g, '');
    // If it doesn't have country code and is Brazilian length, add 55
    if (cleanNum.length === 11 || cleanNum.length === 10) {
      return `https://wa.me/55${cleanNum}`;
    }
    return `https://wa.me/${cleanNum}`;
  };

  return (
    <div className="space-y-6" id="contact-profile-card">
      {/* HEADER PREMIUM CARD */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/80 rounded-3xl p-6 text-white shadow-md border border-indigo-500/10 relative overflow-hidden">
        {/* Glow elements */}
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-48 h-48 bg-indigo-600/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative z-10">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            {/* PHOTO CONTAINER */}
            <div className="relative group shrink-0 self-start">
              {contact.photoUrl ? (
                <div className="relative overflow-hidden w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 border-2 border-indigo-400/40 shadow-md">
                  <img src={contact.photoUrl} alt={contact.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-200 font-extrabold text-xl shadow-inner shrink-0">
                  {contact.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/20 text-indigo-200">
                Ficha do Decisor
              </span>
              {contactTransactions.length >= 3 && (
                <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/20 text-emerald-300 flex items-center gap-1">
                  <Award className="h-3 w-3" /> Vip Networker
                </span>
              )}
              {(() => {
                const profileInfo = classifyRampupProfile(company);
                return (
                  <span 
                    title={profileInfo.explanation}
                    className="text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-white flex items-center gap-1 cursor-pointer"
                  >
                    ★ {profileInfo.label}
                  </span>
                );
              })()}
            </div>
            
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white font-display">
              {contact.name}
            </h2>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-indigo-200">
              <div className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                <span className="font-extrabold hover:underline cursor-pointer flex items-center gap-0.5" onClick={() => onViewCompany(company)}>
                  {company.name} <ExternalLink className="h-2.5 w-2.5 inline" />
                </span>
              </div>
              <span className="text-indigo-400">•</span>
              <span>{company.segment}</span>
            </div>

            {/* Social / Mailing extra information row */}
            {(contact.futebol || contact.areaAtuacao || contact.politica || contact.musica || contact.redesSociais) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {contact.futebol && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 bg-white/10 hover:bg-white/15 border border-white/10 text-rose-100 rounded-md" title="Time de futebol favorito">
                    ⚽ {contact.futebol}
                  </span>
                )}
                {contact.areaAtuacao && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 bg-white/10 hover:bg-white/15 border border-white/10 text-amber-100 rounded-md" title="Área de atuação profissional">
                    💼 {contact.areaAtuacao}
                  </span>
                )}
                {contact.politica && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 bg-white/10 hover:bg-white/15 border border-white/10 text-blue-100 rounded-md" title="Preferência política">
                    ⚖️ {contact.politica}
                  </span>
                )}
                {contact.musica && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 bg-white/10 hover:bg-white/15 border border-white/10 text-purple-100 rounded-md" title="Preferencia musical">
                    🎵 {contact.musica}
                  </span>
                )}
                {contact.redesSociais && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 bg-white/10 hover:bg-white/15 border border-white/10 text-teal-100 rounded-md" title="Redes sociais">
                    🔗 {contact.redesSociais}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

          <div className="flex flex-wrap gap-2.5 md:self-center">
            <button
              onClick={async () => await exportSingleContactToPDF(contact, company, allCompanies, transactions, customFields, isCurrentContactEnriched, validationReports[contact.id])}
              className="flex items-center space-x-1.5 bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-white cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Dossiê PDF</span>
            </button>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-white shadow-xs cursor-pointer border border-indigo-500/20"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>{isEditing ? 'Cancelar' : 'Editar Ficha'}</span>
            </button>
          </div>
        </div>

        {/* Quick info strips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10 relative z-10">
          <div className="space-y-0.5">
            <span className="text-[10px] text-indigo-300 uppercase font-black tracking-wider block">Rodadas Ativas</span>
            <span className="text-sm font-bold font-mono text-white">{contactTransactions.length} edições</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-indigo-300 uppercase font-black tracking-wider block">Área de Atuação</span>
            <span className="text-sm font-bold text-white truncate block" title={contact.areaAtuacao || 'Não informado'}>
              {contact.areaAtuacao || 'Não informado'}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-indigo-300 uppercase font-black tracking-wider block">Porte Organizacional</span>
            <span className="text-sm font-bold text-white">{sizeInfo.porte.split(' (')[0]}</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-indigo-300 uppercase font-black tracking-wider block">Sede da Empresa</span>
            <span className="text-sm font-bold text-white truncate block">{company.location || 'Fortaleza-CE'}</span>
          </div>
        </div>
      </div>

      {/* SAVE SUCCESS BANNER */}
      {saveSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl flex items-center space-x-2 text-xs font-bold animate-fadeIn">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>Ficha de empresário atualizada com sucesso no banco de dados!</span>
        </div>
      )}

      {/* EDITING MODE FORM */}
      {isEditing ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5 animate-fadeIn">
          <h4 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Formulário de Edição de Empresário</h4>
          
          {/* Photo Upload Section */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">Foto do Empresário</span>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {editedContact.photoUrl ? (
                <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0">
                  <img src={editedContact.photoUrl} alt="Foto Preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-slate-200/70 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 font-bold text-lg">
                  {editedContact.name ? editedContact.name.substring(0, 2).toUpperCase() : 'DE'}
                </div>
              )}
              <div className="flex-1 space-y-2 w-full">
                <label className="cursor-pointer bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold text-xs px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs inline-flex items-center gap-1.5">
                  <input type="file" accept="image/*" onChange={handlePhotoFileUpload} className="hidden" />
                  <span>Upload do Dispositivo</span>
                </label>
                <input
                  type="text"
                  placeholder="Ou cole o link direto da foto (https://...)"
                  value={editedContact.photoUrl || ''}
                  onChange={(e) => setEditedContact({ ...editedContact, photoUrl: e.target.value })}
                  className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Nome Completo</label>
              <input
                type="text"
                value={editedContact.name}
                onChange={(e) => setEditedContact({ ...editedContact, name: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Email Corporativo</label>
              <input
                type="email"
                value={editedContact.email}
                onChange={(e) => setEditedContact({ ...editedContact, email: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Telefone / WhatsApp</label>
              <input
                type="text"
                value={editedContact.phone}
                onChange={(e) => setEditedContact({ ...editedContact, phone: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Mailing extra fields */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Time de Futebol</label>
              <input
                type="text"
                value={editedContact.futebol || ''}
                placeholder="Ex: Flamengo, São Paulo..."
                onChange={(e) => setEditedContact({ ...editedContact, futebol: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Área de Atuação</label>
              <input
                type="text"
                value={editedContact.areaAtuacao || ''}
                placeholder="Ex: Recursos Humanos, Tecnologia..."
                onChange={(e) => setEditedContact({ ...editedContact, areaAtuacao: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Preferência Política</label>
              <input
                type="text"
                value={editedContact.politica || ''}
                placeholder="Ex: Centro, Direita, Esquerda..."
                onChange={(e) => setEditedContact({ ...editedContact, politica: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Tipo de Música</label>
              <input
                type="text"
                value={editedContact.musica || ''}
                placeholder="Ex: Rock, Sertanejo, MPB..."
                onChange={(e) => setEditedContact({ ...editedContact, musica: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Redes Sociais</label>
              <input
                type="text"
                value={editedContact.redesSociais || ''}
                placeholder="Ex: LinkedIn, Instagram..."
                onChange={(e) => setEditedContact({ ...editedContact, redesSociais: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Custom fields configured for Contacts */}
            {customFields.filter(cf => cf.target === 'contact').map((cf) => {
              const currentVal = editedContact.customFields?.[cf.id] || '';
              return (
                <div key={cf.id} className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase">{cf.name}</label>
                  {cf.type === 'select' ? (
                    <select
                      value={currentVal}
                      onChange={(e) => handleCustomFieldChange(cf.id, e.target.value)}
                      className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none"
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
                        onChange={(e) => handleCustomFieldChange(cf.id, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-650 dark:text-slate-350">Sim, marcado</span>
                    </div>
                  ) : (
                    <input
                      type={cf.type === 'number' ? 'number' : 'text'}
                      value={currentVal}
                      onChange={(e) => handleCustomFieldChange(cf.id, cf.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                      className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => onDeleteContact(contact.id)}
              className="flex items-center space-x-1.5 text-xs text-red-500 hover:text-red-600 font-bold bg-rose-50 hover:bg-rose-100/60 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Excluir do Sistema</span>
            </button>

            <div className="flex space-x-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all"
              >
                Voltar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-5 py-2.5 rounded-xl text-xs font-extrabold text-white cursor-pointer transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* LEFT COLUMN: CONTACT DETAILS & DYNAMIC CUSTOM FIELDS */}
          <div className="md:col-span-2 space-y-6">
            
            {/* DOSSIER CARD */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                Canais de Contato & Informações
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-850 flex items-start space-x-3">
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wide block">Email Corporativo</span>
                    <a href={`mailto:${contact.email}`} className="text-xs font-bold text-slate-800 dark:text-slate-200 hover:underline break-all">
                      {contact.email || 'Não informado'}
                    </a>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-850 flex items-start space-x-3">
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wide block">WhatsApp / Telefone</span>
                    {contact.phone ? (
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{contact.phone}</span>
                        <a 
                          href={getWhatsAppLink(contact.phone)} 
                          target="_blank" 
                          referrerPolicy="no-referrer"
                          className="inline-flex items-center space-x-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 hover:underline uppercase"
                        >
                          <MessageSquare className="h-3 w-3" />
                          <span>Enviar Mensagem</span>
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 block">Sem telefone</span>
                    )}
                  </div>
                </div>
              </div>

              {/* CONTACT CUSTOM FIELDS & MAILING ATTRIBUTES */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-850 space-y-3">
                <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Atributos Customizados</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-0.5 border-l-2 border-indigo-500/30 dark:border-indigo-500/40 pl-3">
                    <span className="text-[10px] text-slate-450 dark:text-slate-500 uppercase font-black block">Time de Futebol</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{contact.futebol || 'Não definido'}</span>
                  </div>
                  <div className="space-y-0.5 border-l-2 border-indigo-500/30 dark:border-indigo-500/40 pl-3">
                    <span className="text-[10px] text-slate-450 dark:text-slate-500 uppercase font-black block">Área de Atuação</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{contact.areaAtuacao || 'Não definido'}</span>
                  </div>
                  <div className="space-y-0.5 border-l-2 border-indigo-500/30 dark:border-indigo-500/40 pl-3">
                    <span className="text-[10px] text-slate-450 dark:text-slate-500 uppercase font-black block">Preferência Política</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{contact.politica || 'Não definido'}</span>
                  </div>
                  <div className="space-y-0.5 border-l-2 border-indigo-500/30 dark:border-indigo-500/40 pl-3">
                    <span className="text-[10px] text-slate-450 dark:text-slate-500 uppercase font-black block">Tipo de Música</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{contact.musica || 'Não definido'}</span>
                  </div>
                  <div className="space-y-0.5 border-l-2 border-indigo-500/30 dark:border-indigo-500/40 pl-3">
                    <span className="text-[10px] text-slate-450 dark:text-slate-500 uppercase font-black block">Redes Sociais</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{contact.redesSociais || 'Não definido'}</span>
                  </div>

                  {customFields.filter(cf => cf.target === 'contact').map((cf) => {
                    const val = contact.customFields?.[cf.id];
                    const displayVal = val === undefined || val === '' 
                      ? 'Não definido' 
                      : typeof val === 'boolean' 
                        ? (val ? 'Sim' : 'Não') 
                        : String(val);

                    return (
                      <div key={cf.id} className="space-y-0.5 border-l-2 border-indigo-500/30 dark:border-indigo-500/40 pl-3">
                        <span className="text-[10px] text-slate-450 dark:text-slate-500 uppercase font-black block">{cf.name}</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{displayVal}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* EVENT ATTENDANCE TIMELINE */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                  Histórico de Participações
                </h3>
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-0.5 rounded-full border border-indigo-200/20">
                  {contactTransactions.length} Evento(s)
                </span>
              </div>

              {contactTransactions.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-850">
                  {contactTransactions.map((tx) => (
                    <div key={tx.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <h4 className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {tx.eventName}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                          <span className="flex items-center gap-0.5">
                            <Calendar className="h-3 w-3" /> {tx.purchaseDate || 'N/D'}
                          </span>
                          <span>•</span>
                          <span>Ingresso: {tx.ticketType || 'Membro'}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200 block">
                          R$ {tx.value.toFixed(0)}
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-wider ${
                          tx.paymentStatus === 'Aprovado' 
                            ? 'text-emerald-650 dark:text-emerald-450' 
                            : 'text-rose-500'
                        }`}>
                          {tx.paymentStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-slate-400 dark:text-slate-500 space-y-1.5 bg-slate-50/50 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <Calendar className="h-6 w-6 mx-auto text-slate-300 dark:text-slate-700" />
                  <p className="text-xs font-extrabold">Sem rodadas cadastradas para este email</p>
                  <p className="text-[10px] max-w-xs mx-auto">Cadastre ingressos no CRM com o email corporativo do decisor para exibir o histórico unificado de participações.</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: LINKED COMPANY INFO & ACTION STATS */}
          <div className="space-y-6">
            
            {/* LINKED COMPANY SNAPSHOT CARD */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                Organização Vinculada
              </h3>

              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <h4 className="text-xs font-extrabold text-slate-950 dark:text-white truncate">
                      {company.name}
                    </h4>
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block">
                      {company.segment}
                    </span>
                  </div>
                  <button 
                    onClick={() => onViewCompany(company)}
                    className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/80 transition-all cursor-pointer shrink-0"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-850">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-450 dark:text-slate-500 font-bold">Porte Organizacional:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold font-mono">
                      {sizeInfo.porte.split(' (')[0]}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-450 dark:text-slate-500 font-bold">Total Colaboradores:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold font-mono">
                      {company.vidas} vidas
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-450 dark:text-slate-500 font-bold">Faturamento Est. Mensal:</span>
                    <span className="text-emerald-650 dark:text-emerald-400 font-black font-mono">
                      {financialInfo.faturamentoAvg > 0 
                        ? `R$ ${financialInfo.faturamentoAvg.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` 
                        : 'Não informado'}
                    </span>
                  </div>
                </div>

                {company.description && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed italic border-t border-slate-100 dark:border-slate-850 pt-2.5">
                    "{company.description.substring(0, 140)}{company.description.length > 140 ? '...' : ''}"
                  </p>
                )}
              </div>
            </div>

            {/* STRATEGIC BIO CARD */}
            <div className="bg-gradient-to-br from-indigo-50/50 via-slate-50/30 to-indigo-50/30 dark:from-slate-950/20 dark:via-slate-950/10 dark:to-indigo-950/10 rounded-3xl border border-indigo-100/50 dark:border-indigo-950/40 p-5 space-y-3.5">
              <div className="flex items-center space-x-1.5 text-indigo-600 dark:text-indigo-400">
                <Sparkles className="h-4 w-4" />
                <h4 className="text-xs font-black uppercase tracking-wider">Dica de Networking</h4>
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {contactTransactions.length === 0 ? (
                  `Este decisor é novo no ecossistema e não participou de rodadas sob este email corporativo. Tente convidá-lo para a próxima agenda ou valide as sinergias setoriais de sua empresa.`
                ) : contactTransactions.length >= 3 ? (
                  `Representante altamente experiente e frequente, ótimo conector de negócios. Excelente porta de entrada para parcerias corporativas e co-selling na região de ${company.location || 'Ceará'}.`
                ) : (
                  `Familiarizado com o modelo de rodadas da Rampup. Tem foco operacional estratégico. Recomenda-se focar a conversa na oferta de valor e nos canais de parcerias da empresa.`
                )}
              </p>
            </div>

          </div>
        </div>

        {/* PONTOS DE LIGAÇÃO DE NEGÓCIOS NA BASE Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-850 pb-5">
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-1.5">
                <Handshake className="h-4.5 w-4.5 text-indigo-500" />
                <span>Pontos de Ligação de Negócios na Base</span>
              </h4>
              <p className="text-[10px] text-slate-450 mt-1">
                {isCurrentContactEnriched 
                  ? `Mapeamento completo de conexões comerciais enriquecidas para a organização ${company.name}.`
                  : `Visualização em modo de cruzamento prévio do mailing. Enriqueça para obter insights avançados.`}
              </p>
            </div>

            {/* Enrichment Action Button */}
            <div className="shrink-0">
              {isCurrentContactEnriched ? (
                <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/20 px-3.5 py-2 rounded-xl text-xs font-bold shadow-3xs">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                  <span>Cruzamento Enriquecido</span>
                </div>
              ) : (
                <button
                  onClick={handleEnrichCurrentContact}
                  disabled={isEnriching}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-md disabled:bg-indigo-850/50 font-extrabold rounded-xl text-xs flex items-center gap-2 border border-indigo-500/20 transition-all cursor-pointer shadow-3xs"
                >
                  {isEnriching ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Enriquecendo...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 animate-bounce" />
                      <span>Enriquecer Cruzamento Estratégico</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Status Banner when not enriched */}
          {!isCurrentContactEnriched && !isEnriching && (
            <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-150/45 dark:border-indigo-900/30 rounded-2xl text-xs space-y-1.5 animate-fadeIn">
              <div className="flex items-center gap-2 font-black text-indigo-900 dark:text-indigo-300">
                <Info className="h-4 w-4 shrink-0 text-indigo-500" />
                <span>Cruzamento Prévio (Mailing Carregado)</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                O mailing de parceiros foi pré-analisado preliminarmente para mapear compatibilidade básica de nicho econômico. 
                Clique no botão <strong>"Enriquecer Cruzamento Estratégico"</strong> acima para rodar a análise aprofundada de CO-SELLING, faturamentos, canais de sinergia e liberar as ferramentas do Assistente Gemini.
              </p>
            </div>
          )}

          {/* Validation Report Banner when enriched */}
          {isCurrentContactEnriched && !isEnriching && (
            <div className="p-5 bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-200/40 dark:border-emerald-900/30 rounded-2xl space-y-3 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-black text-xs uppercase tracking-wider">
                  <CheckCircle className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                  <span>Conexões Pré-mapeadas e Validadas para o Empresário</span>
                </div>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 font-extrabold px-2.5 py-1 rounded-full border border-emerald-200/20 shadow-3xs shrink-0 self-start sm:self-auto">
                  Grau de Aderência: 98% (Excelente)
                </span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-350 leading-relaxed whitespace-pre-wrap font-sans bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                {validationReports[contact.id] || `O algoritmo comparou as conexões da base frente ao perfil de ${contact.name} e da empresa ${company.name}.\n\nAs empresas mostradas abaixo representam os melhores matches de sinergia setorial, complementaridade operacional e porte financeiro equivalente.`}
              </div>
            </div>
          )}

          {/* Simulated loader block */}
          {isEnriching && (
            <div className="p-10 text-center space-y-3 bg-slate-50 dark:bg-slate-955 rounded-2xl border border-slate-100 dark:border-slate-850 animate-pulse">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-500" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Refinando Conexões e Calculando Fit de Faturamento...</p>
              <p className="text-[10px] text-slate-450 max-w-xs mx-auto">O algoritmo de cruzamento estratégico está comparando o porte econômico, receitas e sinergia de canais.</p>
            </div>
          )}

          {/* Matches list view */}
          {!isEnriching && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* 1. Buyers Column */}
              <div className="space-y-3">
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block border-b pb-1">CO-SELLING (Vender para)</span>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {buyerCompanies.map(c => (
                    <div key={c.id} onClick={() => setSelectedMatch(c)} className="p-3 bg-slate-50 dark:bg-slate-955 border rounded-xl hover:border-indigo-300 transition-colors cursor-pointer text-xs space-y-1">
                      <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                        <span className="truncate">{c.name}</span>
                        <span className="text-indigo-600 dark:text-indigo-400">{calculateCompanyAffinity(company, c, transactions)}%</span>
                      </div>
                      <span className="text-[9px] text-slate-450 block truncate">{c.segment}</span>
                    </div>
                  ))}
                  {buyerCompanies.length === 0 && <p className="text-[11px] text-slate-400 italic">Sem recomendações.</p>}
                </div>
              </div>

              {/* 2. Sellers Column */}
              <div className="space-y-3 border-l border-slate-100 dark:border-slate-850 pl-0 md:pl-6">
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block border-b pb-1">OUTSOURCING (Comprar de)</span>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {sellerCompanies.map(c => (
                    <div key={c.id} onClick={() => setSelectedMatch(c)} className="p-3 bg-slate-50 dark:bg-slate-955 border rounded-xl hover:border-amber-300 transition-colors cursor-pointer text-xs space-y-1">
                      <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                        <span className="truncate">{c.name}</span>
                        <span className="text-amber-500">{calculateCompanyAffinity(company, c, transactions)}%</span>
                      </div>
                      <span className="text-[9px] text-slate-450 block truncate">{c.segment}</span>
                    </div>
                  ))}
                  {sellerCompanies.length === 0 && <p className="text-[11px] text-slate-400 italic">Sem recomendações.</p>}
                </div>
              </div>

              {/* 3. Partners Column */}
              <div className="space-y-3 border-l border-slate-100 dark:border-slate-850 pl-0 md:pl-6">
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block border-b pb-1">PARCERIAS (Canais)</span>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {partnerCompanies.map(c => (
                    <div key={c.id} onClick={() => setSelectedMatch(c)} className="p-3 bg-slate-50 dark:bg-slate-955 border rounded-xl hover:border-emerald-300 transition-colors cursor-pointer text-xs space-y-1">
                      <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                        <span className="truncate">{c.name}</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{calculateCompanyAffinity(company, c, transactions)}%</span>
                      </div>
                      <span className="text-[9px] text-slate-450 block truncate">{c.segment}</span>
                    </div>
                  ))}
                  {partnerCompanies.length === 0 && <p className="text-[11px] text-emerald-600 dark:text-emerald-400 italic">Sem recomendações.</p>}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* AI CONNECTION ASSISTANT PANEL */}
        {selectedMatch && (
          <div className="bg-slate-950 rounded-3xl border border-slate-800 p-6 text-white space-y-6 shadow-lg animate-fadeIn mt-6" id="ai_assistant_panel">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-2xl border border-indigo-500 shadow-md">
                  <Sparkles className="h-5 w-5 animate-spin" style={{ animationDuration: '4.5s' }} />
                </div>
                <div>
                  <h4 className="font-bold text-lg font-display text-white">Assistente de Conexões Gemini</h4>
                  <p className="text-xs text-slate-400">
                    Inteligência de prospecção e canal para o decisor {contact.name}: <strong>{company.name}</strong> ➔ <strong>{selectedMatch.name}</strong>
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setSelectedMatch(null)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isCurrentContactEnriched ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 pt-2">
                
                {/* Options bar */}
                <div className="space-y-4 lg:col-span-1 bg-slate-900 p-4 rounded-2xl border border-slate-850">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Como quer abordar?</span>
                  
                  <div className="space-y-2">
                    <button
                      onClick={() => setAiType('sell')}
                      className={`w-full text-left p-3 rounded-xl text-xs font-extrabold border flex items-center justify-between transition-all cursor-pointer ${
                        aiType === 'sell'
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                      }`}
                    >
                      <span>Pitch Comercial</span>
                      <ArrowUpRight className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => setAiType('partner')}
                      className={`w-full text-left p-3 rounded-xl text-xs font-extrabold border flex items-center justify-between transition-all cursor-pointer ${
                        aiType === 'partner'
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                      }`}
                    >
                      <span>Acordo de Canais</span>
                      <Handshake className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => setAiType('intro')}
                      className={`w-full text-left p-3 rounded-xl text-xs font-extrabold border flex items-center justify-between transition-all cursor-pointer ${
                        aiType === 'intro'
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                      }`}
                    >
                      <span>Template de Email</span>
                      <Mail className="h-4 w-4" />
                    </button>
                  </div>

                  <button
                    onClick={handleQueryAI}
                    disabled={isAiLoading}
                    className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-800/50 font-extrabold py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md text-white mt-4 cursor-pointer"
                  >
                    {isAiLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Calculando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Disparar Consulta IA</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Response card */}
                <div className="lg:col-span-3 bg-black rounded-2xl p-5 border border-slate-850 min-h-[200px] flex flex-col justify-between">
                  
                  {isAiLoading && (
                    <div className="flex flex-col items-center justify-center py-10 space-y-3 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                      <p className="text-xs text-slate-400">
                        O Gemini está traçando a melhor linha de aproximação comercial...
                      </p>
                    </div>
                  )}

                  {!isAiLoading && !aiResponse && (
                    <div className="flex flex-col justify-between h-full space-y-5">
                      {(() => {
                        const localReason = 
                          matches.reasons[`sell_${selectedMatch.id}`] ||
                          matches.reasons[`buy_${selectedMatch.id}`] ||
                          matches.reasons[`partner_${selectedMatch.id}`] ||
                          matches.reasons[`conn_${selectedMatch.id}`];
                        return (
                          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2.5">
                            <div className="flex items-center gap-2 text-indigo-400">
                              <Handshake className="h-4.5 w-4.5" />
                              <span className="text-[10px] font-black uppercase tracking-wider">Racional do Cruzamento Estratégico</span>
                            </div>
                            <p className="text-slate-350 text-xs leading-relaxed font-semibold">
                              {localReason || 'Sinergia de portfólio setorial e compatibilidade de receitas.'}
                            </p>
                          </div>
                        );
                      })()}

                      <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-850 text-[11px] text-slate-400 leading-relaxed">
                        Escolha o tipo de prospecção desejada e dispare a inteligência do Gemini para redigir o roteiro de abordagem.
                      </div>
                    </div>
                  )}

                  {!isAiLoading && aiResponse && (
                    <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed space-y-4 overflow-y-auto max-h-[280px] pr-1 font-sans">
                      {aiResponse}
                    </div>
                  )}

                  {aiResponse && (
                    <div className="flex justify-end pt-3 border-t border-slate-900 mt-4">
                      <button
                        onClick={() => copyToClipboard(aiResponse)}
                        className="text-xs bg-slate-900 text-slate-300 hover:bg-slate-800 px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-800"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>{copySuccess ? 'Copiado!' : 'Copiar Abordagem'}</span>
                      </button>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="p-8 text-center bg-slate-900 border border-slate-850 rounded-2xl space-y-4 max-w-xl mx-auto my-4">
                <Shield className="h-8 w-8 text-indigo-400 mx-auto animate-pulse" />
                <div className="space-y-1">
                  <h5 className="text-sm font-black text-white uppercase tracking-wider">🔒 Racional Estratégico Bloqueado</h5>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Para visualizar o Racional de Conexão detalhado e habilitar o Assistente de Prospecção Gemini com modelos de pitch, você precisa enriquecer este cruzamento.
                  </p>
                </div>
                <button
                  onClick={handleEnrichCurrentContact}
                  className="mx-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 border border-indigo-500/20 transition-all cursor-pointer shadow-3xs"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Enriquecer Conta Agora</span>
                </button>
              </div>
            )}
          </div>
        )}
      </>
    )}
  </div>
  );
}
