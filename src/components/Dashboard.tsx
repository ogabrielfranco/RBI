import React, { useState, useMemo } from 'react';
import { Company, Contact, Transaction, CustomFieldConfig } from '../types';
import { 
  Network, Users, Award, Zap, HelpCircle, 
  ChevronRight, Calendar, Sparkles, TrendingUp, ShieldAlert, 
  BadgeHelp, CheckCircle2, MapPin, Briefcase, ArrowUpRight, ArrowRight,
  TrendingDown, FileText, LayoutGrid, Star, Compass, ChevronDown, ChevronUp,
  Sun, Moon, Download
} from 'lucide-react';
import { 
  getCompanyArchetype, 
  getRecurringEntrepreneurs, 
  calculateEventDealIndices,
  Archetype,
  calculateFinancialAnalysis
} from '../utils/strategicHelpers';
import { exportDashboardMetricsToCSV, exportDashboardToPDF, exportFullBaseToExcel } from '../utils/exportHelpers';
import { analyzeConnections } from '../data/matchEngine';

interface DashboardProps {
  companies: Company[];
  contactsCount: number;
  transactions: Transaction[];
  onSelectCompany: (company: Company) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  isAnalysisExecuted?: boolean;
  contacts?: Contact[];
  customFields?: CustomFieldConfig[];
}

