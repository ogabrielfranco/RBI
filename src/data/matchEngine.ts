import { Company, MatchAnalysis } from '../types';

/**
 * Estimates the monthly average revenue of a company based on employee count (vidas)
 * and its business segment. Safe from circular dependencies.
 */
function estimateFaturamento(vidas: number, segment: string): number {
  const baseSalarioNordeste = 2475;
  const custoFolha = (vidas || 0) * baseSalarioNordeste;
  
  const s = (segment || '').toLowerCase();
  let ratioAvg = 0.40; // Default for services
  
  if (s.includes('comércio') || s.includes('comercio') || s.includes('varejo') || s.includes('atacado') || s.includes('distribui') || s.includes('loja') || s.includes('venda')) {
    ratioAvg = 0.125;
  } else if (s.includes('indústria') || s.includes('industria') || s.includes('fábrica') || s.includes('fabrica') || s.includes('manufatura') || s.includes('confecção') || s.includes('confeccao') || s.includes('metalurg')) {
    ratioAvg = 0.20;
  } else if (s.includes('aliment') || s.includes('restaurante') || s.includes('bar') || s.includes('bebida') || s.includes('gastronomia') || s.includes('lanche')) {
    ratioAvg = 0.30;
  } else if (s.includes('saúde') || s.includes('saude') || s.includes('educa') || s.includes('escola') || s.includes('faculdade') || s.includes('hospital') || s.includes('clínica') || s.includes('clinica') || s.includes('médic') || s.includes('medic')) {
    ratioAvg = 0.40;
  }
  
  return custoFolha / ratioAvg;
}

/**
 * Normalizes text to simplify keyword matching (case-insensitive and accent/special chars resilient)
 */
