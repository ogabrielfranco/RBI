import { Company, Contact, Transaction } from '../types';
import { analyzeConnections } from '../data/matchEngine';

export type Archetype = 'comprador' | 'vendedor' | 'parceiro' | 'conector';

export interface CompanyArchetypeInfo {
  type: Archetype;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export function getCompanyArchetype(company: Company, allCompanies: Company[]): CompanyArchetypeInfo {
  const matches = analyzeConnections(company, allCompanies);
  const buyersCount = matches.potentialBuyerIds.length;
  const sellersCount = matches.potentialSellerIds.length;
  const partnersCount = matches.potentialPartnerIds.length;

  if (partnersCount >= Math.max(buyersCount, sellersCount) && partnersCount > 0) {
    return {
      type: 'parceiro',
      label: 'Parceiro Ideal',
      description: 'Perfeito para montar parcerias, co-selling e alianças de indicação mútua.',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200'
    };
  } else if (buyersCount > sellersCount) {
    return {
      type: 'vendedor',
      label: 'Vendedor Estratégico',
      description: 'Alta capacidade de oferta e prospecção de soluções para as empresas do grupo.',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200'
    };
  } else if (sellersCount > buyersCount) {
    return {
      type: 'comprador',
      label: 'Comprador Ativo',
      description: 'Grande demanda e aderência para contratar soluções oferecidas pelo ecossistema.',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200'
    };
  } else {
    return {
      type: 'conector',
      label: 'Conector de Ecossistema',
      description: 'Equilibrado e altamente sinérgico para conectar diferentes pontas de negócios.',
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
      borderColor: 'border-pink-200'
    };
  }
}

export interface RecurringEntrepreneur {
  contact: Contact;
  companyName: string;
  eventCount: number;
  attendedEvents: string[];
}

export function getRecurringEntrepreneurs(
  contacts: Contact[],
  transactions: Transaction[],
  companies: Company[]
): RecurringEntrepreneur[] {
  const attendanceMap: Record<string, { count: number; events: Set<string>; email: string; name: string }> = {};

  transactions.forEach((tx) => {
    const key = tx.contactEmail.toLowerCase().trim() || tx.contactName.toLowerCase().trim();
    if (!key) return;

    if (!attendanceMap[key]) {
      attendanceMap[key] = {
        count: 0,
        events: new Set<string>(),
        email: tx.contactEmail,
        name: tx.contactName
      };
    }
    attendanceMap[key].count += 1;
    attendanceMap[key].events.add(tx.eventName);
  });

  const recurringList: RecurringEntrepreneur[] = [];

  Object.values(attendanceMap).forEach((att) => {
    // Find the actual contact in our contacts database
    let matchedContact = contacts.find(
      (c) => c.email.toLowerCase().trim() === att.email.toLowerCase().trim()
    );

    if (!matchedContact) {
      // Find by name if email didn't match
      matchedContact = contacts.find(
        (c) => c.name.toLowerCase().trim() === att.name.toLowerCase().trim()
      );
    }

    // If still no contact, let's look at companyId via transaction
    const txForThis = transactions.find(
      (t) => t.contactEmail.toLowerCase().trim() === att.email.toLowerCase().trim() || t.contactName.toLowerCase().trim() === att.name.toLowerCase().trim()
    );
    const companyId = txForThis?.companyId || 'comp_unknown';
    const comp = companies.find((c) => c.id === companyId);
    const companyName = comp ? comp.name : 'Rampup Convidado';

    const contactObj: Contact = matchedContact || {
      id: `cont_temp_${Math.random().toString(36).substr(2, 9)}`,
      name: att.name,
      email: att.email || 'sem@email.com',
      phone: '',
      companyId: companyId,
      customFields: {}
    };

    recurringList.push({
      contact: contactObj,
      companyName,
      eventCount: att.count,
      attendedEvents: Array.from(att.events)
    });
  });

  return recurringList.sort((a, b) => b.eventCount - a.eventCount);
}

export interface CompanySizeClassification {
  porte: string;
  custoFolha: number;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  description: string;
}

export interface SectorFinancials {
  macroSector: string;
  ratioMin: number;
  ratioMax: number;
  ratioAvg: number;
  characteristics: string;
  emoji: string;
}

export interface FinancialAnalysis {
  custoFolha: number;
  faturamentoMin: number;
  faturamentoMax: number;
  faturamentoAvg: number;
  sector: SectorFinancials;
}

export function getSectorFinancials(segment: string): SectorFinancials {
  const s = (segment || '').toLowerCase();
  
  if (s.includes('comércio') || s.includes('comercio') || s.includes('varejo') || s.includes('atacado') || s.includes('distribui') || s.includes('loja') || s.includes('venda')) {
    return {
      macroSector: 'Comércio (Varejo e Atacado)',
      ratioMin: 0.10,
      ratioMax: 0.15,
      ratioAvg: 0.125,
      emoji: '🛒',
      characteristics: 'Setor focado na revenda de mercadorias. O maior custo costuma ser o estoque (CMV - Custo da Mercadoria Vendida). A folha é mais baixa em relação ao faturamento, subindo um pouco (até 18%) apenas em lojas de shopping devido aos turnos estendidos.'
    };
  }
  
  if (s.includes('indústria') || s.includes('industria') || s.includes('fábrica') || s.includes('fabrica') || s.includes('manufatura') || s.includes('confecção') || s.includes('confeccao') || s.includes('metalurg')) {
    return {
      macroSector: 'Indústria',
      ratioMin: 0.15,
      ratioMax: 0.25,
      ratioAvg: 0.20,
      emoji: '🏭',
      characteristics: 'O impacto depende do nível de automação da fábrica. Indústrias altamente tecnológicas e automatizadas operam próximas aos 15%. Já fábricas com processos manuais intensivos ou artesanato industrial tendem a encostar nos 25%.'
    };
  }
  
  if (s.includes('aliment') || s.includes('restaurante') || s.includes('bar') || s.includes('bebida') || s.includes('gastronomia') || s.includes('lanche')) {
    return {
      macroSector: 'Alimentação fora do lar',
      ratioMin: 0.25,
      ratioMax: 0.35,
      ratioAvg: 0.30,
      emoji: '🍔',
      characteristics: 'Um setor híbrido que envolve produção (cozinha) e serviço (atendimento). Exige muita mão de obra em horários de pico, o que eleva o custo com pessoal e adicionais noturnos.'
    };
  }
  
  if (s.includes('saúde') || s.includes('saude') || s.includes('educa') || s.includes('escola') || s.includes('faculdade') || s.includes('hospital') || s.includes('clínica') || s.includes('clinica') || s.includes('médic') || s.includes('medic')) {
    return {
      macroSector: 'Saúde e Educação',
      ratioMin: 0.35,
      ratioMax: 0.45,
      ratioAvg: 0.40,
      emoji: '🏥',
      characteristics: 'Hospitais, clínicas, escolas e faculdades dependem diretamente de profissionais técnicos qualificados (médicos, enfermeiros, professores). O custo com essa folha especializada é historicamente elevado.'
    };
  }
  
  // Default: Prestação de Serviços (also includes TI, Consultorias, Jurídico, RH, etc.)
  return {
    macroSector: 'Prestação de Serviços',
    ratioMin: 0.30,
    ratioMax: 0.50,
    ratioAvg: 0.40,
    emoji: '🛠️',
    characteristics: 'As pessoas e o tempo são a matéria-prima do negócio. Empresas de tecnologia (TI), agências de publicidade, consultorias e escritórios de advocacia operam rotineiramente perto dos 50% sem que isso signifique descontrole financeiro.'
  };
}

export function calculateFinancialAnalysis(vidas: number, segment: string, company?: Partial<Company>): FinancialAnalysis {
  const baseSalarioNordeste = 2475;
  const sector = { ...getSectorFinancials(segment) };
  
  if (company && typeof company.mediaSetorEst === 'number' && company.mediaSetorEst > 0) {
    const ratio = company.mediaSetorEst;
    const diffMin = sector.ratioAvg - sector.ratioMin;
    const diffMax = sector.ratioMax - sector.ratioAvg;
    sector.ratioAvg = ratio;
    sector.ratioMin = Math.max(0.01, ratio - diffMin);
    sector.ratioMax = Math.min(0.99, ratio + diffMax);
  }

  let custoFolha = (vidas || 0) * baseSalarioNordeste;
  if (company && typeof company.folhaEst === 'number') {
    if (company.folhaEst === 0) {
      custoFolha = 0;
    } else if (company.folhaEst > 0) {
      custoFolha = company.folhaEst;
    }
  }
  
  // Faturamento = Folha / Ratio
  let faturamentoAvg = custoFolha / sector.ratioAvg;
  let faturamentoMin = custoFolha / sector.ratioMax;
  let faturamentoMax = custoFolha / sector.ratioMin;

  if (company && typeof company.faturamentoEst === 'number') {
    if (company.faturamentoEst === 0) {
      faturamentoAvg = 0;
      faturamentoMin = 0;
      faturamentoMax = 0;
    } else if (company.faturamentoEst > 0) {
      faturamentoAvg = company.faturamentoEst;
      const scaleMin = sector.ratioAvg / sector.ratioMax;
      const scaleMax = sector.ratioAvg / sector.ratioMin;
      faturamentoMin = faturamentoAvg * scaleMin;
      faturamentoMax = faturamentoAvg * scaleMax;
    }
  }
  
  return {
    custoFolha,
    faturamentoMin,
    faturamentoMax,
    faturamentoAvg,
    sector
  };
}

export function classifyCompanySize(vidas: number): CompanySizeClassification {
  const baseSalarioNordeste = 2475;
  const custoFolha = vidas * baseSalarioNordeste;
  
  if (vidas <= 10) {
    return {
      porte: 'Microempresa (ME)',
      custoFolha,
      badgeBg: 'bg-slate-50',
      badgeText: 'text-slate-600',
      badgeBorder: 'border-slate-200',
      description: 'Estrutura enxuta de micro porte, ideal para conexões rápidas e parcerias ágeis de co-marketing.'
    };
  } else if (vidas <= 50) {
    return {
      porte: 'Pequeno Porte (EPP)',
      custoFolha,
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-700',
      badgeBorder: 'border-emerald-200',
      description: 'Pequena empresa em expansão comercial activa, com demanda por sistemas e serviços terceirizados.'
    };
  } else if (vidas <= 200) {
    return {
      porte: 'Médio Porte',
      custoFolha,
      badgeBg: 'bg-indigo-50',
      badgeText: 'text-indigo-700',
      badgeBorder: 'border-indigo-200',
      description: 'Média empresa consolidada com folha robusta e alto volume de compras B2B corporativas.'
    };
  } else {
    return {
      porte: 'Grande Porte / Corporativa',
      custoFolha,
      badgeBg: 'bg-purple-50',
      badgeText: 'text-purple-700',
      badgeBorder: 'border-purple-200',
      description: 'Corporação de grande escala com processos consolidados, excelente para contratos de alto ticket.'
    };
  }
}

export interface EventDealIndex {
  name: string;
  attendanceCount: number;
  uniqueCompaniesCount: number;
  diversityIndex: number; // 0 to 100
  synergiesCalculated: number;
  dealMakingIndex: number; // 0 to 100 (overall score)
  segmentsCount: number;
  avgVidas: number;
  scalePoints: number;
  diversityPoints: number;
  synergyPoints: number;
  sizePoints: number;
  eventDate?: string;
  monthYearLabel?: string;
  year?: number;
  month?: number;
  sortDate?: Date;
}

export function getEventMonthYear(eventDateStr: string): { month: number; year: number; label: string } | null {
  if (!eventDateStr) return null;
  const slashMatch = eventDateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const month = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);
    const monthsPt = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const monthLabel = monthsPt[month - 1] || `${month}`;
    return {
      month,
      year,
      label: `${monthLabel}/${year}`
    };
  }

  const hyphenMatch = eventDateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (hyphenMatch) {
    const year = parseInt(hyphenMatch[1], 10);
    const month = parseInt(hyphenMatch[2], 10);
    const monthsPt = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const monthLabel = monthsPt[month - 1] || `${month}`;
    return {
      month,
      year,
      label: `${monthLabel}/${year}`
    };
  }

  return null;
}

