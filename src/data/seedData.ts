import { Company, Contact, Transaction } from '../types';

// Map of spelling variations to clean standard names
const COMPANY_NAME_MAP: Record<string, string> = {
  'abax auditoria e consultotia': 'Abax Auditoria e Consultoria',
  'abax auditoria e consultoria': 'Abax Auditoria e Consultoria',
  'advance': 'Advance',
  'advance/cdl jovem': 'Advance',
  'apex imersões': 'APEX IMERSOES',
  'apex imersoes': 'APEX IMERSOES',
  'bpo’ar gestão financeira': 'BPO’AR Gestão Financeira',
  'brasterra': 'Brasterra',
  'caju produção': 'Caju Produção',
  'caju producao': 'Caju Produção',
  'cosbel': 'Cosbel',
  'eclat hair care': 'Cosbel', // Part of Cosbel group in description
  'lessaelima assosiados': 'Lessa & Lima Associados',
  'lessaelima  associados': 'Lessa & Lima Associados',
  'lessa & lima associados': 'Lessa & Lima Associados',
  'lessa & lima associados ': 'Lessa & Lima Associados',
  'puro açai': 'Puro Açaí',
  'puro açaí': 'Puro Açaí',
  'puro.acai': 'Puro Açaí',
  'puro.açai': 'Puro Açaí',
  'puro.açaí': 'Puro Açaí',
  'puro.açaí juazeiro do norte': 'Puro Açaí',
  'puro.acai buena vista': 'Puro Açaí',
  'distribuidora puro.açaí': 'Puro Açaí',
  'distribuidora puroacai': 'Puro Açaí',
  'distribuidora purocai': 'Puro Açaí',
  'somapay': 'Somapay',
  'vsm': 'VSM Comunicação',
  'vsm comunicação': 'VSM Comunicação',
  'vsm/trends': 'VSM Comunicação',
  'trends ceara': 'VSM Comunicação', // Trends is VSM's media
  'trendsce': 'VSM Comunicação',
  'trends': 'VSM Comunicação',
  'yellow energy': 'Yellow Energy',
  'g4flex': 'G4Flex',
  'g4flex integrated solutions': 'G4Flex',
  'g4flex integrated services': 'G4Flex',
  'g4flex integrated solutions ': 'G4Flex',
  'clínica soft harmony': 'Clínica Soft Harmony',
  'mabrouk consorcio': 'Mabrouk Consórcio',
  'mabrouk consorcuo': 'Mabrouk Consórcio',
  'escandi branding': 'Escandi',
  'escandi': 'Escandi',
  'escola espaço criativo': 'Escola Espaço Criativo',
  'escola espaco criativo': 'Escola Espaço Criativo',
  'gomes de matos consultoria': 'Gomes de Matos',
  'gomes de matos': 'Gomes de Matos',
  'grupo camarmo': 'Grupo Camarmo',
  'grupo7': 'Grupo 7',
  'grupo 7': 'Grupo 7',
  'oiti gastrobar': 'Oiti',
  'oiti': 'Oiti',
  'vasto fortaleza': 'Vasto Fortaleza',
  'vasto': 'Vasto Fortaleza'
};

export function cleanCompanyName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return 'Sem Empresa';
  
  // Check direct map
  if (COMPANY_NAME_MAP[normalized]) {
    return COMPANY_NAME_MAP[normalized];
  }
  
  // Return standard capitalized
  return name.trim();
}