function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function analyzeConnections(company: Company, allCompanies: Company[]): MatchAnalysis {
  const potentialBuyerIds: string[] = [];
  const potentialSellerIds: string[] = [];
  const potentialPartnerIds: string[] = [];
  const potentialConnectionIds: string[] = [];
  const reasons: Record<string, string> = {};

  const segment = company.segment;
  const nameNorm = normalizeText(company.name);
  const descNorm = normalizeText(company.description || '');
  const actNorm = normalizeText(company.activity || '');
  const lives = company.vidas || 0;
  const targetFaturamento = estimateFaturamento(lives, segment);

  // Classify target company's offerings
  const sellsBenefits = nameNorm.includes('unimed') || nameNorm.includes('texas') || nameNorm.includes('odont') || nameNorm.includes('lectus') ||
                        descNorm.includes('plano de saude') || descNorm.includes('saude') || actNorm.includes('plano de saude') || actNorm.includes('saude') ||
                        actNorm.includes('beneficio') || actNorm.includes('seguro') || descNorm.includes('seguro');
                        
  const sellsTech = nameNorm.includes('fortes') || nameNorm.includes('g2') || nameNorm.includes('zaperfy') || nameNorm.includes('alares') ||
                    descNorm.includes('software') || descNorm.includes('tecnologia') || descNorm.includes('erp') || descNorm.includes('crm') || descNorm.includes('nuvem') ||
                    actNorm.includes('software') || actNorm.includes('tecnologia') || actNorm.includes('ti') || actNorm.includes('telecom') || actNorm.includes('internet');
                    
  const sellsEnergy = nameNorm.includes('energy') || nameNorm.includes('volt') || nameNorm.includes('solar') || nameNorm.includes('yellow') || nameNorm.includes('goener') ||
                      descNorm.includes('solar') || descNorm.includes('fotovoltaico') || descNorm.includes('energia') ||
                      actNorm.includes('solar') || actNorm.includes('fotovoltaico') || actNorm.includes('energia');
                      
  const sellsFinances = nameNorm.includes('capital') || nameNorm.includes('fidc') || nameNorm.includes('2money') || nameNorm.includes('fluxasset') || nameNorm.includes('credito') ||
                        descNorm.includes('investimento') || descNorm.includes('recebiveis') || descNorm.includes('credito') || descNorm.includes('antecipacao') || descNorm.includes('m&a') ||
                        actNorm.includes('capital') || actNorm.includes('recebiveis') || actNorm.includes('antecipacao') || actNorm.includes('financeiro') || actNorm.includes('m&a');
                        
  const sellsLegalAccounting = nameNorm.includes('abax') || nameNorm.includes('fintax') || segment === 'Jurídico / Advocacia' || segment === 'Contabilidade & Consultoria' ||
                               descNorm.includes('contabil') || descNorm.includes('juridico') || descNorm.includes('fiscal') || descNorm.includes('tributario') || descNorm.includes('auditoria') || descNorm.includes('compliance') || descNorm.includes('bpo') ||
                               actNorm.includes('contabil') || actNorm.includes('juridico') || actNorm.includes('fiscal') || actNorm.includes('tributario') || actNorm.includes('auditoria') || actNorm.includes('compliance') || actNorm.includes('bpo');
                               
  const sellsMarketing = nameNorm.includes('mulato') || nameNorm.includes('compasso') || nameNorm.includes('advance') || segment === 'Marketing, Comunicação & Mídia' ||
                         descNorm.includes('marketing') || descNorm.includes('trafego pago') || descNorm.includes('publicidade') || descNorm.includes('midia') || descNorm.includes('propaganda') ||
                         actNorm.includes('marketing') || actNorm.includes('trafego pago') || actNorm.includes('publicidade') || actNorm.includes('midia') || actNorm.includes('propaganda');
                         
  const sellsEngineeringMaterials = nameNorm.includes('3epar') || nameNorm.includes('maia') || nameNorm.includes('tintas') || nameNorm.includes('correias') || nameNorm.includes('geradores') ||
                                    segment === 'Engenharia' || descNorm.includes('engenharia') || descNorm.includes('estrutural') || descNorm.includes('material de construcao') || descNorm.includes('cimento') || descNorm.includes('gerador') ||
                                    actNorm.includes('engenharia') || actNorm.includes('estrutural') || actNorm.includes('material de construcao') || actNorm.includes('suprimento');
                                    
  const sellsFurnitureLighting = nameNorm.includes('azzo') || nameNorm.includes('led') || descNorm.includes('moveis') || descNorm.includes('mobiliario') || descNorm.includes('iluminacao') ||
                                 actNorm.includes('moveis') || actNorm.includes('mobiliario') || actNorm.includes('iluminacao') || actNorm.includes('led');
                                 
  const sellsLogistics = descNorm.includes('transporte') || descNorm.includes('logistica') || descNorm.includes('frete') || descNorm.includes('carga') ||
                         actNorm.includes('transporte') || actNorm.includes('logistica') || actNorm.includes('frete') || actNorm.includes('carga');

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  for (const other of allCompanies) {
    if (other.id === company.id) continue;

    const otherId = other.id;
    const otherName = other.name;
    const otherSeg = other.segment;
    const otherNameNorm = normalizeText(other.name);
    const otherDescNorm = normalizeText(other.description || '');
    const otherActNorm = normalizeText(other.activity || '');
    const otherLives = other.vidas || 0;
    const otherFaturamento = estimateFaturamento(otherLives, otherSeg);

    // Classify other company's offerings
    const otherSellsBenefits = otherNameNorm.includes('unimed') || otherNameNorm.includes('texas') || otherNameNorm.includes('odont') || otherNameNorm.includes('lectus') ||
                              otherDescNorm.includes('plano de saude') || otherDescNorm.includes('saude') || otherActNorm.includes('plano de saude') || otherActNorm.includes('saude') ||
                              otherActNorm.includes('beneficio') || otherActNorm.includes('seguro') || otherDescNorm.includes('seguro');
                              
    const otherSellsTech = otherNameNorm.includes('fortes') || otherNameNorm.includes('g2') || otherNameNorm.includes('zaperfy') || otherNameNorm.includes('alares') ||
                          otherDescNorm.includes('software') || otherDescNorm.includes('tecnologia') || otherDescNorm.includes('erp') || otherDescNorm.includes('crm') || otherDescNorm.includes('nuvem') ||
                          otherActNorm.includes('software') || otherActNorm.includes('tecnologia') || otherActNorm.includes('ti') || otherActNorm.includes('telecom') || otherActNorm.includes('internet');
                          
    const otherSellsEnergy = otherNameNorm.includes('energy') || otherNameNorm.includes('volt') || otherNameNorm.includes('solar') || otherNameNorm.includes('yellow') || otherNameNorm.includes('goener') ||
                            otherDescNorm.includes('solar') || otherDescNorm.includes('fotovoltaico') || otherDescNorm.includes('energia') ||
                            otherActNorm.includes('solar') || otherActNorm.includes('fotovoltaico') || otherActNorm.includes('energia');
                            
    const otherSellsFinances = otherNameNorm.includes('capital') || otherNameNorm.includes('fidc') || otherNameNorm.includes('2money') || otherNameNorm.includes('fluxasset') || otherNameNorm.includes('credito') ||
                              otherDescNorm.includes('investimento') || otherDescNorm.includes('recebiveis') || otherDescNorm.includes('credito') || otherDescNorm.includes('antecipacao') || otherDescNorm.includes('m&a') ||
                              otherActNorm.includes('capital') || otherActNorm.includes('recebiveis') || otherActNorm.includes('antecipacao') || otherActNorm.includes('financeiro') || otherActNorm.includes('m&a');
                              
    const otherSellsLegalAccounting = otherNameNorm.includes('abax') || otherNameNorm.includes('fintax') || otherSeg === 'Jurídico / Advocacia' || otherSeg === 'Contabilidade & Consultoria' ||
                                     otherDescNorm.includes('contabil') || otherDescNorm.includes('juridico') || otherDescNorm.includes('fiscal') || otherDescNorm.includes('tributario') || otherDescNorm.includes('auditoria') || otherDescNorm.includes('compliance') || otherDescNorm.includes('bpo') ||
                                     otherActNorm.includes('contabil') || otherActNorm.includes('juridico') || otherActNorm.includes('fiscal') || otherActNorm.includes('tributario') || otherActNorm.includes('auditoria') || otherActNorm.includes('compliance') || otherActNorm.includes('bpo');
                                     
    const otherSellsMarketing = otherNameNorm.includes('mulato') || otherNameNorm.includes('compasso') || otherNameNorm.includes('advance') || otherSeg === 'Marketing, Comunicação & Mídia' ||
                               otherDescNorm.includes('marketing') || otherDescNorm.includes('trafego pago') || otherDescNorm.includes('publicidade') || otherDescNorm.includes('midia') || otherDescNorm.includes('propaganda') ||
                               otherActNorm.includes('marketing') || otherActNorm.includes('trafego pago') || otherActNorm.includes('publicidade') || otherActNorm.includes('midia') || otherActNorm.includes('propaganda');
                               
    const otherSellsEngineeringMaterials = otherNameNorm.includes('3epar') || otherNameNorm.includes('maia') || otherNameNorm.includes('tintas') || otherNameNorm.includes('correias') || otherNameNorm.includes('geradores') ||
                                          otherSeg === 'Engenharia' || otherDescNorm.includes('engenharia') || otherDescNorm.includes('estrutural') || otherDescNorm.includes('material de construcao') || otherDescNorm.includes('cimento') || otherDescNorm.includes('gerador') ||
                                          otherActNorm.includes('engenharia') || otherActNorm.includes('estrutural') || otherActNorm.includes('material de construcao') || otherActNorm.includes('suprimento');
                                          
    const otherSellsFurnitureLighting = otherNameNorm.includes('azzo') || otherNameNorm.includes('led') || otherDescNorm.includes('moveis') || otherDescNorm.includes('mobiliario') || otherDescNorm.includes('iluminacao') ||
                                       otherActNorm.includes('moveis') || otherActNorm.includes('mobiliario') || otherActNorm.includes('iluminacao') || otherActNorm.includes('led');
                                       
    const otherSellsLogistics = otherDescNorm.includes('transporte') || otherDescNorm.includes('logistica') || otherDescNorm.includes('frete') || otherDescNorm.includes('carga') ||
                               otherActNorm.includes('transporte') || otherActNorm.includes('logistica') || otherActNorm.includes('frete') || otherActNorm.includes('carga');

    let isMatch = false;

    // =========================================================================
    // 1. CO-SELLING (Vender para) - Can Target sell to Other?
    // Checks segment/activity compatibility AND respects buyer size/revenue!
    // =========================================================================
    let sellReason = '';

    if (sellsBenefits) {
      if (otherLives >= 5) {
        sellReason = `${company.name} pode fornecer planos de saúde corporativos personalizados ou benefícios de bem-estar focados na retenção de talentos para os ${otherLives} colaboradores da ${otherName}, considerando seu faturamento estimado de ${formatBRL(otherFaturamento)}/mês.`;
      }
    } 
    
    else if (sellsTech) {
      // Tech matches almost any corporate entity, with scale-appropriate solutions
      if (otherSeg !== 'Tecnologia & Telecom') {
        if (otherFaturamento >= 120000 || otherLives >= 15) {
          sellReason = `${company.name} pode implantar sistemas integrados de ERP/CRM de alta escala, infraestrutura de nuvem segura e telecomunicações dedicadas compatíveis com o faturamento robusto de ${formatBRL(otherFaturamento)}/mês da ${otherName}.`;
        } else if (otherFaturamento >= 20000 || otherLives >= 3) {
          sellReason = `${company.name} pode fornecer soluções ágeis de software SaaS, automação comercial via WhatsApp e canais digitais perfeitamente calibrados para o porte e faturamento médio de ${formatBRL(otherFaturamento)}/mês da ${otherName}.`;
        }
      }
    } 
    
    else if (sellsEnergy) {
      // Energy cost reduction applies to medium-high consumption, compatible with solid revenues
      if (otherFaturamento >= 40000 || otherLives >= 5) {
        sellReason = `${company.name} pode viabilizar até 20% de economia direta nas despesas de eletricidade da ${otherName} por meio de créditos de energia solar limpa por assinatura (Geração Distribuída), impulsionando a eficiência operacional de sua estrutura estimulada em ${formatBRL(otherFaturamento)}/mês de faturamento.`;
      }
    } 
    
    else if (sellsFinances) {
      // High-ticket M&A or structuring requires big firms; anticipation fits retail/construction/industry
      if (otherSeg === 'Comércio & Varejo' || otherSeg === 'Construção Civil & Imobiliário' || otherSeg === 'Indústria / Manufatura' || otherFaturamento >= 80000) {
        sellReason = `${company.name} pode fornecer injeção de liquidez imediata no caixa da ${otherName} por meio de antecipação simplificada de recebíveis comerciais de vendas a prazo e estruturação de capital de giro sob medida.`;
      } else if (otherFaturamento >= 250000 || otherLives >= 25) {
        sellReason = `${company.name} pode assessorar a ${otherName} com avaliação corporativa sofisticada (valuation), captação qualificada e estruturação financeira para apoiar seu alto faturamento de ${formatBRL(otherFaturamento)}/mês.`;
      }
    } 
    
    else if (sellsLegalAccounting) {
      // Legal/Accounting services scaled by revenue
      if (otherSeg !== 'Jurídico / Advocacia' && otherSeg !== 'Contabilidade & Consultoria') {
        if (otherFaturamento >= 150000 || otherLives >= 15) {
          sellReason = `${company.name} pode assessorar a ${otherName} com auditoria tributária avançada, planejamento societário de redução de custos de impostos e governança de compliance compatível com seu faturamento de ${formatBRL(otherFaturamento)}/mês.`;
        } else if (otherFaturamento >= 15000) {
          sellReason = `${company.name} pode terceirizar a contabilidade mensal (BPO Financeiro), regularizar a escrita fiscal e garantir total conformidade jurídica diária para estruturar o crescimento seguro da ${otherName}.`;
        }
      }
    } 
    
    else if (sellsMarketing) {
      // Marketing fits commercial, consumer-facing or expanding brands
      const isGoodMarketingClient = otherSeg === 'Comércio & Varejo' || otherSeg === 'Construção Civil & Imobiliário' || otherSeg === 'Saúde, Estética & Bem-estar' || otherSeg === 'Serviços' || otherFaturamento >= 35000;
      if (otherSeg !== 'Marketing, Comunicação & Mídia' && isGoodMarketingClient) {
        sellReason = `${company.name} pode impulsionar o funil de vendas e a aquisição de clientes da ${otherName} por meio de campanhas digitais focadas em tráfego pago, posicionamento de marca premium ou divulgação externa regional.`;
      }
    } 
    
    else if (sellsEngineeringMaterials) {
      // Engineering/Materials sells to Builders, Industry, or large facilities
      const isBuilderOrIndustrial = otherSeg === 'Construção Civil & Imobiliário' || otherSeg === 'Indústria / Manufatura' || otherDescNorm.includes('obra') || otherDescNorm.includes('galpao') || otherActNorm.includes('fabrica');
      if (isBuilderOrIndustrial) {
        sellReason = `${company.name} pode fornecer projetos de engenharia estrutural de precisão, suprimento básico de materiais no atacado, correias de transmissão ou geradores industriais de energia para dar total autonomia aos canteiros e operações da ${otherName}.`;
      }
    } 
    
    else if (sellsFurnitureLighting) {
      // Furniture/Lighting matches companies with office structures
      if (otherLives >= 8 || otherFaturamento >= 70000) {
        sellReason = `${company.name} pode modernizar a sede física da ${otherName} com móveis de escritório ergonômicos corporativos sofisticados ou implantar um projeto luminotécnico em LED inteligente, aliando conforto e redução direta no consumo elétrico.`;
      }
    } 
    
    else if (sellsLogistics) {
      // Logistics matches commerce, industry, or heavy distribution
      if (otherSeg === 'Comércio & Varejo' || otherSeg === 'Indústria / Manufatura' || otherFaturamento >= 50000) {
        sellReason = `${company.name} pode acelerar a cadeia de suprimentos e as entregas regionais da ${otherName} por meio de transporte rodoviário ágil de cargas fracionadas, frete monitorado e distribuição corporativa eficiente.`;
      }
    } 
    
    else {
      // General fall-back matching based on complementary sectors and size compatibility
      const isB2B = ['Tecnologia & Telecom', 'Marketing, Comunicação & Mídia', 'Contabilidade & Consultoria', 'Jurídico / Advocacia', 'Finanças & Investimentos', 'Serviços'].includes(segment);
      if (isB2B && otherSeg !== segment && otherFaturamento >= 50000) {
        sellReason = `${company.name} pode oferecer suporte operacional e soluções corporativas de ${segment.toLowerCase()} alinhadas ao orçamento e faturamento planejado de ${formatBRL(otherFaturamento)}/mês da ${otherName}.`;
      }
    }

    if (sellReason) {
      potentialBuyerIds.push(otherId);
      reasons[`sell_${otherId}`] = sellReason;
      isMatch = true;
    }


    // =========================================================================
    // 2. OUTSOURCING (Comprar de) - Can Target buy from Other?
    // Mirrored logic for buyers, verifying that our size and revenue match their tier!
    // =========================================================================
    let buyReason = '';

    if (otherSellsBenefits) {
      if (lives >= 5) {
        buyReason = `${otherName} oferece a estrutura ideal para suprir sua empresa com planos de saúde, convênios corporativos de alto padrão ou seguros de vida de alta atração para os seus ${lives} colaboradores, alinhando benefícios com o faturamento de ${formatBRL(targetFaturamento)}/mês de sua operação.`;
      }
    } 
    
    else if (otherSellsTech) {
      if (segment !== 'Tecnologia & Telecom') {
        if (targetFaturamento >= 120000 || lives >= 15) {
          buyReason = `${otherName} pode estruturar o seu negócio com sistemas integrados de ERP/CRM robustos, canais automatizados omnichannel e infraestrutura estável na nuvem, compatível com seu patamar financeiro de faturamento.`;
        } else if (targetFaturamento >= 20000 || lives >= 3) {
          buyReason = `${otherName} oferece sistemas de gestão comercial em nuvem ágeis, conexões corporativas de internet e ferramentas digitais sob medida para otimizar os fluxos diários de sua equipe de vendas.`;
        }
      }
    } 
    
    else if (otherSellsEnergy) {
      if (targetFaturamento >= 40000 || lives >= 5) {
        buyReason = `${otherName} é o parceiro ideal para reduzir diretamente em até 20% os custos recorrentes de energia elétrica de seus escritórios e sedes físicas através de cotas de usina solar por assinatura, sem investimento em infraestrutura própria.`;
      }
    } 
    
    else if (otherSellsFinances) {
      if (segment !== 'Finanças & Investimentos') {
        if (segment === 'Comércio & Varejo' || segment === 'Construção Civil & Imobiliário' || segment === 'Indústria / Manufatura') {
          buyReason = `${otherName} pode acelerar a liquidez de suas vendas a prazo por meio de antecipação ágil de recebíveis com taxas competitivas para turbinar o capital de giro de sua empresa.`;
        } else if (lives >= 25 || targetFaturamento >= 250000) {
          buyReason = `${otherName} é extremamente recomendada para estruturar soluções de fusões, aquisições (M&A), governança financeira de alta complexidade e avaliação de valuation para subsidiar decisões estratégicas.`;
        }
      }
    } 
    
    else if (otherSellsLegalAccounting) {
      if (segment !== 'Jurídico / Advocacia' && segment !== 'Contabilidade & Consultoria') {
        if (targetFaturamento >= 150000 || lives >= 15) {
          buyReason = `${otherName} possui corpo técnico qualificado para assessorar sua empresa em planejamento tributário estratégico avançado, due diligence e conformidade jurídica para sustentar o faturamento corporativo mensal.`;
        } else if (targetFaturamento >= 15000) {
          buyReason = `${otherName} pode assumir a assessoria contábil rotineira, as obrigações fiscais e trabalhistas, ou fornecer serviços de BPO financeiro para que sua gestão foque exclusivamente em crescer.`;
        }
      }
    } 
    
    else if (otherSellsMarketing) {
      if (segment !== 'Marketing, Comunicação & Mídia' && targetFaturamento >= 35000) {
        buyReason = `${otherName} pode desenhar campanhas personalizadas de captação de clientes na internet, gestão estratégica de tráfego pago nas redes e publicidade visual focada em acelerar os resultados comerciais de sua marca.`;
      }
    } 
    
    else if (otherSellsEngineeringMaterials) {
      const isTargetBuilderOrIndustrial = segment === 'Construção Civil & Imobiliário' || segment === 'Indústria / Manufatura' || descNorm.includes('obra') || descNorm.includes('galpao') || actNorm.includes('fabrica');
      if (isTargetBuilderOrIndustrial) {
        buyReason = `${otherName} pode prover projetos especializados de engenharia estrutural, suprimentos básicos no atacado, correias de transmissão para maquinário fabril ou locação de geradores profissionais de energia para blindar seu cronograma operacional.`;
      }
    } 
    
    else if (otherSellsFurnitureLighting) {
      if (lives >= 8 || targetFaturamento >= 70000) {
        buyReason = `${otherName} pode ambientar seus escritórios com móveis ergonômicos corporativos de altíssima qualidade ou implantar iluminação inteligente de alto rendimento LED para reduzir seus custos mensais de energia.`;
      }
    } 
    
    else if (otherSellsLogistics) {
      if (segment === 'Comércio & Varejo' || segment === 'Indústria / Manufatura' || targetFaturamento >= 50000) {
        buyReason = `${otherName} pode otimizar as entregas de sua empresa e a cadeia logística regional por meio de transportadora ágil, fretes de cargas fracionadas e armazenagem qualificada.`;
      }
    }

    if (buyReason) {
      potentialSellerIds.push(otherId);
      reasons[`buy_${otherId}`] = buyReason;
      isMatch = true;
    }


    // =========================================================================
    // 3. PARTNERSHIPS & CANAIS (Parcerias / Canais) - Complementary Business Synergies
    // High-level cross-referral networks and mutual business scale alignment!
    // =========================================================================
    let partnerReason = '';

    // A. Accounting & Legal (Classic cross-referral synergy)
    if (
      (segment === 'Contabilidade & Consultoria' && otherSeg === 'Jurídico / Advocacia') ||
      (segment === 'Jurídico / Advocacia' && otherSeg === 'Contabilidade & Consultoria')
    ) {
      partnerReason = `Sinergia clássica de canais (cross-referral). A empresa de contabilidade (${company.name}) mapeia lacunas fiscais e operacionais de clientes corporativos, enquanto o escritório de advocacia (${otherName}) desenha planejamentos jurídicos sofisticados e estruturação societária avançada.`;
    }

    // B. Architecture / Engineering + Construction & Real Estate
    else if (
      ((segment === 'Engenharia' || descNorm.includes('projeto') || descNorm.includes('arquit')) && (otherSeg === 'Construção Civil & Imobiliário' || otherDescNorm.includes('construtora'))) ||
      ((otherSeg === 'Engenharia' || otherDescNorm.includes('projeto') || otherDescNorm.includes('arquit')) && (segment === 'Construção Civil & Imobiliário' || descNorm.includes('construtora')))
    ) {
      partnerReason = `Cadeia imobiliária de valor agregado. Projetistas de arquitetura e calculistas de engenharia estrutural indicam construtoras de confiança, enquanto a construtora subcontrata projetos de detalhamento executivo e indica novos proprietários imobiliários.`;
    }

    // C. Marketing Agencies + Production / Mídia OOH / Events
    else if (
      segment === 'Marketing, Comunicação & Mídia' && otherSeg === 'Marketing, Comunicação & Mídia' &&
      (sellsMarketing && otherSellsMarketing)
    ) {
      partnerReason = `Acordo de co-delivery e canais. Agências criativas de posicionamento de marca e gestão de tráfego se associam para fornecer serviços unificados (conteúdo, produção audiovisual sofisticada, assessoria de imprensa e painéis de OOH físicos).`;
    }

    // D. Marketing + Technology / CRM / Software development
    else if (
      (sellsMarketing && otherSellsTech) ||
      (sellsTech && otherSellsMarketing)
    ) {
      partnerReason = `Sinergia de canais de vendas (Inbound + Tech Integration). A agência de marketing gera e qualifica fluxos digitais de leads, enquanto a empresa de tecnologia fornece softwares ERP/CRM e automações de atendimento para converter e organizar a base de contatos.`;
    }

    // E. Finance & M&A + Accounting / Legal compliance
    else if (
      (segment === 'Finanças & Investimentos' && (otherSeg === 'Contabilidade & Consultoria' || otherSeg === 'Jurídico / Advocacia')) ||
      ((segment === 'Contabilidade & Consultoria' || segment === 'Jurídico / Advocacia') && otherSeg === 'Finanças & Investimentos')
    ) {
      partnerReason = `Parceria estratégica de due diligence corporativo. Operações estruturadas de M&A, valuation, reorganização societária ou emissão de títulos de dívida dependem intrinsecamente de auditoria contábil rígida e pareceres jurídicos para validação segura.`;
    }

    // F. Tech Software ERP + Internet / Telecom provider
    else if (
      (sellsTech && otherSellsTech) &&
      ((descNorm.includes('software') && otherDescNorm.includes('internet')) || (descNorm.includes('internet') && otherDescNorm.includes('software')))
    ) {
      partnerReason = `Parceria de infraestrutura e aplicação (Co-selling). A desenvolvedora de softwares em nuvem recomenda o link de internet estável dedicada da operadora telecom para que suas ferramentas rodem de forma impecável no cliente final.`;
    }

    // G. Healthcare Clinics + Benefits brokers / Insurance
    else if (
      (segment === 'Saúde, Estética & Bem-estar' && otherSeg === 'Saúde, Estética & Bem-estar') &&
      ((descNorm.includes('clinica') || descNorm.includes('tratamento')) && (otherDescNorm.includes('corretor') || otherDescNorm.includes('seguro')))
    ) {
      partnerReason = `Acordo de canal de benefícios agregados. Corretoras de seguros corporativos oferecem pacotes preventivos de saúde física, estética ou odontológica das clínicas como vantagem promocional exclusiva para os contratos de novos clientes.`;
    }

    // H. Retail/Industry + Logistics transport
    else if (
      ((segment === 'Comércio & Varejo' || segment === 'Indústria / Manufatura') && otherSellsLogistics) ||
      (sellsLogistics && (otherSeg === 'Comércio & Varejo' || otherSeg === 'Indústria / Manufatura'))
    ) {
      partnerReason = `Parceria operacional de Last-Mile. A empresa comercial ou industrial garante vendas expressivas em larga escala, enquanto o operador de logística especializado fornece serviços ágeis de frete fracionado de mercadorias com tarifas personalizadas.`;
    }

    // I. Same segment and size similarity (Strategic scale alignment!)
    else if (segment === otherSeg && Math.abs(lives - otherLives) <= 15) {
      partnerReason = `Ambas as empresas operam no setor de **${segment}** com escala de operação e contingentes de pessoal semelhantes. Excelente sinergia para compartilhamento de custos de fornecedores comuns, debates regulatórios regionais ou atuação em consórcio cooperativo para novos editais.`;
    }

    if (partnerReason) {
      potentialPartnerIds.push(otherId);
      reasons[`partner_${otherId}`] = partnerReason;
      isMatch = true;
    }


    // =========================================================================
    // 4. SAME SEGMENT / SAME LOCALITY - General Networking Link
    // =========================================================================
    let connReason = '';
    if (!isMatch) {
      if (segment === otherSeg) {
        connReason = `Ambos atuam no mesmo segmento econômico de **${segment}**. Ótima oportunidade para trocar benchmarking sobre desafios do mercado cearense e alinhar diretrizes de melhores práticas setoriais.`;
      } else if (company.location && other.location && company.location === other.location && company.location !== 'Fortaleza, CE') {
        connReason = `Ambas as organizações compartilham proximidade física na localidade de **${company.location}**. Perfeito para estreitar o networking estratégico de base regional e fomentar a economia e as rodadas de negócios locais.`;
      }
    }

    if (connReason) {
      potentialConnectionIds.push(otherId);
      reasons[`conn_${otherId}`] = connReason;
    }
  }

  return {
    targetCompanyId: company.id,
    potentialBuyerIds,
    potentialSellerIds,
    potentialPartnerIds,
    potentialConnectionIds,
    reasons
  };
}