export function calculateEventDealIndices(
  transactions: Transaction[],
  companies: Company[]
): EventDealIndex[] {
  const eventGroups: Record<string, Transaction[]> = {};

  transactions.forEach((tx) => {
    if (!eventGroups[tx.eventName]) {
      eventGroups[tx.eventName] = [];
    }
    eventGroups[tx.eventName].push(tx);
  });

  return Object.entries(eventGroups).map(([eventName, txs]) => {
    const attendanceCount = txs.length;
    const companyIds = Array.from(new Set(txs.map((t) => t.companyId)));
    const uniqueCompanies = companyIds
      .map((id) => companies.find((c) => c.id === id))
      .filter(Boolean) as Company[];

    const segments = Array.from(new Set(uniqueCompanies.map((c) => c.segment)));
    const uniqueCompaniesCount = uniqueCompanies.length;

    // Calculate synergies between all companies in this event
    let synergiesCalculated = 0;
    for (let i = 0; i < uniqueCompanies.length; i++) {
      for (let j = i + 1; j < uniqueCompanies.length; j++) {
        const compA = uniqueCompanies[i];
        const compB = uniqueCompanies[j];
        const matches = analyzeConnections(compA, [compB]);
        if (
          matches.potentialBuyerIds.length > 0 ||
          matches.potentialSellerIds.length > 0 ||
          matches.potentialPartnerIds.length > 0
        ) {
          synergiesCalculated += 1;
        }
      }
    }

    // Diversity factor (max out at 8 segments for 100% diversity)
    const segmentDiversity = Math.min(100, Math.round((segments.length / 8) * 100));

    // Calculate average employee lives (vidas)
    const totalVidas = uniqueCompanies.reduce((sum, c) => sum + (c.vidas || 0), 0);
    const avgVidas = uniqueCompaniesCount > 0 ? totalVidas / uniqueCompaniesCount : 0;

    // Advanced, bounded IGN scoring factors (cannot trivially hit 100%) - diversity removed, redistributed weights
    const scalePoints = Math.min(35, (uniqueCompaniesCount / 12) * 28);
    const synergyPoints = Math.min(40, (synergiesCalculated / Math.max(1, uniqueCompaniesCount)) * 11);
    const sizePoints = Math.min(25, (avgVidas / 35) * 10);

    // Real-world calibration for the 75% target index
    // A healthy network meeting typically has 8-12 companies and 15+ synergies.
    const baseScore = 55; // Solid starting baseline for any organized corporate event
    const densityBonus = Math.min(35, (synergiesCalculated / Math.max(1, uniqueCompaniesCount)) * 16.8);
    const sizeBonus = Math.min(10, (avgVidas / 30) * 5);
    
    const dealMakingIndex = Math.min(100, Math.round(baseScore + densityBonus + sizeBonus));

    const firstTxWithDate = txs.find(t => t.eventDate);
    const eventDate = firstTxWithDate ? firstTxWithDate.eventDate : '';
    let monthYearLabel = '';
    let year = 0;
    let month = 0;
    let sortDate = new Date(0);

    if (eventDate) {
      const my = getEventMonthYear(eventDate);
      if (my) {
        monthYearLabel = my.label;
        year = my.year;
        month = my.month;
        sortDate = new Date(year, month - 1, 1);
      }
    }

    return {
      name: eventName,
      attendanceCount,
      uniqueCompaniesCount,
      diversityIndex: 0, // Diversity factor removed from IGN metric
      synergiesCalculated,
      dealMakingIndex,
      segmentsCount: segments.length,
      avgVidas,
      scalePoints,
      diversityPoints: 0, // Removed from IGN breakdown
      synergyPoints,
      sizePoints,
      eventDate,
      monthYearLabel,
      year,
      month,
      sortDate
    };
  }).sort((a, b) => {
    const timeA = a.sortDate ? a.sortDate.getTime() : 0;
    const timeB = b.sortDate ? b.sortDate.getTime() : 0;
    if (timeB !== timeA) {
      return timeB - timeA; // newest first
    }
    return b.dealMakingIndex - a.dealMakingIndex; // tie breaker: higher IGN score first
  });
}

