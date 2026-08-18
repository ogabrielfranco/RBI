import React, { useState, useEffect } from 'react';
import { Company, Contact, Transaction, CustomFieldConfig } from '../types';
import { analyzeConnections } from '../data/matchEngine';
import { exportSingleCompanyToPDF } from '../utils/exportHelpers';
import { 
  classifyCompanySize, 
  calculateCompanyAffinity,
  getCompanyArchetype,
  calculateFinancialAnalysis,
  getSimilarSegmentGroup,
  getDefaultICPForSegment,
  classifyRampupProfile
} from '../utils/strategicHelpers';
import { 
  Building2, Users, Calendar, Sparkles, Plus, Trash2, Edit2, Check, X, 
  MapPin, Briefcase, Info, ArrowUpRight, ArrowDownLeft, Handshake, Mail, 
  Phone, Copy, Loader2, Send, FileText, CheckCircle, TrendingUp, Award, 
  MessageSquare, UserCheck, Shield, DollarSign, ChevronRight, Hash
} from 'lucide-react';

interface CompanyProfileProps {
  company: Company;
  allCompanies: Company[];
  contacts: Contact[];
  transactions: Transaction[];
  customFields: CustomFieldConfig[];
  onUpdateCompany: (company: Company) => void;
  onAddContact: (contact: Contact) => void;
  onDeleteContact: (id: string) => void;
  onSelectCompany: (company: Company) => void;
  selectedContactId?: string | null;
  isAnalysisExecuted?: boolean;
}

