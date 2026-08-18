import { Company, Contact, Transaction, CustomFieldConfig } from '../types';
import { 
  EventDealIndex, 
  classifyCompanySize, 
  calculateFinancialAnalysis, 
  getSimilarSegmentGroup, 
  getDefaultICPForSegment, 
  getCompanyArchetype,
  classifyRampupProfile
} from './strategicHelpers';
import { jsPDF } from 'jspdf';
import { analyzeConnections } from '../data/matchEngine';

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Loads an image URL (data URL base64, Clearbit URL, or external link)
 * and returns its base64 dataUrl and format for jsPDF.
 */
export async function loadImageAsDataUrl(url: string | undefined): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data:image/')) {
    const isPng = trimmed.includes('image/png');
    return { dataUrl: trimmed, format: isPng ? 'PNG' : 'JPEG' };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 120;
        canvas.height = img.naturalHeight || img.height || 120;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          resolve({ dataUrl, format: 'PNG' });
          return;
        }
      } catch (err) {
        console.warn('Canvas conversion failed for image:', err);
      }
      resolve(null);
    };
    img.onerror = () => resolve(null);
    img.src = trimmed;
  });
}

/**
 * Exports the companies list into a structured CSV format fully readable by Excel.
 */
export function exportCompaniesToCSV(companies: Company[]) {
  const headers = [
    'ID da Empresa',
    'Nome da Empresa',
    'Segmento',
    'Porte',
    'Vidas (Funcionários)',
    'Custo de Folha Estimado (R$)',
    'Localização',
    'Resumo da Atuação',
    'O que Vende e Alvo Comercial'
  ];

  const rows = companies.map(c => {
    const sizeInfo = classifyCompanySize(c.vidas);
    const cleanedDesc = (c.description || '').replace(/"/g, '""').replace(/\n/g, ' ');
    const cleanedActivity = (c.activity || '').replace(/"/g, '""').replace(/\n/g, ' ');
    return [
      c.id,
      c.name,
      c.segment,
      sizeInfo.porte,
      c.vidas,
      sizeInfo.custoFolha.toFixed(2),
      c.location || 'Fortaleza-CE',
      cleanedDesc,
      cleanedActivity
    ];
  });

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(val => `"${val}"`).join(';'))
  ].join('\n');

  downloadCSV(`empresas_ecossistema_rampup_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
}

/**
 * Exports complete dashboard indicators, IGN event indices, and networking rankings to CSV.
 */
export function exportDashboardMetricsToCSV(
  companiesCount: number,
  contactsCount: number,
  totalSynergiesCount: number,
  eventDealIndices: EventDealIndex[],
  topEntrepreneurs: any[]
) {
  let content = '=== RELATORIO ESTRATEGICO - ECOSSISTEMA RAMPUP ===\n';
  content += `Data de Exportacao;${new Date().toLocaleDateString('pt-BR')}\n\n`;

  content += '=== METRICAS CHAVE DO ECOSSISTEMA ===\n';
  content += `Indicador;Quantidade\n`;
  content += `Empresas Ativas no Ecossistema;${companiesCount}\n`;
  content += `Decisores / Empresarios Unificados;${contactsCount}\n`;
  content += `Conexoes e Pontes de Sinergia Ativas;${totalSynergiesCount}\n\n`;

  content += '=== INDICE DE GERACAO DE NEGOCIOS (IGN) POR EDICAO ===\n';
  content += 'Agenda/Edicao;Empresas;Setores;Media de Vidas;Pontos Escala (max 25);Pontos Diversidade (max 25);Pontos Sinergia (max 30);Pontos Porte (max 20);Indice IGN (%)\n';
  
  eventDealIndices.forEach(evt => {
    content += `"${evt.name}";${evt.uniqueCompaniesCount};${evt.segmentsCount};${evt.avgVidas.toFixed(1)};${evt.scalePoints.toFixed(1)};${evt.diversityPoints.toFixed(1)};${evt.synergyPoints.toFixed(1)};${evt.sizePoints.toFixed(1)};${evt.dealMakingIndex}%\n`;
  });

  const totalIGN = eventDealIndices.reduce((sum, e) => sum + e.dealMakingIndex, 0);
  const avgIGN = eventDealIndices.length > 0 ? (totalIGN / eventDealIndices.length) : 0;
  content += `\nINDICE MEDIO GERAL DO ECOSSISTEMA (IGN GERAL);;;;;;;;${avgIGN.toFixed(1)}%\n\n`;

  content += '=== LIDERES DE NETWORKING (PRESENCA EM EVENTOS) ===\n';
  content += 'Posicao;Nome do Decisor;Empresa;Frequencia de Participacao (Edicoes)\n';
  topEntrepreneurs.forEach((leader, idx) => {
    content += `${idx + 1};"${leader.contact.name}";"${leader.companyName}";${leader.eventCount} edicoes\n`;
  });

  downloadCSV(`relatorio_executivo_metricas_rampup_${new Date().toISOString().split('T')[0]}.csv`, content);
}

/**
 * Generates an extremely beautiful, high-fidelity PDF list of companies on the client side.
 * Bypasses the iframe window.print limitations by compiling a native jsPDF document.
 */
export function exportCompaniesToPDF(companies: Company[]) {
  const doc = new jsPDF();
  
  // Header banner
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.rect(0, 0, 210, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('RAMPUP BUSINESS INTELLIGENCE', 15, 18);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Diretório de Empresas do Ecossistema - Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 15, 27);
  
  let y = 50;
  
  // Stats summary box
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(15, y, 180, 15, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(`Total de Empresas Filtradas: ${companies.length} no diretório`, 20, y + 95 / 10);
  y += 25;
  
  companies.forEach((company, idx) => {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    
    // Card Background
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(15, y, 180, 42, 'F');
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.rect(15, y, 180, 42, 'S');
    
    // Left border accent
    doc.setFillColor(79, 70, 229); // indigo-600
    doc.rect(15, y, 3, 42, 'F');
    
    // Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`${idx + 1}. ${company.name}`, 22, y + 8);
    
    // Segment tag
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(79, 70, 229);
    doc.text(`Segmento: ${company.segment || 'Outros'}`, 22, y + 14);
    
    // Metadata
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // slate-500
    const staffText = company.vidas ? `${company.vidas} vidas (Funcionários)` : 'Funcionários: N/D';
    const locText = `Localização: ${company.location || 'Não especificada'}`;
    doc.text(`${staffText}   |   ${locText}`, 22, y + 20);
    
    // Desc
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85); // slate-700
    const descText = company.description || 'Nenhuma descrição detalhada cadastrada.';
    const splitDesc = doc.splitTextToSize(descText, 165);
    doc.text(splitDesc.slice(0, 1), 22, y + 26);
    
    // Activity
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    const actText = `Atividade Principal: ${company.activity || 'Nenhuma atividade principal unificada.'}`;
    const splitAct = doc.splitTextToSize(actText, 165);
    doc.text(splitAct.slice(0, 1), 22, y + 34);
    
    y += 48;
  });
  
  doc.save(`diretorio_empresas_rampup_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Generates an extremely beautiful, high-fidelity PDF report of the main dashboard on the client side.
 */
export function exportDashboardToPDF(
  companiesCount: number,
  contactsCount: number,
  totalSynergiesCount: number,
  eventDealIndices: EventDealIndex[],
  topEntrepreneurs: any[]
) {
  const doc = new jsPDF();
  
  // Header banner
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('RAMPUP BUSINESS INTELLIGENCE', 15, 18);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Relatório Executivo Geral de Métricas e Performance de Ecossistema`, 15, 26);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 15, 32);
  
  let y = 55;
  
  // Section 1: Stats
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('1. INDICADORES GERAIS DO CRM', 15, y);
  y += 8;
  
  // Three Bento Blocks
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  
  // Box 1
  doc.rect(15, y, 55, 24, 'F');
  doc.rect(15, y, 55, 24, 'S');
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(15);
  doc.text(companiesCount.toString(), 42.5, y + 10, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('EMPRESAS ATIVAS', 42.5, y + 17, { align: 'center' });
  
  // Box 2
  doc.setFillColor(248, 250, 252);
  doc.rect(77, y, 55, 24, 'F');
  doc.rect(77, y, 55, 24, 'S');
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(15);
  doc.text(contactsCount.toString(), 104.5, y + 10, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('DECISORES / CONTATOS', 104.5, y + 17, { align: 'center' });
  
  // Box 3
  doc.setFillColor(248, 250, 252);
  doc.rect(140, y, 55, 24, 'F');
  doc.rect(140, y, 55, 24, 'S');
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(15);
  doc.text(totalSynergiesCount.toString(), 167.5, y + 10, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('PONTES DE SINERGIA', 167.5, y + 17, { align: 'center' });
  
  y += 36;
  
  // Section 2: IGN Indices table
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('2. ÍNDICE DE GERAÇÃO DE NEGÓCIOS (IGN) POR EDICAO', 15, y);
  y += 6;
  
  doc.setFillColor(241, 245, 249);
  doc.rect(15, y, 180, 8, 'F');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Agenda / Edição', 18, y + 5.5);
  doc.text('Empresas', 85, y + 5.5);
  doc.text('Segmentos', 110, y + 5.5);
  doc.text('Vidas Médias', 135, y + 5.5);
  doc.text('Índice IGN (%)', 165, y + 5.5);
  y += 8;
  
  eventDealIndices.forEach(evt => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    
    doc.setDrawColor(241, 245, 249);
    doc.line(15, y + 6, 195, y + 6);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(evt.name, 18, y + 4.5);
    
    doc.setFont('helvetica', 'normal');
    doc.text(evt.uniqueCompaniesCount.toString(), 90, y + 4.5);
    doc.text(evt.segmentsCount.toString(), 115, y + 4.5);
    doc.text(evt.avgVidas.toFixed(1), 140, y + 4.5);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229);
    doc.text(`${evt.dealMakingIndex.toFixed(1)}%`, 168, y + 4.5);
    
    y += 8;
  });
  
  y += 12;
  
  // Section 3: Networking Leaders
  if (y > 220) {
    doc.addPage();
    y = 20;
  }
  
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('3. LÍDERES DE NETWORKING / MAIS RECORRENTES', 15, y);
  y += 6;
  
  doc.setFillColor(241, 245, 249);
  doc.rect(15, y, 180, 8, 'F');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Posição', 18, y + 5.5);
  doc.text('Decisor / Representante', 35, y + 5.5);
  doc.text('Empresa Vinculada', 105, y + 5.5);
  doc.text('Participações em Agendas', 160, y + 5.5);
  y += 8;
  
  topEntrepreneurs.slice(0, 15).forEach((leader, idx) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    
    doc.setDrawColor(241, 245, 249);
    doc.line(15, y + 6, 195, y + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(`#${idx + 1}`, 18, y + 4.5);
    
    doc.setFont('helvetica', 'bold');
    doc.text(leader.contact.name, 35, y + 4.5);
    
    doc.setFont('helvetica', 'normal');
    doc.text(leader.companyName || 'N/D', 105, y + 4.5);
    doc.text(`${leader.eventCount} edições`, 165, y + 4.5);
    
    y += 8;
  });
  
  doc.save(`relatorio_dashboard_rampup_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Generates an extremely beautiful, high-fidelity PDF report of the selected Agenda.
 */
export function exportAgendaToPDF(
  agendaName: string,
  companiesCount: number,
  segmentsCount: number,
  avgVidas: number,
  dealMakingIndex: number,
  participants: Company[],
  topSegments: { segment: string; count: number }[]
) {
  const doc = new jsPDF();
  
  // Header banner
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('RAMPUP BUSINESS INTELLIGENCE', 15, 18);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Relatório Diagnóstico das Rodadas de Negócios e Agendas do Ecossistema`, 15, 26);
  doc.text(`Agenda Analisada: ${agendaName}  |  Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 15, 32);
  
  let y = 55;
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('1. MÉTRICAS DIAGNÓSTICAS (IGN)', 15, y);
  y += 8;
  
  // Four metric blocks
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  
  // Block 1
  doc.rect(15, y, 42, 22, 'F');
  doc.rect(15, y, 42, 22, 'S');
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(13);
  doc.text(companiesCount.toString(), 36, y + 9, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('EMPRESAS NA AGENDA', 36, y + 15, { align: 'center' });
  
  // Block 2
  doc.rect(61, y, 42, 22, 'F');
  doc.rect(61, y, 42, 22, 'S');
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(13);
  doc.text(segmentsCount.toString(), 82, y + 9, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('DIVERSIDADE SETORIAL', 82, y + 15, { align: 'center' });
  
  // Block 3
  doc.rect(107, y, 42, 22, 'F');
  doc.rect(107, y, 42, 22, 'S');
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(13);
  doc.text(avgVidas.toFixed(1), 128, y + 9, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('MÉDIA DE VIDAS', 128, y + 15, { align: 'center' });
  
  // Block 4
  doc.rect(153, y, 42, 22, 'F');
  doc.rect(153, y, 42, 22, 'S');
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(13);
  doc.text(`${dealMakingIndex.toFixed(1)}%`, 174, y + 9, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('ÍNDICE IGN GERAL', 174, y + 15, { align: 'center' });
  
  y += 33;
  
  // Section 2: Top Segments
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('2. DISTRIBUIÇÃO E DENSIDADE DOS SETORES PARTICIPANTES', 15, y);
  y += 6;
  
  doc.setFillColor(241, 245, 249);
  doc.rect(15, y, 180, 8, 'F');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Setor / Segmento Comercial', 18, y + 5.5);
  doc.text('Número de Empresas', 145, y + 5.5);
  y += 8;
  
  topSegments.slice(0, 10).forEach(s => {
    doc.setDrawColor(241, 245, 249);
    doc.line(15, y + 6, 195, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(s.segment, 18, y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`${s.count} empresas`, 145, y + 4.5);
    y += 8;
  });
  
  y += 12;
  
  // Section 3: List of participants
  if (y > 220) {
    doc.addPage();
    y = 20;
  }
  
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('3. LISTA NOMINAL DE PARTICIPANTES DA EDICAO', 15, y);
  y += 6;
  
  doc.setFillColor(241, 245, 249);
  doc.rect(15, y, 180, 8, 'F');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Nome da Empresa', 18, y + 5.5);
  doc.text('Segmento', 75, y + 5.5);
  doc.text('Funcionários (Vidas)', 140, y + 5.5);
  doc.text('Sede / Localização', 165, y + 5.5);
  y += 8;
  
  participants.slice(0, 40).forEach(p => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    
    doc.setDrawColor(241, 245, 249);
    doc.line(15, y + 6, 195, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(p.name, 18, y + 4.5);
    
    doc.setFont('helvetica', 'normal');
    doc.text(p.segment || 'Outros', 75, y + 4.5);
    doc.text((p.vidas || 0).toString(), 140, y + 4.5);
    doc.text(p.location || 'N/D', 165, y + 4.5);
    
    y += 8;
  });
  
  if (participants.length > 40) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`... e outras ${participants.length - 40} empresas cadastradas nesta agenda.`, 18, y + 4.5);
  }
  
  doc.save(`panorama_agenda_${agendaName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Native Print Triggers (Legacy Print Mode fallback)
 */
export function triggerPDFPrint() {
  const isDark = document.documentElement.classList.contains('dark');
  const bodyHasDark = document.body.classList.contains('dark');

  if (isDark) {
    document.documentElement.classList.remove('dark');
  }
  if (bodyHasDark) {
    document.body.classList.remove('dark');
  }

  window.print();

  // Restore dark mode asynchronously so the print spooler completes capturing the light style first
  setTimeout(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
    if (bodyHasDark) {
      document.body.classList.add('dark');
    }
  }, 100);
}

/**
 * Exports a highly polished, single page or multi-page PDF dossier for a selected company,
 * including all financial metrics, corporate identity, contacts/decisores, transaction history, and business matches.
 */
export async function exportSingleCompanyToPDF(
  company: Company,
  allCompanies: Company[],
  contacts: Contact[],
  transactions: Transaction[],
  customFields: CustomFieldConfig[],
  isEnriched?: boolean,
  validationReport?: string
) {
  const doc = new jsPDF();
  let y = 48;
  let pageNum = 1;

  // Header Banner
  doc.setFillColor(79, 70, 229); // Indigo 600
  doc.rect(0, 0, 210, 38, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(company.name.toUpperCase(), 15, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`DOSSIÊ COMERCIAL COMPLETO - RAMPUP BUSINESS INTELLIGENCE`, 15, 24);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 15, 30);

  // Dedicated Reserved Space for Logo in Header Banner (Always drawn)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(165, 4, 30, 30, 2, 2, 'F');
  doc.setDrawColor(199, 210, 254);
  doc.setLineWidth(0.5);
  doc.roundedRect(165, 4, 30, 30, 2, 2, 'S');

  let companyLogoDrawn = false;
  if (company.logoUrl) {
    try {
      const logoImg = await loadImageAsDataUrl(company.logoUrl);
      if (logoImg) {
        doc.addImage(logoImg.dataUrl, logoImg.format, 166, 5, 28, 28);
        companyLogoDrawn = true;
      }
    } catch (err) {
      console.warn('Error embedding logo in PDF:', err);
    }
  }

  if (!companyLogoDrawn) {
    // Draw clear reserved space placeholder indicator
    doc.setFillColor(241, 245, 249);
    doc.rect(166, 5, 28, 28, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(166, 5, 28, 28, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('ESPAÇO RESERVADO', 180, 17, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text('LOGO DA EMPRESA', 180, 22, { align: 'center' });
  }

  // Helper to manage page breaks and add page headers dynamically
  const checkSpace = (heightNeeded: number) => {
    if (y + heightNeeded > 270) {
      doc.addPage();
      pageNum++;
      
      // Page background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 210, 297, 'F');
      
      // Mini page header
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.rect(0, 0, 210, 15, 'F');
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.line(0, 15, 210, 15);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text(`RAMPUP INTEL - DOSSIÊ DE NEGÓCIOS: ${company.name.toUpperCase()}`, 15, 10);
      doc.text(`Página ${pageNum}`, 185, 10);
      
      y = 25;
    }
  };

  const financialAnalysis = calculateFinancialAnalysis(company.vidas, company.segment, company);
  const companyContacts = contacts.filter(c => c.companyId === company.id);
  const companyTransactions = transactions
    .filter(t => t.companyId === company.id)
    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));

  // --- 1. CORPORATE METRICS ---
  checkSpace(40);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, y, 180, 32, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(79, 70, 229); // Indigo 600
  doc.text('MÉTRICAS E INDICADORES DE PERFORMANCE', 20, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  doc.text(`Segmento:`, 20, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.text(company.segment, 48, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.text(`Porte Comercial:`, 20, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.text(`${classifyCompanySize(company.vidas).porte} (${company.vidas} colaboradores)`, 48, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.text(`Localização:`, 20, y + 26);
  doc.setFont('helvetica', 'bold');
  doc.text(company.location || 'Ceará, Brasil', 48, y + 26);

  // Financial Estimations
  doc.setFont('helvetica', 'normal');
  doc.text(`Faturamento Est. Mensal:`, 110, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 163, 74); // Emerald 600
  const fatText = financialAnalysis.faturamentoAvg > 0 
    ? `R$ ${financialAnalysis.faturamentoAvg.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` 
    : 'Não informado';
  doc.text(fatText, 150, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Custo de Folha Mensal:`, 110, y + 20);
  doc.setFont('helvetica', 'bold');
  const folhaText = financialAnalysis.custoFolha > 0 
    ? `R$ ${financialAnalysis.custoFolha.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` 
    : 'Não informado';
  doc.text(folhaText, 150, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.text(`Frequência em Rodadas:`, 110, y + 26);
  doc.setFont('helvetica', 'bold');
  doc.text(`${companyTransactions.length} edições participadas`, 150, y + 26);

  y += 38;

  // --- RAMPUP COMMERCIAL POTENTIAL BLOCK ---
  const profileInfo = classifyRampupProfile(company);
  const fatDesc = financialAnalysis.faturamentoAvg > 0 
    ? `o faturamento estimado de R$ ${financialAnalysis.faturamentoAvg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/mês` 
    : 'faturamento não informado';
  const fullExplanation = `${profileInfo.explanation} Com base na análise do ecossistema, ${fatDesc} e o contingente de ${company.vidas} colaboradores justificam este enquadramento estratégico.`;
  const wrappedExplanation = doc.splitTextToSize(fullExplanation, 170);

  let approachTip = '';
  if (profileInfo.role === 'patrocinador') {
    approachTip = 'Abordagem Comercial: Manter relacionamento de excelência. Apresentar relatórios de interações geradas e sugerir novos C-levels do grupo para moderar painéis exclusivos.';
  } else if (profileInfo.role === 'apoiador') {
    approachTip = 'Abordagem Comercial: Manter relacionamento ativo de co-branding. Incentivar participação no comitê de lideranças e explorar parcerias de integração e mídia conjunta.';
  } else if (profileInfo.role === 'potencial_patrocinador') {
    approachTip = 'Abordagem Comercial: Apresentar proposta de Patrocínio Master (R$ 15k/mês). Focar em employer branding, visibilidade exclusiva e matchmaking prioritário com tomadores de decisão.';
  } else if (profileInfo.role === 'potencial_apoiador') {
    approachTip = 'Abordagem Comercial: Apresentar proposta de Apoio (R$ 5k/mês). Destacar o retorno sobre o investimento gerado pelas rodadas de negócios frequentes e as conexões qualificadas.';
  } else {
    approachTip = 'Abordagem Comercial: Convidar para filiação anual como Membro (R$ 5k/ano). Formato ideal de porta de entrada para novos empresários acelerarem seu networking regional.';
  }
  const wrappedApproach = doc.splitTextToSize(approachTip, 170);

  const blockHeight = 12 + (wrappedExplanation.length * 4) + (wrappedApproach.length * 4) + 6;
  checkSpace(blockHeight + 10);

  doc.setFillColor(245, 247, 255); // Light indigo slate bg
  doc.setDrawColor(199, 210, 254); // Indigo border
  doc.roundedRect(15, y, 180, blockHeight, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(79, 70, 229); // Indigo 600
  doc.text(`★ RACIONAL COMERCIAL RAMPUP: ${profileInfo.label.toUpperCase()}`, 20, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(wrappedExplanation, 20, y + 11);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(wrappedApproach, 20, y + 12 + (wrappedExplanation.length * 4));

  y += blockHeight + 8;

  // --- 2. COMMERCIAL IDENTITY ---
  checkSpace(65);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. IDENTIDADE CORPORATIVA E ATUAÇÃO', 15, y);
  
  doc.setDrawColor(226, 232, 240);
  doc.line(15, y + 2, 195, y + 2);
  y += 8;

  // Description (Resumo)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229);
  doc.text('Resumo Corporativo:', 15, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const wrappedDesc = doc.splitTextToSize(company.description || 'Nenhum resumo comercial fornecido.', 180);
  doc.text(wrappedDesc, 15, y);
  y += (wrappedDesc.length * 4) + 4;

  // Activity
  checkSpace(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229);
  doc.text('Atividade Principal (Oferta de valor comercial):', 15, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const wrappedActivity = doc.splitTextToSize(company.activity || 'Nenhuma atividade principal especificada.', 180);
  doc.text(wrappedActivity, 15, y);
  y += (wrappedActivity.length * 4) + 4;

  // ICP
  checkSpace(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229);
  doc.text('Perfil de Cliente Ideal (ICP):', 15, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const wrappedIcp = doc.splitTextToSize(company.icp || getDefaultICPForSegment(company.segment), 180);
  doc.text(wrappedIcp, 15, y);
  y += (wrappedIcp.length * 4) + 8;

  // --- 3. INTERNAL CRM COMMENTS ---
  if (company.comments || company.segmentComments) {
    checkSpace(35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('2. ANOTAÇÕES DE RELACIONAMENTO & CRM', 15, y);
    doc.line(15, y + 2, 195, y + 2);
    y += 8;

    if (company.comments) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(79, 70, 229);
      doc.text('Comentários sobre a Organização:', 15, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const wrappedComm = doc.splitTextToSize(company.comments, 180);
      doc.text(wrappedComm, 15, y);
      y += (wrappedComm.length * 4) + 4;
    }

    if (company.segmentComments) {
      checkSpace(20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(79, 70, 229);
      doc.text('Estudos Setoriais & Benchmarking:', 15, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const wrappedSegComm = doc.splitTextToSize(company.segmentComments, 180);
      doc.text(wrappedSegComm, 15, y);
      y += (wrappedSegComm.length * 4) + 4;
    }
    y += 4;
  }

  // --- 4. DECISORES & CONTATOS ---
  checkSpace(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('3. DECISORES E LIDERANÇAS MAPEADAS', 15, y);
  doc.line(15, y + 2, 195, y + 2);
  y += 8;

  if (companyContacts.length > 0) {
    // Contacts Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(15, y, 180, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('NOME COMPLETO', 18, y + 4.5);
    doc.text('EMAIL corporativo', 85, y + 4.5);
    doc.text('TELEFONE / CONTATO', 150, y + 4.5);
    y += 6;

    for (const contact of companyContacts) {
      checkSpace(12);
      doc.setDrawColor(241, 245, 249);
      doc.line(15, y + 10, 195, y + 10);

      let xOffset = 18;
      if (contact.photoUrl) {
        try {
          const contactPhoto = await loadImageAsDataUrl(contact.photoUrl);
          if (contactPhoto) {
            doc.addImage(contactPhoto.dataUrl, contactPhoto.format, 18, y + 1, 8, 8);
            xOffset = 28;
          }
        } catch (e) {
          console.warn('Could not add contact photo in company PDF:', e);
        }
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(contact.name, xOffset, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(contact.email, 95, y + 6);
      doc.text(contact.phone || 'Sem telefone', 155, y + 6);
      y += 11;
    }
    y += 4;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhum decisor específico cadastrado para esta empresa.', 15, y);
    y += 8;
  }

  // --- 5. TRANSACTION HISTORY ---
  checkSpace(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('4. PARTICIPAÇÃO EM EVENTOS E TRANSAÇÕES', 15, y);
  doc.line(15, y + 2, 195, y + 2);
  y += 8;

  if (companyTransactions.length > 0) {
    doc.setFillColor(241, 245, 249);
    doc.rect(15, y, 180, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('NOME DO EVENTO', 18, y + 4.5);
    doc.text('DATA', 95, y + 4.5);
    doc.text('TIPO DE INGRESSO', 120, y + 4.5);
    doc.text('VALOR', 160, y + 4.5);
    doc.text('STATUS', 180, y + 4.5);
    y += 6;

    companyTransactions.forEach(tx => {
      checkSpace(8);
      doc.setDrawColor(241, 245, 249);
      doc.line(15, y + 6, 195, y + 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(tx.eventName.substring(0, 38), 18, y + 4);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(tx.purchaseDate || 'N/D', 95, y + 4);
      doc.text(tx.ticketType || 'Membro', 120, y + 4);
      doc.text(`R$ ${tx.value.toFixed(0)}`, 160, y + 4);

      if (tx.paymentStatus === 'Aprovado') {
        doc.setTextColor(22, 163, 74); // Emerald 650
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setTextColor(225, 29, 72); // Rose 600
      }
      doc.text(tx.paymentStatus, 180, y + 4);
      y += 7;
    });
    y += 4;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhuma transação financeira ou ingresso registrado na plataforma.', 15, y);
    y += 8;
  }

  // --- 6. ADVANCED CUSTOM FIELDS ---
  const companyCFValues = Object.entries(company.customFields || {}).filter(([_, val]) => val !== undefined && val !== '');
  if (companyCFValues.length > 0) {
    checkSpace(35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('5. CAMPOS PERSONALIZADOS DO SISTEMA', 15, y);
    doc.line(15, y + 2, 195, y + 2);
    y += 8;

    doc.setFillColor(248, 250, 252);
    doc.rect(15, y, 180, companyCFValues.length * 6 + 4, 'F');
    y += 4;

    companyCFValues.forEach(([fieldId, val]) => {
      checkSpace(6);
      const config = customFields.find(cf => cf.id === fieldId);
      const fieldName = config ? config.name : fieldId;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`${fieldName}:`, 20, y);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(String(val), 80, y);
      y += 6;
    });
    y += 4;
  }

  // --- 7. STRATEGIC NETWORKING MATCHES ---
  checkSpace(55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('6. CRUZAMENTOS INTELIGENTES DE NEGÓCIOS (GOLDEN MATCHES)', 15, y);
  doc.line(15, y + 2, 195, y + 2);
  y += 8;

  const matches = analyzeConnections(company, allCompanies);
  const buyers = matches.potentialBuyerIds.map(id => allCompanies.find(c => c.id === id)).filter(Boolean) as Company[];
  const sellers = matches.potentialSellerIds.map(id => allCompanies.find(c => c.id === id)).filter(Boolean) as Company[];
  const partners = matches.potentialPartnerIds.map(id => allCompanies.find(c => c.id === id)).filter(Boolean) as Company[];

  // Render Enrichment Validation Report if present
  if (isEnriched && validationReport) {
    const reportTitle = '★ LAUDO DE VALIDAÇÃO DO MECANISMO ESTRATÉGICO RAMPUP';
    const cleanReport = validationReport.replace(/###?\s+/g, '').replace(/\*\*/g, ''); // strip markdown headers & bold signs for pdf formatting
    const wrappedReport = doc.splitTextToSize(cleanReport, 172);
    const boxHeight = 10 + (wrappedReport.length * 3.5) + 6;
    checkSpace(boxHeight);

    // Light background block for the report
    doc.setFillColor(240, 253, 250); // Teal 50 / Emerald light
    doc.rect(15, y, 180, boxHeight, 'F');
    doc.setDrawColor(16, 185, 129); // Emerald 500
    doc.setLineWidth(0.5);
    doc.rect(15, y, 180, boxHeight, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(13, 148, 136); // Teal 600
    doc.text(reportTitle, 20, y + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text(wrappedReport, 20, y + 12);
    
    y += boxHeight + 6;
  }

  const buyersList = isEnriched ? buyers : buyers.slice(0, 3);
  const sellersList = isEnriched ? sellers : sellers.slice(0, 3);
  const partnersList = isEnriched ? partners : partners.slice(0, 3);

  // 7a. Buyers (Quem pode comprar desta empresa)
  checkSpace(15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('FITS DE VENDA - Clientes potenciais na base (De quem pode fazer VENDA):', 15, y);
  y += 4.5;
  if (buyersList.length > 0) {
    buyersList.forEach(b => {
      const reason = matches.reasons[`sell_${b.id}`] || 'Sinergia comercial identificada na base.';
      const wrappedReason = doc.splitTextToSize(`Racional Estratégico: ${reason}`, 175);
      const neededHeight = 6 + (wrappedReason.length * 3.5) + 3;
      checkSpace(neededHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(79, 70, 229); // Indigo 600
      doc.text(`• ${b.name}`, 18, y);
      
      let xOffset = 18 + doc.getTextWidth(`• ${b.name} `);
      if (isEnriched) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 185, 129); // Emerald 500
        doc.text(`[CONEXÃO VALIDADA]`, xOffset, y);
        xOffset += doc.getTextWidth(`[CONEXÃO VALIDADA] `);
      }

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`(${b.segment})`, xOffset, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(wrappedReason, 22, y);
      y += (wrappedReason.length * 3.5) + 3;
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Nenhum match comprador encontrado na base atual.', 18, y);
    y += 5;
  }
  y += 2;

  // 7b. Sellers (Quem pode vender para esta empresa)
  checkSpace(15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('FITS DE COMPRA - Fornecedores potenciais mapeados (De quem pode fazer COMPRA):', 15, y);
  y += 4.5;
  if (sellersList.length > 0) {
    sellersList.forEach(s => {
      const reason = matches.reasons[`buy_${s.id}`] || 'Fornecedor em potencial para otimização de operações.';
      const wrappedReason = doc.splitTextToSize(`Racional Estratégico: ${reason}`, 175);
      const neededHeight = 6 + (wrappedReason.length * 3.5) + 3;
      checkSpace(neededHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(217, 119, 6); // Amber 600
      doc.text(`• ${s.name}`, 18, y);
      
      let xOffset = 18 + doc.getTextWidth(`• ${s.name} `);
      if (isEnriched) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 185, 129); // Emerald 500
        doc.text(`[CONEXÃO VALIDADA]`, xOffset, y);
        xOffset += doc.getTextWidth(`[CONEXÃO VALIDADA] `);
      }

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`(${s.segment})`, xOffset, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(wrappedReason, 22, y);
      y += (wrappedReason.length * 3.5) + 3;
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Nenhum match de fornecedor encontrado na base.', 18, y);
    y += 5;
  }
  y += 2;

  // 7c. Partners (Parcerias Estratégicas)
  checkSpace(15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('PARCERIAS ESTRATÉGICAS - Sinergia de recomendação / Co-selling (Canais):', 15, y);
  y += 4.5;
  if (partnersList.length > 0) {
    partnersList.forEach(p => {
      const reason = matches.reasons[`partner_${p.id}`] || 'Sinergia de canais identificada para cross-referral.';
      const wrappedReason = doc.splitTextToSize(`Racional Estratégico: ${reason}`, 175);
      const neededHeight = 6 + (wrappedReason.length * 3.5) + 3;
      checkSpace(neededHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(13, 148, 136); // Teal 600
      doc.text(`• ${p.name}`, 18, y);
      
      let xOffset = 18 + doc.getTextWidth(`• ${p.name} `);
      if (isEnriched) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 185, 129); // Emerald 500
        doc.text(`[CONEXÃO VALIDADA]`, xOffset, y);
        xOffset += doc.getTextWidth(`[CONEXÃO VALIDADA] `);
      }

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`(${p.segment})`, xOffset, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(wrappedReason, 22, y);
      y += (wrappedReason.length * 3.5) + 3;
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Nenhum hacker ou parceiro ideal de recomendação listado.', 18, y);
    y += 5;
  }

  // Save the complete dossier!
  doc.save(`dossie_comercial_rampup_${company.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Generates an extremely organized Excel-ready (CSV semi-colon format with UTF-8 BOM)
 * containing the complete company base with all strategic details, estimated monthly financials,
 * ICP metrics, custom fields, totals spent, and concatenated decision makers list.
 */
export function exportFullBaseToExcel(
  companies: Company[],
  contacts: Contact[],
  transactions: Transaction[],
  customFields: CustomFieldConfig[]
) {
  const companyCFConfigs = customFields.filter(cf => cf.target === 'company');
  const contactCFConfigs = customFields.filter(cf => cf.target === 'contact');
  
  // Set up Excel columns
  const headers = [
    'ID da Empresa',
    'Nome da Empresa',
    'Segmento',
    'Categoria / Grupo de Sinergia',
    'Porte Comercial',
    'Vidas (Quantidade de Funcionários)',
    'Faturamento Estimado Mínimo Mensal (R$)',
    'Faturamento Estimado Médio Mensal (R$)',
    'Faturamento Estimado Máximo Mensal (R$)',
    'Custo de Folha Mensal (R$)',
    'Macrosetor Financeiro',
    'Proporção Mínima de Folha (%)',
    'Proporção Média de Folha (%)',
    'Proporção Máxima de Folha (%)',
    'Perfil de Cliente Ideal (ICP)',
    'Potencial para o Rampup (Classificação)',
    'Potencial para o Rampup (Justificativa)',
    'Localidade / Cidade',
    'Resumo da Atuação (Dossiê)',
    'Atividade Comercial',
    'Anotações Internas (CRM)',
    'Anotações Setoriais',
    'Arquétipo de Ecossistema',
    'Descrição do Arquétipo',
    'Sinergia: Clientes Potenciais (Venda)',
    'Sinergia: Fornecedores Potenciais (Compra)',
    'Sinergia: Canais Potenciais (Parceria)',
    'Quantidade de Ingressos Comprados',
    'Total Financeiro Investido (R$)',
    'Nome do Empresário / Sócio',
    'Email do Empresário / Sócio',
    'Telefone / WhatsApp',
    'Time de Futebol',
    'Área de Atuação',
    'Preferência Política',
    'Tipo de Música',
    'Redes Sociais'
  ];

  // Append contact custom fields
  contactCFConfigs.forEach(cf => {
    headers.push(`Contato: ${cf.name}`);
  });

  // Append company custom fields as separate headers
  companyCFConfigs.forEach(cf => {
    headers.push(`Empresa: ${cf.name}`);
  });

  const rows: any[][] = [];

  const clean = (txt: string) => {
    return (txt || '').replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '').replace(/;/g, ',');
  };

  companies.forEach(c => {
    // 1. Calculations
    const sizeInfo = classifyCompanySize(c.vidas);
    const financialAnalysis = calculateFinancialAnalysis(c.vidas, c.segment, c);
    const arch = getCompanyArchetype(c.id === 'all' ? companies[0] : c, companies);
    const rampupProfile = classifyRampupProfile(c);
    const matches = analyzeConnections(c, companies);
    
    // 2. CRM Transactions spent summary
    const compTxs = transactions.filter(t => t.companyId === c.id);
    const approvedTxs = compTxs.filter(t => t.paymentStatus === 'Aprovado');
    const totalInvested = approvedTxs.reduce((sum, t) => sum + t.value, 0);
    
    // 3. Find contacts for this company
    const compContacts = contacts.filter(con => con.companyId === c.id);

    const getCompanyCells = () => [
      c.id,
      clean(c.name),
      clean(c.segment),
      clean(getSimilarSegmentGroup(c.segment)),
      sizeInfo.porte,
      c.vidas,
      financialAnalysis.faturamentoMin.toFixed(2),
      financialAnalysis.faturamentoAvg.toFixed(2),
      financialAnalysis.faturamentoMax.toFixed(2),
      financialAnalysis.custoFolha.toFixed(2),
      financialAnalysis.sector.macroSector,
      (financialAnalysis.sector.ratioMin * 100).toFixed(1),
      (financialAnalysis.sector.ratioAvg * 100).toFixed(1),
      (financialAnalysis.sector.ratioMax * 100).toFixed(1),
      clean(c.icp || getDefaultICPForSegment(c.segment)),
      rampupProfile.label,
      clean(rampupProfile.explanation),
      clean(c.location || 'Fortaleza, CE'),
      clean(c.description),
      clean(c.activity),
      clean(c.comments || ''),
      clean(c.segmentComments || ''),
      arch.label,
      clean(arch.description),
      matches.potentialBuyerIds.length,
      matches.potentialSellerIds.length,
      matches.potentialPartnerIds.length,
      compTxs.length,
      totalInvested.toFixed(2)
    ];

    if (compContacts.length > 0) {
      compContacts.forEach(con => {
        const rowData = [
          ...getCompanyCells(),
          clean(con.name),
          clean(con.email),
          clean(con.phone || ''),
          clean(con.futebol || ''),
          clean(con.areaAtuacao || ''),
          clean(con.politica || ''),
          clean(con.musica || ''),
          clean(con.redesSociais || '')
        ];

        // Append contact custom fields
        contactCFConfigs.forEach(cf => {
          const val = con.customFields?.[cf.id] !== undefined ? String(con.customFields[cf.id]) : '';
          rowData.push(clean(val));
        });

        // Append company custom fields
        companyCFConfigs.forEach(cf => {
          const val = c.customFields?.[cf.id] !== undefined ? String(c.customFields[cf.id]) : '';
          rowData.push(clean(val));
        });

        rows.push(rowData);
      });
    } else {
      // If no contacts, push one row with empty contact details
      const rowData = [
        ...getCompanyCells(),
        '', // Nome do Empresário / Sócio
        '', // Email do Empresário / Sócio
        '', // Telefone / WhatsApp
        '', // Time de Futebol
        '', // Área de Atuação
        '', // Preferência Política
        '', // Tipo de Música
        ''  // Redes Sociais
      ];

      // Append contact custom fields (empty)
      contactCFConfigs.forEach(() => {
        rowData.push('');
      });

      // Append company custom fields
      companyCFConfigs.forEach(cf => {
        const val = c.customFields?.[cf.id] !== undefined ? String(c.customFields[cf.id]) : '';
        rowData.push(clean(val));
      });

      rows.push(rowData);
    }
  });

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(val => `"${val}"`).join(';'))
  ].join('\n');

  downloadCSV(`base_completa_unificada_empresas_rampup_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
}

/**
 * Generates an extremely beautiful, high-fidelity PDF report for a single Entrepreneur/Contact.
 */
export async function exportSingleContactToPDF(
  contact: Contact,
  company: Company,
  allCompanies: Company[],
  transactions: Transaction[],
  customFields: CustomFieldConfig[],
  isEnriched?: boolean,
  validationReport?: string
) {
  const doc = new jsPDF();
  
  // Header banner
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.rect(0, 0, 210, 45, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('RAMPUP BUSINESS INTELLIGENCE', 15, 18);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('DOSSIÊ INDIVIDUAL DO EMPRESÁRIO / DECISOR', 15, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Perfil: ${contact.name.toUpperCase()}`, 15, 33);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Relatório individual de networking e faturamento do decisor no ecossistema Rampup`, 15, 39);

  // Dedicated Reserved Space for Photo in Header Banner (Always drawn)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(165, 6, 32, 32, 3, 3, 'F');
  doc.setDrawColor(199, 210, 254);
  doc.setLineWidth(0.5);
  doc.roundedRect(165, 6, 32, 32, 3, 3, 'S');

  let contactPhotoDrawn = false;
  if (contact.photoUrl) {
    try {
      const photoImg = await loadImageAsDataUrl(contact.photoUrl);
      if (photoImg) {
        doc.addImage(photoImg.dataUrl, photoImg.format, 166, 7, 30, 30);
        contactPhotoDrawn = true;
      }
    } catch (err) {
      console.warn('Error embedding contact photo in PDF:', err);
    }
  }

  if (!contactPhotoDrawn) {
    // Draw clear reserved space placeholder indicator
    doc.setFillColor(241, 245, 249);
    doc.rect(166, 7, 30, 30, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(166, 7, 30, 30, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('ESPAÇO RESERVADO', 181, 19, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text('FOTO DO DECISOR', 181, 24, { align: 'center' });
  }

  let y = 60;
  let pageNum = 1;

  const checkSpace = (needed: number) => {
    if (y + needed > 275) {
      doc.addPage();
      pageNum++;
      
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 210, 297, 'F');
      
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.rect(0, 0, 210, 15, 'F');
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.line(0, 15, 210, 15);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`RAMPUP INTEL - FICHA DO EMPRESÁRIO: ${contact.name.toUpperCase()}`, 15, 10);
      doc.text(`Página ${pageNum}`, 185, 10);
      
      y = 25;
    }
  };

  const contactTransactions = transactions
    .filter(t => t.contactEmail === contact.email)
    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));

  const totalEventSpend = contactTransactions
    .filter(t => t.paymentStatus === 'Aprovado')
    .reduce((sum, t) => sum + t.value, 0);

  // --- 1. BASIC CONTACT INFORMATION ---
  checkSpace(35);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, y, 180, 28, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(79, 70, 229);
  doc.text('DADOS GERAIS DO EMPRESÁRIO', 20, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  doc.text(`Email Corporativo:`, 20, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.text(contact.email || 'Não informado', 48, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.text(`Telefone / WhatsApp:`, 20, y + 19);
  doc.setFont('helvetica', 'bold');
  doc.text(contact.phone || 'Não informado', 48, y + 19);

  doc.setFont('helvetica', 'normal');
  doc.text(`Rodadas Ativas:`, 115, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.text(`${contactTransactions.length} edições confirmadas`, 145, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Área de Atuação:`, 115, y + 19);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(contact.areaAtuacao || 'Não informado', 145, y + 19);

  y += 35;

  // --- 1B. MAILING & PREFERENCES ---
  if (contact.futebol || contact.areaAtuacao || contact.politica || contact.musica || contact.redesSociais) {
    checkSpace(41);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, y, 180, 34, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(79, 70, 229); // Indigo 600
    doc.text('DADOS DE MAILING & PREFERÊNCIAS DO EMPRESÁRIO', 20, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);

    doc.text(`Time de Futebol:`, 20, y + 13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(contact.futebol || 'Não informado', 48, y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Área de Atuação:`, 20, y + 19);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(contact.areaAtuacao || 'Não informado', 48, y + 19);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Pref. Política:`, 115, y + 13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(contact.politica || 'Não informado', 145, y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Tipo de Música:`, 115, y + 19);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(contact.musica || 'Não informado', 145, y + 19);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Redes Sociais:`, 20, y + 26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(contact.redesSociais || 'Não informado', 48, y + 26);

    y += 41;
  }
  checkSpace(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. CONTEXTO ORGANIZACIONAL & EMPRESA VINCULADA', 15, y);
  doc.setDrawColor(226, 232, 240);
  doc.line(15, y + 2, 195, y + 2);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  doc.text(`Organização:`, 15, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(company.name, 45, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Segmento de Atuação:`, 15, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.text(company.segment, 45, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.text(`Tamanho & Porte:`, 115, y);
  doc.setFont('helvetica', 'bold');
  doc.text(`${classifyCompanySize(company.vidas).porte} (${company.vidas} colaboradores)`, 145, y);

  doc.setFont('helvetica', 'normal');
  doc.text(`Faturamento Est:`, 115, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 163, 74);
  const fin = calculateFinancialAnalysis(company.vidas, company.segment, company);
  const fatText = fin.faturamentoAvg > 0 
    ? `R$ ${fin.faturamentoAvg.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mês` 
    : 'Não informado';
  doc.text(fatText, 145, y + 6);

  y += 14;

  // Description and activities
  if (company.description) {
    checkSpace(15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(79, 70, 229);
    doc.text('Resumo de Atuação da Organização:', 15, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const wrapDesc = doc.splitTextToSize(company.description, 180);
    doc.text(wrapDesc, 15, y);
    y += (wrapDesc.length * 4) + 4;
  }

  // --- RAMPUP STRATEGIC PROFILE BLOCK ---
  const profileInfo = classifyRampupProfile(company);
  const fatDesc = fin.faturamentoAvg > 0 
    ? `o faturamento bruto estimado em R$ ${fin.faturamentoAvg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/mês` 
    : 'faturamento não informado';
  const fullExplanation = `O empresário representa a empresa ${company.name}, que possui perfil classificado como ${profileInfo.label}. ${profileInfo.explanation} O contingente de ${company.vidas} colaboradores e ${fatDesc} fundamentam este posicionamento estratégico.`;
  const wrappedExplanation = doc.splitTextToSize(fullExplanation, 170);

  let approachTip = '';
  if (profileInfo.role === 'patrocinador') {
    approachTip = 'Diretriz de Relacionamento: Manter contato de alto nível institucional. Envolver em painéis exclusivos e conselhos consultivos.';
  } else if (profileInfo.role === 'apoiador') {
    approachTip = 'Diretriz de Relacionamento: Estimular co-marketing ativo e apoiar integrações ou ações conjuntas regionais.';
  } else if (profileInfo.role === 'potencial_patrocinador') {
    approachTip = 'Diretriz de Relacionamento: Apresentar cota de Patrocínio Master (R$ 15 mil/mês) focada na atratividade de marca empregadora e matchmaking prioritário.';
  } else if (profileInfo.role === 'potencial_apoiador') {
    approachTip = 'Diretriz de Relacionamento: Ofertar plano de Apoio (R$ 5 mil/mês) demonstrando o ROI gerado pela rede e conexões qualificadas.';
  } else {
    approachTip = 'Diretriz de Relacionamento: Convidar para se associar como Membro Oficial (R$ 5 mil/ano) focando no potencial de atração de negócios regionais com baixo investimento.';
  }
  const wrappedApproach = doc.splitTextToSize(approachTip, 170);

  const blockHeight = 12 + (wrappedExplanation.length * 4) + (wrappedApproach.length * 4) + 6;
  checkSpace(blockHeight + 10);

  doc.setFillColor(245, 247, 255); // Indigo slate bg
  doc.setDrawColor(199, 210, 254); // Indigo border
  doc.roundedRect(15, y, 180, blockHeight, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(79, 70, 229); // Indigo 600
  doc.text(`★ CLASSIFICAÇÃO COMERCIAL RAMPUP: ${profileInfo.label.toUpperCase()}`, 20, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(wrappedExplanation, 20, y + 11);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(wrappedApproach, 20, y + 12 + (wrappedExplanation.length * 4));

  y += blockHeight + 8;

  // --- 3. DYNAMIC CUSTOM FIELDS FOR CONTACTS ---
  const contactCFValues = Object.entries(contact.customFields || {}).filter(([_, val]) => val !== undefined && val !== '');
  const contactConfigs = customFields.filter(cf => cf.target === 'contact');

  if (contactCFValues.length > 0) {
    checkSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('2. INFORMAÇÕES ADICIONAIS & CAMPOS PERSONALIZADOS', 15, y);
    doc.line(15, y + 2, 195, y + 2);
    y += 8;

    contactCFValues.forEach(([fieldId, value]) => {
      const config = contactConfigs.find(c => c.id === fieldId);
      if (!config) return;

      checkSpace(6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(79, 70, 229);
      doc.text(`${config.name}:`, 15, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const strVal = typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value);
      doc.text(strVal, 50, y);
      y += 5.5;
    });
    y += 3;
  }

  // --- 4. MEETING ATTENDANCE LIST ---
  checkSpace(35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('3. HISTÓRICO DE RODADAS E PARTICIPAÇÕES', 15, y);
  doc.line(15, y + 2, 195, y + 2);
  y += 8;

  if (contactTransactions.length > 0) {
    doc.setFillColor(241, 245, 249);
    doc.rect(15, y, 180, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('AGENDA / EDIDÃO DO EVENTO', 18, y + 4.5);
    doc.text('DATA COMPRA', 95, y + 4.5);
    doc.text('TIPO DE INGRESSO', 125, y + 4.5);
    doc.text('VALOR', 160, y + 4.5);
    doc.text('STATUS', 180, y + 4.5);
    y += 7;

    contactTransactions.forEach(tx => {
      checkSpace(8);
      doc.setDrawColor(241, 245, 249);
      doc.line(15, y + 6, 195, y + 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(tx.eventName.substring(0, 36), 18, y + 4);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(tx.purchaseDate || 'N/D', 95, y + 4);
      doc.text(tx.ticketType || 'Membro', 125, y + 4);
      doc.text(`R$ ${tx.value.toFixed(0)}`, 160, y + 4);

      if (tx.paymentStatus === 'Aprovado') {
        doc.setTextColor(22, 163, 74);
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setTextColor(225, 29, 72);
      }
      doc.text(tx.paymentStatus, 180, y + 4);
      y += 7;
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Este empresário não possui nenhuma presença registrada sob seu email corporativo.', 15, y);
    y += 8;
  }

  // --- 5. STRATEGIC NETWORKING MATCHES FOR ENTREPRENEUR ---
  checkSpace(55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('4. CRUZAMENTOS INTELIGENTES DE NEGÓCIOS DE SUA ORGANIZAÇÃO (GOLDEN MATCHES)', 15, y);
  doc.line(15, y + 2, 195, y + 2);
  y += 8;

  const matches = analyzeConnections(company, allCompanies);
  const buyers = matches.potentialBuyerIds.map(id => allCompanies.find(c => c.id === id)).filter(Boolean) as Company[];
  const sellers = matches.potentialSellerIds.map(id => allCompanies.find(c => c.id === id)).filter(Boolean) as Company[];
  const partners = matches.potentialPartnerIds.map(id => allCompanies.find(c => c.id === id)).filter(Boolean) as Company[];

  // Render Enrichment Validation Report if present
  if (isEnriched && validationReport) {
    const reportTitle = '★ LAUDO DE VALIDAÇÃO DO MECANISMO ESTRATÉGICO RAMPUP';
    const cleanReport = validationReport.replace(/###?\s+/g, '').replace(/\*\*/g, ''); // strip markdown headers & bold signs for pdf formatting
    const wrappedReport = doc.splitTextToSize(cleanReport, 172);
    const boxHeight = 10 + (wrappedReport.length * 3.5) + 6;
    checkSpace(boxHeight);

    // Light background block for the report
    doc.setFillColor(240, 253, 250); // Teal 50 / Emerald light
    doc.rect(15, y, 180, boxHeight, 'F');
    doc.setDrawColor(16, 185, 129); // Emerald 500
    doc.setLineWidth(0.5);
    doc.rect(15, y, 180, boxHeight, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(13, 148, 136); // Teal 600
    doc.text(reportTitle, 20, y + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text(wrappedReport, 20, y + 12);
    
    y += boxHeight + 6;
  }

  const buyersList = isEnriched ? buyers : buyers.slice(0, 3);
  const sellersList = isEnriched ? sellers : sellers.slice(0, 3);
  const partnersList = isEnriched ? partners : partners.slice(0, 3);

  // 5a. Buyers
  checkSpace(15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('FITS DE VENDA - Clientes potenciais na base (De quem pode fazer VENDA):', 15, y);
  y += 4.5;
  if (buyersList.length > 0) {
    buyersList.forEach(b => {
      const reason = matches.reasons[`sell_${b.id}`] || 'Sinergia comercial identificada na base.';
      const wrappedReason = doc.splitTextToSize(`Racional Estratégico: ${reason}`, 175);
      const neededHeight = 6 + (wrappedReason.length * 3.5) + 3;
      checkSpace(neededHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(79, 70, 229); // Indigo 600
      doc.text(`• ${b.name}`, 18, y);
      
      let xOffset = 18 + doc.getTextWidth(`• ${b.name} `);
      if (isEnriched) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 185, 129); // Emerald 500
        doc.text(`[CONEXÃO VALIDADA]`, xOffset, y);
        xOffset += doc.getTextWidth(`[CONEXÃO VALIDADA] `);
      }

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`(${b.segment})`, xOffset, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(wrappedReason, 22, y);
      y += (wrappedReason.length * 3.5) + 3;
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Nenhum match comprador encontrado na base atual.', 18, y);
    y += 5;
  }
  y += 2;

  // 5b. Sellers
  checkSpace(15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('FITS DE COMPRA - Fornecedores potenciais mapeados (De quem pode fazer COMPRA):', 15, y);
  y += 4.5;
  if (sellersList.length > 0) {
    sellersList.forEach(s => {
      const reason = matches.reasons[`buy_${s.id}`] || 'Fornecedor em potencial para otimização de operações.';
      const wrappedReason = doc.splitTextToSize(`Racional Estratégico: ${reason}`, 175);
      const neededHeight = 6 + (wrappedReason.length * 3.5) + 3;
      checkSpace(neededHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(217, 119, 6); // Amber 600
      doc.text(`• ${s.name}`, 18, y);
      
      let xOffset = 18 + doc.getTextWidth(`• ${s.name} `);
      if (isEnriched) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 185, 129); // Emerald 500
        doc.text(`[CONEXÃO VALIDADA]`, xOffset, y);
        xOffset += doc.getTextWidth(`[CONEXÃO VALIDADA] `);
      }

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`(${s.segment})`, xOffset, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(wrappedReason, 22, y);
      y += (wrappedReason.length * 3.5) + 3;
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Nenhum match de fornecedor encontrado na base.', 18, y);
    y += 5;
  }
  y += 2;

  // 5c. Partners
  checkSpace(15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('PARCERIAS ESTRATÉGICAS - Sinergia de recomendação / Co-selling (Canais):', 15, y);
  y += 4.5;
  if (partnersList.length > 0) {
    partnersList.forEach(p => {
      const reason = matches.reasons[`partner_${p.id}`] || 'Sinergia de canais identificada para cross-referral.';
      const wrappedReason = doc.splitTextToSize(`Racional Estratégico: ${reason}`, 175);
      const neededHeight = 6 + (wrappedReason.length * 3.5) + 3;
      checkSpace(neededHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(13, 148, 136); // Teal 600
      doc.text(`• ${p.name}`, 18, y);
      
      let xOffset = 18 + doc.getTextWidth(`• ${p.name} `);
      if (isEnriched) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 185, 129); // Emerald 500
        doc.text(`[CONEXÃO VALIDADA]`, xOffset, y);
        xOffset += doc.getTextWidth(`[CONEXÃO VALIDADA] `);
      }

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`(${p.segment})`, xOffset, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(wrappedReason, 22, y);
      y += (wrappedReason.length * 3.5) + 3;
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Nenhum parceiro ideal de recomendação listado.', 18, y);
    y += 5;
  }

  // Save PDF!
  const sanitizedFilename = contact.name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`perfil_empresario_rampup_${sanitizedFilename}_${new Date().toISOString().split('T')[0]}.pdf`);
}