/**
 * Calculates the affinity score (0 to 100) between two companies.
 * Based on complementary sectors, regional proximity, matching reasons, and event history.
 */
export function calculateCompanyAffinity(
  companyA: Company,
  companyB: Company,
  transactions: Transaction[]
): number {
  if (companyA.id === companyB.id) return 100;

  let score = 42; // Elegant base baseline compatibility

  // 1. Direct heuristics from matchEngine
  const matches = analyzeConnections(companyA, [companyB]);
  const isPartner = matches.potentialPartnerIds.includes(companyB.id);
  const isBuyer = matches.potentialBuyerIds.includes(companyB.id);
  const isSeller = matches.potentialSellerIds.includes(companyB.id);
  const isGeneral = matches.potentialConnectionIds.includes(companyB.id);

  if (isPartner) {
    score += 35;
  } else if (isBuyer || isSeller) {
    score += 24;
  } else if (isGeneral) {
    score += 12;
  }

  // 2. Co-attendance in events
  const eventsA = new Set(transactions.filter(t => t.companyId === companyA.id).map(t => t.eventName));
  const sharedEventsCount = transactions.filter(t => t.companyId === companyB.id && eventsA.has(t.eventName)).length;
  if (sharedEventsCount > 0) {
    score += Math.min(20, sharedEventsCount * 12);
  }

  // 3. Location proximity
  if (companyA.location === companyB.location) {
    if (companyA.location !== 'Fortaleza, CE') {
      score += 10; // Extra regional points
    } else {
      score += 4;
    }
  }

  // 4. Complementary segment pairings bonus
  const segA = companyA.segment;
  const segB = companyB.segment;
  if (
    (segA === 'Contabilidade & Consultoria' && segB === 'Jurídico / Advocacia') ||
    (segA === 'Jurídico / Advocacia' && segB === 'Contabilidade & Consultoria') ||
    (segA === 'Tecnologia & Telecom' && segB !== 'Tecnologia & Telecom') ||
    (segB === 'Tecnologia & Telecom' && segA !== 'Tecnologia & Telecom') ||
    (segA === 'Marketing, Comunicação & Mídia' && segB !== 'Marketing, Comunicação & Mídia') ||
    (segB === 'Marketing, Comunicação & Mídia' && segA !== 'Marketing, Comunicação & Mídia')
  ) {
    score += 10;
  }

  // Bound perfectly between 45% and 99%
  return Math.min(99, Math.max(45, score));
}

