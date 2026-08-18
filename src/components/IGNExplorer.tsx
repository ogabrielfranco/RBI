import React, { useState, useMemo } from 'react';
import { Company, Transaction, Contact } from '../types';
import { calculateEventDealIndices, getCompanyArchetype } from '../utils/strategicHelpers';
import { analyzeConnections } from '../data/matchEngine';
import { 
  TrendingUp, Users, Building2, Zap, Search, ArrowRight, Info, 
  Calendar, MapPin, Handshake, ShoppingBag, Target, Activity, Award, Sparkles
} from 'lucide-react';

interface IGNExplorerProps {
  companies: Company[];
  transactions: Transaction[];
  contactsCount: number;
  isAnalysisExecuted?: boolean;
  triggerAnalysisRun?: () => void;
}

export default function IGNExplorer({ 
  companies, 
  transactions, 
  contactsCount,
  isAnalysisExecuted = false,
  triggerAnalysisRun
}: IGNExplorerProps) {
  const [selectedEventName, setSelectedEventName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'partners' | 'members'>('sales');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');

  // 1. Calculate the IGN for all agendas
  const allEventsIGN = useMemo(() => {
    return calculateEventDealIndices(transactions, companies);
  }, [transactions, companies]);

  // Set the default selected event to the first one if not set
  useMemo(() => {
    if (!selectedEventName && allEventsIGN.length > 0) {
      setSelectedEventName(allEventsIGN[0].name);
    }
  }, [allEventsIGN, selectedEventName]);

  // Filter events based on search query
  const filteredEvents = useMemo(() => {
    if (!searchQuery) return allEventsIGN;
    return allEventsIGN.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allEventsIGN, searchQuery]);

  // 2. Get detailed participant data for the SELECTED event
  const selectedEventDetails = useMemo(() => {
    return allEventsIGN.find(e => e.name === selectedEventName) || null;
  }, [allEventsIGN, selectedEventName]);

  // Find all transactions for this event
  const eventTransactions = useMemo(() => {
    return transactions.filter(t => t.eventName === selectedEventName);
  }, [transactions, selectedEventName]);

  // Get unique participating company objects
  const eventCompanies = useMemo(() => {
    const ids = Array.from(new Set(eventTransactions.map(t => t.companyId)));
    return ids
      .map(id => companies.find(c => c.id === id))
      .filter(Boolean) as Company[];
  }, [eventTransactions, companies]);

  // 3. Compute crossing matchmaking pairs within the event (potential B2B matchings)
  const matchesData = useMemo(() => {
    if (!isAnalysisExecuted || eventCompanies.length < 2) {
      return { sales: [], partners: [], crossingPotential: 0, totalPossiblePairs: 0 };
    }

    const salesMatches: Array<{ seller: Company; buyer: Company; reason: string }> = [];
    const partnersMatches: Array<{ partnerA: Company; partnerB: Company; reason: string }> = [];
    let activeSynergiesCount = 0;

    const N = eventCompanies.length;
    const totalPossiblePairs = (N * (N - 1)) / 2;

    // Direct B2B Sales (Seller can sell to Buyer)
    eventCompanies.forEach(compA => {
      const analysis = analyzeConnections(compA, eventCompanies);
      analysis.potentialBuyerIds.forEach(buyerId => {
        const buyerComp = eventCompanies.find(c => c.id === buyerId);
        if (buyerComp) {
          const reason = analysis.reasons[`sell_${buyerId}`] || '';
          salesMatches.push({
            seller: compA,
            buyer: buyerComp,
            reason
          });
        }
      });
    });

    // Strategic Partnerships (Mutual Synergy)
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const compA = eventCompanies[i];
        const compB = eventCompanies[j];
        const analysis = analyzeConnections(compA, [compB]);
        
        let hasSynergy = false;
        
        if (analysis.potentialPartnerIds.includes(compB.id)) {
          const reason = analysis.reasons[`partner_${compB.id}`] || '';
          partnersMatches.push({
            partnerA: compA,
            partnerB: compB,
            reason
          });
          hasSynergy = true;
        }

        if (
          hasSynergy ||
          analysis.potentialBuyerIds.includes(compB.id) ||
          analysis.potentialSellerIds.includes(compB.id)
        ) {
          activeSynergiesCount++;
        }
      }
    }

    const crossingPotential = totalPossiblePairs > 0 
      ? Math.round((activeSynergiesCount / totalPossiblePairs) * 100)
      : 0;

    return {
      sales: salesMatches,
      partners: partnersMatches,
      crossingPotential,
      totalPossiblePairs
    };
  }, [eventCompanies]);

  // Individual company matchmaking inside this event
  const memberMatchProfile = useMemo(() => {
    if (!isAnalysisExecuted || !selectedMemberId) return null;
    const memberComp = eventCompanies.find(c => c.id === selectedMemberId);
    if (!memberComp) return null;

    const analysis = analyzeConnections(memberComp, eventCompanies);
    
    const buyers = analysis.potentialBuyerIds
      .map(id => eventCompanies.find(c => c.id === id))
      .filter(Boolean) as Company[];

    const sellers = analysis.potentialSellerIds
      .map(id => eventCompanies.find(c => c.id === id))
      .filter(Boolean) as Company[];

    const partners = analysis.potentialPartnerIds
      .map(id => eventCompanies.find(c => c.id === id))
      .filter(Boolean) as Company[];

    return {
      company: memberComp,
      buyers,
      sellers,
      partners,
      analysis
    };
  }, [selectedMemberId, eventCompanies]);

  // Reset selected member when event changes
  React.useEffect(() => {
    if (eventCompanies.length > 0) {
      setSelectedMemberId(eventCompanies[0].id);
    } else {
      setSelectedMemberId('');
    }
  }, [selectedEventName, eventCompanies]);

  // Event extra meta (like date and city)
  const eventMeta = useMemo(() => {
    if (eventTransactions.length === 0) return { date: 'N/A', city: 'Fortaleza, CE' };
    const sorted = [...eventTransactions].sort((a, b) => b.eventDate.localeCompare(a.eventDate));
    return {
      date: sorted[0].eventDate || 'N/A',
      city: sorted[0].eventLocation || 'Fortaleza, CE'
    };
  }, [eventTransactions]);

  const getScoreColor = (score: number) => {
    if (score >= 75) return { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-900/40', progress: 'stroke-emerald-500' };
    if (score >= 50) return { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-900/40', progress: 'stroke-amber-500' };
    return { bg: 'bg-slate-50 dark:bg-slate-900/40', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-800', progress: 'stroke-indigo-500' };
  };

  return (
    <div className="space-y-8 animate-fade-in" id="ign_explorer_root">
      {/* Overview Intro Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 dark:from-slate-950 dark:via-[#090d16] dark:to-[#0f172a] rounded-3xl p-6 md:p-8 text-white border border-indigo-500/20 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <Zap className="h-64 w-64 text-indigo-400" />
        </div>
        <div className="max-w-3xl space-y-3 relative z-10">
          <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-indigo-300">
            Inteligência de Rede & Matchmaking
          </span>
          <h2 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight">
            Análise Avançada de IGN & Cruzamentos B2B
          </h2>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-medium">
            O <strong>IGN (Índice de Geração de Negócios)</strong> reflete a densidade de conexões reais entre compradores, vendedores e parceiros estratégicos presentes em cada agenda de eventos. Descubra pontes inexploradas, quem pode fornecer para quem e a sinergia consolidada do ecossistema.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* SIDEBAR: Event Agendas List */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <h3 className="text-base font-bold font-display text-slate-800 dark:text-white">Agendas de Eventos</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Selecione uma agenda para auditar cruzamentos</p>
          </div>

          {/* Search bar for agendas */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar agenda ou evento..."
              className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 bg-slate-50/50 dark:bg-slate-950 focus:outline-none focus:border-indigo-500 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          {/* Agendas list items */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredEvents.map(evt => {
              const isSelected = evt.name === selectedEventName;
              const colors = getScoreColor(evt.dealMakingIndex);

              return (
                <div
                  key={evt.name}
                  onClick={() => setSelectedEventName(evt.name)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                    isSelected 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/15' 
                      : 'bg-white dark:bg-slate-950/40 border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="space-y-1 max-w-[70%]">
                    <p className={`text-xs font-black leading-tight ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                      {evt.name}
                    </p>
                    <div className="flex items-center space-x-2 text-[10px] font-semibold opacity-85">
                      <span className="flex items-center space-x-0.5">
                        <Building2 className="h-3 w-3" />
                        <span>{evt.uniqueCompaniesCount} Empresas</span>
                      </span>
                      <span>•</span>
                      <span>{evt.synergiesCalculated} Conexões</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2.5">
                    <div className={`px-2.5 py-1 rounded-lg text-center ${isSelected ? 'bg-white/15 text-white' : `${colors.bg} ${colors.text} border ${colors.border}`} text-[11px] font-black tracking-tight`}>
                      {evt.dealMakingIndex}% <span className="text-[8px] uppercase font-bold">IGN</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredEvents.length === 0 && (
              <div className="py-12 text-center text-slate-400 space-y-1">
                <p className="text-xs font-bold">Nenhuma agenda encontrada.</p>
                <p className="text-[10px]">Altere sua busca para filtrar outras agendas.</p>
              </div>
            )}
          </div>
        </div>

        {/* DETAILS PANEL: Deep-dive of selected agenda */}
        <div className="lg:col-span-8 space-y-6">
          {!isAnalysisExecuted ? (
            <div className="bg-white dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center flex flex-col items-center justify-center space-y-6 h-full min-h-[460px]">
              <div className="h-16 w-16 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 shadow-sm animate-pulse">
                <Zap className="h-8 w-8" />
              </div>
              <div className="space-y-2 max-w-md">
                <h4 className="text-lg font-black font-display text-slate-800 dark:text-white tracking-tight">Cruzamentos e Cruzamento IGN Suspensos</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Para auditar o cruzamento comercial desta agenda, identificar os leads de compra/venda qualificados e a afinidade entre decisores, execute as heurísticas de IA.
                </p>
              </div>
              {triggerAnalysisRun && (
                <button
                  onClick={triggerAnalysisRun}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/20 text-white font-extrabold rounded-xl text-xs flex items-center space-x-2 shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95 animate-bounce"
                  style={{ animationDuration: '3s' }}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Executar Rampup Intel</span>
                </button>
              )}
            </div>
          ) : selectedEventDetails ? (
            <>
              {/* Event scorecard header card */}
              <div className="bg-white dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
                
                {/* Event Name & Metadata */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-5">
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 rounded-lg text-[9px] font-black uppercase tracking-wider">
                        Agenda Auditada
                      </span>
                    </div>
                    <h3 className="text-lg md:text-xl font-black font-display text-slate-800 dark:text-white leading-tight">
                      {selectedEventDetails.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 dark:text-slate-500 font-medium">
                      <span className="flex items-center space-x-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{eventMeta.date}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{eventMeta.city}</span>
                      </span>
                    </div>
                  </div>

                  {/* IGN Gauge */}
                  <div className="flex items-center space-x-4 self-start md:self-auto bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-150 dark:border-slate-850">
                    <div className="relative flex items-center justify-center">
                      <svg className="w-14 h-14 transform -rotate-90">
                        <circle cx="28" cy="28" r="24" fill="transparent" stroke="#e2e8f0" strokeWidth="4" className="dark:stroke-slate-850" />
                        <circle 
                          cx="28" 
                          cy="28" 
                          r="24" 
                          fill="transparent" 
                          stroke="#4f46e5" 
                          strokeWidth="4" 
                          strokeDasharray={`${(selectedEventDetails.dealMakingIndex / 100) * 151} 151`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 leading-none">{selectedEventDetails.dealMakingIndex}%</span>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider leading-none">Índice IGN</p>
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {selectedEventDetails.dealMakingIndex >= 75 ? 'Maturidade Excelente B2B' : 'Geração de Negócios Ótima'}
                      </h4>
                      <p className="text-[9.5px] text-slate-400 leading-none">Com base na sinergia e fit de vidas</p>
                    </div>
                  </div>
                </div>

                {/* Grid of Key Crossing Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  
                  <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 p-4 rounded-xl space-y-1">
                    <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Empresas Presentes</p>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-baseline space-x-1">
                      <span>{selectedEventDetails.uniqueCompaniesCount}</span>
                      <span className="text-xs font-bold text-slate-400">CNPJs</span>
                    </h3>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 p-4 rounded-xl space-y-1">
                    <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Sinergias Ativas</p>
                    <h3 className="text-xl font-black text-indigo-600 dark:text-indigo-400 flex items-baseline space-x-1">
                      <span>{selectedEventDetails.synergiesCalculated}</span>
                      <span className="text-xs font-bold text-indigo-400">pontes</span>
                    </h3>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 p-4 rounded-xl space-y-1">
                    <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Média de Colaboradores</p>
                    <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 flex items-baseline space-x-1">
                      <span>{Math.round(selectedEventDetails.avgVidas)}</span>
                      <span className="text-xs font-bold text-emerald-400">vidas</span>
                    </h3>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 p-4 rounded-xl space-y-1">
                    <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Potencial de Cruzamento</p>
                    <h3 className="text-xl font-black text-purple-600 dark:text-purple-400 flex items-baseline space-x-1" title={`${selectedEventDetails.synergiesCalculated} pontes de ${matchesData.totalPossiblePairs} combinações possíveis`}>
                      <span>{matchesData.crossingPotential}%</span>
                      <span className="text-xs font-bold text-purple-400">real</span>
                    </h3>
                  </div>

                </div>

                {/* Explanation about Potencial Real de Cruzamentos */}
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/60 dark:border-indigo-900/30 p-4 rounded-2xl flex items-start space-x-3 text-xs leading-relaxed text-indigo-950 dark:text-indigo-300">
                  <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Potencial Real de Cruzamentos (Densidade de Oportunidades)</p>
                    <p className="text-slate-600 dark:text-indigo-200">
                      Das <strong>{matchesData.totalPossiblePairs} combinações B2B possíveis</strong> entre as {selectedEventDetails.uniqueCompaniesCount} empresas da agenda, <strong>{matchesData.crossingPotential}%</strong> possuem sinergia de negócios estruturada (demanda real de compra/venda de soluções ou forte fit de cooperação corporativa).
                    </p>
                  </div>
                </div>

              </div>

              {/* Sub tabs inside selected event */}
              <div className="bg-white dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
                
                {/* Switcher Navigation */}
                <div className="flex border-b border-slate-100 dark:border-slate-800 pb-2.5 gap-2 overflow-x-auto">
                  <button
                    onClick={() => setActiveSubTab('sales')}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center space-x-2 ${
                      activeSubTab === 'sales'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span>Oportunidades de Compra & Venda ({matchesData.sales.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveSubTab('partners')}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center space-x-2 ${
                      activeSubTab === 'partners'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Handshake className="h-3.5 w-3.5" />
                    <span>Parcerias Estratégicas ({matchesData.partners.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveSubTab('members')}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center space-x-2 ${
                      activeSubTab === 'members'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Auditoria Individual de Membros</span>
                  </button>
                </div>

                {/* TAB CONTENT: B2B SALES */}
                {activeSubTab === 'sales' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">Cruzamentos de Compra e Venda</h4>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Fluxos onde uma empresa tem a solução que atende diretamente a dor, porte ou segmento de outra da mesma agenda.</p>
                    </div>

                    <div className="space-y-3.5 max-h-[400px] overflow-y-auto pr-1">
                      {matchesData.sales.map((item, idx) => {
                        const sellerArch = getCompanyArchetype(item.seller, companies);
                        const buyerArch = getCompanyArchetype(item.buyer, companies);
                        
                        return (
                          <div 
                            key={`sales_match_${idx}`}
                            className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              {/* Seller */}
                              <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-3xs">
                                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                                <span className="font-extrabold text-slate-800 dark:text-slate-100">{item.seller.name}</span>
                                <span className="text-[9px] text-slate-400">({item.seller.segment})</span>
                              </div>

                              <div className="hidden sm:flex flex-col items-center justify-center text-slate-300 shrink-0 mx-2">
                                <ArrowRight className="h-4 w-4 text-indigo-500 animate-pulse" />
                                <span className="text-[8px] font-black tracking-widest text-indigo-400 uppercase mt-0.5">Vende Para</span>
                              </div>

                              {/* Buyer */}
                              <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-3xs">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                <span className="font-extrabold text-slate-800 dark:text-slate-100">{item.buyer.name}</span>
                                <span className="text-[9px] text-slate-400">({item.buyer.segment} • {item.buyer.vidas} Vidas)</span>
                              </div>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-900/40 p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 font-medium">
                              {item.reason}
                            </p>
                          </div>
                        );
                      })}

                      {matchesData.sales.length === 0 && (
                        <div className="py-12 text-center text-slate-400 space-y-2 bg-slate-50 dark:bg-slate-950/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                          <p className="text-xs font-bold">Nenhum cruzamento de compra/venda direto detectado.</p>
                          <p className="text-[10px]">Tente cadastrar novas empresas ou atualizar suas descrições e vidas para calibrar as heurísticas.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB CONTENT: PARTNERSHIPS */}
                {activeSubTab === 'partners' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">Alianças e Indicações Mútuas</h4>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Parcerias estratégicas onde as duas empresas não concorrem, mas vendem para o mesmo cliente final (ex: Contabilidade + Jurídico).</p>
                    </div>

                    <div className="space-y-3.5 max-h-[400px] overflow-y-auto pr-1">
                      {matchesData.partners.map((item, idx) => {
                        return (
                          <div 
                            key={`partner_match_${idx}`}
                            className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3"
                          >
                            <div className="flex items-center justify-between text-xs">
                              {/* Partner A */}
                              <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-3xs w-[45%]">
                                <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                                <span className="font-extrabold text-slate-800 dark:text-slate-100 truncate">{item.partnerA.name}</span>
                              </div>

                              <div className="text-[10px] text-teal-500 font-extrabold uppercase tracking-wider bg-teal-50 dark:bg-teal-950/40 px-2 py-1 rounded-lg border border-teal-100 dark:border-teal-900/30 shrink-0 mx-2">
                                Sinergia
                              </div>

                              {/* Partner B */}
                              <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-3xs w-[45%]">
                                <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                                <span className="font-extrabold text-slate-800 dark:text-slate-100 truncate">{item.partnerB.name}</span>
                              </div>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-900/40 p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 font-medium">
                              {item.reason}
                            </p>
                          </div>
                        );
                      })}

                      {matchesData.partners.length === 0 && (
                        <div className="py-12 text-center text-slate-400 space-y-2 bg-slate-50 dark:bg-slate-950/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                          <p className="text-xs font-bold">Nenhuma sinergia de indicação mútua direta encontrada.</p>
                          <p className="text-[10px]">Tente diversificar os segmentos das empresas cadastradas no ecossistema.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB CONTENT: MEMBERS INDIVIDUAL AUDIT */}
                {activeSubTab === 'members' && (
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">Perfilador de Conexões de Agenda</h4>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Selecione uma empresa específica presente na agenda para ver o seu raio de atuação e cruzamentos com os demais convidados.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      
                      {/* Left: list of companies inside the event */}
                      <div className="md:col-span-5 border border-slate-150 dark:border-slate-800 rounded-2xl p-3 bg-slate-50/50 dark:bg-slate-950/20 space-y-2 max-h-[340px] overflow-y-auto">
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider px-1 mb-1.5">Membros na Agenda ({eventCompanies.length})</p>
                        {eventCompanies.map(c => {
                          const isSelected = c.id === selectedMemberId;
                          return (
                            <div
                              key={c.id}
                              onClick={() => setSelectedMemberId(c.id)}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer text-xs ${
                                isSelected 
                                  ? 'bg-indigo-600 border-indigo-600 text-white font-bold' 
                                  : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <div className="truncate font-bold">{c.name}</div>
                              <div className={`text-[9.5px] ${isSelected ? 'text-indigo-150' : 'text-slate-400 dark:text-slate-500'}`}>{c.segment}</div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Right: details of matchmaking for selected company */}
                      <div className="md:col-span-7 space-y-4">
                        {memberMatchProfile ? (
                          <div className="border border-slate-200 dark:border-slate-800 p-5 rounded-2xl bg-white dark:bg-slate-950 space-y-4">
                            
                            {/* Profile header */}
                            <div className="border-b border-slate-100 dark:border-slate-800/60 pb-3">
                              <span className="text-[8px] font-black uppercase bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-150 dark:border-indigo-900 px-2 py-0.5 rounded-md">
                                {memberMatchProfile.company.segment}
                              </span>
                              <h4 className="text-base font-black text-slate-800 dark:text-white mt-1">
                                {memberMatchProfile.company.name}
                              </h4>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                Atividade: {memberMatchProfile.company.activity || 'N/A'}
                              </p>
                            </div>

                            {/* Who can they sell to */}
                            <div className="space-y-2">
                              <p className="text-[9px] font-extrabold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">
                                🛒 Pode Vender Para ({memberMatchProfile.buyers.length})
                              </p>
                              {memberMatchProfile.buyers.length > 0 ? (
                                <div className="space-y-1.5">
                                  {memberMatchProfile.buyers.map(b => (
                                    <div key={b.id} className="text-xs bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                      <div className="font-bold text-slate-700 dark:text-slate-200">{b.name}</div>
                                      <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-[11px] leading-relaxed">
                                        {memberMatchProfile.analysis.reasons[`sell_${b.id}`]}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-400 italic">Nenhum comprador imediato na agenda.</p>
                              )}
                            </div>

                            {/* Strategic partners in agenda */}
                            <div className="space-y-2">
                              <p className="text-[9px] font-extrabold text-teal-500 uppercase tracking-wider">
                                🤝 Sinergia / Parcerias na Agenda ({memberMatchProfile.partners.length})
                              </p>
                              {memberMatchProfile.partners.length > 0 ? (
                                <div className="space-y-1.5">
                                  {memberMatchProfile.partners.map(p => (
                                    <div key={p.id} className="text-xs bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                      <div className="font-bold text-slate-700 dark:text-slate-200">{p.name}</div>
                                      <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-[11px] leading-relaxed">
                                        {memberMatchProfile.analysis.reasons[`partner_${p.id}`]}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-400 italic">Nenhum parceiro complementar na agenda.</p>
                              )}
                            </div>

                          </div>
                        ) : (
                          <div className="py-16 text-center text-slate-400 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950">
                            <p className="text-xs">Selecione uma empresa ao lado para analisar.</p>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}

              </div>
            </>
          ) : (
            <div className="py-24 text-center text-slate-400 bg-white dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-sm font-bold">Nenhuma agenda selecionada.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
