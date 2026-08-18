import React, { useState, useEffect, useMemo } from 'react';
import { Company, Contact, Transaction, CustomFieldConfig } from './types';
import Dashboard from './components/Dashboard';
import ConnectionsGraph from './components/ConnectionsGraph';
import CompanyProfile from './components/CompanyProfile';
import ContactProfile from './components/ContactProfile';
import CompanyForm from './components/CompanyForm';
import AIChatDatabase from './components/AIChatDatabase';
import MailingImporter from './components/MailingImporter';
import AgendaPanorama from './components/AgendaPanorama';
import { classifyCompanySize, calculateFinancialAnalysis, getSimilarSegmentGroup, classifyRampupProfile } from './utils/strategicHelpers';
import { exportCompaniesToCSV, exportCompaniesToPDF, exportFullBaseToExcel, exportSingleCompanyToPDF } from './utils/exportHelpers';
import { 
  Building2, Users, LayoutDashboard, Network, Settings, Plus, Search, 
  Trash2, X, Filter, Sparkles, TrendingUp, ChevronRight, SlidersHorizontal,
  Sun, Moon, Zap, Upload, Calendar
} from 'lucide-react';

export default function App() {
  // Global Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('crm-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      document.body.style.backgroundColor = '#0b0f19';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      document.body.style.backgroundColor = '#f8fafc';
    }
    localStorage.setItem('crm-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Database States
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldConfig[]>([]);

  // AI Analysis Execution Gating State
  const [isAnalysisExecuted, setIsAnalysisExecuted] = useState<boolean>(() => {
    return localStorage.getItem('crm-analysis-executed') === 'true';
  });

  const triggerAnalysisRun = () => {
    setIsAnalysisExecuted(true);
    localStorage.setItem('crm-analysis-executed', 'true');
  };

  const resetAnalysisRun = () => {
    setIsAnalysisExecuted(false);
    localStorage.setItem('crm-analysis-executed', 'false');
  };

  // UI Control States
  const [activeTab, setActiveTab] = useState<'dashboard' | 'companies' | 'constellation' | 'ai-chat' | 'import-mailing' | 'agenda-panorama'>('dashboard');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [directoryMode, setDirectoryMode] = useState<'companies' | 'contacts'>('companies');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [vidasFilter, setVidasFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [faturamentoFilter, setFaturamentoFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'none' | 'az' | 'za'>('none');
  const [futebolFilter, setFutebolFilter] = useState('');
  const [areaAtuacaoFilter, setAreaAtuacaoFilter] = useState('');
  const [politicaFilter, setPoliticaFilter] = useState('');
  const [musicaFilter, setMusicaFilter] = useState('');
  const [rampupFilter, setRampupFilter] = useState('');

  // Fetch full DB on startup
  const fetchDB = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/db');
      if (!res.ok) throw new Error('Erro ao buscar dados do CRM.');
      const data = await res.json();
      setCompanies(data.companies || []);
      setContacts(data.contacts || []);
      setTransactions(data.transactions || []);
      setCustomFields(data.customFields || []);
      if (!data.companies || data.companies.length === 0) {
        setActiveTab('import-mailing');
        resetAnalysisRun();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao carregar conexões.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDB();
  }, []);

  // --- CRUD FUNCTIONS ---

  // Create Company
  const handleCreateCompany = async (newComp: Company) => {
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newComp)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao salvar empresa.');
      }
      const saved = await res.json();
      setCompanies(prev => [saved, ...prev]);
      setIsFormOpen(false);
      setSelectedCompany(saved);
      setActiveTab('companies');
    } catch (err: any) {
      alert(`Falha ao registrar empresa: ${err.message}`);
    }
  };

  // Update Company
  const handleUpdateCompany = async (updatedComp: Company) => {
    try {
      const res = await fetch(`/api/companies/${updatedComp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedComp)
      });
      if (!res.ok) throw new Error('Erro ao atualizar empresa.');
      const saved = await res.json();
      setCompanies(prev => prev.map(c => c.id === saved.id ? saved : c));
      setSelectedCompany(saved);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete Company
  const handleDeleteCompany = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Deseja realmente excluir esta empresa? Isso removerá permanentemente todos os contatos e ingressos dela.')) return;

    try {
      const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao excluir empresa.');
      setCompanies(prev => prev.filter(c => c.id !== id));
      setContacts(prev => prev.filter(c => c.companyId !== id));
      setTransactions(prev => prev.filter(t => t.companyId !== id));
      if (selectedCompany?.id === id) {
        setSelectedCompany(null);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Create Contact
  const handleAddContact = async (contact: Contact) => {
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contact)
      });
      if (!res.ok) throw new Error('Falha ao registrar contato.');
      const saved = await res.json();
      setContacts(prev => [...prev, saved]);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete Contact
  const handleDeleteContact = async (id: string) => {
    if (!confirm('Excluir este contato do sistema?')) return;
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao deletar contato.');
      setContacts(prev => prev.filter(c => c.id !== id));
      if (selectedContactId === id) {
        setSelectedContactId(null);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Update Contact
  const handleUpdateContact = async (updatedContact: Contact) => {
    try {
      const res = await fetch(`/api/contacts/${updatedContact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedContact)
      });
      if (!res.ok) throw new Error('Erro ao atualizar contato.');
      const saved = await res.json();
      setContacts(prev => prev.map(c => c.id === saved.id ? saved : c));
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Create Custom Field Config
  const handleCreateCustomField = async (config: CustomFieldConfig) => {
    try {
      const res = await fetch('/api/custom-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (!res.ok) throw new Error('Erro ao registrar campo customizado.');
      const saved = await res.json();
      setCustomFields(prev => [...prev, saved]);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete Custom Field Config
  const handleDeleteCustomField = async (id: string) => {
    if (!confirm('Deseja excluir este campo customizado? Todos os valores preenchidos em todas as fichas serão limpos permanentemente.')) return;
    try {
      const res = await fetch(`/api/custom-fields/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao remover configuração.');
      setCustomFields(prev => prev.filter(cf => cf.id !== id));
      // Re-fetch database to get clean state values
      fetchDB();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Restore complete database backup
  const handleRestoreBackup = async (backupData: any): Promise<boolean> => {
    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao restaurar backup.');
      }
      await fetchDB();
      return true;
    } catch (err: any) {
      alert(`Falha ao restaurar backup: ${err.message}`);
      return false;
    }
  };


  // --- FILTERS LOGIC ---

  // Get unique lists for filter dropdowns
  const uniqueSegments = Array.from(new Set(companies.map(c => getSimilarSegmentGroup(c.segment)))).sort();
  const uniqueLocations = Array.from(new Set(companies.map(c => c.location))).sort();
  const uniqueEvents = Array.from(new Set(transactions.map(t => t.eventName))).sort();

  const uniqueFutebol = useMemo(() => {
    const list = new Set<string>();
    companies.forEach(c => { if (c.futebol) list.add(c.futebol); });
    contacts.forEach(c => { if (c.futebol) list.add(c.futebol); });
    return Array.from(list).filter(Boolean).sort();
  }, [companies, contacts]);

  const uniqueAreaAtuacao = useMemo(() => {
    const list = new Set<string>();
    companies.forEach(c => { if (c.areaAtuacao) list.add(c.areaAtuacao); });
    contacts.forEach(c => { if (c.areaAtuacao) list.add(c.areaAtuacao); });
    return Array.from(list).filter(Boolean).sort();
  }, [companies, contacts]);

  const uniquePolitica = useMemo(() => {
    const list = new Set<string>();
    companies.forEach(c => { if (c.politica) list.add(c.politica); });
    contacts.forEach(c => { if (c.politica) list.add(c.politica); });
    return Array.from(list).filter(Boolean).sort();
  }, [companies, contacts]);

  const uniqueMusica = useMemo(() => {
    const list = new Set<string>();
    companies.forEach(c => { if (c.musica) list.add(c.musica); });
    contacts.forEach(c => { if (c.musica) list.add(c.musica); });
    return Array.from(list).filter(Boolean).sort();
  }, [companies, contacts]);

  // Filtered and sorted companies
  const filteredCompanies = useMemo(() => {
    let result = companies.filter(company => {
      // 1. Text Search
      const text = searchQuery.toLowerCase();
      const matchesText = 
        company.name.toLowerCase().includes(text) ||
        company.segment.toLowerCase().includes(text) ||
        getSimilarSegmentGroup(company.segment).toLowerCase().includes(text) ||
        (company.description || '').toLowerCase().includes(text) ||
        (company.activity || '').toLowerCase().includes(text) ||
        (company.futebol || '').toLowerCase().includes(text) ||
        (company.areaAtuacao || '').toLowerCase().includes(text) ||
        (company.politica || '').toLowerCase().includes(text) ||
        (company.musica || '').toLowerCase().includes(text) ||
        contacts.some(c => c.companyId === company.id && (
          c.name.toLowerCase().includes(text) ||
          (c.futebol || '').toLowerCase().includes(text) ||
          (c.areaAtuacao || '').toLowerCase().includes(text) ||
          (c.politica || '').toLowerCase().includes(text) ||
          (c.musica || '').toLowerCase().includes(text)
        ));

      // 2. Segment (grouped similar)
      const matchesSegment = !segmentFilter || getSimilarSegmentGroup(company.segment) === segmentFilter;

      // 3. Location (retained in logic but retired in UI)
      const matchesLocation = !locationFilter || company.location === locationFilter;

      // 4. Vidas (Employees)
      let matchesVidas = true;
      if (vidasFilter) {
        if (vidasFilter === 'Pequena') matchesVidas = company.vidas >= 10 && company.vidas <= 30;
        else if (vidasFilter === 'Media') matchesVidas = company.vidas > 30 && company.vidas <= 70;
        else if (vidasFilter === 'Grande') matchesVidas = company.vidas > 70 && company.vidas <= 500;
        else if (vidasFilter === 'BIG') matchesVidas = company.vidas > 500;
      }

      // 4.5 Faturamento Estimado
      let matchesFaturamento = true;
      if (faturamentoFilter) {
        const financialAnalysis = calculateFinancialAnalysis(company.vidas, company.segment, company);
        const fat = financialAnalysis.faturamentoAvg;
        if (faturamentoFilter === 'Ate100k') matchesFaturamento = fat <= 100000;
        else if (faturamentoFilter === '100k-500k') matchesFaturamento = fat > 100000 && fat <= 500000;
        else if (faturamentoFilter === '500k-2M') matchesFaturamento = fat > 500000 && fat <= 2000000;
        else if (faturamentoFilter === 'Mais2M') matchesFaturamento = fat > 2000000;
      }

      // 5. Attended Event
      const matchesEvent = !eventFilter || transactions.some(t => t.companyId === company.id && t.eventName === eventFilter);

      // Mailing Extra Filters
      const matchesFutebol = !futebolFilter || company.futebol === futebolFilter || contacts.some(c => c.companyId === company.id && c.futebol === futebolFilter);
      const matchesAreaAtuacao = !areaAtuacaoFilter || company.areaAtuacao === areaAtuacaoFilter || contacts.some(c => c.companyId === company.id && c.areaAtuacao === areaAtuacaoFilter);
      const matchesPolitica = !politicaFilter || company.politica === politicaFilter || contacts.some(c => c.companyId === company.id && c.politica === politicaFilter);
      const matchesMusica = !musicaFilter || company.musica === musicaFilter || contacts.some(c => c.companyId === company.id && c.musica === musicaFilter);

      // Potencial Rampup Filter
      let matchesRampup = true;
      if (rampupFilter) {
        const profile = classifyRampupProfile(company);
        if (rampupFilter === 'membro') {
          matchesRampup = profile.role === 'membro' || profile.role === 'potencial_membro';
        } else if (rampupFilter === 'apoiador') {
          matchesRampup = profile.role === 'apoiador' || profile.role === 'potencial_apoiador';
        } else if (rampupFilter === 'patrocinador') {
          matchesRampup = profile.role === 'patrocinador' || profile.role === 'potencial_patrocinador';
        }
      }

      return matchesText && matchesSegment && matchesLocation && matchesVidas && matchesFaturamento && matchesEvent && matchesFutebol && matchesAreaAtuacao && matchesPolitica && matchesMusica && matchesRampup;
    });

    if (sortOrder === 'az') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    } else if (sortOrder === 'za') {
      result = [...result].sort((a, b) => b.name.localeCompare(a.name, 'pt-BR'));
    }

    return result;
  }, [companies, searchQuery, segmentFilter, locationFilter, vidasFilter, faturamentoFilter, eventFilter, sortOrder, contacts, transactions, futebolFilter, areaAtuacaoFilter, politicaFilter, musicaFilter, rampupFilter]);

  // Filtered and sorted contacts (entrepreneurs)
  const filteredContacts = useMemo(() => {
    let result = contacts.filter(contact => {
      const comp = companies.find(c => c.id === contact.companyId);
      
      // 1. Text Search
      const text = searchQuery.toLowerCase();
      const matchesText = 
        contact.name.toLowerCase().includes(text) ||
        (contact.email || '').toLowerCase().includes(text) ||
        (contact.phone || '').toLowerCase().includes(text) ||
        (contact.futebol || '').toLowerCase().includes(text) ||
        (contact.areaAtuacao || '').toLowerCase().includes(text) ||
        (contact.politica || '').toLowerCase().includes(text) ||
        (contact.musica || '').toLowerCase().includes(text) ||
        (comp ? comp.name.toLowerCase().includes(text) : false) ||
        (comp ? comp.segment.toLowerCase().includes(text) : false);

      // 2. Segment (grouped similar)
      const matchesSegment = !segmentFilter || (comp ? getSimilarSegmentGroup(comp.segment) === segmentFilter : false);

      // 3. Location (retained in logic)
      const matchesLocation = !locationFilter || (comp ? comp.location === locationFilter : false);

      // 4. Vidas (Employees)
      let matchesVidas = true;
      if (vidasFilter && comp) {
        if (vidasFilter === 'Pequena') matchesVidas = comp.vidas >= 10 && comp.vidas <= 30;
        else if (vidasFilter === 'Media') matchesVidas = comp.vidas > 30 && comp.vidas <= 70;
        else if (vidasFilter === 'Grande') matchesVidas = comp.vidas > 70 && comp.vidas <= 500;
        else if (vidasFilter === 'BIG') matchesVidas = comp.vidas > 500;
      } else if (vidasFilter && !comp) {
        matchesVidas = false;
      }

      // 4.5 Faturamento Estimado
      let matchesFaturamento = true;
      if (faturamentoFilter && comp) {
        const financialAnalysis = calculateFinancialAnalysis(comp.vidas, comp.segment, comp);
        const fat = financialAnalysis.faturamentoAvg;
        if (faturamentoFilter === 'Ate100k') matchesFaturamento = fat <= 100000;
        else if (faturamentoFilter === '100k-500k') matchesFaturamento = fat > 100000 && fat <= 500000;
        else if (faturamentoFilter === '500k-2M') matchesFaturamento = fat > 500000 && fat <= 2000000;
        else if (faturamentoFilter === 'Mais2M') matchesFaturamento = fat > 2000000;
      } else if (faturamentoFilter && !comp) {
        matchesFaturamento = false;
      }

      // 5. Attended Event
      const matchesEvent = !eventFilter || transactions.some(t => t.contactEmail === contact.email && t.eventName === eventFilter);

      // Mailing Extra Filters
      const matchesFutebol = !futebolFilter || contact.futebol === futebolFilter || (comp ? comp.futebol === futebolFilter : false);
      const matchesAreaAtuacao = !areaAtuacaoFilter || contact.areaAtuacao === areaAtuacaoFilter || (comp ? comp.areaAtuacao === areaAtuacaoFilter : false);
      const matchesPolitica = !politicaFilter || contact.politica === politicaFilter || (comp ? comp.politica === politicaFilter : false);
      const matchesMusica = !musicaFilter || contact.musica === musicaFilter || (comp ? comp.musica === musicaFilter : false);

      // Potencial Rampup Filter
      let matchesRampup = true;
      if (rampupFilter && comp) {
        const profile = classifyRampupProfile(comp);
        if (rampupFilter === 'membro') {
          matchesRampup = profile.role === 'membro' || profile.role === 'potencial_membro';
        } else if (rampupFilter === 'apoiador') {
          matchesRampup = profile.role === 'apoiador' || profile.role === 'potencial_apoiador';
        } else if (rampupFilter === 'patrocinador') {
          matchesRampup = profile.role === 'patrocinador' || profile.role === 'potencial_patrocinador';
        }
      } else if (rampupFilter && !comp) {
        matchesRampup = false;
      }

      return matchesText && matchesSegment && matchesLocation && matchesVidas && matchesFaturamento && matchesEvent && matchesFutebol && matchesAreaAtuacao && matchesPolitica && matchesMusica && matchesRampup;
    });

    if (sortOrder === 'az') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    } else if (sortOrder === 'za') {
      result = [...result].sort((a, b) => b.name.localeCompare(a.name, 'pt-BR'));
    }

    return result;
  }, [contacts, companies, searchQuery, segmentFilter, locationFilter, vidasFilter, faturamentoFilter, eventFilter, sortOrder, transactions, futebolFilter, areaAtuacaoFilter, politicaFilter, musicaFilter, rampupFilter]);

  const clearFilters = () => {
    setSearchQuery('');
    setSegmentFilter('');
    setLocationFilter('');
    setVidasFilter('');
    setEventFilter('');
    setFaturamentoFilter('');
    setFutebolFilter('');
    setAreaAtuacaoFilter('');
    setPoliticaFilter('');
    setMusicaFilter('');
    setRampupFilter('');
    setSortOrder('none');
  };

  const selectedContact = contacts.find(c => c.id === selectedContactId);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f19] text-slate-800 dark:text-slate-100 font-sans antialiased transition-colors duration-300" id="main_app_layout">
      {/* Top Banner / Navbar */}
      <header className="bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800/80 sticky top-0 z-40 shadow-xs px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setActiveTab('dashboard'); setSelectedCompany(null); }}>
          <div className="h-10 w-10 bg-indigo-600 dark:bg-indigo-700 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm">
            RBI
          </div>
          <div>
            <h1 className="font-display font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
              RBI - CRM Inteligente
            </h1>
          </div>
        </div>

        {/* Global tab selector */}
        <nav className="flex space-x-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-transparent dark:border-slate-800 overflow-x-auto max-w-full no-scrollbar shrink-0 scrollbar-none">
          <button
            onClick={() => { setActiveTab('dashboard'); setSelectedCompany(null); }}
            className={`flex items-center shrink-0 space-x-1.5 py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </button>
          
          <button
            onClick={() => { setActiveTab('companies'); }}
            className={`flex items-center shrink-0 space-x-1.5 py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'companies'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Empresas & Clientes</span>
          </button>

          <button
            onClick={() => { setActiveTab('constellation'); }}
            className={`flex items-center shrink-0 space-x-1.5 py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'constellation'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Network className="h-3.5 w-3.5" />
            <span>Constelação</span>
          </button>

          <button
            onClick={() => { setActiveTab('ai-chat'); setSelectedCompany(null); }}
            className={`flex items-center shrink-0 space-x-1.5 py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ai-chat'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
            <span>Conversar com IA (Database)</span>
          </button>

          <button
            onClick={() => { setActiveTab('agenda-panorama'); setSelectedCompany(null); }}
            className={`flex items-center shrink-0 space-x-1.5 py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'agenda-panorama'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Panorama de Agendas</span>
          </button>

          <button
            onClick={() => { setActiveTab('import-mailing'); setSelectedCompany(null); }}
            className={`flex items-center shrink-0 space-x-1.5 py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'import-mailing'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Importar Mailing</span>
          </button>
        </nav>

        <div className="flex items-center space-x-2.5">
          {/* Header Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-3xs"
            title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-600" />}
          </button>

          <button
            onClick={() => setIsFormOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Cadastrar Empresa</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Loading / Error overlay */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500 font-bold animate-pulse">Sincronizando banco de conexões da Rampup...</p>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-xl text-sm flex items-center space-x-2">
            <X className="h-5 w-5 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Dynamic Views Rendering */}
        {!isLoading && !errorMsg && (
          <>
            {/* 1. DASHBOARD VIEW */}
            {activeTab === 'dashboard' && (
              <Dashboard 
                companies={companies}
                contactsCount={contacts.length}
                transactions={transactions}
                onSelectCompany={(comp) => { setSelectedCompany(comp); setActiveTab('companies'); }}
                theme={theme}
                onToggleTheme={toggleTheme}
                isAnalysisExecuted={isAnalysisExecuted}
                contacts={contacts}
                customFields={customFields}
              />
            )}

            {/* 2. CONSTELLATION GRAPH VIEW */}
            {activeTab === 'constellation' && (
              <ConnectionsGraph
                companies={companies}
                contacts={contacts}
                transactions={transactions}
                selectedCompany={selectedCompany}
                onSelectCompany={(comp) => setSelectedCompany(comp)}
                isAnalysisExecuted={isAnalysisExecuted}
                triggerAnalysisRun={triggerAnalysisRun}
              />
            )}

            {/* 3. AI DATABASE INTELLIGENCE CHAT */}
            {activeTab === 'ai-chat' && (
              <AIChatDatabase
                companies={companies}
                transactions={transactions}
                contactsCount={contacts.length}
              />
            )}

            {/* 4.1. AGENDA PANORAMA DASHBOARD */}
            {activeTab === 'agenda-panorama' && (
              <AgendaPanorama
                companies={companies}
                transactions={transactions}
                contactsCount={contacts.length}
                isAnalysisExecuted={isAnalysisExecuted}
                triggerAnalysisRun={triggerAnalysisRun}
              />
            )}

            {/* 4.5. MAILING IMPORTER VIEW */}
            {activeTab === 'import-mailing' && (
              <MailingImporter 
                onImportComplete={() => {
                  fetchDB();
                  resetAnalysisRun();
                  setActiveTab('dashboard');
                }}
                onLoadDemoData={async () => {
                  const res = await fetch('/api/mailing/seed-default', { method: 'POST' });
                  if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Falha ao carregar mailing de exemplo.');
                  }
                  await fetchDB();
                  resetAnalysisRun();
                }}
                existingCompaniesCount={companies.length}
              />
            )}

            {/* 5. COMPANIES DIRECTORY WORKSPACE */}
            {activeTab === 'companies' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left hand sidebar checklist of companies */}
                <div className={`lg:col-span-4 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-5 ${selectedCompany ? 'hidden lg:block' : 'block'}`}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black uppercase tracking-wider font-display text-slate-800 dark:text-white">
                        {directoryMode === 'companies' ? 'Diretório de Empresas' : 'Diretório de Empresários'}
                      </h4>
                      <div className="flex space-x-1.5">
                        <button
                          onClick={() => exportCompaniesToCSV(filteredCompanies)}
                          className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-extrabold border border-emerald-200 dark:border-emerald-900/40 transition-all cursor-pointer shadow-3xs flex items-center space-x-1"
                          title="Exportar Filtradas para Excel"
                        >
                          <span>XLSX/CSV</span>
                        </button>
                        <button
                          onClick={() => {
                            if (selectedCompany) {
                              exportSingleCompanyToPDF(selectedCompany, companies, contacts, transactions, customFields);
                            } else {
                              exportCompaniesToPDF(filteredCompanies);
                            }
                          }}
                          className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-[10px] font-extrabold border border-indigo-200 dark:border-indigo-900/40 transition-all cursor-pointer shadow-3xs flex items-center space-x-1"
                          title={selectedCompany ? `Exportar Dossiê de ${selectedCompany.name} em PDF` : "Exportar PDF de Empresas"}
                        >
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>

                    {/* Toggle between Companies and Entrepreneurs */}
                    <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/60 dark:border-slate-850">
                      <button
                        onClick={() => { setDirectoryMode('companies'); setSelectedCompany(null); setSelectedContactId(null); setFutebolFilter(''); setMusicaFilter(''); }}
                        className={`flex-1 py-1.5 text-center text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                          directoryMode === 'companies'
                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-3xs border border-slate-200/10 dark:border-slate-700/30'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        <Building2 className="h-3.5 w-3.5" />
                        <span>Empresas ({companies.length})</span>
                      </button>
                      <button
                        onClick={() => { setDirectoryMode('contacts'); setSelectedCompany(null); setSelectedContactId(null); }}
                        className={`flex-1 py-1.5 text-center text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                          directoryMode === 'contacts'
                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-3xs border border-slate-200/10 dark:border-slate-700/30'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        <Users className="h-3.5 w-3.5" />
                        <span>Empresários ({contacts.length})</span>
                      </button>
                    </div>
                    
                    {/* Search and Advanced Filters */}
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={directoryMode === 'companies' ? "Buscar empresa, segmento, decisor..." : "Buscar empresário, email, telefone..."}
                        className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 bg-slate-50/50 dark:bg-slate-950 focus:outline-none focus:border-indigo-500 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                      />
                    </div>

                    {/* Export complete database to XLSX */}
                    <button
                      onClick={() => exportFullBaseToExcel(companies, contacts, transactions, customFields)}
                      className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-all shadow-xs cursor-pointer border border-emerald-550/30"
                      title="Exportar base inteira em planilha Excel de forma organizada e com informações extra como faturamento, ICP, custo de folha, etc"
                    >
                      <Upload className="h-3.5 w-3.5 rotate-180 text-emerald-100" />
                      <span>Exportar Base Completa (XLSX)</span>
                    </button>
                  </div>

                  {/* Filter panel toggles */}
                  <div className="space-y-3 bg-slate-50/50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200 dark:border-slate-850">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                      <div className="flex items-center space-x-1">
                        <Filter className="h-3.5 w-3.5 text-slate-400" />
                        <span>Filtros Avançados</span>
                      </div>
                      {(segmentFilter || locationFilter || vidasFilter || eventFilter || searchQuery || faturamentoFilter || sortOrder !== 'none' || futebolFilter || areaAtuacaoFilter || politicaFilter || musicaFilter || rampupFilter) && (
                        <button onClick={clearFilters} className="text-indigo-600 dark:text-indigo-450 hover:underline normal-case font-bold">
                          Limpar tudo
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 pt-1.5">
                      {/* Potencial Rampup select */}
                      <select
                        value={rampupFilter}
                        onChange={(e) => setRampupFilter(e.target.value)}
                        className="w-full text-xs border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/40 rounded-lg px-2 py-1.5 focus:outline-none text-indigo-900 dark:text-indigo-200 font-bold cursor-pointer"
                      >
                        <option value="">Potencial Rampup (Todos)</option>
                        <option value="membro">★ Potencial Membro / Membro</option>
                        <option value="apoiador">★ Potencial Apoiador / Apoiador</option>
                        <option value="patrocinador">★ Potencial Patrocinador / Patrocinador</option>
                      </select>
                      {/* Segment select */}
                      <select
                        value={segmentFilter}
                        onChange={(e) => setSegmentFilter(e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5 focus:outline-none text-slate-700 dark:text-slate-300 font-medium animate-fade-in"
                      >
                        <option value="">Todos os Segmentos ({uniqueSegments.length})</option>
                        {uniqueSegments.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>

                      {/* Vidas select */}
                      <select
                        value={vidasFilter}
                        onChange={(e) => setVidasFilter(e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5 focus:outline-none text-slate-700 dark:text-slate-300 font-medium"
                      >
                        <option value="">Qualquer tamanho (vidas)</option>
                        <option value="Pequena">Pequeno Porte (10 - 30 colaboradores)</option>
                        <option value="Media">Média (30 - 70 colaboradores)</option>
                        <option value="Grande">Grande (70 - 500 colaboradores)</option>
                        <option value="BIG">BIG Company (Mais de 500 colaboradores)</option>
                      </select>

                      {/* Faturamento select */}
                      <select
                        value={faturamentoFilter}
                        onChange={(e) => setFaturamentoFilter(e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5 focus:outline-none text-slate-700 dark:text-slate-300 font-medium"
                      >
                        <option value="">Qualquer faturamento (est.)</option>
                        <option value="Ate100k">Até R$ 100 mil / mês</option>
                        <option value="100k-500k">R$ 100 mil - R$ 500 mil / mês</option>
                        <option value="500k-2M">R$ 500 mil - R$ 2 milhões / mês</option>
                        <option value="Mais2M">Acima de R$ 2 milhões / mês</option>
                      </select>

                      {/* Events select */}
                      <select
                        value={eventFilter}
                        onChange={(e) => setEventFilter(e.target.value)}
                        className="w-full text-xs border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5 focus:outline-none text-slate-700 dark:text-slate-300 font-medium"
                      >
                        <option value="">Filtrar Participação em Evento ({uniqueEvents.length})</option>
                        {uniqueEvents.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>

                      {/* Futebol filter select */}
                      {uniqueFutebol.length > 0 && directoryMode === 'contacts' && (
                        <select
                          value={futebolFilter}
                          onChange={(e) => setFutebolFilter(e.target.value)}
                          className="w-full text-xs border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5 focus:outline-none text-slate-700 dark:text-slate-300 font-medium"
                        >
                          <option value="">Filtrar Time de Futebol ({uniqueFutebol.length})</option>
                          {uniqueFutebol.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      )}

                      {/* Area atuacao filter select */}
                      {uniqueAreaAtuacao.length > 0 && (
                        <select
                          value={areaAtuacaoFilter}
                          onChange={(e) => setAreaAtuacaoFilter(e.target.value)}
                          className="w-full text-xs border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5 focus:outline-none text-slate-700 dark:text-slate-300 font-medium"
                        >
                          <option value="">Filtrar Área de Atuação ({uniqueAreaAtuacao.length})</option>
                          {uniqueAreaAtuacao.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      )}

                      {/* Politica filter select */}
                      {uniquePolitica.length > 0 && (
                        <select
                          value={politicaFilter}
                          onChange={(e) => setPoliticaFilter(e.target.value)}
                          className="w-full text-xs border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5 focus:outline-none text-slate-700 dark:text-slate-300 font-medium"
                        >
                          <option value="">Filtrar Preferência Política ({uniquePolitica.length})</option>
                          {uniquePolitica.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      )}

                      {/* Musica filter select */}
                      {uniqueMusica.length > 0 && directoryMode === 'contacts' && (
                        <select
                          value={musicaFilter}
                          onChange={(e) => setMusicaFilter(e.target.value)}
                          className="w-full text-xs border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5 focus:outline-none text-slate-700 dark:text-slate-300 font-medium"
                        >
                          <option value="">Filtrar Tipo de Música ({uniqueMusica.length})</option>
                          {uniqueMusica.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      )}

                      {/* Ordenação select */}
                      <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as 'none' | 'az' | 'za')}
                        className="w-full text-xs border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5 focus:outline-none text-slate-700 dark:text-slate-300 font-medium"
                      >
                        <option value="none">Ordenação Padrão</option>
                        <option value="az">Ordenar de A a Z</option>
                        <option value="za">Ordenar de Z a A</option>
                      </select>
                    </div>
                  </div>

                  {/* List of elements (Companies or Contacts) */}
                  <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                    {directoryMode === 'companies' ? (
                      <>
                        <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider px-1">
                          Empresas ({filteredCompanies.length})
                        </p>

                        {filteredCompanies.map((c) => {
                          const isSelected = selectedCompany?.id === c.id;
                          const sizeInfo = classifyCompanySize(c.vidas);
                          const profileInfo = classifyRampupProfile(c);
                          const fin = calculateFinancialAnalysis(c.vidas, c.segment, c);

                          return (
                            <div
                              key={c.id}
                              onClick={() => { setSelectedCompany(c); setSelectedContactId(null); }}
                              className={`p-3.5 rounded-2xl border transition-all cursor-pointer group flex items-start gap-3 relative ${
                                isSelected 
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/15' 
                                  : 'bg-white dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-100'
                              }`}
                            >
                              {/* Company Logo / Icon */}
                              <div className="shrink-0 pt-0.5">
                                {c.logoUrl ? (
                                  <div className={`w-11 h-11 rounded-xl p-1 flex items-center justify-center border overflow-hidden ${
                                    isSelected ? 'bg-white/95 border-indigo-400/30' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-2xs'
                                  }`}>
                                    <img src={c.logoUrl} alt={c.name} className="w-full h-full object-contain" />
                                  </div>
                                ) : (
                                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center border font-black text-xs ${
                                    isSelected 
                                      ? 'bg-indigo-700/80 border-indigo-500/40 text-white' 
                                      : 'bg-gradient-to-br from-indigo-50 to-indigo-100/60 dark:from-indigo-950/60 dark:to-indigo-900/30 border-indigo-200/50 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400'
                                  }`}>
                                    <Building2 className="h-5 w-5" />
                                  </div>
                                )}
                              </div>

                              {/* Main Details */}
                              <div className="flex-1 min-w-0 space-y-1.5">
                                {/* Top Header: Company Name & Rampup Badge */}
                                <div className="flex items-start justify-between gap-1.5">
                                  <h5 className="text-xs font-black leading-snug line-clamp-1 group-hover:text-indigo-500 transition-colors">
                                    {c.name}
                                  </h5>
                                  <span 
                                    title={profileInfo.explanation}
                                    className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border shrink-0 ${
                                      isSelected 
                                        ? 'bg-white/20 border-white/30 text-white' 
                                        : `${profileInfo.badgeBg} ${profileInfo.badgeBorder} ${profileInfo.badgeText}`
                                    }`}
                                  >
                                    {profileInfo.label}
                                  </span>
                                </div>

                                {/* Sub-header: Segment, Porte, Location */}
                                <div className="flex flex-wrap items-center gap-1 text-[9.5px]">
                                  <span className={`font-extrabold ${isSelected ? 'text-indigo-100' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                    {c.segment}
                                  </span>
                                  <span className={isSelected ? 'text-indigo-300' : 'text-slate-300 dark:text-slate-600'}>•</span>
                                  <span className={`font-semibold ${isSelected ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {c.location || 'Fortaleza-CE'}
                                  </span>
                                  <span className={isSelected ? 'text-indigo-300' : 'text-slate-300 dark:text-slate-600'}>•</span>
                                  <span className={`font-bold text-[8.5px] px-1.5 py-0.2 rounded-md border ${
                                    isSelected 
                                      ? 'bg-indigo-700/60 border-indigo-500/40 text-white' 
                                      : `${sizeInfo.badgeBg} ${sizeInfo.badgeBorder} ${sizeInfo.badgeText}`
                                  }`}>
                                    {c.vidas} colaboradores
                                  </span>
                                </div>

                                {/* Financial Pills Strip */}
                                <div className={`grid grid-cols-2 gap-1.5 pt-1 text-[9px] rounded-lg p-1.5 ${
                                  isSelected 
                                    ? 'bg-indigo-700/40 border border-indigo-500/30 text-indigo-100' 
                                    : 'bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60'
                                }`}>
                                  <div>
                                    <span className={`block text-[8px] font-black uppercase tracking-wider ${isSelected ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`}>
                                      Est. Folha/mês
                                    </span>
                                    <span className={`font-mono font-bold ${isSelected ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                                      {fin.custoFolha > 0 ? `R$ ${fin.custoFolha.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` : 'N/A'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className={`block text-[8px] font-black uppercase tracking-wider ${isSelected ? 'text-emerald-200' : 'text-slate-400 dark:text-slate-500'}`}>
                                      Est. Faturamento/mês
                                    </span>
                                    <span className={`font-mono font-extrabold ${isSelected ? 'text-emerald-200' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                      {fin.faturamentoAvg > 0 ? `R$ ${fin.faturamentoAvg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` : 'N/A'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Action button & chevron */}
                              <div className="flex flex-col items-end justify-between shrink-0 self-stretch pt-0.5">
                                <button
                                  onClick={(e) => handleDeleteCompany(c.id, e)}
                                  title="Excluir empresa"
                                  className={`p-1 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                                    isSelected ? 'text-indigo-200 hover:text-white hover:bg-indigo-700' : 'text-slate-400 hover:text-red-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                  }`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                                <ChevronRight className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-slate-300 dark:text-slate-600 group-hover:text-indigo-500'}`} />
                              </div>
                            </div>
                          );
                        })}

                        {filteredCompanies.length === 0 && (
                          <div className="py-12 text-center text-slate-400 dark:text-slate-550 space-y-1">
                            <Building2 className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-700" />
                            <p className="text-xs font-bold">Nenhuma empresa filtrada.</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">Tente buscar por termos diferentes ou limpe os filtros.</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider px-1">
                          Empresários ({filteredContacts.length})
                        </p>

                        {filteredContacts.map((con) => {
                          const comp = companies.find(c => c.id === con.companyId);
                          const isSelected = selectedContactId === con.id;
                          const presencesCount = transactions.filter(t => t.contactEmail === con.email).length;
                          
                          return (
                            <div
                              key={con.id}
                              onClick={() => { 
                                if (comp) {
                                  setSelectedCompany(comp);
                                  setSelectedContactId(con.id);
                                }
                              }}
                              className={`flex flex-col p-3 rounded-xl border transition-all cursor-pointer group space-y-1.5 ${
                                isSelected 
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/10' 
                                  : 'bg-white dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-100'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-extrabold leading-tight">{con.name}</h5>
                                <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-full border ${
                                  isSelected 
                                    ? 'bg-indigo-700/60 border-indigo-500/40 text-white' 
                                    : 'bg-indigo-50 dark:bg-indigo-950/55 border-indigo-200/40 text-indigo-600 dark:text-indigo-400'
                                }`}>
                                  {presencesCount} Rodada(s)
                                </span>
                              </div>

                              {comp && (
                                <div className={`flex items-center space-x-1 text-[10px] font-bold ${isSelected ? 'text-indigo-100' : 'text-slate-700 dark:text-slate-350'}`}>
                                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                                  <span className="line-clamp-1">{comp.name}</span>
                                </div>
                              )}

                              <div className={`flex flex-col space-y-0.5 text-[9.5px] ${isSelected ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`}>
                                <span>{con.email}</span>
                                {con.phone && (
                                  <span className="font-bold">Tel: {con.phone}</span>
                                )}
                              </div>

                              {(con.futebol || con.areaAtuacao || con.politica || con.musica || con.redesSociais) && (
                                <div className="flex flex-wrap gap-1 pt-1.5 pb-0.5">
                                  {con.futebol && (
                                    <span className={`inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 font-extrabold rounded-md ${
                                      isSelected
                                        ? 'bg-indigo-700/50 border border-indigo-500/20 text-indigo-100'
                                        : 'bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-300'
                                    }`}>
                                      ⚽ {con.futebol}
                                    </span>
                                  )}
                                  {con.areaAtuacao && (
                                    <span className={`inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 font-extrabold rounded-md ${
                                      isSelected
                                        ? 'bg-indigo-700/50 border border-indigo-500/20 text-indigo-100'
                                        : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-300'
                                    }`}>
                                      💼 {con.areaAtuacao}
                                    </span>
                                  )}
                                  {con.politica && (
                                    <span className={`inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 font-extrabold rounded-md ${
                                      isSelected
                                        ? 'bg-indigo-700/50 border border-indigo-500/20 text-indigo-100'
                                        : 'bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-blue-700 dark:text-blue-300'
                                    }`}>
                                      ⚖️ {con.politica}
                                    </span>
                                  )}
                                  {con.musica && (
                                    <span className={`inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 font-extrabold rounded-md ${
                                      isSelected
                                        ? 'bg-indigo-700/50 border border-indigo-500/20 text-indigo-100'
                                        : 'bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 text-purple-700 dark:text-purple-300'
                                    }`}>
                                      🎵 {con.musica}
                                    </span>
                                  )}
                                  {con.redesSociais && (
                                    <span className={`inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 font-extrabold rounded-md ${
                                      isSelected
                                        ? 'bg-indigo-700/50 border border-indigo-500/20 text-indigo-100'
                                        : 'bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/30 text-teal-700 dark:text-teal-300'
                                    }`}>
                                      🔗 {con.redesSociais}
                                    </span>
                                  )}
                                </div>
                              )}

                              {comp && (
                                <div className="flex items-center justify-between pt-1 border-t border-dashed border-slate-100/20 dark:border-slate-800/50">
                                  <span className={isSelected ? 'text-indigo-100' : 'text-indigo-600 dark:text-indigo-450 font-bold text-[8.5px]'}>
                                    {comp.segment}
                                  </span>
                                  {(() => {
                                    const profileInfo = classifyRampupProfile(comp);
                                    return (
                                      <span 
                                        title={profileInfo.explanation}
                                        className={`text-[8px] font-black px-1.5 py-0.2 rounded border ${
                                          isSelected 
                                            ? 'bg-indigo-700/40 border-indigo-500/20 text-indigo-100' 
                                            : `${profileInfo.badgeBg} ${profileInfo.badgeBorder} ${profileInfo.badgeText}`
                                        }`}
                                      >
                                        {profileInfo.label}
                                      </span>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {filteredContacts.length === 0 && (
                          <div className="py-12 text-center text-slate-400 dark:text-slate-550 space-y-1">
                            <Users className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-700" />
                            <p className="text-xs font-bold">Nenhum empresário filtrado.</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">Tente buscar por termos diferentes ou limpe os filtros.</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Right hand main active content profile or selection placeholder */}
                <div className={`lg:col-span-8 ${(!selectedCompany && !selectedContactId) ? 'hidden lg:block' : 'block'}`}>
                  {directoryMode === 'contacts' && selectedContactId && selectedContact ? (
                    <div className="space-y-4">
                      {/* Back button visible only on mobile */}
                      <button
                        onClick={() => { setSelectedContactId(null); setSelectedCompany(null); }}
                        className="lg:hidden flex items-center space-x-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-extrabold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl mb-2 cursor-pointer shadow-3xs hover:bg-slate-50 transition-all"
                      >
                        <span>← Voltar para a Lista</span>
                      </button>

                      <ContactProfile
                        contact={selectedContact}
                        company={companies.find(c => c.id === selectedContact.companyId) || {
                          id: selectedContact.companyId,
                          name: 'Empresa Indefinida',
                          segment: 'Outros',
                          description: '',
                          activity: '',
                          vidas: 1,
                          location: 'Fortaleza-CE',
                          customFields: {}
                        }}
                        allCompanies={companies}
                        transactions={transactions}
                        customFields={customFields}
                        onUpdateContact={handleUpdateContact}
                        onDeleteContact={handleDeleteContact}
                        isAnalysisExecuted={isAnalysisExecuted}
                        onViewCompany={(comp) => {
                          setDirectoryMode('companies');
                          setSelectedCompany(comp);
                          setSelectedContactId(null);
                        }}
                      />
                    </div>
                  ) : selectedCompany ? (
                    <div className="space-y-4">
                      {/* Back button visible only on mobile */}
                      <button
                        onClick={() => { setSelectedCompany(null); setSelectedContactId(null); }}
                        className="lg:hidden flex items-center space-x-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-extrabold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl mb-2 cursor-pointer shadow-3xs hover:bg-slate-50 transition-all"
                      >
                        <span>← Voltar para a Lista</span>
                      </button>

                      <CompanyProfile
                        company={selectedCompany}
                        allCompanies={companies}
                        contacts={contacts}
                        transactions={transactions}
                        customFields={customFields}
                        onUpdateCompany={handleUpdateCompany}
                        onAddContact={handleAddContact}
                        onDeleteContact={handleDeleteContact}
                        onSelectCompany={(comp) => {
                          setSelectedCompany(comp);
                          setSelectedContactId(null);
                        }}
                        selectedContactId={selectedContactId}
                      />
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-16 text-center space-y-4 shadow-sm h-full flex flex-col justify-center items-center">
                      <div className="p-4 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl animate-bounce" style={{ animationDuration: '3s' }}>
                        {directoryMode === 'companies' ? <Building2 className="h-10 w-10" /> : <Users className="h-10 w-10" />}
                      </div>
                      <div className="space-y-1.5 max-w-sm">
                        <h4 className="font-bold font-display text-slate-800 dark:text-white text-lg">
                          {directoryMode === 'companies' ? 'Selecione uma Empresa' : 'Selecione um Empresário'}
                        </h4>
                        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                          {directoryMode === 'companies'
                            ? 'Selecione uma empresa do diretório ao lado para gerenciar seus decisores, histórico de ingressos e gerar novas conexões inteligentes de negócios.'
                            : 'Selecione um empresário do diretório ao lado para visualizar seu dossiê individual de networking, histórico de presença e gerenciar seus atributos de contato.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* AI Analysis Gating Action Banner - Persistent at bottom of all tabs (except AI Chat) */}
            {companies.length > 0 && activeTab !== 'ai-chat' && (
              <div className={`mt-8 p-4 rounded-2xl border transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm ${
                isAnalysisExecuted 
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 text-slate-800 dark:text-slate-200' 
                  : 'bg-indigo-50/50 dark:bg-indigo-950/25 border-indigo-100 dark:border-indigo-900/40 text-slate-800 dark:text-slate-200'
              }`}>
                <div className="flex items-start space-x-3.5">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    isAnalysisExecuted 
                      ? 'bg-emerald-100/70 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
                      : 'bg-indigo-100/70 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-850'
                  }`}>
                    <Sparkles className={`h-5 w-5 ${!isAnalysisExecuted ? 'animate-pulse text-indigo-500' : 'text-emerald-500'}`} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider flex flex-wrap items-center gap-2">
                      <span>Status da Inteligência Comercial (RBI CRM)</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase font-extrabold border ${
                        isAnalysisExecuted 
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30' 
                          : 'bg-amber-100 dark:bg-amber-900/45 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-900/30 animate-pulse'
                      }`}>
                        {isAnalysisExecuted ? 'Inteligência Ativa' : 'Inteligência Pendente'}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {isAnalysisExecuted 
                        ? 'Todos os cruzamentos de sinergias setoriais, matches de ouro bilaterais, líderes de engajamento e arquétipos inteligentes do ecossistema estão atualizados e calculados.'
                        : 'Os dados do mailing foram carregados com sucesso! No entanto, os cruzamentos automáticos, canais de sinergia e análises estão suspensos até sua execução manual.'}
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  {isAnalysisExecuted ? (
                    <button
                      onClick={resetAnalysisRun}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-all cursor-pointer border dark:border-slate-800"
                    >
                      <span>🔄 Suspender/Recalcular Análise</span>
                    </button>
                  ) : (
                    <button
                      onClick={triggerAnalysisRun}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs flex items-center space-x-2 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer animate-bounce"
                      style={{ animationDuration: '3s' }}
                    >
                      <Zap className="h-4 w-4 fill-amber-300 text-amber-300" />
                      <span>Executar Rampup Intel</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* 5. FLOATING FORM MODAL */}
      {isFormOpen && (
        <CompanyForm
          customFields={customFields}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleCreateCompany}
        />
      )}
    </div>
  );
}