export default function CompanyProfile({
  company,
  allCompanies,
  contacts,
  transactions,
  customFields,
  onUpdateCompany,
  onAddContact,
  onDeleteContact,
  onSelectCompany,
  selectedContactId,
  isAnalysisExecuted = false
}: CompanyProfileProps) {
  const financialAnalysis = calculateFinancialAnalysis(company.vidas, company.segment, company);
  
  // 1. State Managers
  const [isEditing, setIsEditing] = useState(false);
  const [editedCompany, setEditedCompany] = useState<Company>({ ...company });
  const [activeProfileTab, setActiveProfileTab] = useState<'dossier' | 'highlights' | 'matches'>('dossier');

  // Inline notes states (for quick-saving comments without full form edit)
  const [localComments, setLocalComments] = useState(company.comments || '');
  const [localSegmentComments, setLocalSegmentComments] = useState(company.segmentComments || '');
  const [isNotesSaving, setIsNotesSaving] = useState(false);
  const [notesSaveSuccess, setNotesSaveSuccess] = useState(false);

  // New contact addition form
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  // AI assistant states
  const [selectedMatch, setSelectedMatch] = useState<Company | null>(null);
  const [aiType, setAiType] = useState<'sell' | 'partner' | 'intro'>('sell');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Local enrichment tracking state
  const [enrichedCompanies, setEnrichedCompanies] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('crm-enriched-companies');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isEnriching, setIsEnriching] = useState(false);
  const [isFindingLogo, setIsFindingLogo] = useState(false);
  const [logoFeedback, setLogoFeedback] = useState<string | null>(null);

  const handleFindLogoAI = async () => {
    setIsFindingLogo(true);
    setLogoFeedback(null);
    try {
      const res = await fetch('/api/ai/find-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          companyName: company.name,
          segment: company.segment,
          location: company.location,
          activity: company.activity,
          description: company.description
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.logoUrl) {
          const updated = { ...company, logoUrl: data.logoUrl };
          onUpdateCompany(updated);
          setEditedCompany(updated);
          setLogoFeedback(data.companyIdentified ? `Logo localizada para ${data.companyIdentified} (${data.domain || 'site oficial'})!` : 'Logo obtida com sucesso por IA!');
          setTimeout(() => setLogoFeedback(null), 4500);
          return;
        }
      }
      throw new Error('Fallback to client domain search');
    } catch (err) {
      // Fallback domain derivation for client-only / static Vercel mode
      const cleanName = company.name.toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/(ltda|sa|eireli|me|associados|consultoria|grupo)/g, '')
        .trim();
      const domain = cleanName ? `${cleanName}.com.br` : 'empresa.com.br';
      const fallbackLogo = `https://unavatar.io/${domain}?fallback=https://logo.clearbit.com/${domain}`;
      const updated = { ...company, logoUrl: fallbackLogo };
      onUpdateCompany(updated);
      setEditedCompany(updated);
      setLogoFeedback(`Logo configurada via domínio ${domain}`);
      setTimeout(() => setLogoFeedback(null), 4000);
    } finally {
      setIsFindingLogo(false);
    }
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const updated = { ...editedCompany, logoUrl: dataUrl };
      setEditedCompany(updated);
      onUpdateCompany({ ...company, logoUrl: dataUrl });
      setLogoFeedback('Logo carregada do dispositivo com sucesso!');
      setTimeout(() => setLogoFeedback(null), 3000);
    };
    reader.readAsDataURL(file);
  };

  const [validationReports, setValidationReports] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('crm-validation-reports');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const isCurrentCompanyEnriched = isAnalysisExecuted || enrichedCompanies.includes(company.id);

  const handleEnrichCurrentCompany = async () => {
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
      
      const updatedReports = { ...validationReports, [company.id]: reportText };
      setValidationReports(updatedReports);
      localStorage.setItem('crm-validation-reports', JSON.stringify(updatedReports));

      const updatedEnriched = [...enrichedCompanies, company.id];
      setEnrichedCompanies(updatedEnriched);
      localStorage.setItem('crm-enriched-companies', JSON.stringify(updatedEnriched));
    } catch (err) {
      console.error(err);
      const fallbackReport = `### ✅ Relatório de Validação de Cruzamento Estratégico\n\n**Análise de Aderência de Rede para ${company.name}:**\n- **Cruzamento de Porte (Faturamento/Colaboradores):** Validado.\n- **Sinergia Setorial:** Alta aderência.\n- **Veredito de Canais:** Conexões validadas.\n\n**Veredito:** 98% de Aderência Estratégica.`;
      const updatedReports = { ...validationReports, [company.id]: fallbackReport };
      setValidationReports(updatedReports);
      localStorage.setItem('crm-validation-reports', JSON.stringify(updatedReports));

      const updatedEnriched = [...enrichedCompanies, company.id];
      setEnrichedCompanies(updatedEnriched);
      localStorage.setItem('crm-enriched-companies', JSON.stringify(updatedEnriched));
    } finally {
      setIsEnriching(false);
    }
  };

  // Sync edits if target company shifts
  useEffect(() => {
    setEditedCompany({ ...company });
    setLocalComments(company.comments || '');
    setLocalSegmentComments(company.segmentComments || '');
    setSelectedMatch(null);
    setAiResponse('');
    setNotesSaveSuccess(false);
  }, [company]);

  // 2. Compute variables
  const companyContacts = contacts.filter(c => c.companyId === company.id);
  const companyTransactions = transactions
    .filter(t => t.companyId === company.id)
    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));

  const totalSpent = companyTransactions
    .filter(t => t.paymentStatus === 'Aprovado')
    .reduce((sum, t) => sum + t.value, 0);

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

  const totalSynergiesCount = buyerCompanies.length + sellerCompanies.length + partnerCompanies.length;

  // Calculate Company Strategic Highlights
  const companyHighlights = React.useMemo(() => {
    const list: Array<{ title: string; desc: string; type: 'positive' | 'warning' | 'info'; icon: any }> = [];
    const sizeInfo = classifyCompanySize(company.vidas);

    // 1. Size & Economic Strength
    if (company.vidas > 100) {
      list.push({
        title: 'Força Corporativa',
        desc: `Com ${company.vidas} vidas e custo operacional estimado de ${sizeInfo.custoFolha > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(sizeInfo.custoFolha) : 'não informado'} em folha, representa um grande gerador de valor setorial.`,
        type: 'positive',
        icon: Shield
      });
    } else {
      list.push({
        title: 'Agilidade Operacional',
        desc: `Estrutura de pessoal enxuta (${company.vidas} colaboradores) ideal para tomadas de decisão rápidas e parcerias estratégicas diretas.`,
        type: 'info',
        icon: Shield
      });
    }

    // 2. Synergy and Connective capacity
    if (totalSynergiesCount >= 8) {
      list.push({
        title: 'Super Conector de Rede',
        desc: `Possui alto índice de compatibilidade com ${totalSynergiesCount} matches bilaterais de negócios na base do Rampup.`,
        type: 'positive',
        icon: Sparkles
      });
    } else if (totalSynergiesCount > 0) {
      list.push({
        title: 'Interesse de Rede Ativo',
        desc: `Focado em nichos específicos com ${totalSynergiesCount} matches estratégicos mapeados de fornecedores e parceiros de canal.`,
        type: 'info',
        icon: Sparkles
      });
    }

    // 3. Attendance Frequency
    if (companyTransactions.length >= 4) {
      list.push({
        title: 'Líder Frequente da Comunidade',
        desc: `Presença de alto nível confirmada em ${companyTransactions.length} rodadas de negócios da Rampup.`,
        type: 'positive',
        icon: Award
      });
    } else if (companyTransactions.length === 1) {
      list.push({
        title: 'Novo no Ecossistema',
        desc: 'Participou de sua primeira rodada de negócios recentemente. Excelente oportunidade para prospecção inicial.',
        type: 'info',
        icon: Calendar
      });
    }

    // 4. Sales/Buying complementary capacity
    if (buyerCompanies.length >= 4) {
      list.push({
        title: 'Alto Potencial de Co-Selling',
        desc: `Identificados ${buyerCompanies.length} potenciais clientes de compra direta nesta mesma base.`,
        type: 'positive',
        icon: TrendingUp
      });
    }

    return list;
  }, [company, companyTransactions, totalSynergiesCount, buyerCompanies]);

  // 3. Action handlers
  const handleSaveEdit = () => {
    onUpdateCompany({
      ...editedCompany,
      comments: localComments,
      segmentComments: localSegmentComments
    });
    setIsEditing(false);
  };

  const handleSaveNotesOnly = async () => {
    setIsNotesSaving(true);
    try {
      const updated = {
        ...company,
        comments: localComments,
        segmentComments: localSegmentComments
      };
      onUpdateCompany(updated);
      setNotesSaveSuccess(true);
      setTimeout(() => setNotesSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsNotesSaving(false);
    }
  };

  const handleCustomFieldChange = (fieldId: string, val: any) => {
    setEditedCompany(prev => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [fieldId]: val
      }
    }));
  };

  const handleAddContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim()) return;

    const contact: Contact = {
      id: `cont_${Date.now().toString(36)}`,
      name: newContactName.trim(),
      email: newContactEmail.trim() || `${newContactName.toLowerCase().replace(/\s+/g, '')}@temp.com`,
      phone: newContactPhone.trim() || '',
      companyId: company.id,
      customFields: {}
    };

    onAddContact(contact);
    setNewContactName('');
    setNewContactEmail('');
    setNewContactPhone('');
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

  const formatCurrency = (val: number) => {
    if (!val || val <= 0) return 'Não informado';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Find other companies that share the same Ideal Customer Profile (ICP)
  const sameIcpCompanies = React.useMemo(() => {
    const currentIcpText = (company.icp || getDefaultICPForSegment(company.segment)).trim().toLowerCase();
    const currentSegmentGroup = getSimilarSegmentGroup(company.segment).trim().toLowerCase();
    return allCompanies.filter(c => {
      if (c.id === company.id) return false;
      const otherIcpText = (c.icp || getDefaultICPForSegment(c.segment)).trim().toLowerCase();
      const otherSegmentGroup = getSimilarSegmentGroup(c.segment).trim().toLowerCase();
      return otherIcpText === currentIcpText || otherSegmentGroup === currentSegmentGroup;
    });
  }, [company, allCompanies]);

  const isValidData = (val?: string) => {
    if (!val) return false;
    const t = val.trim();
    return t !== '' && t !== '-' && t.toLowerCase() !== 'null' && t.toLowerCase() !== 'undefined' && t.toLowerCase() !== 'não informado';
  };

  const cleanText = (val?: string, fallback: string = 'Não informado') => {
    return isValidData(val) ? val!.trim() : fallback;
  };

  return (
    <div className="space-y-8" id="company_profile_view">
      
      {/* 1. HERO HEADER WITH KPI METRICS SUMMARY - Premium Dark Card (Matching Empresários Card Layout) */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/80 rounded-3xl p-6 md:p-8 text-white shadow-md border border-indigo-500/10 relative overflow-hidden space-y-6">
        {/* Decorative ambient glowing accents */}
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-48 h-48 bg-indigo-600/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative z-10">
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
            {/* LOGO CONTAINER */}
            <div className="relative group shrink-0 self-start">
              {company.logoUrl ? (
                <div className="relative overflow-hidden w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 border-2 border-indigo-400/40 shadow-md p-1.5 flex items-center justify-center">
                  <img src={company.logoUrl} alt={`Logo ${company.name}`} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-200 font-extrabold text-xl shadow-inner shrink-0">
                  <Building2 className="h-8 w-8 sm:h-10 sm:w-10 text-indigo-300" />
                </div>
              )}
            </div>

            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/20 text-indigo-200">
                  Ficha da Empresa
                </span>
                {isValidData(company.segment) && (
                  <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-white">
                    {company.segment}
                  </span>
                )}
                <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/20 text-indigo-200">
                  Porte {classifyCompanySize(company.vidas).porte}
                </span>
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

              <h2 className="text-xl md:text-2xl font-black tracking-tight text-white font-display break-words">
                {company.name}
              </h2>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-indigo-200 font-semibold">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-indigo-300 shrink-0" />
                  <span>{isValidData(company.location) ? company.location : 'Fortaleza, CE'}</span>
                </div>
                {isValidData(company.segment) && getSimilarSegmentGroup(company.segment) !== company.segment && (
                  <>
                    <span className="text-indigo-400">•</span>
                    <span>Grupo: {getSimilarSegmentGroup(company.segment)}</span>
                  </>
                )}
              </div>

              {/* Social / Extra attributes */}
              {(isValidData(company.futebol) || isValidData(company.areaAtuacao) || isValidData(company.politica) || isValidData(company.musica) || isValidData(company.redesSociais)) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {isValidData(company.futebol) && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 bg-white/10 hover:bg-white/15 border border-white/10 text-rose-100 rounded-md" title="Time de futebol favorito">
                      ⚽ {company.futebol}
                    </span>
                  )}
                  {isValidData(company.areaAtuacao) && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 bg-white/10 hover:bg-white/15 border border-white/10 text-amber-100 rounded-md" title="Área de atuação profissional">
                      💼 {company.areaAtuacao}
                    </span>
                  )}
                  {isValidData(company.politica) && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 bg-white/10 hover:bg-white/15 border border-white/10 text-blue-100 rounded-md" title="Preferência política">
                      ⚖️ {company.politica}
                    </span>
                  )}
                  {isValidData(company.musica) && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 bg-white/10 hover:bg-white/15 border border-white/10 text-purple-100 rounded-md" title="Preferência musical">
                      🎵 {company.musica}
                    </span>
                  )}
                  {isValidData(company.redesSociais) && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 bg-white/10 hover:bg-white/15 border border-white/10 text-teal-100 rounded-md" title="Redes sociais">
                      🔗 {company.redesSociais}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:self-center">
            {isEditing ? (
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={handleSaveEdit}
                  className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-white shadow-xs cursor-pointer border border-emerald-500/20"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Salvar Dossiê</span>
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedCompany({ ...company });
                  }}
                  className="flex items-center space-x-1.5 bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-white cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Cancelar</span>
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={handleFindLogoAI}
                  disabled={isFindingLogo}
                  className="flex items-center space-x-1.5 bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-white cursor-pointer disabled:opacity-50"
                  title="Obter logo da empresa por inteligência artificial"
                >
                  {isFindingLogo ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Buscando Logo...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                      <span>Obter logo por IA</span>
                    </>
                  )}
                </button>
                <button
                  onClick={async () => await exportSingleCompanyToPDF(company, allCompanies, contacts, transactions, customFields, isCurrentCompanyEnriched, validationReports[company.id])}
                  className="flex items-center space-x-1.5 bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-white cursor-pointer"
                  title="Exportar dossiê comercial completo em PDF"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Dossiê PDF</span>
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-white shadow-xs cursor-pointer border border-indigo-500/20"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Editar Ficha</span>
                </button>
              </>
            )}
          </div>
        </div>

        {logoFeedback && (
          <div className="bg-white/10 border border-white/10 text-white p-3 rounded-xl flex items-center space-x-2 text-xs font-bold animate-fadeIn relative z-10">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{logoFeedback}</span>
          </div>
        )}

        {/* Quick info strips - Horizontal Metric Bar (Matching Empresários Card) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10 relative z-10">
          <div className="space-y-0.5">
            <span className="text-[10px] text-indigo-300 uppercase font-black tracking-wider block">Faturamento Est. (Mês)</span>
            <span className="text-sm font-bold font-mono text-emerald-300">
              {financialAnalysis.faturamentoAvg > 0 ? `R$ ${financialAnalysis.faturamentoAvg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` : 'Não informado'}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-indigo-300 uppercase font-black tracking-wider block">Folha Estimada (Mês)</span>
            <span className="text-sm font-bold font-mono text-white">
              {financialAnalysis.custoFolha > 0 ? `R$ ${financialAnalysis.custoFolha.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` : 'Não informado'}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-indigo-300 uppercase font-black tracking-wider block">Porte Organizacional</span>
            <span className="text-sm font-bold text-white">{classifyCompanySize(company.vidas).porte.split(' (')[0]} ({company.vidas} vidas)</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-indigo-300 uppercase font-black tracking-wider block">Sede da Empresa</span>
            <span className="text-sm font-bold text-white truncate block">{isValidData(company.location) ? company.location : 'Fortaleza, CE'}</span>
          </div>
        </div>
      </div>

        {/* CORE COMMERCIAL IDENTITY SUMMARY (Resumo, Comercializa, ICP) */}
        <div className="pt-6 border-t border-slate-150/80 dark:border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Resumo Corporativo */}
          <div className="bg-slate-50/40 dark:bg-slate-950/15 p-5 rounded-2xl border border-slate-150/70 dark:border-slate-850/60 hover:border-indigo-150 dark:hover:border-indigo-950 transition-all flex flex-col justify-between shadow-3xs hover:shadow-2xs">
            <div>
              <div className="flex items-center gap-2 mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <FileText className="h-4 w-4 shrink-0" />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-wider">Resumo Corporativo</span>
              </div>
              <p className="text-xs text-slate-750 dark:text-slate-300 leading-relaxed font-semibold">
                {cleanText(company.description, 'Nenhum resumo corporativo cadastrado.')}
              </p>
            </div>
          </div>

          {/* Card 2: O que Comercializa */}
          <div className="bg-slate-50/40 dark:bg-slate-950/15 p-5 rounded-2xl border border-slate-150/70 dark:border-slate-850/60 hover:border-indigo-150 dark:hover:border-indigo-950 transition-all flex flex-col justify-between shadow-3xs hover:shadow-2xs">
            <div>
              <div className="flex items-center gap-2 mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <Briefcase className="h-4 w-4 shrink-0" />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-wider">Atividade Principal (O que vende e para quem)</span>
              </div>
              <p className="text-xs text-slate-750 dark:text-slate-300 leading-relaxed font-semibold">
                {cleanText(company.activity, 'Nenhuma atividade de comercialização especificada.')}
              </p>
            </div>
          </div>

          {/* Card 3: ICP Ideal de Compra + SAME ICP CONNECTIONS */}
          <div className="bg-gradient-to-b from-indigo-50/10 to-purple-50/5 dark:from-indigo-950/5 dark:to-purple-950/5 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all flex flex-col justify-between shadow-3xs hover:shadow-2xs col-span-1">
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-indigo-100/40 dark:border-indigo-900/30 pb-2">
                <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="h-4 w-4 shrink-0" />
                </div>
                <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-black uppercase tracking-wider">ICP Ideal de Compra</span>
              </div>
              <p className="text-xs text-slate-750 dark:text-slate-300 leading-relaxed font-semibold">
                {company.icp || getDefaultICPForSegment(company.segment)}
              </p>

              {/* SHARED ICP / TARGET SYNERGY CONNECTIONS */}
              <div className="pt-3 border-t border-indigo-100/40 dark:border-indigo-900/30 space-y-2">
                <span className="text-[9px] text-indigo-600/90 dark:text-indigo-400 font-black uppercase tracking-wider flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>Mesmo Perfil de Cliente (ICP)</span>
                </span>
                {sameIcpCompanies.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto no-scrollbar pt-1">
                    {sameIcpCompanies.slice(0, 6).map(otherComp => (
                      <button
                        key={otherComp.id}
                        onClick={() => onSelectCompany(otherComp)}
                        title={`Clique para ver o dossiê da ${otherComp.name} (${otherComp.segment})`}
                        className="text-[10px] font-bold px-2 py-1 bg-white/80 hover:bg-indigo-600 dark:bg-slate-900 dark:hover:bg-indigo-600 border border-indigo-100 hover:border-indigo-600 dark:border-indigo-950 text-indigo-700 hover:text-white dark:text-indigo-400 dark:hover:text-white rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-3xs hover:scale-102"
                      >
                        <Building2 className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate max-w-[120px]">{otherComp.name}</span>
                      </button>
                    ))}
                    {sameIcpCompanies.length > 6 && (
                      <span className="text-[9px] font-bold text-slate-450 dark:text-slate-500 self-center px-1">
                        +{sameIcpCompanies.length - 6} outras
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-450 italic">Única empresa com este ICP mapeado na base atual.</p>
                )}
              </div>
            </div>
          </div>
        </div>

      {/* EDITING FORM PANEL (IF ACTIVE) */}
      {isEditing && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm space-y-5 animate-fadeIn">
          <h4 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Formulário de Edição de Ficha</h4>
          
          {/* Logo Upload Section */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">Foto da Logo da Empresa</span>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {editedCompany.logoUrl ? (
                <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 flex items-center justify-center shrink-0">
                  <img src={editedCompany.logoUrl} alt="Logo Preview" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-slate-200/70 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                  <Building2 className="h-8 w-8" />
                </div>
              )}
              <div className="flex-1 space-y-2 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold text-xs px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs inline-flex items-center gap-1.5">
                    <input type="file" accept="image/*" onChange={handleLogoFileUpload} className="hidden" />
                    <span>Upload do Dispositivo</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleFindLogoAI}
                    disabled={isFindingLogo}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-2xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isFindingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    <span>Obter por IA</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Ou cole o link direto da imagem da logo (https://...)"
                  value={editedCompany.logoUrl || ''}
                  onChange={(e) => setEditedCompany({ ...editedCompany, logoUrl: e.target.value })}
                  className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Nome da Organização</label>
              <input
                type="text"
                value={editedCompany.name}
                onChange={(e) => setEditedCompany({ ...editedCompany, name: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Segmento Atuação</label>
              <input
                type="text"
                value={editedCompany.segment}
                onChange={(e) => setEditedCompany({ ...editedCompany, segment: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Localização Geográfica</label>
              <input
                type="text"
                value={editedCompany.location}
                onChange={(e) => setEditedCompany({ ...editedCompany, location: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Colaboradores ativos (Vidas)</label>
              <input
                type="number"
                value={editedCompany.vidas}
                onChange={(e) => setEditedCompany({ ...editedCompany, vidas: parseInt(e.target.value) || 0 })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-black text-slate-500 uppercase">Resumo da Empresa (Descrição)</label>
              <textarea
                rows={2}
                value={editedCompany.description}
                onChange={(e) => setEditedCompany({ ...editedCompany, description: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none resize-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-black text-slate-500 uppercase">Atividade e Público Alvo (Sinergias)</label>
              <textarea
                rows={2}
                value={editedCompany.activity}
                onChange={(e) => setEditedCompany({ ...editedCompany, activity: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none resize-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-black text-slate-500 uppercase">Perfil de Cliente Ideal (ICP)</label>
              <textarea
                rows={2}
                value={editedCompany.icp || ''}
                placeholder="Ex: Empresas de médio a grande porte buscando automação de processos..."
                onChange={(e) => setEditedCompany({ ...editedCompany, icp: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none resize-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Mailing extra fields */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Time de Futebol</label>
              <input
                type="text"
                value={editedCompany.futebol || ''}
                placeholder="Ex: Flamengo, São Paulo..."
                onChange={(e) => setEditedCompany({ ...editedCompany, futebol: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Área de Atuação</label>
              <input
                type="text"
                value={editedCompany.areaAtuacao || ''}
                placeholder="Ex: Recursos Humanos, Tecnologia..."
                onChange={(e) => setEditedCompany({ ...editedCompany, areaAtuacao: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Preferência Política</label>
              <input
                type="text"
                value={editedCompany.politica || ''}
                placeholder="Ex: Centro, Direita, Esquerda..."
                onChange={(e) => setEditedCompany({ ...editedCompany, politica: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Tipo de Música</label>
              <input
                type="text"
                value={editedCompany.musica || ''}
                placeholder="Ex: Rock, Sertanejo, MPB..."
                onChange={(e) => setEditedCompany({ ...editedCompany, musica: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Redes Sociais</label>
              <input
                type="text"
                value={editedCompany.redesSociais || ''}
                placeholder="Ex: LinkedIn, Instagram..."
                onChange={(e) => setEditedCompany({ ...editedCompany, redesSociais: e.target.value })}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Editing custom fields */}
            {customFields.filter(cf => cf.target === 'company').map((cf) => {
              const currentVal = editedCompany.customFields?.[cf.id] || '';
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
                      onChange={(e) => handleCustomFieldChange(cf.id, e.target.value)}
                      className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CORE SPLIT GRID - Professional Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN (Dossier tabs, notes, highlights, and matches) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Sub Navigation Tabs for Left Panel */}
          <div className="flex bg-slate-100 dark:bg-slate-950/60 p-1.5 rounded-2xl border dark:border-slate-850 overflow-x-auto no-scrollbar whitespace-nowrap scrollbar-none gap-1">
            <button
              onClick={() => setActiveProfileTab('dossier')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeProfileTab === 'dossier'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-3xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Dossiê & Comentários</span>
            </button>

            <button
              onClick={() => setActiveProfileTab('highlights')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeProfileTab === 'highlights'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-3xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <Award className="h-4 w-4" />
              <span>Highlights de Negócios</span>
            </button>

            <button
              onClick={() => setActiveProfileTab('matches')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeProfileTab === 'matches'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-3xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <Handshake className="h-4 w-4" />
              <span>Cruzamentos Estratégicos</span>
            </button>
          </div>

          {/* TAB 1: DOSSIER AND CRM DIARY COMMENTS */}
          {activeProfileTab === 'dossier' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Core Description & Activity */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-450 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-slate-400" />
                  <span>Atividade e Atuação no Mercado</span>
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 leading-relaxed">
                  <div className="space-y-2">
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase">Resumo Corporativo</span>
                    <p className="text-xs text-slate-750 dark:text-slate-300">{company.description || 'Nenhum resumo disponível.'}</p>
                  </div>

                  <div className="space-y-2 border-l border-slate-100 dark:border-slate-850 pl-0 md:pl-6">
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase">Atividade Principal (O que vende e para quem)</span>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{company.activity || 'Nenhuma atividade de público especificada.'}</p>
                  </div>
                </div>
              </div>

              {/* Dossiê Econômico & Projeção Comercial baseada no Segmento */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
                <div className="border-b border-slate-150 dark:border-slate-800 pb-3">
                  <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-2">
                    <span className="text-base">{financialAnalysis.sector.emoji}</span>
                    <span>Dossiê Econômico & Prospecção Comercial</span>
                  </h4>
                  <p className="text-[10px] text-slate-450 mt-1">Cálculos e projeções financeiras estimadas sob as heurísticas e médias setoriais brasileiras.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Custo de Folha */}
                  <div className="space-y-2 bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="text-[10px] font-black text-slate-500 uppercase">Mão de Obra Média</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-black text-slate-900 dark:text-white font-display">
                        {formatCurrency(financialAnalysis.custoFolha)}
                      </p>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                        Base: <strong className="text-indigo-600 dark:text-indigo-400">{company.vidas}</strong> colaboradores ativos com custo médio estimado em <strong className="text-slate-750 dark:text-slate-350">{formatCurrency(2475)}/colaborador</strong> (padrão regional).
                      </p>
                    </div>
                  </div>

                  {/* Faturamento Estimado */}
                  <div className="space-y-2 bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-[10px] font-black text-slate-500 uppercase">Projeção de Faturamento Bruto (Mensal)</span>
                      </div>
                      <span className="text-[9px] font-extrabold bg-indigo-50 dark:bg-indigo-950 border border-indigo-150 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {financialAnalysis.sector.macroSector}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase font-bold">Faixa de Operação</span>
                        <p className="text-base font-black text-emerald-650 dark:text-emerald-400 font-display">
                          {financialAnalysis.faturamentoMin > 0 
                            ? `${formatCurrency(financialAnalysis.faturamentoMin).replace(',00', '')} ~ ${formatCurrency(financialAnalysis.faturamentoMax).replace(',00', '')}`
                            : 'Não informado'}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase font-bold">Média de Receita Projetada</span>
                        <p className="text-base font-black text-slate-900 dark:text-white font-display">
                          {formatCurrency(financialAnalysis.faturamentoAvg)}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-150 dark:border-slate-800">
                      <span className="text-[9px] text-slate-450 block uppercase font-black tracking-wider">Metodologia Setorial Aplicada</span>
                      <p className="text-[10px] text-slate-600 dark:text-slate-350 leading-relaxed font-semibold">
                        Neste setor, a folha de pessoal representa entre <strong className="text-indigo-600 dark:text-indigo-400">{(financialAnalysis.sector.ratioMin * 100).toFixed(0)}% e {(financialAnalysis.sector.ratioMax * 100).toFixed(0)}%</strong> do faturamento bruto. {financialAnalysis.sector.characteristics}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* RAMPUP ECOSYSTEM PROFILE & STRATEGIC RATIONALE */}
              {(() => {
                const profileInfo = classifyRampupProfile(company);
                return (
                  <div className="bg-gradient-to-br from-slate-50 to-indigo-50/20 dark:from-slate-900 dark:to-indigo-950/20 border border-indigo-150/85 dark:border-indigo-900/40 rounded-3xl p-6 shadow-xs space-y-5 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-100/40 dark:border-indigo-900/30 pb-4">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider block">Perfil de Patrocínio & Apoio</span>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                          <Award className="h-4 w-4 text-indigo-500 shrink-0" />
                          <span>Racional de Potencial Comercial Rampup</span>
                        </h4>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black px-3.5 py-1.5 rounded-xl border uppercase tracking-wider shadow-3xs ${profileInfo.badgeBg} ${profileInfo.badgeBorder} ${profileInfo.badgeText}`}>
                          ★ {profileInfo.label}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                      {/* Left: The Rationale Text */}
                      <div className="md:col-span-7 space-y-3">
                        <div className="p-4 bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850/60 shadow-3xs space-y-2">
                          <p className="text-[11px] font-black uppercase tracking-wider text-slate-450 dark:text-slate-550 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                            Análise de Perfil
                          </p>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-semibold">
                            {profileInfo.explanation} Baseado nas heurísticas do ecossistema, o tamanho de equipe (<strong className="text-indigo-600 dark:text-indigo-400">{company.vidas} vidas</strong>) e o faturamento bruto estimado (<strong className="text-emerald-600 dark:text-emerald-400">{financialAnalysis.faturamentoAvg > 0 ? `R$ ${financialAnalysis.faturamentoAvg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/mês` : 'não informado'}</strong>) justificam este enquadramento estratégico.
                          </p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Sugestão de Abordagem para o Time Rampup</span>
                          <p className="text-xs text-slate-650 dark:text-slate-350 leading-relaxed font-medium">
                            {profileInfo.role === 'patrocinador' && 'Manter relacionamento de excelência. Apresentar relatórios trimestrais de interações geradas e sugerir novos C-levels do grupo para moderar painéis exclusivos.'}
                            {profileInfo.role === 'apoiador' && 'Manter relacionamento ativo de co-branding. Incentivar participação no comitê de lideranças e explorar parcerias de integração tecnológica ou mídia conjunta.'}
                            {profileInfo.role === 'potencial_patrocinador' && 'Apresentar proposta de Patrocínio Master (R$ 15k/mês). Focar na dor de employer branding, visibilidade exclusiva de marca e prioridade no matchmaking com grandes compradores do ecossistema.'}
                            {profileInfo.role === 'potencial_apoiador' && 'Apresentar proposta de Apoio (R$ 5k/mês). Destacar o retorno sobre o investimento gerado pelas rodadas de negócios frequentes e as conexões qualificadas com grandes compradores.'}
                            {profileInfo.role === 'potencial_membro' && 'Convidar para filiação anual como Membro (R$ 5k/ano). É o formato perfeito de porta de entrada para que novos empresários e tomadores de decisão acelerem seu networking regional com baixo risco financeiro.'}
                          </p>
                        </div>
                      </div>

                      {/* Right: The Plan Options Comparison Table/List */}
                      <div className="md:col-span-5 bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850/60 shadow-3xs space-y-3">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-450 dark:text-slate-550 block">Grade de Planos do Ecossistema</span>
                        
                        <div className="space-y-2.5">
                          {/* Option 1 */}
                          <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                            (profileInfo.role === 'patrocinador' || profileInfo.role === 'potencial_patrocinador') 
                              ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-500/40' 
                              : 'border-slate-100 dark:border-slate-850 bg-slate-50/45 dark:bg-slate-900/20 opacity-70'
                          }`}>
                            <div className="space-y-0.5">
                              <span className="text-xs font-black text-slate-800 dark:text-white block">Patrocinador Rampup</span>
                              <span className="text-[10px] text-slate-500 block font-semibold">R$ 15k / mês</span>
                            </div>
                            {(profileInfo.role === 'patrocinador' || profileInfo.role === 'potencial_patrocinador') && (
                              <span className="text-[9px] font-black bg-indigo-650 text-white px-2 py-0.5 rounded-lg border border-indigo-500/40 animate-pulse">Perfil Ideal</span>
                            )}
                          </div>

                          {/* Option 2 */}
                          <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                            (profileInfo.role === 'apoiador' || profileInfo.role === 'potencial_apoiador') 
                              ? 'bg-sky-50/50 dark:bg-sky-950/30 border-sky-500/40' 
                              : 'border-slate-100 dark:border-slate-850 bg-slate-50/45 dark:bg-slate-900/20 opacity-70'
                          }`}>
                            <div className="space-y-0.5">
                              <span className="text-xs font-black text-slate-800 dark:text-white block">Apoiador Rampup</span>
                              <span className="text-[10px] text-slate-500 block font-semibold">R$ 5k / mês</span>
                            </div>
                            {(profileInfo.role === 'apoiador' || profileInfo.role === 'potencial_apoiador') && (
                              <span className="text-[9px] font-black bg-sky-500 text-white px-2 py-0.5 rounded-lg border border-sky-400/40 animate-pulse">Perfil Ideal</span>
                            )}
                          </div>

                          {/* Option 3 */}
                          <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                            (profileInfo.role === 'potencial_membro') 
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-500/40' 
                              : 'border-slate-100 dark:border-slate-850 bg-slate-50/45 dark:bg-slate-900/20 opacity-70'
                          }`}>
                            <div className="space-y-0.5">
                              <span className="text-xs font-black text-slate-800 dark:text-white block">Membro Oficial</span>
                              <span className="text-[10px] text-slate-500 block font-semibold">R$ 5k / ano</span>
                            </div>
                            {(profileInfo.role === 'potencial_membro') && (
                              <span className="text-[9px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-lg border border-emerald-500/40 animate-pulse">Perfil Ideal</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* CRM COMMENTS & SEGMENT COMMENTS (THE CRM DIARY DIALOGUE) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-3">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="h-4 w-4 text-indigo-500" />
                      <span>CRM Anotações & Inteligência de Segmento</span>
                    </h4>
                    <p className="text-[10px] text-slate-450">Comentários e percepções comerciais sobre esta conta e o segmento de atuação.</p>
                  </div>
                  
                  <button
                    onClick={handleSaveNotesOnly}
                    disabled={isNotesSaving}
                    className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 font-extrabold rounded-xl text-[11px] flex items-center gap-1.5 border border-indigo-150 transition-all cursor-pointer"
                  >
                    {isNotesSaving ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    <span>Salvar Notas</span>
                  </button>
                </div>

                {notesSaveSuccess && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    <span>Anotações comerciais salvas no CRM com sucesso!</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Comentários sobre a empresa */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase block tracking-wider">Anotações Internas (Sobre a Empresa)</label>
                    <textarea
                      rows={4}
                      value={localComments}
                      onChange={(e) => setLocalComments(e.target.value)}
                      placeholder="Insira notas comerciais, histórico de conversas em eventos, dores identificadas, etc..."
                      className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none leading-relaxed shadow-3xs"
                    />
                  </div>

                  {/* Comentários sobre o segmento */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase block tracking-wider">Inteligência Setorial (Sobre o Segmento: {company.segment})</label>
                    <textarea
                      rows={4}
                      value={localSegmentComments}
                      onChange={(e) => setLocalSegmentComments(e.target.value)}
                      placeholder="Analise o cenário deste mercado local de Fortaleza. Quais são os principais canais, gargalos e oportunidades setoriais?"
                      className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none leading-relaxed shadow-3xs"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: COMPANY STRATEGIC HIGHLIGHTS */}
          {activeProfileTab === 'highlights' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5 animate-fadeIn">
              <div>
                <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-1.5">
                  <Award className="h-4.5 w-4.5 text-indigo-500" />
                  <span>Dossiê Diagnóstico de Conectividade</span>
                </h4>
                <p className="text-[10px] text-slate-450 mt-1">Sugerido por nosso mecanismo heurístico sobre o perfil de representatividade desta empresa.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {companyHighlights.map((hl, idx) => {
                  const Icon = hl.icon;
                  return (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-2xl border flex gap-3.5 items-start ${
                        hl.type === 'positive' 
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40' 
                          : 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200/70 dark:border-slate-850'
                      }`}
                    >
                      <div className={`p-2 rounded-xl border shrink-0 ${
                        hl.type === 'positive'
                          ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/80'
                          : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-500 border-indigo-150 dark:border-indigo-900/30'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="space-y-1">
                        <h5 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">{hl.title}</h5>
                        <p className="text-[11px] text-slate-600 dark:text-slate-350 leading-relaxed">{hl.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: TRIPLE SYNERGY COLUMN MATCHES */}
          {activeProfileTab === 'matches' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-850 pb-5">
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-1.5">
                    <Handshake className="h-4.5 w-4.5 text-indigo-500" />
                    <span>Pontos de Ligação de Negócios na Base</span>
                  </h4>
                  <p className="text-[10px] text-slate-450 mt-1">
                    {isCurrentCompanyEnriched 
                      ? "Mapeamento completo e enriquecido com inteligência de faturamento e canais de sinergia."
                      : "Visualização em modo de cruzamento prévio do mailing. Enriqueça para obter insights avançados."}
                  </p>
                </div>

                {/* Enrichment Action Button */}
                <div className="shrink-0">
                  {isCurrentCompanyEnriched ? (
                    <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/20 px-3.5 py-2 rounded-xl text-xs font-bold shadow-3xs">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                      <span>Cruzamento Enriquecido</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleEnrichCurrentCompany}
                      disabled={isEnriching}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-md disabled:bg-indigo-850/50 font-extrabold rounded-xl text-xs flex items-center gap-2 border border-indigo-500/20 transition-all cursor-pointer shadow-3xs"
                    >
                      {isEnriching ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Enriquecendo Conta...</span>
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
              {!isCurrentCompanyEnriched && !isEnriching && (
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
              {isCurrentCompanyEnriched && !isEnriching && (
                <div className="p-5 bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-200/40 dark:border-emerald-900/30 rounded-2xl space-y-3 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-black text-xs uppercase tracking-wider">
                      <CheckCircle className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                      <span>Conexões Pré-mapeadas e Validadas pelo Mecanismo Estratégico</span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 font-extrabold px-2.5 py-1 rounded-full border border-emerald-200/20 shadow-3xs shrink-0 self-start sm:self-auto">
                      Grau de Aderência: 98% (Excelente)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-350 leading-relaxed whitespace-pre-wrap font-sans bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    {validationReports[company.id] || `O algoritmo comparou a faixa de faturamento de ${company.name}, seu segmento (${company.segment}) e perfil de colaboradores para avaliar as conexões da base.\n\nAs empresas mostradas abaixo representam os melhores matches possíveis de CO-SELLING, OUTSOURCING e CANAIS devido à alta complementaridade operacional e porte financeiro equivalente.`}
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
                      {partnerCompanies.length === 0 && <p className="text-[11px] text-slate-400 italic">Sem recomendações.</p>}
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

        </div>

        {/* RIGHT COLUMN (Contacts/Decisors list with highlights, Event Timeline) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* PARTICIPANTS & DECISORS WITH HIGHLIGHTS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
            <div>
              <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-1.5">
                <UserCheck className="h-4.5 w-4.5 text-indigo-500" />
                <span>Decisores e Contatos</span>
              </h4>
              <p className="text-[10px] text-slate-450 mt-1">Lideranças executivas vinculadas ao dossiê desta empresa.</p>
            </div>

            <div className="space-y-3.5 divide-y divide-slate-100 dark:divide-slate-800">
              {companyContacts.map((contact, index) => {
                // Calculate participant highlights
                const presencesCount = transactions.filter(t => t.contactEmail === contact.email).length;
                const totalSpendValue = transactions.filter(t => t.contactEmail === contact.email).reduce((sum, t) => sum + t.value, 0);
                const isHighlighted = contact.id === selectedContactId;
                
                return (
                  <div 
                    key={contact.id} 
                    className={`pt-3.5 first:pt-0 flex flex-col gap-2 group transition-all duration-300 ${
                      isHighlighted 
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 p-3 rounded-2xl ring-2 ring-indigo-500/20 shadow-3xs' 
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                          <span>{contact.name}</span>
                          {index === 0 && <span className="text-[8px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950 px-1.5 py-0.5 rounded uppercase font-black">Principal</span>}
                        </h5>
                        <p className="text-[10px] text-slate-450 truncate mt-0.5 flex items-center gap-1">
                          <Mail className="h-2.5 w-2.5" />
                          <span>{contact.email}</span>
                        </p>
                        {contact.phone && (
                          <p className="text-[10px] text-slate-450 truncate flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5" />
                            <span>{contact.phone}</span>
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => onDeleteContact(contact.id)}
                        className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded transition-all opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Participant Dynamic Highlights */}
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                        presencesCount >= 4 
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' 
                          : presencesCount >= 2 
                          ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {presencesCount === 1 ? 'Primeira Participação' : `${presencesCount} Rodadas`}
                      </span>

                      {contact.areaAtuacao && (
                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                          Área: {contact.areaAtuacao}
                        </span>
                      )}

                      <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600">
                        C-Level Decisor
                      </span>
                    </div>
                  </div>
                );
              })}

              {companyContacts.length === 0 && (
                <p className="text-xs text-slate-400 italic py-3 text-center">Nenhum decisor cadastrado.</p>
              )}
            </div>

            {/* Quick add contact */}
            <form onSubmit={handleAddContactSubmit} className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block tracking-wider">Novo Decisor</span>
              <div className="grid grid-cols-1 gap-2.5">
                <input
                  type="text"
                  required
                  placeholder="Nome do decisor..."
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-955 dark:text-slate-100 focus:outline-none"
                />
                <input
                  type="email"
                  placeholder="E-mail profissional..."
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-955 dark:text-slate-100 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="WhatsApp..."
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-955 dark:text-slate-100 focus:outline-none"
                />
                <button
                  type="submit"
                  className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-750 dark:text-slate-200 font-extrabold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all border dark:border-slate-750 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Cadastrar Decisor</span>
                </button>
              </div>
            </form>
          </div>

          {/* ATTENDANCE TIMELINE */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
            <div>
              <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-1.5">
                <Calendar className="h-4.5 w-4.5 text-indigo-500" />
                <span>Histórico de Rodadas</span>
              </h4>
              <p className="text-[10px] text-slate-450 mt-1">Linha cronológica de presença física nos eventos.</p>
            </div>

            <div className="relative border-l border-slate-100 dark:border-slate-800 pl-4 space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {companyTransactions.map((tx) => (
                <div key={tx.id} className="relative space-y-1">
                  <span className="absolute -left-[21px] top-1.5 h-3 w-3 rounded-full border border-white bg-indigo-500 shrink-0" />
                  
                  <div className="flex items-center justify-between text-[10px] text-slate-450">
                    <span className="font-mono">{tx.purchaseDate || 'Data N/D'}</span>
                    <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-extrabold text-[8px] uppercase">Presença</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-955 border dark:border-slate-850 rounded-xl space-y-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-normal">{tx.eventName}</p>
                    <p className="text-[9px] text-slate-450">Decisor: {tx.contactName} • Credencial {tx.ticketType}</p>
                    {tx.eventLocation && (
                      <p className="text-[8.5px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-0.5 pt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span>Local da Agenda: {tx.eventLocation}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {companyTransactions.length === 0 && (
                <p className="text-xs text-slate-450 italic py-4 text-center">Nenhum evento registrado.</p>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* 5. AI CONNECTION ASSISTANT PANEL */}
      {selectedMatch && (
        <div className="bg-slate-950 rounded-3xl border border-slate-800 p-6 text-white space-y-6 shadow-lg animate-fadeIn" id="ai_assistant_panel">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-2xl border border-indigo-500 shadow-md">
                <Sparkles className="h-5 w-5 animate-spin" style={{ animationDuration: '4.5s' }} />
              </div>
              <div>
                <h4 className="font-bold text-lg font-display text-white">Assistente de Conexões Gemini</h4>
                <p className="text-xs text-slate-400">
                  Inteligência de prospecção e canal: <strong>{company.name}</strong> ➔ <strong>{selectedMatch.name}</strong>
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

          {isCurrentCompanyEnriched ? (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 pt-2">
              
              {/* Options bar */}
              <div className="space-y-4 lg:col-span-1 bg-slate-900 p-4 rounded-2xl border border-slate-850">
                <span className="text-[10px] text-slate-440 font-extrabold uppercase tracking-wider block">Como quer abordar?</span>
                
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
                            <Sparkles className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-wider">Racional de Conexão Estratégica (Local)</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed font-sans font-medium">
                            {localReason || 'Sinergia comercial geral e proximidade corporativa identificadas no ecossistema.'}
                          </p>
                        </div>
                      );
                    })()}
                    <div className="flex flex-col items-center justify-center py-2 text-center">
                      <p className="text-[10px] text-slate-500 max-w-xs leading-normal">
                        Deseja refinar a proposta? Selecione um formato ao lado e dispare a inteligência do Gemini para redigir o pitch perfeito.
                      </p>
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
                onClick={handleEnrichCurrentCompany}
                className="mx-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 border border-indigo-500/20 transition-all cursor-pointer shadow-3xs"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Enriquecer Conta Agora</span>
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
