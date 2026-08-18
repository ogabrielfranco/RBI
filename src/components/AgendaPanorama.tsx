import React, { useState, useMemo } from 'react';
import { Company, Contact, Transaction } from '../types';
import { 
  calculateEventDealIndices, 
  classifyCompanySize, 
  getCompanyArchetype,
  calculateFinancialAnalysis,
  EventDealIndex 
} from '../utils/strategicHelpers';
import { analyzeConnections } from '../data/matchEngine';
import { exportAgendaToPDF } from '../utils/exportHelpers';
import { 
  Calendar, Users, Building2, TrendingUp, Info, Search, 
  ArrowRight, Check, Sparkles, Zap, Award, BarChart3, 
  PieChart, ShieldAlert, ArrowDown, ArrowUp, Shuffle, 
  ChevronRight, Activity, Plus, FileText, CheckCircle, HelpCircle
} from 'lucide-react';

interface AgendaPanoramaProps {
  companies: Company[];
  transactions: Transaction[];
  contactsCount: number;
  isAnalysisExecuted?: boolean;
  triggerAnalysisRun?: () => void;
}

export default function AgendaPanorama({
  companies,
  transactions,
  contactsCount,
  isAnalysisExecuted = false,
  triggerAnalysisRun
}: AgendaPanoramaProps) {
  const [selectedAgendaA, setSelectedAgendaA] = useState<string>('');
  const [selectedAgendaB, setSelectedAgendaB] = useState<string>(''); // For side-by-side comparison

  // 1. Calculate indices for all agendas
  const allAgendas = useMemo(() => {
    return calculateEventDealIndices(transactions, companies);
  }, [transactions, companies]);

  // Set default selected agendas
  useMemo(() => {
    if (!selectedAgendaA && allAgendas.length > 0) {
      setSelectedAgendaA(allAgendas[0].name);
    }
  }, [allAgendas, selectedAgendaA]);

  // Calculate Overall Averages across ALL agendas in the system for benchmark indicators
  const overallAverages = useMemo(() => {
    if (allAgendas.length === 0) return {
      companies: 0,
      attendance: 0,
      avgVidas: 0,
      synergies: 0,
      ign: 0
    };

    const total = allAgendas.reduce((acc, agenda) => {
      acc.companies += agenda.uniqueCompaniesCount;
      acc.attendance += agenda.attendanceCount;
      acc.avgVidas += agenda.avgVidas;
      acc.synergies += agenda.synergiesCalculated;
      acc.ign += agenda.dealMakingIndex;
      return acc;
    }, { companies: 0, attendance: 0, avgVidas: 0, synergies: 0, ign: 0 });

    const count = allAgendas.length;
    return {
      companies: total.companies / count,
      attendance: total.attendance / count,
      avgVidas: total.avgVidas / count,
      synergies: total.synergies / count,
      ign: total.ign / count
    };
  }, [allAgendas]);

  // Attendance Frequency Map across ALL times (to find heavy user/frequency of each participant)
  const participantTotalFrequency = useMemo(() => {
    const freqMap: Record<string, number> = {};
    transactions.forEach(tx => {
      const email = tx.contactEmail.toLowerCase().trim() || tx.contactName.toLowerCase().trim();
      if (email) {
        freqMap[email] = (freqMap[email] || 0) + 1;
      }
    });
    return freqMap;
  }, [transactions]);

  // Helper function to extract stats for a specific agenda
  const getAgendaStats = (agendaName: string) => {
    if (!agendaName) return null;

    let agendaInfo;
    let txs;

    if (agendaName === '__TODAS__') {
      agendaInfo = {
        name: 'Todas as Agendas (Somatório)',
        uniqueCompaniesCount: companies.length,
        attendanceCount: transactions.length,
        diversityIndex: 100,
        synergiesCalculated: allAgendas.reduce((sum, a) => sum + (a.synergiesCalculated || 0), 0),
        dealMakingIndex: Math.round(allAgendas.reduce((sum, a) => sum + (a.dealMakingIndex || 0), 0) / Math.max(1, allAgendas.length)),
        segmentsCount: Array.from(new Set(companies.map(c => c.segment))).length,
        avgVidas: Math.round(companies.reduce((sum, c) => sum + (c.vidas || 0), 0) / Math.max(1, companies.length)),
        scalePoints: 100,
        diversityPoints: 100,
        synergyPoints: 100,
        sizePoints: 100
      };
      txs = transactions;
    } else {
      agendaInfo = allAgendas.find(a => a.name === agendaName);
      if (!agendaInfo) return null;
      txs = transactions.filter(t => t.eventName === agendaName);
    }

    // Get participating companies
    const compIds = Array.from(new Set(txs.map(t => t.companyId)));
    const agendaCompanies = compIds
      .map(id => companies.find(c => c.id === id))
      .filter(Boolean) as Company[];

    // Unique participants (contacts) in this agenda
    const participantsList = txs.map(t => {
      const company = companies.find(c => c.id === t.companyId);
      return {
        name: t.contactName,
        email: t.contactEmail,
        companyId: t.companyId,
        companyName: company?.name || 'Empresa Convidada',
        ticketType: t.ticketType,
        vidas: company?.vidas ?? 0,
        segment: company?.segment || '',
        company: company,
        value: t.value,
        totalPresences: participantTotalFrequency[t.contactEmail.toLowerCase().trim() || t.contactName.toLowerCase().trim()] || 1
      };
    }).sort((a, b) => b.totalPresences - a.totalPresences);

    // Size distribution of companies (Micro, Pequeno, Medio, Grande)
    const sizes = { micro: 0, pequeno: 0, medio: 0, grande: 0 };
    let totalEmployeeLives = 0;

    agendaCompanies.forEach(c => {
      totalEmployeeLives += c.vidas || 0;
      const sizeClass = classifyCompanySize(c.vidas || 0);
      if (c.vidas <= 10) sizes.micro++;
      else if (c.vidas <= 50) sizes.pequeno++;
      else if (c.vidas <= 200) sizes.medio++;
      else sizes.grande++;
    });

    // Segment distribution
    const segmentCounts: Record<string, number> = {};
    agendaCompanies.forEach(c => {
      segmentCounts[c.segment] = (segmentCounts[c.segment] || 0) + 1;
    });
    const sortedSegments = Object.entries(segmentCounts)
      .map(([name, count]) => ({ name, count, percent: Math.round((count / Math.max(1, agendaCompanies.length)) * 100) }))
      .sort((a, b) => b.count - a.count);

    // Top connectors (companies in this agenda with the highest internal synergy count within this group)
    const topConnectors = agendaCompanies.map(comp => {
      const connections = analyzeConnections(comp, agendaCompanies);
      const synergyCount = connections.potentialBuyerIds.length + connections.potentialSellerIds.length + connections.potentialPartnerIds.length;
      return {
        company: comp,
        synergyCount,
        archetype: getCompanyArchetype(comp, companies)
      };
    }).sort((a, b) => b.synergyCount - a.synergyCount).slice(0, 5);

    // Matchmaking leads discovered in this event (for B2B tab)
    const salesMatches: Array<{ seller: Company; buyer: Company; reason: string }> = [];
    const partnersMatches: Array<{ partnerA: Company; partnerB: Company; reason: string }> = [];

    if (isAnalysisExecuted && agendaCompanies.length >= 2) {
      agendaCompanies.forEach(compA => {
        const analysis = analyzeConnections(compA, agendaCompanies);
        analysis.potentialBuyerIds.forEach(buyerId => {
          const buyerComp = agendaCompanies.find(c => c.id === buyerId);
          if (buyerComp) {
            salesMatches.push({
              seller: compA,
              buyer: buyerComp,
              reason: analysis.reasons[`sell_${buyerId}`] || 'Sinergia comercial identificada.'
            });
          }
        });

        analysis.potentialPartnerIds.forEach(partnerId => {
          const partnerComp = agendaCompanies.find(c => c.id === partnerId);
          if (partnerComp && compA.id < partnerId) { // avoid duplicates for partner connections
            partnersMatches.push({
              partnerA: compA,
              partnerB: partnerComp,
              reason: analysis.reasons[`partner_${partnerId}`] || 'Sinergia e parceria estratégica de canais.'
            });
          }
        });
      });
    }

    return {
      agendaInfo,
      transactions: txs,
      companies: agendaCompanies,
      participants: participantsList,
      sizes,
      totalEmployeeLives,
      sortedSegments,
      topConnectors,
      salesMatches,
      partnersMatches
    };
  };

  const statsA = useMemo(() => getAgendaStats(selectedAgendaA), [selectedAgendaA, companies, transactions, isAnalysisExecuted, participantTotalFrequency]);
  const statsB = useMemo(() => getAgendaStats(selectedAgendaB), [selectedAgendaB, companies, transactions, isAnalysisExecuted, participantTotalFrequency]);

  // List of other agendas to select for comparison
  const availableAgendasForB = useMemo(() => {
    return allAgendas.filter(a => a.name !== selectedAgendaA);
  }, [allAgendas, selectedAgendaA]);

  const renderKPIComparison = (
    label: string, 
    valueA: number, 
    valueB: number | undefined, 
    avgValue: number, 
    formatFn: (v: number) => string = (v) => v.toFixed(0),
    isComparing: boolean
  ) => {
    const isAboveA = valueA >= avgValue;
    const diffA = avgValue > 0 ? ((valueA - avgValue) / avgValue) * 100 : 0;

    return (
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</span>
          {!isComparing && (
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center space-x-0.5 ${
              isAboveA 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30' 
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30'
            }`}>
              {isAboveA ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
              <span>{Math.abs(diffA).toFixed(0)}% vs. média</span>
            </span>
          )}
        </div>

        <div className="mt-2.5 flex items-baseline justify-between">
          <div>
            <span className="text-2xl font-black font-display text-slate-900 dark:text-white">
              {formatFn(valueA)}
            </span>
            {isComparing && <span className="text-[10px] text-slate-400 block mt-0.5">Agenda Principal</span>}
          </div>

          {isComparing && valueB !== undefined && (
            <div className="text-right border-l border-slate-200 dark:border-slate-800 pl-4">
              <span className="text-xl font-extrabold text-slate-600 dark:text-slate-300">
                {formatFn(valueB)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Comparativa</span>
            </div>
          )}
        </div>

        {/* Mini benchmark explanation */}
        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between text-[10px] text-slate-400">
          <span>Média geral: {formatFn(avgValue)}</span>
          {!isComparing && (
            <span className={`font-semibold ${isAboveA ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              {isAboveA ? 'Acima da média geral' : 'Abaixo da média'}
            </span>
          )}
        </div>
      </div>
    );
  };

  const handleExportAgendaPDF = () => {
    if (!statsA) return;
    const agendaName = statsA.agendaInfo?.name || selectedAgendaA || 'Todas as Agendas';
    const companiesCount = statsA.companies?.length || 0;
    const segmentsCount = statsA.sortedSegments?.length || 0;
    const avgVidas = statsA.agendaInfo?.avgVidas || 0;
    const dealMakingIndex = statsA.agendaInfo?.dealMakingIndex || 0;
    const participants = statsA.companies || [];
    const topSegments = statsA.sortedSegments?.map(s => ({ segment: s.name, count: s.count })) || [];
    
    exportAgendaToPDF(
      agendaName,
      companiesCount,
      segmentsCount,
      avgVidas,
      dealMakingIndex,
      participants,
      topSegments
    );
  };

  return (
    <div className="space-y-8" id="agenda-panorama-root">
      
      {/* 1. Header & Quick Introduction */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black font-display text-slate-950 dark:text-white tracking-tight flex items-center space-x-2">
            <Calendar className="h-5.5 w-5.5 text-indigo-600" />
            <span>Panorama das Agendas do Rampup</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Painel diagnóstico completo das rodadas de networking da Rampup. Analise participações, densidade de sinergias, portes de empresas, frequência de empreendedores e realize comparativos lado a lado de edições.
          </p>
        </div>
 
        {/* Quick overall database context & export buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportAgendaPDF}
            className="no-print bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer hover:-translate-y-0.5"
          >
            <FileText className="h-4 w-4" />
            <span>Exportar em PDF</span>
          </button>

          <div className="bg-slate-100 dark:bg-slate-900/60 border dark:border-slate-800 rounded-xl px-4 py-2.5 shrink-0 flex items-center space-x-3 text-xs">
            <div className="text-slate-500 font-bold">Base Total:</div>
            <div className="flex space-x-2.5">
              <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md font-extrabold border dark:border-slate-750 text-slate-800 dark:text-slate-200">
                {allAgendas.length} Agendas
              </span>
              <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md font-extrabold border dark:border-slate-750 text-slate-800 dark:text-slate-200">
                {companies.length} Empresas
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Selection Bar & Comparison Toggles */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
          
          {/* Main Agenda Selector */}
          <div className="lg:col-span-5 space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
              <span>Agenda Principal</span>
              <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 px-2 py-0.5 rounded-md">Foco</span>
            </label>
            <div className="relative">
              <select
                value={selectedAgendaA}
                onChange={(e) => {
                  setSelectedAgendaA(e.target.value);
                  if (e.target.value === selectedAgendaB) {
                    setSelectedAgendaB(''); // avoid comparing to self
                  }
                }}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="__TODAS__" className="font-extrabold text-indigo-600 dark:text-indigo-400">
                  ⚡ Todas as Agendas (Somatório Geral)
                </option>
                {allAgendas.map(agenda => (
                  <option key={agenda.name} value={agenda.name}>
                    {agenda.name} {agenda.monthYearLabel ? `(${agenda.monthYearLabel})` : ''} — IGN {agenda.dealMakingIndex}% ({agenda.uniqueCompaniesCount} empresas)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comparison Toggle or Selector */}
          <div className="lg:col-span-5 space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
              <span>Comparar com Outra Agenda</span>
              <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 px-2 py-0.5 rounded-md">Opcional</span>
            </label>
            <div className="relative">
              <select
                value={selectedAgendaB}
                onChange={(e) => setSelectedAgendaB(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">-- Sem Comparação (Modo Individual) --</option>
                <option value="__TODAS__" className="font-extrabold text-indigo-600 dark:text-indigo-400">
                  ⚡ Todas as Agendas (Somatório Geral)
                </option>
                {availableAgendasForB.map(agenda => (
                  <option key={agenda.name} value={agenda.name}>
                    {agenda.name} {agenda.monthYearLabel ? `(${agenda.monthYearLabel})` : ''} — IGN {agenda.dealMakingIndex}% ({agenda.uniqueCompaniesCount} empresas)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clear Comparison Action Button */}
          {selectedAgendaB && (
            <div className="lg:col-span-2">
              <button
                onClick={() => setSelectedAgendaB('')}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer border dark:border-slate-750"
              >
                <Shuffle className="h-3.5 w-3.5" />
                <span>Limpar Comparativo</span>
              </button>
            </div>
          )}
        </div>

        {/* Dynamic banner regarding active comparative mode */}
        {selectedAgendaB && (
          <div className="bg-indigo-50/50 dark:bg-indigo-950/15 border border-indigo-100/60 dark:border-indigo-900/20 p-3 rounded-xl flex items-center space-x-2 text-[11px] text-slate-600 dark:text-slate-400">
            <Info className="h-4 w-4 text-indigo-500 shrink-0" />
            <span>
              <strong>Modo Comparativo Ativo:</strong> Você está visualizando <strong>{selectedAgendaA === '__TODAS__' ? 'Todas as Agendas (Somatório)' : selectedAgendaA}</strong> em comparação direta lado a lado com <strong>{selectedAgendaB === '__TODAS__' ? 'Todas as Agendas (Somatório)' : selectedAgendaB}</strong>.
            </span>
          </div>
        )}
      </div>

      {/* 3. Core KPI Block (Primary vs. Comparative vs. System Averages) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsA && renderKPIComparison(
          'Índice de Geração de Negócios (IGN)',
          statsA.agendaInfo.dealMakingIndex,
          statsB?.agendaInfo.dealMakingIndex,
          overallAverages.ign,
          (v) => `${v.toFixed(0)}%`,
          !!selectedAgendaB
        )}

        {statsA && renderKPIComparison(
          'Total de Empresas Únicas',
          statsA.companies.length,
          statsB?.companies.length,
          overallAverages.companies,
          (v) => `${v.toFixed(0)}`,
          !!selectedAgendaB
        )}

        {statsA && renderKPIComparison(
          'Participantes (Engajamento)',
          statsA.participants.length,
          statsB?.participants.length,
          overallAverages.attendance,
          (v) => `${v.toFixed(0)}`,
          !!selectedAgendaB
        )}

        {statsA && renderKPIComparison(
          'Média de Colaboradores (Vidas)',
          statsA.agendaInfo.avgVidas,
          statsB?.agendaInfo.avgVidas,
          overallAverages.avgVidas,
          (v) => `${v.toFixed(0)}`,
          !!selectedAgendaB
        )}
      </div>

      {/* 4. Layout Area: Side-By-Side (If comparing) OR Deep Individual (If not) */}
      {selectedAgendaB && statsA && statsB ? (
        
        /* Modos de Comparação Lado a Lado */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* COLUMN A - AGENDA PRINCIPAL */}
          <div className="space-y-6">
            <div className="bg-indigo-600/10 dark:bg-indigo-500/5 border border-indigo-500/20 px-4 py-2 rounded-xl flex items-center justify-between">
              <span className="text-xs font-black text-indigo-800 dark:text-indigo-300 uppercase tracking-widest">{selectedAgendaA === '__TODAS__' ? 'Todas as Agendas (Somatório)' : selectedAgendaA}</span>
              <span className="text-[10px] bg-indigo-600 text-white font-extrabold px-2 py-0.5 rounded-full">Agenda Principal</span>
            </div>

            {/* Sizes & Distribution A */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 tracking-wider flex items-center space-x-1.5">
                <PieChart className="h-4 w-4 text-indigo-500" />
                <span>Porte das Empresas Participantes</span>
              </h3>
              {renderSizeBreakdownSegment(statsA.sizes, statsA.companies.length)}
            </div>

            {/* Segments A */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 tracking-wider flex items-center space-x-1.5">
                <BarChart3 className="h-4 w-4 text-indigo-500" />
                <span>Maiores Segmentos da Agenda</span>
              </h3>
              {renderSegmentsList(statsA.sortedSegments)}
            </div>

            {/* Top Connectors A */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 tracking-wider flex items-center space-x-1.5">
                <Award className="h-4 w-4 text-indigo-500" />
                <span>Top Conectores Internos</span>
              </h3>
              {renderTopConnectors(statsA.topConnectors)}
            </div>

            {/* Highlights A */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 tracking-wider flex items-center space-x-1.5">
                <CheckCircle className="h-4 w-4 text-indigo-500" />
                <span>Highlights da Agenda</span>
              </h3>
              {renderHighlightsList(statsA)}
            </div>

            {/* Participant Frequency A */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 tracking-wider flex items-center space-x-1.5">
                <Users className="h-4 w-4 text-indigo-500" />
                <span>Presenças & Frequência ({statsA.participants.length})</span>
              </h3>
              {renderParticipantsList(statsA.participants)}
            </div>
          </div>

          {/* COLUMN B - AGENDA COMPARATIVA */}
          <div className="space-y-6">
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl flex items-center justify-between border dark:border-slate-755">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">{selectedAgendaB === '__TODAS__' ? 'Todas as Agendas (Somatório)' : selectedAgendaB}</span>
              <span className="text-[10px] bg-slate-500 dark:bg-slate-700 text-white font-extrabold px-2 py-0.5 rounded-full">Agenda Comparativa</span>
            </div>

            {/* Sizes & Distribution B */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 tracking-wider flex items-center space-x-1.5">
                <PieChart className="h-4 w-4 text-slate-400" />
                <span>Porte das Empresas Participantes</span>
              </h3>
              {renderSizeBreakdownSegment(statsB.sizes, statsB.companies.length)}
            </div>

            {/* Segments B */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 tracking-wider flex items-center space-x-1.5">
                <BarChart3 className="h-4 w-4 text-slate-400" />
                <span>Maiores Segmentos da Agenda</span>
              </h3>
              {renderSegmentsList(statsB.sortedSegments)}
            </div>

            {/* Top Connectors B */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 tracking-wider flex items-center space-x-1.5">
                <Award className="h-4 w-4 text-slate-400" />
                <span>Top Conectores Internos</span>
              </h3>
              {renderTopConnectors(statsB.topConnectors)}
            </div>

            {/* Highlights B */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 tracking-wider flex items-center space-x-1.5">
                <CheckCircle className="h-4 w-4 text-slate-400" />
                <span>Highlights da Agenda</span>
              </h3>
              {renderHighlightsList(statsB)}
            </div>

            {/* Participant Frequency B */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 tracking-wider flex items-center space-x-1.5">
                <Users className="h-4 w-4 text-slate-400" />
                <span>Presenças & Frequência ({statsB.participants.length})</span>
              </h3>
              {renderParticipantsList(statsB.participants)}
            </div>
          </div>

        </div>
      ) : (
        
        /* Individual Agenda Layout (Deep-dive on selected agenda) */
        statsA && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Main Column: Breakdown, Distributions, Stats */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Event Size & Distribution */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-1.5">
                    <PieChart className="h-5 w-5 text-indigo-500" />
                    <span>Perfil de Portes das Empresas Participantes</span>
                  </h3>
                  <p className="text-[11px] text-slate-450 dark:text-slate-400 mt-1">
                    Análise com base no número total de colaboradores ativos (vidas) informados no mailing corporativo.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border dark:border-slate-850">
                  {renderSizeBreakdownSegment(statsA.sizes, statsA.companies.length, true)}
                </div>
              </div>

              {/* Attendance Frequency and Details */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-1.5">
                      <Users className="h-5 w-5 text-indigo-500" />
                      <span>Frequência e Presença dos Participantes</span>
                    </h3>
                    <p className="text-[11px] text-slate-450 dark:text-slate-400 mt-1">
                      Descubra a recorrência histórica de cada empresário presente nesta rodada da Rampup.
                    </p>
                  </div>
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold px-3 py-1 rounded-xl shrink-0 self-start sm:self-center">
                    {statsA.participants.length} participantes únicos
                  </span>
                </div>

                <div className="overflow-hidden border border-slate-100 dark:border-slate-850 rounded-2xl">
                  {renderParticipantsListDetailed(statsA.participants)}
                </div>
              </div>

              {/* B2B Sinergias & Matches (IA Gated) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-1.5">
                      <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
                      <span>Inteligência de Matches & Cruzamento Bilateral</span>
                    </h3>
                    <p className="text-[11px] text-slate-450 dark:text-slate-400 mt-1">
                      Oportunidades de co-selling e parcerias estratégicas calculadas com base nos segmentos complementares.
                    </p>
                  </div>

                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-extrabold border ${
                    isAnalysisExecuted 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-200 dark:border-emerald-900/30' 
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 border-amber-200 dark:border-amber-900/30'
                  }`}>
                    {isAnalysisExecuted ? 'Ativa' : 'Pendente'}
                  </span>
                </div>

                {!isAnalysisExecuted ? (
                  <div className="bg-indigo-50/20 dark:bg-indigo-950/5 border border-dashed border-indigo-150 dark:border-indigo-900/40 rounded-2xl p-8 text-center space-y-4 flex flex-col items-center justify-center">
                    <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-950 rounded-xl flex items-center justify-center text-indigo-500 border dark:border-indigo-850">
                      <Zap className="h-6 w-6 animate-pulse" />
                    </div>
                    <div className="max-w-md space-y-1.5">
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Mapeamento Inteligente Suspenso</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Execute a Inteligência de Heurística no topo da tela para disparar o cruzamento automático de compradores, fornecedores e canais complementares desta agenda.
                      </p>
                    </div>
                    {triggerAnalysisRun && (
                      <button
                        onClick={triggerAnalysisRun}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs flex items-center space-x-1.5 shadow-md transition-all cursor-pointer hover:-translate-y-0.5"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Executar Inteligência</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* B2B Synergy stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 p-4 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-450 dark:text-slate-400 block uppercase">Matches de Compra/Venda Direta</span>
                        <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                          {statsA.salesMatches.length} cruzamentos
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 p-4 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-450 dark:text-slate-400 block uppercase">Canais Estratégicos Mútuos</span>
                        <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                          {statsA.partnersMatches.length} parcerias
                        </span>
                      </div>
                    </div>

                    {/* Display some sample matches */}
                    {statsA.salesMatches.length === 0 && statsA.partnersMatches.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-4">Nenhuma sinergia B2B direta encontrada com as regras do matchEngine atual para este grupo.</p>
                    ) : (
                      <div className="space-y-3.5 max-h-[280px] overflow-y-auto pr-1">
                        {statsA.salesMatches.slice(0, 5).map((match, idx) => (
                          <div key={`sales-${idx}`} className="bg-slate-55 dark:bg-slate-950/40 p-3.5 rounded-xl border dark:border-slate-850 flex items-start gap-3 text-xs">
                            <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-600 text-[9px] font-black px-2 py-0.5 rounded uppercase mt-0.5">Venda</span>
                            <div className="flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5 font-bold">
                                <span className="text-slate-800 dark:text-white">{match.seller.name}</span>
                                <ArrowRight className="h-3 w-3 text-slate-400" />
                                <span className="text-indigo-600 dark:text-indigo-400">{match.buyer.name}</span>
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">{match.reason}</p>
                            </div>
                          </div>
                        ))}

                        {statsA.partnersMatches.slice(0, 5).map((match, idx) => (
                          <div key={`partner-${idx}`} className="bg-slate-55 dark:bg-slate-950/40 p-3.5 rounded-xl border dark:border-slate-850 flex items-start gap-3 text-xs">
                            <span className="bg-emerald-50 dark:bg-emerald-950 text-emerald-600 text-[9px] font-black px-2 py-0.5 rounded uppercase mt-0.5">Canal</span>
                            <div className="flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5 font-bold">
                                <span className="text-slate-800 dark:text-white">{match.partnerA.name}</span>
                                <span className="text-slate-400 font-normal">&amp;</span>
                                <span className="text-slate-800 dark:text-white">{match.partnerB.name}</span>
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">{match.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Right Side Column: Segments, Connectors, Highlights */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Highlights Checklist */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <CheckCircle className="h-4.5 w-4.5 text-indigo-500" />
                  <span>Highlights da Rodada</span>
                </h3>
                {renderHighlightsList(statsA)}
              </div>

              {/* Segment representation */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <BarChart3 className="h-4.5 w-4.5 text-indigo-500" />
                  <span>Sectores Predominantes</span>
                </h3>
                {renderSegmentsList(statsA.sortedSegments)}
              </div>

              {/* Top connectors/influence centers */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <Award className="h-4.5 w-4.5 text-indigo-500" />
                  <span>Pontos de Sinergia Interna</span>
                </h3>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Empresas presentes nesta agenda que possuem maior compatibilidade de cruzamento com as demais do grupo.
                </p>
                {renderTopConnectors(statsA.topConnectors)}
              </div>

            </div>

          </div>
        )
      )}

    </div>
  );
}

/* Helper small renderers */

function renderSizeBreakdownSegment(
  sizes: { micro: number; pequeno: number; medio: number; grande: number }, 
  total: number,
  showLabel = false
) {
  const safeTotal = Math.max(1, total);
  const microPct = Math.round((sizes.micro / safeTotal) * 100);
  const pequenoPct = Math.round((sizes.pequeno / safeTotal) * 100);
  const medioPct = Math.round((sizes.medio / safeTotal) * 100);
  const grandePct = Math.round((sizes.grande / safeTotal) * 100);

  return (
    <div className="space-y-4">
      
      {/* Visual horizontal segmented progress bar */}
      <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
        {sizes.micro > 0 && (
          <div 
            className="bg-slate-400 h-full" 
            style={{ width: `${microPct}%` }} 
            title={`Micro: ${sizes.micro} (${microPct}%)`}
          />
        )}
        {sizes.pequeno > 0 && (
          <div 
            className="bg-emerald-500 h-full" 
            style={{ width: `${pequenoPct}%` }} 
            title={`Pequeno: ${sizes.pequeno} (${pequenoPct}%)`}
          />
        )}
        {sizes.medio > 0 && (
          <div 
            className="bg-indigo-500 h-full" 
            style={{ width: `${medioPct}%` }} 
            title={`Médio: ${sizes.medio} (${medioPct}%)`}
          />
        )}
        {sizes.grande > 0 && (
          <div 
            className="bg-purple-500 h-full" 
            style={{ width: `${grandePct}%` }} 
            title={`Grande: ${sizes.grande} (${grandePct}%)`}
          />
        )}
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <div className="h-2.5 w-2.5 rounded bg-slate-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline font-bold text-slate-800 dark:text-slate-300">
              <span className="truncate text-[11px]">Micro (ME)</span>
              <span>{sizes.micro}</span>
            </div>
            {showLabel && <span className="text-[9px] text-slate-400 block mt-0.5">Até 10 colaboradores</span>}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="h-2.5 w-2.5 rounded bg-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline font-bold text-slate-800 dark:text-slate-300">
              <span className="truncate text-[11px]">Pequeno (EPP)</span>
              <span>{sizes.pequeno}</span>
            </div>
            {showLabel && <span className="text-[9px] text-slate-400 block mt-0.5">11 a 50 colaboradores</span>}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="h-2.5 w-2.5 rounded bg-indigo-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline font-bold text-slate-800 dark:text-slate-300">
              <span className="truncate text-[11px]">Médio Porte</span>
              <span>{sizes.medio}</span>
            </div>
            {showLabel && <span className="text-[9px] text-slate-400 block mt-0.5">51 a 200 colaboradores</span>}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="h-2.5 w-2.5 rounded bg-purple-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline font-bold text-slate-800 dark:text-slate-300">
              <span className="truncate text-[11px]">Grande Porte</span>
              <span>{sizes.grande}</span>
            </div>
            {showLabel && <span className="text-[9px] text-slate-400 block mt-0.5">Acima de 200 colaboradores</span>}
          </div>
        </div>
      </div>

    </div>
  );
}

function renderSegmentsList(segments: Array<{ name: string; count: number; percent: number }>) {
  if (segments.length === 0) {
    return <p className="text-xs text-slate-400 italic">Nenhum segmento registrado.</p>;
  }

  return (
    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
      {segments.map((seg, idx) => (
        <div key={idx} className="space-y-1">
          <div className="flex justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
            <span className="truncate pr-2">{seg.name}</span>
            <span className="shrink-0">{seg.count} ({seg.percent}%)</span>
          </div>
          <div className="h-1.5 w-full bg-slate-50 dark:bg-slate-950 rounded-full overflow-hidden">
            <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${seg.percent}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function renderTopConnectors(connectors: Array<{ company: Company; synergyCount: number; archetype: any }>) {
  if (connectors.length === 0) {
    return <p className="text-xs text-slate-400 italic">Nenhum conector calculado.</p>;
  }

  return (
    <div className="space-y-2.5">
      {connectors.map((conn, idx) => (
        <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850">
          <div className="min-w-0 pr-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{conn.company.name}</h4>
            <span className="text-[10px] text-slate-400 block truncate mt-0.5">{conn.company.segment}</span>
          </div>
          
          <div className="text-right shrink-0">
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-150 dark:border-indigo-900/30">
              {conn.synergyCount} sinergias
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function renderHighlightsList(stats: any) {
  const highlights: string[] = [];

  // Generate logical facts about the agenda
  if (stats.companies.length > 0) {
    highlights.push(`Representa um ecossistema com mais de ${stats.totalEmployeeLives.toLocaleString()} colaboradores (vidas).`);
  }

  if (stats.sortedSegments.length > 0) {
    highlights.push(`Segmento predominante: "${stats.sortedSegments[0].name}" representando ${stats.sortedSegments[0].percent}% do grupo.`);
  }

  const mediumLargeCompaniesCount = stats.sizes.medio + stats.sizes.grande;
  if (mediumLargeCompaniesCount > 0) {
    const pct = Math.round((mediumLargeCompaniesCount / stats.companies.length) * 100);
    highlights.push(`${pct}% do grupo é composto por empresas de Médio ou Grande porte.`);
  } else {
    highlights.push(`Grupo 100% focado em Micro e Pequenas empresas, gerando agilidade e parcerias imediatas.`);
  }

  if (stats.participants.length > stats.companies.length) {
    highlights.push(`Alta taxa de representatividade múltipla: média de ${(stats.participants.length / stats.companies.length).toFixed(1)} decisores por empresa.`);
  }

  // Find heavy users
  const heavyUsers = stats.participants.filter((p: any) => p.totalPresences >= 3);
  if (heavyUsers.length > 0) {
    highlights.push(`Presença de ${heavyUsers.length} líderes frequentes da comunidade (participaram de 3+ edições).`);
  }

  return (
    <div className="space-y-3">
      {highlights.map((hl, idx) => (
        <div key={idx} className="flex items-start space-x-2.5 text-xs text-slate-650 dark:text-slate-300 leading-normal">
          <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <span>{hl}</span>
        </div>
      ))}
    </div>
  );
}

function renderParticipantsList(participants: any[]) {
  if (participants.length === 0) {
    return <p className="text-xs text-slate-400 italic text-center py-4">Nenhum participante nesta agenda.</p>;
  }

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
      {participants.map((p, idx) => {
        const isHeavy = p.totalPresences >= 4;
        const isRegular = p.totalPresences >= 2 && p.totalPresences < 4;

        return (
          <div key={idx} className="p-2 bg-slate-50 dark:bg-slate-950 rounded-xl flex items-center justify-between text-xs border dark:border-slate-850">
            <div className="min-w-0 pr-2">
              <span className="font-extrabold text-slate-800 dark:text-slate-200 block truncate">{p.name}</span>
              <span className="text-[10px] text-slate-400 block truncate">{p.companyName}</span>
            </div>

            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
              isHeavy 
                ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' 
                : isRegular 
                ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300' 
                : 'bg-slate-100 dark:bg-slate-900 text-slate-500'
            }`}>
              {p.totalPresences}x Presença{p.totalPresences > 1 ? 's' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function renderParticipantsListDetailed(participants: any[]) {
  if (participants.length === 0) {
    return <p className="text-xs text-slate-400 italic text-center py-6">Nenhum participante encontrado.</p>;
  }

  return (
    <div className="max-h-[340px] overflow-y-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-955 border-b border-slate-100 dark:border-slate-850 font-bold text-slate-500 dark:text-slate-400">
            <th className="py-2.5 px-4">Nome do Decisor</th>
            <th className="py-2.5 px-4">Empresa Representada</th>
            <th className="py-2.5 px-4">Vidas</th>
            <th className="py-2.5 px-4 text-right">Faturamento Est.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
          {participants.map((p, idx) => {
            const fin = calculateFinancialAnalysis(p.vidas, p.segment, p.company);
            const faturamentoAvgStr = fin.faturamentoAvg > 0 ? fin.faturamentoAvg.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'Não informado';

            return (
              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 text-slate-800 dark:text-slate-200">
                <td className="py-2.5 px-4 font-bold">{p.name}</td>
                <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">{p.companyName}</td>
                <td className="py-2.5 px-4">
                  <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-indigo-150 dark:border-indigo-900/30">
                    {p.vidas} {p.vidas === 1 ? 'vida' : 'vidas'}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right font-extrabold text-slate-700 dark:text-slate-300">
                  {faturamentoAvgStr}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