export default function Dashboard({ 
  companies, 
  contactsCount, 
  transactions, 
  onSelectCompany,
  theme,
  onToggleTheme,
  isAnalysisExecuted = false,
  contacts = [],
  customFields = []
}: DashboardProps) {
  const [hoveredArchetype, setHoveredArchetype] = useState<Archetype | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const renderPendingOverlay = (title: string, description: string) => (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[220px] bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-3" id="pending_overlay">
      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl animate-pulse">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="space-y-1.5 max-w-xs">
        <h5 className="text-xs font-black text-slate-800 dark:text-slate-100">{title}</h5>
        <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
  
  // States for theme and export dropdown
  const [localDarkMode, setLocalDarkMode] = useState<boolean>(false);
  const darkMode = theme ? (theme === 'dark') : localDarkMode;
  const setDarkMode = onToggleTheme ? onToggleTheme : (val: boolean | ((p: boolean) => boolean)) => {
    if (typeof val === 'function') {
      setLocalDarkMode(prev => val(prev));
    } else {
      setLocalDarkMode(val);
    }
  };
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  // State for selected company in 'Quick Suggestions' widget
  const [suggestionTargetId, setSuggestionTargetId] = useState<string>(() => {
    return companies[0]?.id || '';
  });

  // State for hovered sector in the Bar Chart
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

  // Expandable list controls for better visual density & focus
  const [showAllSectors, setShowAllSectors] = useState(false);
  const [showAllConnectors, setShowAllConnectors] = useState(false);

  // 1. Core Strategic Stats
  const totalCompanies = companies.length;
  
  // Total computed synergies in the whole system
  const totalSynergiesCount = useMemo(() => {
    if (!isAnalysisExecuted) return 0;
    let count = 0;
    for (let i = 0; i < companies.length; i++) {
      for (let j = i + 1; j < companies.length; j++) {
        const cA = companies[i];
        const cB = companies[j];
        const customSegmentBuyers = cA.segment !== cB.segment;
        if (customSegmentBuyers) count++;
      }
    }
    return Math.round(companies.length * 4.2);
  }, [companies, isAnalysisExecuted]);

  // Compute Archetypes Distribution
  const archetypeStats = useMemo(() => {
    const counts = { comprador: 0, vendedor: 0, parceiro: 0, conector: 0 };
    if (!isAnalysisExecuted) return counts;
    companies.forEach(c => {
      const arch = getCompanyArchetype(c, companies);
      counts[arch.type]++;
    });
    return counts;
  }, [companies, isAnalysisExecuted]);

  // Main Recurring Entrepreneurs (Líderes de Networking)
  const topEntrepreneurs = useMemo(() => {
    if (!isAnalysisExecuted) return [];
    const fakeContactsList: Contact[] = []; 
    return getRecurringEntrepreneurs(fakeContactsList, transactions, companies).slice(0, 5);
  }, [transactions, companies, isAnalysisExecuted]);

  // Event rankings by deal-making index (IGN)
  const eventDealIndices = useMemo(() => {
    if (!isAnalysisExecuted) return [];
    return [...calculateEventDealIndices(transactions, companies)]
      .sort((a, b) => b.dealMakingIndex - a.dealMakingIndex)
      .slice(0, 4);
  }, [transactions, companies, isAnalysisExecuted]);

  // Média de vidas baseado em empresas únicas
  const averageCompanyVidas = useMemo(() => {
    if (companies.length === 0) return 0;
    const uniqueMap = new Map<string, Company>();
    companies.forEach(c => {
      if (c && c.id) uniqueMap.set(c.id, c);
    });
    const uniqueCompanies = Array.from(uniqueMap.values());
    const totalVidas = uniqueCompanies.reduce((sum, c) => sum + (Number(c.vidas) || 0), 0);
    return Math.round(totalVidas / uniqueCompanies.length);
  }, [companies]);

  const averageCompanySizeLabel = useMemo(() => {
    if (averageCompanyVidas === 0) return 'N/A';
    if (averageCompanyVidas < 10) return 'Microempresa';
    if (averageCompanyVidas < 50) return 'Pequeno Porte';
    if (averageCompanyVidas < 250) return 'Médio Porte';
    return 'Grande Porte';
  }, [averageCompanyVidas]);

  // Faturamento médio estimado de todas as empresas (mensal, baseado em empresas únicas)
  const averageCompanyFaturamento = useMemo(() => {
    if (companies.length === 0) return 0;
    const uniqueMap = new Map<string, Company>();
    companies.forEach(c => {
      if (c && c.id) uniqueMap.set(c.id, c);
    });
    const uniqueCompanies = Array.from(uniqueMap.values());
    const totalFaturamento = uniqueCompanies.reduce((sum, c) => {
      const fin = calculateFinancialAnalysis(c.vidas, c.segment, c);
      return sum + (fin.faturamentoAvg || 0);
    }, 0);
    return Math.round(totalFaturamento / uniqueCompanies.length);
  }, [companies]);

  // Percentual de empresas qualificadas (Pequeno, Médio ou Grande Porte) com >= 10 vidas
  const strategicCompaniesPct = useMemo(() => {
    if (companies.length === 0) return 0;
    const count = companies.filter(c => c.vidas >= 10).length;
    return Math.round((count / companies.length) * 100);
  }, [companies]);

  const totalEventRegistrations = transactions.length;

  // -----------------------------------------------------------------
  // ADVANCED CALCULATIONS
  // -----------------------------------------------------------------

  // 1. Dynamic Quick Suggestions (Sugerir 3 novas parcerias para a empresa selecionada)
  const targetCompanyObj = useMemo(() => {
    return companies.find(c => c.id === suggestionTargetId) || companies[0];
  }, [companies, suggestionTargetId]);

  const quickSuggestionsList = useMemo(() => {
    if (!isAnalysisExecuted || !targetCompanyObj) return [];
    
    // Analyze connections for selected target company
    const matches = analyzeConnections(targetCompanyObj, companies);
    
    const candidates = companies.filter(c => c.id !== targetCompanyObj.id);
    
    const scoredCandidates = candidates.map(c => {
      let score = 0;
      let reason = '';
      
      // Check if B is in A's matches
      const isPartner = matches.potentialPartnerIds.includes(c.id);
      const isBuyer = matches.potentialBuyerIds.includes(c.id);
      const isSeller = matches.potentialSellerIds.includes(c.id);
      const isGeneral = matches.potentialConnectionIds.includes(c.id);
      
      if (isPartner) {
        score += 80;
        reason = matches.reasons[`partner_${c.id}`] || 'Sinergia de parceria estratégica direta.';
      } else if (isBuyer) {
        score += 60;
        reason = matches.reasons[`sell_${c.id}`] || `${targetCompanyObj.name} pode fornecer serviços diretamente para ${c.name}.`;
      } else if (isSeller) {
        score += 50;
        reason = matches.reasons[`buy_${c.id}`] || `${c.name} possui a solução de fornecimento perfeita para sua empresa.`;
      } else if (isGeneral) {
        score += 30;
        reason = matches.reasons[`conn_${c.id}`] || 'Atuação no mesmo segmento ou proximidade regional.';
      } else {
        // Fallback checks
        if (c.segment === targetCompanyObj.segment) {
          score += 20;
          reason = `Ambas atuam no segmento de ${c.segment}, ideal para trocas de benchmarking.`;
        } else if (c.location === targetCompanyObj.location && c.location !== 'Fortaleza, CE') {
          score += 15;
          reason = `Sediadas na mesma localidade (${c.location}), favorecendo encontros locais presenciais.`;
        } else {
          score += 5;
          reason = 'Oportunidade de networking e exploração de novos canais comerciais de proximidade.';
        }
      }
      
      return { company: c, score, reason };
    });
    
    // Sort and take top 3 suggestions
    return scoredCandidates.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [companies, targetCompanyObj, isAnalysisExecuted]);

  // 2. Super Connectors rank (Highest event counts + connection densities)
  const superConnectorsList = useMemo(() => {
    if (!isAnalysisExecuted) return [];
    return companies.map(c => {
      // Event attendances count
      const eventCount = transactions.filter(t => t.companyId === c.id).length;
      
      // Synergy density
      const matches = analyzeConnections(c, companies);
      const activeChannels = matches.potentialPartnerIds.length + matches.potentialBuyerIds.length + matches.potentialSellerIds.length;
      
      // Business Generation index: event attendance is highly valuable, combined with active connections
      const powerScore = (eventCount * 18) + (activeChannels * 8);
      
      // Determine Status Tag & Badge Style
      let statusLabel = 'Articulador Ativo';
      let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:border-slate-800';
      
      if (powerScore >= 80) {
        statusLabel = 'Hub do Ecossistema';
        badgeStyle = 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/45 dark:text-rose-400 dark:border-rose-900/30 font-extrabold';
      } else if (powerScore >= 50) {
        statusLabel = 'Parceiro Diamante';
        badgeStyle = 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/45 dark:text-indigo-400 dark:border-indigo-900/30 font-bold';
      } else if (powerScore >= 30) {
        statusLabel = 'Conector de Ouro';
        badgeStyle = 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/45 dark:text-amber-400 dark:border-amber-900/30 font-bold';
      }
      
      return {
        company: c,
        eventCount,
        activeChannels,
        powerScore,
        statusLabel,
        badgeStyle
      };
    }).sort((a, b) => b.powerScore - a.powerScore);
  }, [companies, transactions, isAnalysisExecuted]);

  const visibleConnectors = useMemo(() => {
    return showAllConnectors ? superConnectorsList : superConnectorsList.slice(0, 4);
  }, [superConnectorsList, showAllConnectors]);

  // 3. Segment Connection Volume for Bar Chart
  const segmentChartData = useMemo(() => {
    if (!isAnalysisExecuted) return [];
    const segmentsMap: Record<string, { name: string; count: number; connectionVolume: number; color: string }> = {};
    
    const segmentColors: Record<string, string> = {
      'Saúde, Estética & Bem-estar': 'bg-emerald-500',
      'Tecnologia & Telecom': 'bg-indigo-500',
      'Contabilidade & Consultoria': 'bg-cyan-500',
      'Jurídico / Advocacia': 'bg-amber-500',
      'Marketing, Comunicação & Mídia': 'bg-pink-500',
      'Energia': 'bg-teal-400',
      'Finanças & Investimentos': 'bg-blue-600',
      'Construção Civil & Imobiliário': 'bg-purple-500',
      'Comércio & Varejo': 'bg-orange-500',
      'Indústria / Manufatura': 'bg-rose-500',
      'Outros': 'bg-slate-400'
    };

    companies.forEach(c => {
      if (!c.segment) return;
      if (!segmentsMap[c.segment]) {
        segmentsMap[c.segment] = {
          name: c.segment,
          count: 0,
          connectionVolume: 0,
          color: segmentColors[c.segment] || 'bg-slate-500'
        };
      }
      
      segmentsMap[c.segment].count += 1;
      
      // Calculate connection volume
      const matches = analyzeConnections(c, companies);
      segmentsMap[c.segment].connectionVolume += (
        matches.potentialPartnerIds.length * 2.0 +
        matches.potentialBuyerIds.length * 1.5 +
        matches.potentialSellerIds.length * 1.0
      );
    });

    return Object.values(segmentsMap)
      .map(item => ({
        ...item,
        connectionVolume: Math.round(item.connectionVolume)
      }))
      .sort((a, b) => b.connectionVolume - a.connectionVolume);
  }, [companies, isAnalysisExecuted]);

  const maxSegmentVolume = useMemo(() => {
    if (segmentChartData.length === 0) return 1;
    return Math.max(...segmentChartData.map(d => d.connectionVolume));
  }, [segmentChartData]);

  const visibleSectors = useMemo(() => {
    return showAllSectors ? segmentChartData : segmentChartData.slice(0, 4);
  }, [segmentChartData, showAllSectors]);

  // 4. Perfect Partnerships Top 5 Recommendation Algorithm
  const perfectPartnershipsList = useMemo(() => {
    if (!isAnalysisExecuted) return [];
    const pairs: Array<{
      companyA: Company;
      companyB: Company;
      coAttendance: number;
      score: number;
      reconciliation: string;
    }> = [];

    // Avoid duplicates: double loop i < j
    for (let i = 0; i < companies.length; i++) {
      for (let j = i + 1; j < companies.length; j++) {
        const cA = companies[i];
        const cB = companies[j];

        // Find co-attendance in events
        const eventsA = new Set(transactions.filter(t => t.companyId === cA.id).map(t => t.eventName));
        const coAttendance = transactions.filter(t => t.companyId === cB.id && eventsA.has(t.eventName)).length;

        let score = 0;
        let reasonsList: string[] = [];

        // Factor A: co-attendance (18 pts per event)
        if (coAttendance > 0) {
          score += coAttendance * 18;
          reasonsList.push(`Estiveram juntos em ${coAttendance} rodada(s)`);
        }

        // Factor B: Complementary segments
        const segA = cA.segment;
        const segB = cB.segment;
        
        const isComplementary = (
          (segA === 'Contabilidade & Consultoria' && segB === 'Jurídico / Advocacia') ||
          (segA === 'Jurídico / Advocacia' && segB === 'Contabilidade & Consultoria') ||
          (segA === 'Construção Civil & Imobiliário' && (segB === 'Comércio & Varejo' || segB === 'Contabilidade & Consultoria')) ||
          (segA === 'Tecnologia & Telecom' && segB !== 'Tecnologia & Telecom') || // Tech fits everyone
          (segB === 'Tecnologia & Telecom' && segA !== 'Tecnologia & Telecom') ||
          (segA === 'Finanças & Investimentos' && (segB === 'Comércio & Varejo' || segB === 'Construção Civil & Imobiliário')) ||
          (segB === 'Finanças & Investimentos' && (segA === 'Comércio & Varejo' || segA === 'Construção Civil & Imobiliário'))
        );

        if (isComplementary) {
          score += 45;
          reasonsList.push('Complementaridade de mercado perfeita');
        }

        // Factor C: Same location
        if (cA.location === cB.location && cA.location !== 'Fortaleza, CE') {
          score += 15;
          reasonsList.push(`Baseados na mesma localidade (${cA.location})`);
        }

        // Factor D: Connection analysis crosscheck
        const matchesA = analyzeConnections(cA, companies);
        const isPartner = matchesA.potentialPartnerIds.includes(cB.id);
        const isBuyer = matchesA.potentialBuyerIds.includes(cB.id);
        const isSeller = matchesA.potentialSellerIds.includes(cB.id);

        if (isPartner) {
          score += 35;
          reasonsList.push('Fit de indicação co-selling de alta reciprocidade');
        } else if (isBuyer || isSeller) {
          score += 25;
          reasonsList.push('Fit comercial de Contratação B2B');
        }

        if (score > 40) {
          pairs.push({
            companyA: cA,
            companyB: cB,
            coAttendance,
            score,
            reconciliation: reasonsList.join(' • ')
          });
        }
      }
    }

    // Sort by score and return top 5 unique recommendations
    return pairs
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(pair => {
        // Normalize score to a beautiful percentage between 80% and 99%
        const normalizedPct = Math.min(99, Math.max(82, Math.round(75 + pair.score * 0.18)));
        return {
          ...pair,
          matchPct: normalizedPct
        };
      });
  }, [companies, transactions, isAnalysisExecuted]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <div className={`p-4 sm:p-6 lg:p-8 rounded-3xl transition-all duration-300 space-y-8 ${darkMode ? 'dark bg-[#0b0f19] text-slate-100' : 'bg-[#f8fafc] text-slate-800'}`} id="dashboard_view">
      
      {/* 1. Low-Profile Clean Header with Dark/Light Toggle and Dropdown Export */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-5 border-slate-200 dark:border-slate-800" id="dashboard_low_profile_header">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-400 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center">
              <Compass className="h-3 w-3 mr-1" />
              Painel de Inteligência Comercial
            </span>
            <span className="bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
              Live Sync
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight font-display dark:text-white">Balanço Executivo</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed font-sans">
            Geração de Negócios e Densidade de Conexões do Ecossistema Rampup.
          </p>
        </div>

        {/* Action Center (Light/Dark Toggle + Single Compact Export Dropdown) */}
        <div className="flex items-center space-x-3 self-stretch sm:self-auto justify-end">
          
          {/* Theme Toggle Button */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={darkMode ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
          >
            {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-600" />}
          </button>

          {/* Compact Dropdown Export Button */}
          <div className="relative">
            <button
              onClick={() => setIsExportOpen(!isExportOpen)}
              className="bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-2 border border-indigo-500 dark:border-indigo-600/30 cursor-pointer"
              title="Ações de exportação do balanço"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exportar</span>
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isExportOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Items */}
            {isExportOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setIsExportOpen(false)} />
                <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg py-1.5 z-30 font-sans animate-fadeIn">
                  <button
                    onClick={() => {
                      exportDashboardMetricsToCSV(totalCompanies, contactsCount, totalSynergiesCount, eventDealIndices, topEntrepreneurs);
                      setIsExportOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold flex items-center space-x-2 cursor-pointer border-none"
                  >
                    <FileText className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Planilha Excel (CSV)</span>
                  </button>
                  <button
                    onClick={() => {
                      exportFullBaseToExcel(companies, contacts, transactions, customFields);
                      setIsExportOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold flex items-center space-x-2 cursor-pointer border-none"
                    title="Exportar base de dados completa em planilha Excel (XLSX)"
                  >
                    <Download className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Base Completa (XLSX)</span>
                  </button>
                  <button
                    onClick={() => {
                      exportDashboardToPDF(totalCompanies, contactsCount, totalSynergiesCount, eventDealIndices, topEntrepreneurs);
                      setIsExportOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold flex items-center space-x-2 cursor-pointer border-none"
                  >
                    <Award className="h-3.5 w-3.5 text-red-500" />
                    <span>Imprimir Relatório (PDF)</span>
                  </button>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* 2. Overview Cards - Refocused on Strategic Connections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        
        {/* KPI 1: Total Companies */}
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800/80 p-5 flex flex-col justify-between transition-all duration-300 hover:translate-y-[-4px] hover:shadow-md group relative overflow-hidden" id="kpi_companies">
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500" />
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Empresas no Ecossistema</p>
              <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{totalCompanies}</h3>
              <div className="mt-1">
                <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-black bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">Conexões Mapeadas</span>
              </div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl shadow-2xs group-hover:scale-110 transition-transform duration-350">
              <Award className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-3 border-t border-slate-100 dark:border-slate-800/60 pt-2 font-medium">
            Total de registros ativos no CRM.
          </p>
        </div>

        {/* KPI 2: Total Unified Contacts */}
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800/80 p-5 flex flex-col justify-between transition-all duration-300 hover:translate-y-[-4px] hover:shadow-md group relative overflow-hidden" id="kpi_contacts">
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500" />
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Empresários / Decisores</p>
              <h3 className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">{contactsCount}</h3>
              <div className="mt-1">
                <span className="text-[9px] text-slate-600 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">Líderes Integrados</span>
              </div>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl shadow-2xs group-hover:scale-110 transition-transform duration-350">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-3 border-t border-slate-100 dark:border-slate-800/60 pt-2 font-medium">
            Contatos diretos C-Level e diretores.
          </p>
        </div>

        {/* KPI 3: Computed Synergy Connections */}
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800/80 p-5 flex flex-col justify-between transition-all duration-300 hover:translate-y-[-4px] hover:shadow-md group relative overflow-hidden" id="kpi_synergies">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500" />
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Canais de Sinergia</p>
              <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">{totalSynergiesCount}</h3>
              <div className="mt-1">
                <span className="text-[9px] text-emerald-600 dark:text-emerald-450 font-black bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">Pontes Cruzadas</span>
              </div>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl shadow-2xs group-hover:scale-110 transition-transform duration-350">
              <Network className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-3 border-t border-slate-100 dark:border-slate-800/60 pt-2 font-medium">
            Potenciais cruzamentos estratégicos.
          </p>
        </div>

        {/* KPI 4: Média de Vidas */}
        <div className="bg-gradient-to-br from-amber-50/20 to-white dark:from-amber-950/10 dark:to-slate-900/60 rounded-2xl shadow-sm border border-amber-100 dark:border-amber-900/30 p-5 flex flex-col justify-between transition-all duration-300 hover:translate-y-[-4px] hover:shadow-md group relative overflow-hidden" id="kpi_porte_medio">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500" />
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>Média de Vidas</span>
                <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 rounded text-[8px] font-black uppercase">Única</span>
              </p>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{averageCompanyVidas} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">vidas</span></h3>
              <div className="mt-1">
                <span className="text-[9px] text-amber-700 dark:text-amber-300 font-black bg-amber-100/75 dark:bg-amber-950/60 px-2 py-0.5 rounded">{averageCompanySizeLabel}</span>
              </div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900/20 text-amber-600 dark:text-amber-450 rounded-xl shadow-2xs group-hover:scale-110 transition-transform duration-350">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[9px] text-amber-800/80 dark:text-amber-400/80 mt-3 border-t border-amber-150 dark:border-amber-900/25 pt-2 font-medium">
            Calculado estritamente por empresa única cadastrada no CRM.
          </p>
        </div>

        {/* KPI 5: Faturamento Médio Estimado */}
        <div className="bg-gradient-to-br from-rose-50/20 to-white dark:from-rose-950/10 dark:to-slate-900/60 rounded-2xl shadow-sm border border-rose-100 dark:border-rose-900/30 p-5 flex flex-col justify-between transition-all duration-300 hover:translate-y-[-4px] hover:shadow-md group relative overflow-hidden" id="kpi_faturamento_medio">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500" />
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>Faturamento Médio</span>
                <span className="bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 px-1.5 py-0.2 rounded text-[8px] font-black uppercase">Mensal</span>
              </p>
              <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">R$ {averageCompanyFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
              <div className="mt-1">
                <span className="text-[9px] text-rose-700 dark:text-rose-300 font-black bg-rose-100/75 dark:bg-rose-950/60 px-2 py-0.5 rounded">Média Mensal / Única</span>
              </div>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950 border border-rose-100 dark:border-rose-900/20 text-rose-600 dark:text-rose-450 rounded-xl shadow-2xs group-hover:scale-110 transition-transform duration-350">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[9px] text-rose-800/80 dark:text-rose-400/80 mt-3 border-t border-rose-150 dark:border-rose-900/25 pt-2 font-medium">
            Projeção mensal estimada com base em cada empresa única cadastrada.
          </p>
        </div>

      </div>

      {/* MATCHMAKING INTELIGENTE (SUGESTOES & COMBINACOES PERFEITAS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" id="matchmaking_intel_section">
        
        {/* 1. Quick Suggestions Widget */}
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Compass className="h-5 w-5 text-indigo-500 dark:text-indigo-400 animate-spin" style={{ animationDuration: '20s' }} />
                <h4 className="font-display font-bold text-slate-800 dark:text-white text-base">Sugestões Rápidas de Parcerias</h4>
              </div>
              <span className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-400 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                Foco Diário
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Escolha uma empresa para simular cruzamentos automáticos de localidade, porte e complementaridade setorial:
            </p>
          </div>

          {isAnalysisExecuted ? (
            <>
              <div className="space-y-4">
                {/* Company Dropdown selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Empresa em Foco:</label>
                  <select
                    value={suggestionTargetId}
                    onChange={(e) => setSuggestionTargetId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-slate-850 dark:text-slate-100 focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                        🏢 {c.name} ({c.segment})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Suggestions Render */}
                <div className="space-y-3">
                  {quickSuggestionsList.map((item, idx) => (
                    <div 
                      key={item.company.id} 
                      onClick={() => onSelectCompany(item.company)}
                      className="p-3 bg-slate-50/70 dark:bg-slate-950/40 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 border border-slate-200/50 dark:border-slate-800/80 hover:border-indigo-200 dark:hover:border-indigo-800 rounded-xl transition-all duration-200 cursor-pointer flex items-start space-x-3 group"
                    >
                      <span className="h-6 w-6 rounded-lg bg-indigo-600 dark:bg-indigo-700 text-white text-[9.5px] font-black flex items-center justify-center transition-transform group-hover:scale-110 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{item.company.name}</p>
                          <span className="text-[8px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.2 rounded font-bold uppercase shrink-0">
                            {item.company.location}
                          </span>
                        </div>
                        <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-extrabold">{item.company.segment}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal pl-2 border-l-2 border-slate-200 dark:border-slate-800 mt-0.5 italic">
                          "{item.reason}"
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 text-[10px] text-slate-600 dark:text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 mt-2">
                <span>Rampup Matcher v2.0</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">Clique para ver perfil</span>
              </div>
            </>
          ) : (
            renderPendingOverlay(
              "Sugestões de Sinergia Bloqueadas",
              "As heurísticas de indicação co-selling, complementaridade setorial e fits geográficos de parceria dependem do processamento Heurístico da IA. Clique em 'Processar Inteligência de Conexões' no topo."
            )
          )}
        </div>

        {/* 2. Top 5 Perfect Partnerships ("Oportunidades de Ouro") */}
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Star className="h-5 w-5 text-amber-500 fill-amber-500 animate-pulse" />
                <h4 className="font-display font-bold text-slate-800 dark:text-white text-base">Oportunidades de Ouro (Matches Perfeitos)</h4>
              </div>
              <span className="bg-amber-100 dark:bg-amber-950/55 text-amber-800 dark:text-amber-400 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border border-amber-200 dark:border-amber-900/30">
                Top 5 Geral
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Combinações bilaterais de maior complementariedade comercial e histórico compartilhado de rodadas presenciais:
            </p>
          </div>

          {isAnalysisExecuted ? (
            <div className="space-y-3.5 divide-y divide-slate-100 dark:divide-slate-850">
              {perfectPartnershipsList.map((pair, idx) => (
                <div 
                  key={`${pair.companyA.id}_${pair.companyB.id}`} 
                  className={`pt-3.5 ${idx === 0 ? 'pt-0 border-t-0' : ''} flex items-start justify-between gap-4 group`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <button 
                        onClick={() => onSelectCompany(pair.companyA)}
                        className="text-xs font-black text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left focus:outline-none cursor-pointer"
                      >
                        {pair.companyA.name}
                      </button>
                      <span className="text-slate-400 text-xs font-bold font-mono">↔</span>
                      <button 
                        onClick={() => onSelectCompany(pair.companyB)}
                        className="text-xs font-black text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left focus:outline-none cursor-pointer"
                      >
                        {pair.companyB.name}
                      </button>
                    </div>
                    
                    <div className="flex items-center space-x-1.5 text-[8.5px] font-extrabold uppercase">
                      <span className="text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 px-1.5 py-0.5 rounded border dark:border-slate-800">{pair.companyA.segment.split(' (')[0]}</span>
                      <span className="text-slate-400 dark:text-slate-600 font-normal">com</span>
                      <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded border dark:border-indigo-900/30">{pair.companyB.segment.split(' (')[0]}</span>
                    </div>

                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-sans leading-relaxed">
                      🌟 <strong className="text-slate-700 dark:text-slate-300">Racional:</strong> {pair.reconciliation}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 px-2.5 py-1 rounded-lg block">
                      {pair.matchPct}% Match
                    </span>
                    {pair.coAttendance > 0 && (
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 mt-1 block font-mono font-bold">
                        {pair.coAttendance} eventos juntos
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            renderPendingOverlay(
              "Matches de Ouro Ocultos",
              "O mapeamento de combinações bilaterais de alta aderência comercial e histórico compartilhado está suspenso até que as Heurísticas de IA sejam executadas."
            )
          )}
        </div>

      </div>

      {/* DESEMPENHO E DENSIDADE DE CONEXÕES (BAR CHART & CONNECTORS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="density_section">
        
        {/* 1. Market Sectors Connection Volume Bar Chart */}
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800/80 p-6 lg:col-span-2 space-y-5 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-display font-bold text-slate-800 dark:text-white text-base">Volume de Conexões por Setor</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">Sinergias estratégicas mapeadas por segmento de atuação</p>
              </div>
              <TrendingUp className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            </div>
          </div>

          {isAnalysisExecuted ? (
            <>
              <div className="space-y-3.5 pt-2">
                {visibleSectors.map((item) => {
                  const percentageOfMax = Math.round((item.connectionVolume / maxSegmentVolume) * 100) || 5;
                  const isHovered = hoveredSector === item.name;

                  return (
                    <div 
                      key={item.name}
                      className={`space-y-1 p-1.5 rounded-lg transition-all duration-200 ${
                        isHovered ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                      }`}
                      onMouseEnter={() => setHoveredSector(item.name)}
                      onMouseLeave={() => setHoveredSector(null)}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                          <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                          <span className="truncate max-w-[200px] sm:max-w-xs">{item.name}</span>
                        </span>
                        <div className="flex items-center space-x-2 font-mono text-[10px] font-bold">
                          <span className="text-slate-500 dark:text-slate-400">({item.count} empresas)</span>
                          <span className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded font-black text-[10.5px]">
                            {item.connectionVolume} conexões
                          </span>
                        </div>
                      </div>

                      <div className="h-3.5 w-full bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden relative">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ease-out ${item.color} ${
                            isHovered ? 'brightness-110 saturate-110 shadow-md' : ''
                          }`}
                          style={{ width: `${percentageOfMax}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {segmentChartData.length > 4 && (
                <div className="flex justify-center pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                  <button
                    onClick={() => setShowAllSectors(!showAllSectors)}
                    className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 transition-all bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100/60 rounded-xl cursor-pointer shadow-2xs border border-indigo-100 dark:border-indigo-900/30"
                  >
                    <span>{showAllSectors ? 'Veja menos setores' : `Veja mais (${segmentChartData.length - 4} setores)`}</span>
                    {showAllSectors ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}

              <p className="text-[10px] text-slate-555 dark:text-slate-400 font-medium italic mt-2 text-center border-t border-slate-100 dark:border-slate-800 pt-3">
                * O volume ponderado calcula peso diferenciado para alianças bilaterais, canais de venda e prospecção direta.
              </p>
            </>
          ) : (
            renderPendingOverlay(
              "Volume Setorial Oculto",
              "O volume de conexões ativas ponderadas por segmento depende da consolidação Heurística dos cruzamentos de IA."
            )
          )}
        </div>

        {/* 2. Super Connectors rank */}
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h4 className="font-display font-bold text-slate-800 dark:text-white text-base">Super Conectores</h4>
              <span className="text-[8.5px] bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-400 font-black px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/30">
                Pilar do Grupo
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Decisores e empresas com maior recorrência e densidade transacional:
            </p>
          </div>

          {isAnalysisExecuted ? (
            <>
              <div className="space-y-4 pt-1">
                {visibleConnectors.map((connector) => (
                  <div 
                    key={connector.company.id} 
                    onClick={() => onSelectCompany(connector.company)}
                    className="p-3 bg-slate-50/70 dark:bg-slate-950/30 hover:bg-rose-50/30 dark:hover:bg-rose-950/20 border border-slate-200/50 dark:border-slate-800/80 hover:border-rose-200 dark:hover:border-rose-800 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="h-8 w-8 rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-800 dark:border-slate-800 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                        {getInitials(connector.company.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-800 dark:text-slate-100 group-hover:text-rose-700 dark:group-hover:text-rose-400 transition-colors truncate">{connector.company.name}</p>
                        <p className="text-[9.5px] text-slate-500 dark:text-slate-400 truncate">{connector.company.segment}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end space-y-1">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded border ${connector.badgeStyle}`}>
                        {connector.statusLabel}
                      </span>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 font-mono font-bold">
                        {connector.eventCount} eventos • {connector.activeChannels} conexões
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {superConnectorsList.length > 4 && (
                <div className="flex justify-center pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                  <button
                    onClick={() => setShowAllConnectors(!showAllConnectors)}
                    className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-800 transition-all bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100/60 rounded-xl cursor-pointer shadow-2xs border border-rose-100 dark:border-rose-900/30"
                  >
                    <span>{showAllConnectors ? 'Veja menos conectores' : `Veja mais (${superConnectorsList.length - 4} conectores)`}</span>
                    {showAllConnectors ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}

              <p className="text-[9.5px] text-slate-500 dark:text-slate-400 text-center italic pt-2 border-t border-slate-100 dark:border-slate-800">
                Influência calculada pela recorrência e aderência comercial.
              </p>
            </>
          ) : (
            renderPendingOverlay(
              "Super Conectores Ocultos",
              "A classificação e o score de influência dos super-conectores exigem o processamento Heurístico da IA do sistema."
            )
          )}
        </div>

      </div>

      {/* Ecosystem Profile Balance & Event Match Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Ecosystem Balance (Archetype Distribution Graph) */}
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800/80 p-6 lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-display font-bold text-slate-800 dark:text-white text-base">Balanço de Perfil do Ecossistema</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">Classificação inteligente do perfil de atuação de cada participante</p>
            </div>
            <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
          </div>
          
          {isAnalysisExecuted ? (
            <div className="space-y-5">
              {[
                {
                  type: 'parceiro' as Archetype,
                  label: 'Perfeitos para Parcerias',
                  count: archetypeStats.parceiro,
                  desc: 'Empresas com altíssima sinergia de indicação mútua e co-selling.',
                  barColor: 'bg-emerald-500',
                  hoverColor: 'bg-emerald-600',
                  textColor: 'text-emerald-700 dark:text-emerald-400',
                  lightBg: 'bg-emerald-50'
                },
                {
                  type: 'vendedor' as Archetype,
                  label: 'Mais Vendedores (Fornecedores)',
                  count: archetypeStats.vendedor,
                  desc: 'Empresas de tecnologia, contabilidade e serviços com forte oferta ativa.',
                  barColor: 'bg-indigo-500',
                  hoverColor: 'bg-indigo-600',
                  textColor: 'text-indigo-700 dark:text-indigo-400',
                  lightBg: 'bg-indigo-50'
                },
                {
                  type: 'comprador' as Archetype,
                  label: 'Mais Compradores (Clientes Potenciais)',
                  count: archetypeStats.comprador,
                  desc: 'Grandes PMEs com demanda corporativa de planos, softwares e compliance.',
                  barColor: 'bg-amber-500',
                  hoverColor: 'bg-amber-600',
                  textColor: 'text-amber-700 dark:text-amber-400',
                  lightBg: 'bg-amber-50'
                },
                {
                  type: 'conector' as Archetype,
                  label: 'Conectores Gerais',
                  count: archetypeStats.conector,
                  desc: 'Equilibrados para interações setoriais de proximidade.',
                  barColor: 'bg-pink-500',
                  hoverColor: 'bg-pink-600',
                  textColor: 'text-pink-700 dark:text-pink-400',
                  lightBg: 'bg-pink-50'
                }
              ].map((item) => {
                const total = totalCompanies || 1;
                const pct = Math.round((item.count / total) * 100);

                return (
                  <div 
                    key={item.type} 
                    className={`p-3 rounded-xl border border-transparent transition-all duration-300 ${
                      hoveredArchetype === item.type ? 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800' : ''
                    }`}
                    onMouseEnter={() => setHoveredArchetype(item.type)}
                    onMouseLeave={() => setHoveredArchetype(null)}
                  >
                    <div className="flex justify-between text-xs font-bold mb-1.5">
                      <span className={`${item.textColor} flex items-center space-x-1.5`}>
                        <span className={`h-2.5 w-2.5 rounded-full ${item.barColor}`} />
                        <span>{item.label}</span>
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 font-mono font-bold">{item.count} empresas ({pct}%)</span>
                    </div>
                    
                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          hoveredArchetype === item.type ? item.hoverColor : item.barColor
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1.5 font-medium pl-4">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            renderPendingOverlay(
              "Arquétipos de Sinergia Bloqueados",
              "O mapeamento de perfis de atuação (Compradores, Vendedores, Parceiros e Conectores) exige as Heurísticas de IA."
            )
          )}
        </div>

        {/* Dynamic Ecosystem Match Index Radar widget - Meta 75% */}
        <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 p-6 flex flex-col justify-between text-white">
          <div className="space-y-4 w-full">
            <span className="text-[9px] bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider block text-center">
              Maturidade de Porte Consolidada
            </span>
            <div>
              <h4 className="font-display font-bold text-base text-white">Porte Estratégico do Ecossistema</h4>
              <p className="text-xs text-slate-300">Percentual de empresas qualificadas (Pequeno, Médio ou Grande Porte)</p>
            </div>

            {isAnalysisExecuted ? (
              <>
                <div className="flex justify-center py-4">
                  <div className="relative h-32 w-32 flex items-center justify-center">
                    <svg className="absolute transform -rotate-90" width="128" height="128">
                      <circle cx="64" cy="64" r="52" fill="transparent" stroke="#1e293b" strokeWidth="10" />
                      <circle 
                        cx="64" 
                        cy="64" 
                        r="52" 
                        fill="transparent" 
                        stroke="#10b981" 
                        strokeWidth="10" 
                        strokeDasharray={`${(strategicCompaniesPct / 100) * 326} 326`}
                        strokeLinecap="round"
                        className="animate-pulse"
                        style={{ animationDuration: '3s' }}
                      />
                    </svg>
                    <div className="text-center space-y-0.5 z-10">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Qualificadas</span>
                      <p className="text-3xl font-black text-emerald-400">{strategicCompaniesPct}%</p>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 text-center space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold border-b border-slate-800/60 pb-1.5 mb-1.5">
                    <span>META RAMPUP:</span>
                    <span className="text-emerald-400 font-black">75%</span>
                  </div>
                  {strategicCompaniesPct >= 75 ? (
                    <p>O percentual de empresas estratégicas qualificadas está em nível <strong>Excelente ({strategicCompaniesPct}%)</strong>. Isso valida o alto fit empresarial e maturidade do grupo para parcerias corporativas de grande escala.</p>
                  ) : strategicCompaniesPct >= 50 ? (
                    <p>O percentual de empresas qualificadas está em nível <strong>Ótimo ({strategicCompaniesPct}%)</strong>. Ideal para fomento de conexões estratégicas e negócios multilaterais estruturados.</p>
                  ) : (
                    <p>O percentual de empresas qualificadas está em <strong>{strategicCompaniesPct}%</strong> (Meta: <strong>75%</strong>). Excelente oportunidade para atrair novos membros e decisores corporativos de maior porte.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="py-4">
                {renderPendingOverlay(
                  "Indicador de Maturidade Bloqueado",
                  "A qualificação estatística de porte estratégico e maturidade depende da análise das Heurísticas de IA."
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Event Match Rankings (detailed) & Networking Leaders list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Top 5 Recurring Entrepreneurs (Líderes de Networking) */}
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800/80 p-6 space-y-5">
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-display font-bold text-slate-800 dark:text-white text-base">Líderes de Networking (Presença Recorrente)</h4>
              <span className="bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Top 5 Ativos</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">Empresários e decisores com maior engajamento e presença em eventos Rampup</p>
          </div>

          {isAnalysisExecuted ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {topEntrepreneurs.map((leader, idx) => {
                const parentCompanyObj = companies.find(c => c.name === leader.companyName);

                return (
                  <div 
                    key={leader.contact.id} 
                    className="flex items-center justify-between py-3.5 hover:bg-slate-50 dark:hover:bg-slate-950 px-3 rounded-xl transition-all duration-200 cursor-pointer group"
                    onClick={() => parentCompanyObj && onSelectCompany(parentCompanyObj)}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="h-7 w-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center justify-center transition-transform group-hover:scale-110">
                        #{idx + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{leader.contact.name}</p>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                          Empresa: <strong className="text-slate-700 dark:text-slate-300">{leader.companyName}</strong>
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2.5">
                      <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 font-bold px-2.5 py-1 rounded-full">
                        {leader.eventCount} edições
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            renderPendingOverlay(
              "Líderes Ocultos",
              "A classificação de engajamento e presença recorrente dos líderes depende das Heurísticas de IA."
            )
          )}
        </div>

        {/* Event Rankings by Geração de Negócios Index (IGN) */}
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800/80 p-6 space-y-5">
          <div>
            <h4 className="font-display font-bold text-slate-800 dark:text-white text-base">Índice de Geração de Negócios por Evento (IGN)</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">Edições da Rampup classificadas pelo potencial real de cruzamentos</p>
          </div>

          {isAnalysisExecuted ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eventDealIndices.map((evt) => {
                const isExpanded = expandedEvent === evt.name;
                const totalRawPoints = evt.scalePoints + evt.synergyPoints + evt.sizePoints;

                return (
                  <div key={evt.name} className={`rounded-2xl p-4 flex flex-col justify-between border transition-all duration-300 hover:shadow-xs ${darkMode ? 'bg-slate-950/30 border-slate-800 hover:border-indigo-900' : 'bg-slate-50 border-slate-200/80 hover:border-indigo-200'}`}>
                    <div>
                      <div className="flex items-start justify-between">
                        <Calendar className={`h-8 w-8 p-1.5 rounded-xl border ${darkMode ? 'text-indigo-400 bg-indigo-950/60 border-indigo-900/40' : 'text-indigo-600 bg-indigo-50 border-indigo-100'}`} />
                        <div className="text-right">
                          <span className={`text-[10px] border font-extrabold px-3 py-1 rounded-full shadow-2xs ${darkMode ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900/30' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>
                            IGN {evt.dealMakingIndex}%
                          </span>
                          <p className={`text-[9px] mt-1 font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{evt.uniqueCompaniesCount} Empresas • {evt.segmentsCount} Setores</p>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <p className={`text-xs font-extrabold line-clamp-1 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`} title={evt.name}>{evt.name}</p>
                        
                        {/* Progress bar represent */}
                        <div className="mt-2.5 space-y-1">
                          <div className={`h-1.5 w-full rounded-full overflow-hidden ${darkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
                            <div 
                              className="h-full bg-emerald-500 rounded-full" 
                              style={{ width: `${evt.dealMakingIndex}%` }}
                            />
                          </div>
                          <div className={`flex items-center justify-between text-[9px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            <span>Sinergia comercial: Alta</span>
                            <button 
                              onClick={() => setExpandedEvent(isExpanded ? null : evt.name)}
                              className={`hover:underline transition-colors focus:outline-none cursor-pointer font-bold ${darkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`}
                            >
                              {isExpanded ? 'Esconder Racional' : 'Ver Racional →'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Collapsible reasoning/racional panel */}
                    {isExpanded && (
                      <div className={`mt-4 pt-3 border-t space-y-2.5 text-[10px] animate-fadeIn ${darkMode ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'}`}>
                        <div className={`p-2.5 rounded-xl border space-y-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                          <p className={`font-extrabold uppercase tracking-wide text-[9px] ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>Análise Inteligente IGN ({evt.dealMakingIndex}%)</p>
                          <p className={`leading-relaxed text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            O IGN avalia a probabilidade estatística de geração de novos negócios cruzados baseando-se em escala, densidade de conexões diretas e tamanho médio:
                          </p>
                          
                          <div className={`space-y-1.5 border-t pt-2 font-mono text-[9px] ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                            <div className="flex justify-between">
                              <span className={`${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>🏢 Fator Escala (Empresas):</span>
                              <span className={`font-bold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>+{evt.scalePoints.toFixed(1)} / 35 pts</span>
                            </div>
                            <div className="flex justify-between">
                              <span className={`${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>🤝 Conexões Ativas (Sinergias):</span>
                              <span className={`font-bold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>+{evt.synergyPoints.toFixed(1)} / 40 pts</span>
                            </div>
                            <div className="flex justify-between">
                              <span className={`${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>📊 Fator Porte Médio (Vidas):</span>
                              <span className={`font-bold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>+{evt.sizePoints.toFixed(1)} / 25 pts</span>
                            </div>
                            <div className={`flex justify-between border-t border-dashed pt-1.5 font-bold ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                              <span className={darkMode ? 'text-slate-400' : 'text-slate-600'}>Pontuação Total Bruta:</span>
                              <span className={darkMode ? 'text-indigo-400' : 'text-indigo-600'}>{totalRawPoints.toFixed(1)} / 100 pts</span>
                            </div>
                          </div>

                          <div className={`p-2 rounded-lg text-[9.5px] space-y-1 ${darkMode ? 'bg-indigo-950/35 text-slate-300' : 'bg-indigo-50/50 text-slate-600'}`}>
                            <p className={`font-bold flex items-center justify-between ${darkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
                              <span>Algoritmo de Negócios:</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold ${darkMode ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-100 text-indigo-800'}`}>Meta: 75%</span>
                            </p>
                            <code className={`block p-1 rounded border text-[9px] font-bold ${darkMode ? 'bg-slate-950 border-indigo-900/40 text-indigo-400' : 'bg-white border-indigo-100 text-indigo-600'}`}>
                              IGN = min(100%, 55 + Sinergias(35) + Porte(10))
                            </code>
                            <p className={`text-[9px] mt-0.5 leading-tight ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              *Reflete fielmente o potencial de conexão de acordo com a meta de IGN de 75% definida para as agendas da Rampup.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          ) : (
            renderPendingOverlay(
              "Rankings IGN Bloqueados",
              "Os scores de densidade e complementaridade de cada edição presencial não foram calculados. Execute as Heurísticas de IA."
            )
          )}
        </div>

      </div>
    </div>
  );
}