export function parseTSVData(tsvContent: string): {
  companies: Company[];
  contacts: Contact[];
  transactions: Transaction[];
} {
  const lines = tsvContent.split(/\r?\n/);
  if (lines.length < 2) {
    return { companies: [], contacts: [], transactions: [] };
  }

  const header = lines[0].split('\t').map(h => h.trim().replace(/^["']|["']$/g, ''));
  
  const colIndex = (candidates: string | string[]) => {
    const list = Array.isArray(candidates) ? candidates : [candidates];
    // 1. Try exact match (case-insensitive)
    let foundIdx = header.findIndex(h => list.some(c => h.toLowerCase().trim() === c.toLowerCase().trim()));
    if (foundIdx !== -1) return foundIdx;

    // 2. Try substring match where header contains candidate or vice-versa
    foundIdx = header.findIndex(h => list.some(c => {
      const hClean = h.toLowerCase().trim();
      const cClean = c.toLowerCase().trim();
      return cClean.length > 2 && (hClean.includes(cClean) || cClean.includes(hClean));
    }));
    return foundIdx;
  };

  const idxEventName = colIndex(['Nome do Evento', 'Evento', 'Event', 'Event Name']);
  const idxEventDate = colIndex(['Data do Evento', 'Data Evento', 'Data', 'Event Date']);
  const idxEventLocation = colIndex(['Local do Evento', 'Local Evento', 'Local', 'Event Location']);
  const idxContactName = colIndex(['Nome Completo', 'Nome', 'Contato', 'Name', 'Contact Name', 'Contact']);
  const idxContactEmail = colIndex(['Email', 'E-mail', 'Mail', 'Contact Email']);
  const idxContactPhone = colIndex(['Telefone', 'Celular', 'Fone', 'Phone', 'Mobile']);
  const idxCompanyName = colIndex(['Empresa', 'Nome da Empresa', 'Nome Empresa', 'Razão Social', 'Company', 'Company Name']);
  const idxVidas = colIndex(['Quantidade de Vidas', 'Vidas', 'Colaboradores', 'Funcionários', 'Employees', 'Size']);
  const idxSegment = colIndex(['Segmento', 'Área', 'Setor', 'Sector', 'Segment', 'Area']);
  const idxDescription = colIndex(['Resumo da Empresa', 'Descrição', 'Resumo', 'Description', 'About', 'Resumo Corporativo']);
  const idxActivity = colIndex([
    'Atividade Principal',
    'Atividade',
    'Activity',
    'Core Business',
    'O que vende',
    'O que vende e para quem',
    'O que comercializa',
    'Comercializa',
    'Atividade Principal (O que vende e para quem)',
    'O que vende e para quem?'
  ]);
  const idxTicketType = colIndex(['Tipo de ingresso', 'Tipo Ingresso', 'Ingresso', 'Ticket Type']);
  const idxTicketValue = colIndex(['Valor', 'Preço', 'Ingresso', 'Ticket Value', 'Value', 'Price']);
  const idxPaymentStatus = colIndex(['Estado de pagamento', 'Status Pagamento', 'Pagamento', 'Status', 'Payment Status']);
  const idxPurchaseDate = colIndex(['Data compra', 'Data Compra', 'Data', 'Purchase Date']);

  const companiesMap: Map<string, Company> = new Map();
  const contactsMap: Map<string, Contact> = new Map();
  const transactions: Transaction[] = [];

  // Helper to generate simple IDs
  const makeId = (prefix: string, name: string) => {
    const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${prefix}_${clean}_${Math.random().toString(36).substr(2, 5)}`;
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cells = line.split('\t').map(c => c.trim());
    
    // Extract raw cell values with fallbacks
    const rawCompany = cells[idxCompanyName] || '';
    if (!rawCompany) continue; // Skip entries without an associated company

    const cleanCompany = cleanCompanyName(rawCompany);
    const rawContactName = cells[idxContactName] || '';
    const rawContactEmail = (cells[idxContactEmail] || '').toLowerCase();
    const rawContactPhone = cells[idxContactPhone] || '';

    // Segment & Descriptions
    const rawSegment = cells[idxSegment] || '';
    const rawDescription = cells[idxDescription] || '';
    const rawActivity = cells[idxActivity] || '';
    
    // Vidas parsing
    let rawVidasVal = cells[idxVidas] || '';
    // handle potential decimal commas
    rawVidasVal = rawVidasVal.replace(',', '.');
    let vidas = 0;
    if (rawVidasVal) {
      const parsedFloat = parseFloat(rawVidasVal);
      if (!isNaN(parsedFloat)) {
        // Handle cases like "2,2" which might mean thousands (e.g. 2200 employees)
        if (parsedFloat > 0 && parsedFloat < 10) {
          vidas = Math.round(parsedFloat * 1000);
        } else {
          vidas = Math.round(parsedFloat);
        }
      }
    }

    // Determine location from event location or default
    const rawEventLocation = cells[idxEventLocation] || '';
    let location = 'Fortaleza, CE';
    if (rawEventLocation.toLowerCase().includes('crateús')) {
      location = 'Crateús, CE';
    } else if (rawEventLocation.toLowerCase().includes('guaramiranga')) {
      location = 'Guaramiranga, CE';
    } else if (rawEventLocation.toLowerCase().includes('caucaia')) {
      location = 'Caucaia, CE';
    } else if (rawContactPhone.startsWith('(81)') || rawContactPhone.startsWith('81')) {
      location = 'Recife, PE';
    } else if (rawContactPhone.startsWith('(19)') || rawContactPhone.startsWith('19')) {
      location = 'Campinas, SP';
    } else if (rawContactPhone.startsWith('(11)') || rawContactPhone.startsWith('11')) {
      location = 'São Paulo, SP';
    }

    // Standardize segments
    let segment = rawSegment || 'Outros';
    if (segment.toLowerCase().includes('construç') || segment.toLowerCase().includes('concre') || segment.toLowerCase().includes('incorpor')) {
      segment = 'Construção Civil & Imobiliário';
    } else if (segment.toLowerCase().includes('imobili')) {
      segment = 'Construção Civil & Imobiliário';
    } else if (segment.toLowerCase().includes('advoc') || segment.toLowerCase().includes('jurid') || segment.toLowerCase().includes('direito')) {
      segment = 'Jurídico / Advocacia';
    } else if (segment.toLowerCase().includes('tecnol') || segment.toLowerCase().includes('software') || segment.toLowerCase().includes('saas') || segment.toLowerCase().includes('telecom')) {
      segment = 'Tecnologia & Telecom';
    } else if (segment.toLowerCase().includes('saúd') || segment.toLowerCase().includes('fitness') || segment.toLowerCase().includes('estét') || segment.toLowerCase().includes('odont')) {
      segment = 'Saúde, Estética & Bem-estar';
    } else if (segment.toLowerCase().includes('finan') || segment.toLowerCase().includes('banco') || segment.toLowerCase().includes('invest')) {
      segment = 'Finanças & Investimentos';
    } else if (segment.toLowerCase().includes('contab')) {
      segment = 'Contabilidade & Consultoria';
    } else if (segment.toLowerCase().includes('consult')) {
      segment = 'Contabilidade & Consultoria';
    } else if (segment.toLowerCase().includes('propagan') || segment.toLowerCase().includes('public') || segment.toLowerCase().includes('market') || segment.toLowerCase().includes('comunic')) {
      segment = 'Marketing, Comunicação & Mídia';
    } else if (segment.toLowerCase().includes('aliment') || segment.toLowerCase().includes('bebida') || segment.toLowerCase().includes('restauran') || segment.toLowerCase().includes('confeit') || segment.toLowerCase().includes('pizzaria')) {
      segment = 'Alimentos & Bebidas';
    } else if (segment.toLowerCase().includes('indústr')) {
      segment = 'Indústria / Manufatura';
    } else if (segment.toLowerCase().includes('comér') || segment.toLowerCase().includes('varej') || segment.toLowerCase().includes('atacad') || segment.toLowerCase().includes('loja')) {
      segment = 'Comércio & Varejo';
    } else if (segment.toLowerCase().includes('segur')) {
      segment = 'Seguros';
    } else if (segment.toLowerCase().includes('educa')) {
      segment = 'Educação';
    } else if (segment.toLowerCase().includes('transpor') || segment.toLowerCase().includes('logíst')) {
      segment = 'Logística & Transportes';
    } else if (segment.toLowerCase().includes('energ')) {
      segment = 'Energia';
    } else if (segment === '#N/D') {
      segment = 'Outros';
    }

    // 1. Get or Create Company
    const companyKey = cleanCompany.toLowerCase();
    let company = companiesMap.get(companyKey);
    const isFallbackActivity = (act: string) => !act || act === 'Venda e geração de negócios no segmento.' || act === 'Geradora de negócios e conexões.';
    
    if (!company) {
      company = {
        id: `comp_${companyKey.replace(/[^a-z0-9]/g, '_')}`,
        name: cleanCompany,
        segment: segment,
        description: rawDescription || (rawActivity ? `Atua em: ${rawActivity}` : 'Empresa participante do ecossistema Rampup.'),
        activity: rawActivity || 'Venda e geração de negócios no segmento.',
        vidas: vidas,
        location: location,
        customFields: {}
      };
      companiesMap.set(companyKey, company);
    } else {
      // Merge values if better information exists in other rows
      if (vidas > company.vidas) company.vidas = vidas;
      if (segment !== 'Outros' && company.segment === 'Outros') company.segment = segment;
      if (rawDescription.length > company.description.length) company.description = rawDescription;
      
      // Merge activity properly avoiding fallback blocks
      if (rawActivity && !isFallbackActivity(rawActivity)) {
        if (isFallbackActivity(company.activity) || rawActivity.length > company.activity.length) {
          company.activity = rawActivity;
        }
      }
      
      // If the existing name is ALL CAPS and the new clean name has mixed case, prefer the mixed case
      const isAllCaps = (str: string) => str === str.toUpperCase() && str !== str.toLowerCase();
      if (isAllCaps(company.name) && !isAllCaps(cleanCompany)) {
        company.name = cleanCompany;
      }
    }

    // 2. Get or Create Contact
    const contactKey = rawContactEmail || `${rawContactName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    let contact = contactsMap.get(contactKey);
    if (!contact && rawContactName) {
      contact = {
        id: `cont_${contactKey.replace(/[^a-z0-9]/g, '_')}`,
        name: rawContactName,
        email: rawContactEmail || `${contactKey}@temp-crm.com`,
        phone: rawContactPhone || '',
        companyId: company.id,
        customFields: {}
      };
      contactsMap.set(contactKey, contact);
    }

    // 3. Create Transaction
    const rawValue = cells[idxTicketValue] || 'R$ 0,00';
    const cleanValue = parseFloat(rawValue.replace('R$', '').replace(/\s+/g, '').replace('.', '').replace(',', '.').trim()) || 0;
    
    transactions.push({
      id: `tx_${Math.random().toString(36).substr(2, 9)}`,
      companyId: company.id,
      contactName: rawContactName,
      contactEmail: rawContactEmail,
      eventName: cells[idxEventName] || 'RampUp Event',
      eventDate: cells[idxEventDate] || '',
      eventLocation: rawEventLocation || '',
      ticketType: cells[idxTicketType] || 'Ingresso',
      value: cleanValue,
      paymentStatus: cells[idxPaymentStatus] || 'Aprovado',
      purchaseDate: cells[idxPurchaseDate] || ''
    });
  }

  return {
    companies: Array.from(companiesMap.values()),
    contacts: Array.from(contactsMap.values()),
    transactions
  };
}

import defaultDb from './db.json';

export function getDemoData(): { companies: Company[]; contacts: Contact[]; transactions: Transaction[]; customFields: any[] } {
  return {
    companies: (defaultDb.companies || []) as Company[],
    contacts: (defaultDb.contacts || []) as Contact[],
    transactions: (defaultDb.transactions || []) as Transaction[],
    customFields: ((defaultDb as any).customFields || [
      { id: 'f_site', name: 'Website', type: 'string', target: 'company' },
      { id: 'f_linkedin', name: 'LinkedIn', type: 'string', target: 'company' },
      { id: 'f_linkedin_p', name: 'LinkedIn Pessoal', type: 'string', target: 'contact' },
      { id: 'f_interesse', name: 'Principais Interesses', type: 'select', target: 'company', options: ['Vendas', 'Parcerias', 'Investimentos', 'Contratação', 'Tecnologia', 'Networking'] }
    ])
  };
}