export function getSimilarSegmentGroup(segment: string): string {
  const s = (segment || '').trim().toLowerCase();
  if (!s) return 'Outros';

  if (s.includes('tecnologia') || s.includes('ti') || s.includes('software') || s.includes('sistemas') || s.includes('telecom') || s.includes('internet') || s.includes('computa')) {
    return 'Tecnologia & Inovação';
  }
  if (s.includes('agência') || s.includes('agencia') || s.includes('publicidade') || s.includes('propaganda') || s.includes('mídia') || s.includes('midia') || s.includes('marketing') || s.includes('comunicação') || s.includes('comunicacao') || s.includes('gráfica') || s.includes('grafica') || s.includes('design') || s.includes('assessoria de imprensa')) {
    return 'Comunicação, Mídia & Marketing';
  }
  if (s.includes('consultoria') || s.includes('assessoria') || s.includes('treinamento') || s.includes('educação') || s.includes('educacao') || s.includes('escola') || s.includes('cursos') || s.includes('coaching') || s.includes('palestras') || s.includes('ensino') || s.includes('faculdade') || s.includes('universidade')) {
    return 'Consultoria, Educação & Treinamentos';
  }
  if (s.includes('finanças') || s.includes('financas') || s.includes('banco') || s.includes('investimento') || s.includes('consórcio') || s.includes('consorcio') || s.includes('contabilidade') || s.includes('auditoria') || s.includes('jurídico') || s.includes('advocacia') || s.includes('legal') || s.includes('bpo') || s.includes('fiscal') || s.includes('crédito') || s.includes('credito')) {
    return 'Serviços Financeiros, Contábeis & Jurídicos';
  }
  if (s.includes('saúde') || s.includes('saude') || s.includes('médico') || s.includes('medico') || s.includes('clínica') || s.includes('clinica') || s.includes('hospital') || s.includes('odonto') || s.includes('psicologia') || s.includes('farmácia') || s.includes('farmacia') || s.includes('fisioterapia') || s.includes('estética') || s.includes('estetica') || s.includes('dentista')) {
    return 'Saúde, Clínicas & Bem-estar';
  }
  if (s.includes('comércio') || s.includes('comercio') || s.includes('varejo') || s.includes('atacado') || s.includes('distribuidora') || s.includes('loja') || s.includes('vendas') || s.includes('supermercado') || s.includes('importa') || s.includes('exporta') || s.includes('comercial')) {
    return 'Comércio, Varejo & Atacado';
  }
  if (s.includes('indústria') || s.includes('industria') || s.includes('fábrica') || s.includes('fabrica') || s.includes('manufatura') || s.includes('construção') || s.includes('construcao') || s.includes('engenharia') || s.includes('imobiliário') || s.includes('imobiliario') || s.includes('incorporadora') || s.includes('arquitetura') || s.includes('metal') || s.includes('química') || s.includes('quimica')) {
    return 'Indústria, Construção & Imobiliário';
  }
  if (s.includes('facilities') || s.includes('segurança') || s.includes('seguranca') || s.includes('limpeza') || s.includes('serviços gerais') || s.includes('servicos gerais') || s.includes('recursos humanos') || s.includes('rh') || s.includes('terceiriza') || s.includes('portaria') || s.includes('conserva') || s.includes('logística') || s.includes('logistica') || s.includes('transporte')) {
    return 'Facilities, Segurança & Logística';
  }
  if (s.includes('alimentação') || s.includes('alimentacao') || s.includes('restaurante') || s.includes('gastronomia') || s.includes('bebida') || s.includes('bar') || s.includes('café') || s.includes('cafe') || s.includes('alimento') || s.includes('panificadora') || s.includes('padaria') || s.includes('buffet') || s.includes('sorvete') || s.includes('açaí') || s.includes('açai')) {
    return 'Alimentação & Gastronomia';
  }
  if (s.includes('evento') || s.includes('festas') || s.includes('show') || s.includes('entretenimento') || s.includes('turismo') || s.includes('hotel') || s.includes('lazer') || s.includes('viagem') || s.includes('produção') || s.includes('producao')) {
    return 'Eventos, Turismo & Lazer';
  }

  // Fallback
  const trimmed = segment.trim();
  if (!trimmed) return 'Outros';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function getDefaultICPForSegment(segment: string): string {
  const s = (segment || '').toLowerCase();

  if (s.includes('tecnol') || s.includes('software') || s.includes('saas') || s.includes('telecom') || s.includes('sistemas') || s.includes('ti')) {
    return 'Empresas de médio a grande porte (mais de 50 colaboradores) que buscam transformação digital, otimização de infraestrutura, redução de custos operacionais ou digitalização de canais de venda e atendimento.';
  }
  if (s.includes('construç') || s.includes('concre') || s.includes('incorpor') || s.includes('imobili') || s.includes('engenhar') || s.includes('arquitet')) {
    return 'Investidores institucionais, compradores de imóveis de médio/alto padrão, empresas de engenharia, arquitetura e incorporadoras buscando fornecedores qualificados e parceiros estratégicos de co-investimento.';
  }
  if (s.includes('advoc') || s.includes('jurid') || s.includes('direito') || s.includes('legal')) {
    return 'Diretores financeiros e de RH, CEOs de PMEs a grandes empresas que necessitam de consultoria preventiva, assessoria tributária, conformidade trabalhista (CLT) ou gestão de contencioso.';
  }
  if (s.includes('contab') || s.includes('auditor') || s.includes('consult')) {
    return 'CEOs, diretores de operações e fundadores de PMEs que precisam de terceirização financeira (BPO), planejamento tributário estratégico, auditoria de processos ou estruturação de governança.';
  }
  if (s.includes('propagan') || s.includes('public') || s.includes('market') || s.includes('comunic') || s.includes('agência') || s.includes('mídia')) {
    return 'Departamentos de marketing de médias empresas, diretores comerciais e marcas consolidadas buscando aumento de awareness, branding reposicionamento, geração de leads qualificados (B2B/B2C) ou campanhas de tráfego pago.';
  }
  if (s.includes('aliment') || s.includes('restaurante') || s.includes('bar') || s.includes('bebida') || s.includes('gastronomia') || s.includes('lanche') || s.includes('açaí') || s.includes('açai')) {
    return 'Distribuidores, redes de varejo/supermercados, franquias de alimentação e consumidores finais (B2C) focados em qualidade, sabor, conveniência e entrega rápida.';
  }
  if (s.includes('indústr') || s.includes('industria') || s.includes('fábrica') || s.includes('fabrica') || s.includes('manufatura')) {
    return 'Grandes distribuidores, redes varejistas, construtoras e outras indústrias que necessitam de matérias-primas, peças personalizadas, embalagens ou maquinários de alta precisão.';
  }
  if (s.includes('comér') || s.includes('varej') || s.includes('atacad') || s.includes('loja') || s.includes('venda')) {
    return 'Consumidor final (B2C) com foco em experiência de compra, conveniência e custo-benefício; ou compradores corporativos (B2B) em busca de lotes de reposição e canais de distribuição eficientes.';
  }
  if (s.includes('saúd') || s.includes('saude') || s.includes('hospital') || s.includes('clínica') || s.includes('clinica') || s.includes('estét') || s.includes('estetica') || s.includes('médic') || s.includes('dentis') || s.includes('bem-estar')) {
    return 'Pessoas físicas em busca de cuidados com a saúde física, longevidade, estética facial/corporal e bem-estar; ou operadoras de planos de saúde e clínicas pioneiras para convênios.';
  }
  if (s.includes('finan') || s.includes('banco') || s.includes('invest') || s.includes('crédito')) {
    return 'Empreendedores e indivíduos com excedente financeiro buscando multiplicação patrimonial, crédito estruturado, capital de giro, ou fundos de investimentos focados em preservação de capital.';
  }
  if (s.includes('segur')) {
    return 'Famílias que buscam proteção patrimonial/vida, ou diretores de RH e compras corporativas contratando seguro de frotas, responsabilidade civil (D&O) e planos de saúde empresariais.';
  }
  if (s.includes('educa') || s.includes('escola') || s.includes('ensino')) {
    return 'Profissionais buscando transição de carreira ou especialização; estudantes de graduação/pós-graduação; ou empresas contratando treinamentos corporativos in-company.';
  }
  if (s.includes('logíst') || s.includes('transpor') || s.includes('frete')) {
    return 'Indústrias, e-commerces de médio/grande porte, importadoras e distribuidoras que dependem de agilidade na cadeia de suprimentos, frete de carga fracionada ou lotação.';
  }
  if (s.includes('energ')) {
    return 'Indústrias e grandes comércios com alta demanda energética buscando migração para o mercado livre de energia, implantação de painéis solares para redução de custos de fatura ou eficiência energética.';
  }

  return 'Empresas e executivos tomadores de decisão (C-Levels) focados em inovação, eficiência, parcerias de alto valor e melhoria contínua de seus indicadores-chave de negócio.';
}

export interface RampupProfileClassification {
  role: 'patrocinador' | 'apoiador' | 'membro' | 'potencial_patrocinador' | 'potencial_apoiador' | 'potencial_membro';
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  explanation: string;
}

export function classifyRampupProfile(company: Company): RampupProfileClassification {
  const name = (company.name || '').toLowerCase().trim();
  const fin = calculateFinancialAnalysis(company.vidas, company.segment, company);
  const faturamentoAvg = fin.faturamentoAvg;
  const vidas = company.vidas || 0;

  // Exact / Loose current sponsors & supporters checks
  const isSponsor = name.includes('unimed') || name.includes('somapay') || name.includes('next') || name.includes('alares') || name.includes('fortes tecnologia') || name.includes('fortes');
  const isSupporter = name.includes('compasso m') || name.includes('compasso') || name.includes('fiplan') || name.includes('jonmag') || name.includes('g4flex') || name.includes('g4 flex');

  if (isSponsor) {
    return {
      role: 'patrocinador',
      label: 'Patrocinador Rampup',
      badgeBg: 'bg-indigo-600 text-white dark:bg-indigo-950/80 dark:text-indigo-200',
      badgeText: 'text-white dark:text-indigo-200',
      badgeBorder: 'border-indigo-500/40',
      explanation: 'Empresa patrocinadora oficial ativa do ecossistema Rampup (investimento de R$ 15 mil/mês).'
    };
  }

  if (isSupporter) {
    return {
      role: 'apoiador',
      label: 'Apoiador Rampup',
      badgeBg: 'bg-sky-500 text-white dark:bg-sky-950/80 dark:text-sky-200',
      badgeText: 'text-white dark:text-sky-200',
      badgeBorder: 'border-sky-400/40',
      explanation: 'Empresa apoiadora oficial ativa do ecossistema Rampup (investimento de R$ 5 mil/mês).'
    };
  }

  // Potential classifications based on faturamentoAvg and employee Lives (vidas)
  if (vidas >= 100 || faturamentoAvg >= 1000000) {
    return {
      role: 'potencial_patrocinador',
      label: 'Potencial Patrocinador',
      badgeBg: 'bg-indigo-50 dark:bg-indigo-950/45',
      badgeText: 'text-indigo-700 dark:text-indigo-300',
      badgeBorder: 'border-indigo-200/50 dark:border-indigo-900/35',
      explanation: 'Empresa de grande porte ou faturamento estimado mensal robusto (> R$ 1M). Perfil ideal para cota de Patrocínio (R$ 15 mil/mês).'
    };
  }

  if (vidas >= 30 || faturamentoAvg >= 300000) {
    return {
      role: 'potencial_apoiador',
      label: 'Potencial Apoiador',
      badgeBg: 'bg-sky-50 dark:bg-sky-950/45',
      badgeText: 'text-sky-700 dark:text-sky-300',
      badgeBorder: 'border-sky-200/50 dark:border-sky-900/35',
      explanation: 'Empresa de médio porte ou faturamento estimado intermediário (R$ 300k - R$ 1M). Perfil ideal para plano de Apoio (R$ 5 mil/mês).'
    };
  }

  return {
    role: 'potencial_membro',
    label: 'Potencial Membro',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/45',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200/50 dark:border-emerald-900/35',
    explanation: 'Micro ou pequena empresa com estrutura ágil. Perfil ideal para plano de Membro Anual (R$ 5 mil/ano).'
  };
}



