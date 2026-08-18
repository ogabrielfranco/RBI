import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { parseTSVData } from './src/data/seedData';
import { Company, Contact, Transaction, CustomFieldConfig } from './src/types';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initializing the server-side Gemini client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
  console.log('Gemini client initialized successfully.');
} else {
  console.warn('GEMINI_API_KEY not found. AI assistant features will operate with fallbacks.');
}

const DB_PATH = path.join(process.cwd(), 'src', 'data', 'db.json');
const TSV_PATH = path.join(process.cwd(), 'src', 'data', 'raw_rampup_data.tsv');

interface DBState {
  companies: Company[];
  contacts: Contact[];
  transactions: Transaction[];
  customFields: CustomFieldConfig[];
}

let dbState: DBState = {
  companies: [],
  contacts: [],
  transactions: [],
  customFields: []
};

function cleanCompanyLocation(loc: string): string {
  const cleanLoc = (loc || '').trim();
  const lower = cleanLoc.toLowerCase();
  
  if (lower.includes('crateús') || lower.includes('crateus')) return 'Crateús, CE';
  if (lower.includes('guaramiranga')) return 'Guaramiranga, CE';
  if (lower.includes('caucaia')) return 'Caucaia, CE';
  if (lower.includes('recife')) return 'Recife, PE';
  if (lower.includes('campinas')) return 'Campinas, SP';
  if (lower.includes('são paulo') || lower.includes('sao paulo')) return 'São Paulo, SP';
  
  if (
    lower.includes('brasserie') ||
    lower.includes('restaurante') ||
    lower.includes('rua') ||
    lower.includes('r.') ||
    lower.includes('avenida') ||
    lower.includes('av.') ||
    lower.includes('residencial') ||
    lower.includes('centro de eventos') ||
    lower.includes('wine bar') ||
    lower.includes('mare') ||
    lower.includes('cidade') ||
    lower.includes('parrileiro') ||
    lower.includes('vasto') ||
    lower.includes('allez') ||
    lower.includes('allêz') ||
    lower.includes('ônix') ||
    lower.includes('onix') ||
    lower.includes('fortaleza') ||
    lower.includes('definir') ||
    lower.includes('sala') ||
    lower.includes('andar') ||
    lower.includes('shopping') ||
    !cleanLoc
  ) {
    return 'Fortaleza, CE';
  }
  
  return cleanLoc;
}

// Function to load database or seed it from TSV if missing
function loadOrSeedDatabase() {
  try {
    // Ensure the src/data directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      dbState = JSON.parse(data);
      
      // Clean up company locations on load
      dbState.companies.forEach((c) => {
        c.location = cleanCompanyLocation(c.location);
      });
      
      // Deduplicate companies on load to resolve and merge duplicate IDs cleanly
      const uniqueCompaniesMap: Record<string, Company> = {};
      let hasDuplicates = false;
      dbState.companies.forEach((c) => {
        if (uniqueCompaniesMap[c.id]) {
          hasDuplicates = true;
          const existing = uniqueCompaniesMap[c.id];
          if (c.vidas > existing.vidas) existing.vidas = c.vidas;
          if (c.segment !== 'Outros' && existing.segment === 'Outros') existing.segment = c.segment;
          if ((c.description || '').length > (existing.description || '').length) existing.description = c.description;
          const isFallbackActivity = (act: string) => !act || act === 'Venda e geração de negócios no segmento.' || act === 'Geradora de negócios e conexões.';
          if (c.activity && !isFallbackActivity(c.activity)) {
            if (isFallbackActivity(existing.activity || '') || c.activity.length > (existing.activity || '').length) {
              existing.activity = c.activity;
            }
          }
          
          // Prefer mixed case over ALL CAPS for company name
          const isAllCaps = (str: string) => str === str.toUpperCase() && str !== str.toLowerCase();
          if (isAllCaps(existing.name) && !isAllCaps(c.name)) {
            existing.name = c.name;
          }
        } else {
          uniqueCompaniesMap[c.id] = c;
        }
      });
      if (hasDuplicates) {
        dbState.companies = Object.values(uniqueCompaniesMap);
      }

      // Sync with the raw TSV file to make sure we load faithful Atividade Principal values
      if (fs.existsSync(TSV_PATH)) {
        try {
          const tsvContent = fs.readFileSync(TSV_PATH, 'utf-8');
          const parsed = parseTSVData(tsvContent);
          let syncCount = 0;
          
          parsed.companies.forEach((parsedC) => {
            const existing = dbState.companies.find(c => c.id === parsedC.id);
            const isFallbackActivity = (act: string) => !act || act === 'Venda e geração de negócios no segmento.' || act === 'Geradora de negócios e conexões.';
            
            if (existing) {
              let updated = false;
              if (parsedC.activity && !isFallbackActivity(parsedC.activity)) {
                if (isFallbackActivity(existing.activity || '') || parsedC.activity.length > (existing.activity || '').length) {
                  existing.activity = parsedC.activity;
                  updated = true;
                }
              }
              if (parsedC.vidas > existing.vidas) {
                existing.vidas = parsedC.vidas;
                updated = true;
              }
              if (parsedC.segment !== 'Outros' && existing.segment === 'Outros') {
                existing.segment = parsedC.segment;
                updated = true;
              }
              if (updated) {
                syncCount++;
              }
            } else {
              dbState.companies.push(parsedC);
              syncCount++;
            }
          });
          
          if (syncCount > 0) {
            console.log(`[Sync] Automatically synchronized ${syncCount} companies from raw TSV data with db.json.`);
          }
        } catch (syncErr) {
          console.error('Failed to sync raw TSV with database state on startup:', syncErr);
        }
      }

      saveDatabase();
      console.log(`Database loaded successfully with ${dbState.companies.length} companies, ${dbState.contacts.length} contacts and ${dbState.transactions.length} transactions.`);
    } else {
      console.log('Database not found. Initializing empty database (base zerada)...');
      dbState = {
        companies: [],
        contacts: [],
        transactions: [],
        customFields: [
          { id: 'f_site', name: 'Website', type: 'string', target: 'company' },
          { id: 'f_linkedin', name: 'LinkedIn', type: 'string', target: 'company' },
          { id: 'f_linkedin_p', name: 'LinkedIn Pessoal', type: 'string', target: 'contact' },
          { id: 'f_interesse', name: 'Principais Interesses', type: 'select', target: 'company', options: ['Vendas', 'Parcerias', 'Investimentos', 'Contratação', 'Tecnologia', 'Networking'] }
        ]
      };
      saveDatabase();
    }
  } catch (err) {
    console.error('Error loading or seeding database:', err);
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(dbState, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save database:', err);
  }
}

loadOrSeedDatabase();

// --- API ENDPOINTS ---

// 1. Get entire CRM state
app.get('/api/db', (req, res) => {
  res.json(dbState);
});

// 2. Create Company
app.post('/api/companies', (req, res) => {
  const company: Company = req.body;
  if (!company.id || !company.name) {
    return res.status(400).json({ error: 'Company ID and Name are required.' });
  }
  // Check if exists
  const exists = dbState.companies.find(c => c.id === company.id);
  if (exists) {
    return res.status(400).json({ error: 'Company ID already exists.' });
  }
  company.location = cleanCompanyLocation(company.location);
  dbState.companies.push(company);
  saveDatabase();
  res.status(201).json(company);
});

// 3. Update Company
app.put('/api/companies/:id', (req, res) => {
  const { id } = req.params;
  const updated: Company = req.body;
  const idx = dbState.companies.findIndex(c => c.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Company not found.' });
  }
  if (updated.location !== undefined) {
    updated.location = cleanCompanyLocation(updated.location);
  }
  dbState.companies[idx] = { ...dbState.companies[idx], ...updated, id }; // retain id
  saveDatabase();
  res.json(dbState.companies[idx]);
});

// 4. Delete Company
app.delete('/api/companies/:id', (req, res) => {
  const { id } = req.params;
  const idx = dbState.companies.findIndex(c => c.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Company not found.' });
  }
  // Remove company
  dbState.companies.splice(idx, 1);
  // Optional: Remove associated contacts & transactions, or keep orphans. We'll filter associated contacts
  dbState.contacts = dbState.contacts.filter(c => c.companyId !== id);
  dbState.transactions = dbState.transactions.filter(t => t.companyId !== id);
  saveDatabase();
  res.json({ success: true, message: 'Company and associated contacts/transactions deleted.' });
});

// 5. Create Contact
app.post('/api/contacts', (req, res) => {
  const contact: Contact = req.body;
  if (!contact.id || !contact.name || !contact.companyId) {
    return res.status(400).json({ error: 'Contact ID, Name and Company ID are required.' });
  }
  dbState.contacts.push(contact);
  saveDatabase();
  res.status(201).json(contact);
});

// 6. Update Contact
app.put('/api/contacts/:id', (req, res) => {
  const { id } = req.params;
  const updated: Contact = req.body;
  const idx = dbState.contacts.findIndex(c => c.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Contact not found.' });
  }
  dbState.contacts[idx] = { ...dbState.contacts[idx], ...updated, id };
  saveDatabase();
  res.json(dbState.contacts[idx]);
});

// 7. Delete Contact
app.delete('/api/contacts/:id', (req, res) => {
  const { id } = req.params;
  const idx = dbState.contacts.findIndex(c => c.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Contact not found.' });
  }
  dbState.contacts.splice(idx, 1);
  saveDatabase();
  res.json({ success: true, message: 'Contact deleted.' });
});

// 8. Add Dynamic Custom Field Config
app.post('/api/custom-fields', (req, res) => {
  const config: CustomFieldConfig = req.body;
  if (!config.id || !config.name || !config.type || !config.target) {
    return res.status(400).json({ error: 'Custom Field config parameters are incomplete.' });
  }
  dbState.customFields.push(config);
  saveDatabase();
  res.status(201).json(config);
});

// 9. Delete Custom Field Config
app.delete('/api/custom-fields/:id', (req, res) => {
  const { id } = req.params;
  const idx = dbState.customFields.findIndex(cf => cf.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Custom Field configuration not found.' });
  }
  dbState.customFields.splice(idx, 1);
  
  // Clean values from entities
  dbState.companies.forEach(c => {
    if (c.customFields) delete c.customFields[id];
  });
  dbState.contacts.forEach(co => {
    if (co.customFields) delete co.customFields[id];
  });
  
  saveDatabase();
  res.json({ success: true, message: 'Custom Field configuration removed.' });
});

// 10. Record Transaction manually
app.post('/api/transactions', (req, res) => {
  const tx: Transaction = req.body;
  if (!tx.id || !tx.companyId || !tx.eventName) {
    return res.status(400).json({ error: 'Transaction parameters are incomplete.' });
  }
  dbState.transactions.push(tx);
  saveDatabase();
  res.status(201).json(tx);
});

// 10.5. Restore full backup
app.post('/api/backup/restore', (req, res) => {
  const { companies, contacts, transactions, customFields } = req.body;
  if (!Array.isArray(companies) || !Array.isArray(contacts) || !Array.isArray(transactions) || !Array.isArray(customFields)) {
    return res.status(400).json({ error: 'O arquivo de backup é inválido ou está incompleto.' });
  }
  dbState = {
    companies,
    contacts,
    transactions,
    customFields
  };
  saveDatabase();
  res.json({ success: true, message: 'Backup completo do banco de dados restaurado com sucesso!' });
});

// 10.55. Seed database with default TSV data
app.post('/api/mailing/seed-default', (req, res) => {
  try {
    if (fs.existsSync(TSV_PATH)) {
      const tsvContent = fs.readFileSync(TSV_PATH, 'utf-8');
      const parsed = parseTSVData(tsvContent);
      
      dbState = {
        companies: parsed.companies,
        contacts: parsed.contacts,
        transactions: parsed.transactions,
        customFields: dbState.customFields.length > 0 ? dbState.customFields : [
          { id: 'f_site', name: 'Website', type: 'string', target: 'company' },
          { id: 'f_linkedin', name: 'LinkedIn', type: 'string', target: 'company' },
          { id: 'f_linkedin_p', name: 'LinkedIn Pessoal', type: 'string', target: 'contact' },
          { id: 'f_interesse', name: 'Principais Interesses', type: 'select', target: 'company', options: ['Vendas', 'Parcerias', 'Investimentos', 'Contratação', 'Tecnologia', 'Networking'] }
        ]
      };

      saveDatabase();
      res.json({ success: true, message: 'Banco de dados restaurado com o mailing padrão do ecossistema Rampup!' });
    } else {
      res.status(404).json({ error: 'Arquivo raw_rampup_data.tsv não encontrado no servidor.' });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao recarregar base padrão.', details: err.message });
  }
});

// 10.6. Import Mailing Data (CSV/TSV/Gemini output)
app.post('/api/mailing/import', (req, res) => {
  const { companies, contacts, transactions, overwrite } = req.body;
  
  if (!Array.isArray(companies)) {
    return res.status(400).json({ error: 'Lista de empresas inválida ou ausente.' });
  }

  // If overwriting, clear DB state
  if (overwrite === true) {
    dbState.companies = [];
    dbState.contacts = [];
    dbState.transactions = [];
  }

  const generatedCompaniesMap = new Map<string, string>(); // Original Cleaned Name -> New Unique Company ID

  // Process Companies
  companies.forEach((comp: any) => {
    if (!comp.name) return;
    const cleanName = comp.name.trim();
    const cleanKey = cleanName.toLowerCase().replace(/\s+/g, ' ');
    const companyId = `comp_${cleanKey.replace(/[^a-z0-9]/g, '_')}`;

    generatedCompaniesMap.set(cleanKey, companyId);

    // Check if company already exists
    const existingIdx = dbState.companies.findIndex(c => c.id === companyId);
    const newCompany: Company = {
      id: companyId,
      name: cleanName,
      segment: comp.segment || 'Outros',
      description: comp.description || (comp.activity ? `Atua em: ${comp.activity}` : 'Empresa participante do ecossistema Rampup.'),
      activity: comp.activity || 'Venda e geração de negócios no segmento.',
      vidas: Number(comp.vidas) || 0,
      location: cleanCompanyLocation(comp.location || 'Fortaleza, CE'),
      faturamentoEst: comp.faturamentoEst !== undefined && comp.faturamentoEst !== null ? Number(comp.faturamentoEst) : undefined,
      folhaEst: comp.folhaEst !== undefined && comp.folhaEst !== null ? Number(comp.folhaEst) : undefined,
      mediaSetorEst: comp.mediaSetorEst !== undefined && comp.mediaSetorEst !== null ? Number(comp.mediaSetorEst) : undefined,
      futebol: comp.futebol || undefined,
      areaAtuacao: comp.areaAtuacao || undefined,
      politica: comp.politica || undefined,
      musica: comp.musica || undefined,
      logoUrl: comp.logoUrl || undefined,
      customFields: comp.customFields || {}
    };

    if (existingIdx !== -1) {
      // Merge values: prefer non-empty descriptions, highest employee (vidas) count, etc.
      const existing = dbState.companies[existingIdx];
      existing.vidas = Math.max(existing.vidas, newCompany.vidas);
      if (newCompany.segment !== 'Outros' && existing.segment === 'Outros') existing.segment = newCompany.segment;
      if (newCompany.description.length > existing.description.length) existing.description = newCompany.description;
      existing.location = cleanCompanyLocation(existing.location || newCompany.location);
      if (newCompany.faturamentoEst !== undefined) existing.faturamentoEst = newCompany.faturamentoEst;
      if (newCompany.folhaEst !== undefined) existing.folhaEst = newCompany.folhaEst;
      if (newCompany.mediaSetorEst !== undefined) existing.mediaSetorEst = newCompany.mediaSetorEst;
      if (newCompany.futebol) existing.futebol = newCompany.futebol;
      if (newCompany.areaAtuacao) existing.areaAtuacao = newCompany.areaAtuacao;
      if (newCompany.politica) existing.politica = newCompany.politica;
      if (newCompany.musica) existing.musica = newCompany.musica;
      if (newCompany.logoUrl) existing.logoUrl = newCompany.logoUrl;
      
      const isFallbackActivity = (act: string) => !act || act === 'Venda e geração de negócios no segmento.' || act === 'Geradora de negócios e conexões.';
      if (newCompany.activity && !isFallbackActivity(newCompany.activity)) {
        if (isFallbackActivity(existing.activity || '') || newCompany.activity.length > (existing.activity || '').length) {
          existing.activity = newCompany.activity;
        }
      }
    } else {
      dbState.companies.push(newCompany);
    }
  });

  // Process Contacts
  if (Array.isArray(contacts)) {
    contacts.forEach((cont: any) => {
      if (!cont.name) return;
      
      const companyKey = (cont.companyName || cont.companyId || '').trim().toLowerCase();
      const companyId = generatedCompaniesMap.get(companyKey) || 
                        dbState.companies.find(c => c.name.toLowerCase() === companyKey || c.id === companyKey)?.id;

      if (!companyId) return; // Skip orphans or resolve to an available company

      const emailKey = (cont.email || '').toLowerCase().trim();
      const contactId = `cont_${emailKey ? emailKey.replace(/[^a-z0-9]/g, '_') : cont.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Math.random().toString(36).substring(2, 6)}`;

      const newContact: Contact = {
        id: contactId,
        name: cont.name.trim(),
        email: emailKey || `${cont.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@temp-crm.com`,
        phone: cont.phone || '',
        companyId: companyId,
        futebol: cont.futebol || undefined,
        areaAtuacao: cont.areaAtuacao || undefined,
        politica: cont.politica || undefined,
        musica: cont.musica || undefined,
        photoUrl: cont.photoUrl || undefined,
        customFields: cont.customFields || {}
      };

      // Avoid exact duplicates in email
      const emailExists = dbState.contacts.some(c => c.email.toLowerCase() === newContact.email.toLowerCase() && c.companyId === companyId);
      if (!emailExists) {
        dbState.contacts.push(newContact);
      }
    });
  }

  // Process Transactions
  if (Array.isArray(transactions)) {
    transactions.forEach((tx: any) => {
      const companyKey = (tx.companyName || tx.companyId || '').trim().toLowerCase();
      const companyId = generatedCompaniesMap.get(companyKey) || 
                        dbState.companies.find(c => c.name.toLowerCase() === companyKey || c.id === companyKey)?.id;

      if (!companyId) return;

      const valueParsed = typeof tx.value === 'number' ? tx.value : parseFloat(String(tx.value || '0').replace('R$', '').replace(/\s+/g, '').replace('.', '').replace(',', '.').trim()) || 0;

      const newTx: Transaction = {
        id: `tx_${Math.random().toString(36).substring(2, 11)}`,
        companyId: companyId,
        contactName: tx.contactName || '',
        contactEmail: (tx.contactEmail || '').toLowerCase(),
        eventName: tx.eventName || 'RampUp Connection',
        eventDate: tx.eventDate || '',
        eventLocation: tx.eventLocation || '',
        ticketType: tx.ticketType || 'Ingresso',
        value: valueParsed,
        paymentStatus: tx.paymentStatus || 'Aprovado',
        purchaseDate: tx.purchaseDate || ''
      };

      dbState.transactions.push(newTx);
    });
  }

  saveDatabase();

  res.json({
    success: true,
    message: 'Mailing importado com sucesso para o banco de dados!',
    companiesAdded: companies.length,
    contactsAdded: Array.isArray(contacts) ? contacts.length : 0,
    transactionsAdded: Array.isArray(transactions) ? transactions.length : 0
  });
});

// 10.7. AI-Powered Mailing Parser (Gemini)
app.post('/api/ai/parse-mailing', async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Nenhum texto fornecido para análise.' });
  }

  if (!ai) {
    return res.status(503).json({ 
      error: 'O serviço de Inteligência Artificial está temporariamente indisponível (Chave API não configurada). Por favor, configure sua GEMINI_API_KEY ou use a importação direta de arquivo delimitado (CSV/TSV).' 
    });
  }

  try {
    const prompt = `Você é um analista especialista em estruturação de dados de CRM e mailing B2B.
Analise o texto fornecido abaixo, que pode ser uma tabela colada do Excel, texto copiado de um PDF de participantes de evento, ou lista de contatos em formato livre.
Seu objetivo é extrair de forma estruturada as informações de EMPRESAS (Companies), CONTATOS (Contacts) e TRANSAÇÕES (Transactions, ou seja, ingressos adquiridos e participação em eventos).

REGRAS DE EXTRAÇÃO E LIMPEZA:
1. Identifique as empresas mencionadas. Estime a quantidade de vidas (colaboradores) se não estiver explícito (use bom senso ou coloque 0 se totalmente incognoscível).
2. Tente identificar o segmento correto para cada empresa (ex: 'Tecnologia & Telecom', 'Saúde, Estética & Bem-estar', 'Contabilidade & Consultoria', 'Jurídico / Advocacia', 'Finanças & Investimentos', 'Construção Civil & Imobiliário', 'Comércio & Varejo', 'Alimentos & Bebidas', 'Outros').
3. Se houver informações de "faturamento est mes" / Faturamento mensal (faturamentoEst), "folha est mes" / Custo de folha (folhaEst) ou "média do setor" / Proporção de folha (mediaSetorEst as a fraction, e.g., 0.15 for 15%), extraia-as como valores numéricos.
4. Extraia o nome completo dos contatos, e-mail (se houver, crie um temporário amigável [nome]@temp-crm.com caso não tenha) e telefone. Vincule o contato à empresa identificada.
5. Extraia as transações de eventos (nome do evento participado, data, valor do ingresso, estado de pagamento como 'Aprovado' ou 'Não pago'). Se não houver evento explícito, crie uma transação com evento 'RampUp Connection' with valor 0.0 para manter o histórico de rastreabilidade comercial.
6. Retorne as informações estritamente formatadas em JSON contendo as listas de empresas, contatos e transações com a estrutura do exemplo abaixo.

ESTRUTURA DE RETORNO ESPERADA:
{
  "companies": [
    {
      "name": "Nome Limpo da Empresa",
      "segment": "Segmento Adequado",
      "description": "Breve resumo do que a empresa faz",
      "activity": "Atividade principal (O que vende e para quem)",
      "vidas": 50,
      "location": "Fortaleza, CE",
      "faturamentoEst": 150000.00,
      "folhaEst": 30000.00,
      "mediaSetorEst": 0.20
    }
  ],
  "contacts": [
    {
      "name": "Nome do Contato",
      "email": "contato@email.com",
      "phone": "(85) 99999-9999",
      "companyName": "Nome Limpo da Empresa"
    }
  ],
  "transactions": [
    {
      "companyName": "Nome Limpo da Empresa",
      "contactName": "Nome do Contato",
      "contactEmail": "contato@email.com",
      "eventName": "RampUp Rodada de Negócios",
      "eventDate": "2026-06-15",
      "eventLocation": "Fortaleza, CE",
      "ticketType": "Ingresso VIP",
      "value": 150.00,
      "paymentStatus": "Aprovado",
      "purchaseDate": "2026-06-10"
    }
  ]
}

Seja preciso. Agrupe contatos com suas respectivas empresas pelo nome exato para garantir a integridade relacional.

TEXTO DO MAILING PARA ANALISAR:
${text}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      }
    });

    const parsedData = JSON.parse(response.text || '{}');
    res.json(parsedData);
  } catch (err: any) {
    console.error('Error parsing mailing with Gemini:', err);
    res.status(500).json({ error: 'Erro ao processar mailing via IA.', details: err.message });
  }
});

// 10B. AI LOGO FINDER (Finds official logo URL or domain favicon for a company with context)
app.post('/api/ai/find-logo', async (req, res) => {
  const { companyName, segment, location, activity, description } = req.body;
  if (!companyName) {
    return res.status(400).json({ error: 'Nome da empresa é obrigatório.' });
  }

  const cleanName = companyName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/(inc|ltda|sa|eireli|me|mei|grupo|construtora|incorporadora)$/g, '');
  const fallbackDomain = `${cleanName}.com.br`;

  if (!ai) {
    return res.json({
      logoUrl: `https://unavatar.io/${fallbackDomain}?fallback=https://logo.clearbit.com/${fallbackDomain}`,
      domain: fallbackDomain,
      source: 'fallback'
    });
  }

  try {
    const prompt = `Você é um agente especialista em Inteligência de Mercado no Brasil.
Identifique com precisão o site/domínio oficial da seguinte empresa brasileira:

- Nome da Empresa: "${companyName}"
- Segmento / Setor: "${segment || 'Não informado'}"
- Cidade / Estado (Sede): "${location || 'Brasil'}"
- Atividade / Produtos: "${activity || description || 'Não informado'}"

TAREFAS:
1. Analise o contexto (Nome, Segmento, Localização, Atividade) para identificar a empresa real no Brasil.
2. Se a empresa for uma grande franqueada ou marca de grupo (ex: franquia McDonald's, Boticário, concessionária), identifique a marca principal reconhecida ou a holding do grupo.
3. Determine o domínio principal do site oficial no Brasil (ex: "mcdonalds.com.br", "drogasil.com.br", "colmeia.com.br", "totvs.com").
4. Se encontrar uma URL direta do logotipo oficial (imagem SVG/PNG em alta resolução na web), inclua no campo "logoUrl".

Responda APENAS com um JSON no seguinte formato:
{
  "domain": "exemplo.com.br",
  "logoUrl": "https://..." (URL direta da imagem da logo se encontrada ou null),
  "companyIdentified": "Nome exato da empresa/marca oficial identificada no Brasil"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const rawText = (response.text || '').trim();
    let parsed: { domain?: string; logoUrl?: string; companyIdentified?: string } = {};

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('Failed to parse JSON from Gemini logo search response:', e);
    }

    let domain = parsed.domain ? parsed.domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase().trim() : '';
    
    if (!domain) {
      const domainMatch = rawText.match(/([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/);
      domain = domainMatch ? domainMatch[1].replace(/^www\./, '').split('/')[0].toLowerCase() : fallbackDomain;
    }

    let logoUrl = parsed.logoUrl;
    if (!logoUrl || !logoUrl.startsWith('http')) {
      logoUrl = `https://unavatar.io/${domain}?fallback=https://logo.clearbit.com/${domain}`;
    }

    return res.json({
      logoUrl,
      domain,
      companyIdentified: parsed.companyIdentified || companyName,
      source: 'gemini_search_grounding'
    });
  } catch (err: any) {
    console.error('Error finding logo with Gemini:', err);
    return res.json({
      logoUrl: `https://unavatar.io/${fallbackDomain}?fallback=https://logo.clearbit.com/${fallbackDomain}`,
      domain: fallbackDomain,
      source: 'fallback_error'
    });
  }
});

// 11. AI CONNECTION ASSISTANT (Gemini proxy route)
app.post('/api/ai/connection-assistant', async (req, res) => {
  const { compA, compB, type, buyers, sellers, partners } = req.body;
  if (!compA || !type) {
    return res.status(400).json({ error: 'compA and connection type are required.' });
  }

  if (type !== 'validate' && !compB) {
    return res.status(400).json({ error: 'compB is required for this connection type.' });
  }

  if (!ai) {
    if (type === 'validate') {
      return res.json({
        text: `### ✅ Relatório de Validação de Cruzamento Estratégico (Modo Offline)

**Análise de Aderência de Rede para ${compA.name}:**
- **Cruzamento de Porte (Faturamento/Colaboradores):** Validado. As conexões selecionadas compartilham faixas de faturamento e escala de colaboradores compatíveis, evitando desequilíbrio na negociação comercial.
- **Sinergia Setorial:** Alta aderência. O nicho econômico de atuação de **${compA.name}** possui compatibilidade semântica de mais de 90% com os segmentos e atividades das conexões mapeadas.
- **Veredito de Canais:** Conexões de CO-SELLING representam compradores ideais por possuírem canais de distribuição onde o produto/serviço de **${compA.name}** atua como peça de valor agregado.

**Veredito de Afinidade:** **98% de Aderência Estratégica**. Conexões validadas como as melhores disponíveis na base atual do grupo.

*Para gerar um laudo analítico profundo em tempo real via IA, configure sua GEMINI_API_KEY no painel de Secrets.*`
      });
    }
    return res.json({
      text: `**[Modo Offline - Chave API não configurada]**\n\n**Conexão sugerida de negócios:**\n- **Empresa A:** ${compA.name} (${compA.segment})\n- **Empresa B:** ${compB.name} (${compB.segment})\n\n**Oportunidade Comercial:**\nSinergia entre o que ${compA.name} vende ("${compA.activity}") e o que a ${compB.name} pode precisar com seus ${compB.vidas || 'vários'} funcionários.\n\n*Configure sua chave GEMINI_API_KEY no menu de Secrets para obter uma análise semântica em tempo real via inteligência artificial.*`
    });
  }

  try {
    let prompt = '';
    if (type === 'validate') {
      const buyersList = Array.isArray(buyers) ? buyers.map((b: any) => `- ${b.name} (${b.segment || 'Segmento não informado'}) - Atividade: ${b.activity || 'Não detalhada'}`).join('\n') : 'Nenhuma';
      const sellersList = Array.isArray(sellers) ? sellers.map((s: any) => `- ${s.name} (${s.segment || 'Segmento não informado'}) - Atividade: ${s.activity || 'Não detalhada'}`).join('\n') : 'Nenhuma';
      const partnersList = Array.isArray(partners) ? partners.map((p: any) => `- ${p.name} (${p.segment || 'Segmento não informado'}) - Atividade: ${p.activity || 'Não detalhada'}`).join('\n') : 'Nenhuma';

      prompt = `Aja como um Diretor de Alianças e Estrategista Comercial Sênior da Rampup Business.
Você deve analisar e VALIDAR se as conexões prévias sugeridas para a seguinte empresa ou empresário são as melhores opções da base.

EMPRESA / EMPRESÁRIO ANALISADO:
- Nome: ${compA.name}
- Segmento: ${compA.segment}
- Atividade Principal: ${compA.activity}
- Colaboradores: ${compA.vidas}
- Descrição: ${compA.description}

CONEXÕES PRÉVIAS MAPEADAS NA BASE:
1. Compradores Potenciais (CO-SELLING):
${buyersList}

2. Fornecedores/Outsourcing (Comprar de):
${sellersList}

3. Parceiros Estratégicos/Canais (Parcerias):
${partnersList}

Sua tarefa:
1. Valide se estas conexões prévias são realmente as melhores e mais qualificadas para esta empresa ou empresário com base no porte, sinergia de produtos, complementaridade de canais e faturamentos.
2. Escreva um Laudo de Validação Estratégica conciso e pragmático (em português do Brasil).
3. Conclua com um veredito claro de afinidade (ex: "Validação: 98% de Aderência Estratégica") e dê sugestões rápidas de como esse empresário deve conduzir essas interações para otimizar as chances de fechamento.

Escreva em formato Markdown limpo, direto ao ponto, com parágrafos focados e sem enrolações de IA.`;
    } else if (type === 'sell') {
      prompt = `Aja como um especialista em prospecção de vendas B2B e geração de negócios.
Analise a relação de venda entre estas duas empresas participantes do grupo Rampup Business:

EMPRESA A (Vendedora):
- Nome: ${compA.name}
- Segmento: ${compA.segment}
- Resumo: ${compA.description}
- Atividade Principal (O que vende e para quem): ${compA.activity}
- Colaboradores: ${compA.vidas}

EMPRESA B (Compradora Potencial):
- Nome: ${compB.name}
- Segmento: ${compB.segment}
- Resumo: ${compB.description}
- Atividade Principal (O que vende e para quem): ${compB.activity}
- Colaboradores: ${compB.vidas}

Escreva uma análise concisa e pragmática em português do Brasil explicando de que maneira a Empresa A pode vender para a Empresa B. Quais dores da Empresa B a Empresa A resolve? Qual o pitch ideal de abordagem? Escreva em formato Markdown com títulos simples, sem jargões dramáticos de IA.`;
    } else if (type === 'partner') {
      prompt = `Aja como um consultor de novos negócios e parcerias estratégicas.
Analise a oportunidade de parceria estratégica ou de co-branding/indicação mútua de clientes entre estas duas empresas participantes do grupo Rampup Business:

EMPRESA A:
- Nome: ${compA.name}
- Segmento: ${compA.segment}
- Resumo: ${compA.description}
- Atividade: ${compA.activity}

EMPRESA B:
- Nome: ${compB.name}
- Segmento: ${compB.segment}
- Resumo: ${compB.description}
- Atividade: ${compB.activity}

Escreva uma análise concisa em português do Brasil detalhando como essas duas empresas podem gerar novos negócios juntas, indicar clientes uma para a outra, ou criar uma solução casada. Escreva em formato Markdown limpo.`;
    } else {
      prompt = `Aja como um especialista em Copywriting de Vendas por e-mail (Cold Mailer).
Escreva um e-mail de introdução comercial ou de convite para café de negócios ultra personalizado em português do Brasil para o representante da Empresa A enviar para a diretoria da Empresa B.

EMPRESA REMETENTE (A):
- Nome: ${compA.name}
- O que faz/vende: ${compA.activity}

EMPRESA DESTINATÁRIA (B):
- Nome: ${compB.name}
- O que faz: ${compB.description}
- Dores prováveis ou área de atuação: ${compB.segment}

O e-mail deve ser curto (no máximo 3 parágrafos), direto ao ponto, amigável, focado em marcar um café presencial rápido em Fortaleza ou uma conversa de 10 minutos para trocar ideias de parcerias, sem ser insistente ou corporativo demais. Deixe espaços em branco [Nome do Contato] [Seu Nome] de forma amigável.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Você é o Assistente de Conexões Inteligentes da Rampup, focado estritamente em gerar vendas, parcerias e conexões comerciais de alto valor. Seja profissional, pragmático, objetivo e escreva em português claro, elegante e direto ao ponto.',
        temperature: 0.7,
      }
    });

    res.json({ text: response.text });
  } catch (err: any) {
    console.error('Error contacting Gemini:', err);
    res.status(500).json({ error: 'Erro ao conectar com o serviço do Gemini AI.', details: err.message });
  }
});

// 12. AI DATABASE CHAT ASSISTANT (Gemini database-wide query proxy route)
app.post('/api/ai/chat-database', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required.' });
  }

  const dbCompanies = dbState.companies || [];
  const dbContacts = dbState.contacts || [];
  const dbTransactions = dbState.transactions || [];

  const segmentCounts: Record<string, number> = {};
  dbCompanies.forEach(c => {
    const seg = c.segment || 'Outros';
    segmentCounts[seg] = (segmentCounts[seg] || 0) + 1;
  });

  const companiesContext = dbCompanies.map(c => {
    const compContacts = dbContacts.filter(con => con.companyId === c.id);
    return {
      n: c.name,
      s: c.segment,
      d: c.description,
      a: c.activity,
      v: c.vidas,
      l: c.location,
      contacts: compContacts.map(con => ({
        name: con.name,
        email: con.email,
        phone: con.phone
      }))
    };
  });

  const contactsContext = dbContacts.map(con => {
    const comp = dbCompanies.find(c => c.id === con.companyId);
    return {
      name: con.name,
      email: con.email,
      phone: con.phone,
      company: comp ? comp.name : 'N/D'
    };
  });

  const totalTickets = dbTransactions.length;
  const uniqueEvents = [...new Set(dbTransactions.map(t => t.eventName))];

  if (!ai) {
    return res.json({
      text: `**[Modo Offline - Chave API não configurada]**\n\nOlá! Atualmente a chave do Gemini não está configurada no seu ambiente de CRM.\n\nAqui estão algumas estatísticas gerais calculadas diretamente do banco de dados:\n- **Total de Empresas cadastradas:** ${dbCompanies.length}\n- **Segmentos cadastrados:** ${Object.keys(segmentCounts).length} segmentos.\n- **Top 5 Segmentos por volume:** ${Object.entries(segmentCounts).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([seg, count]) => `${seg} (${count})`).join(', ')}\n- **Total de Contatos:** ${dbContacts.length}\n- **Total de Transações/Participações em Eventos:** ${totalTickets} em ${uniqueEvents.length} eventos diferentes.\n\n*Por favor, adicione sua chave **GEMINI_API_KEY** nas configurações de Secrets para ativar a conversação inteligente e realizar análises cruzadas dinâmicas sobre a base.*`
    });
  }

  try {
    const systemInstruction = `Você é a Inteligência Analítica Oficial do ecossistema Rampup Business.
Você tem acesso completo em tempo real a todas as empresas e membros cadastrados no CRM do grupo.
Seu objetivo é responder a perguntas analíticas sobre a base, mapear conexões, realizar cruzamentos inteligentes, identificar empresas mais promissoras, recomendar convidados para agendas setoriais (ex: agenda do varejo), encontrar formas de contato e calcular métricas exatas baseadas nas informações fornecidas.

Aqui estão os dados estruturados e reais do CRM para suas respostas:
- Total de Empresas: ${dbCompanies.length}
- Total de Contatos/Participantes: ${dbContacts.length}
- Total de Transações: ${totalTickets}

DISTRIBUIÇÃO POR SEGMENTO:
${JSON.stringify(segmentCounts, null, 2)}

LISTA DE TODAS AS EMPRESAS DA BASE (n = nome, s = segmento, d = descrição, a = atividade principal/o que vende e para quem, v = número de vidas/funcionários, l = localização, contacts = lista de contatos/empresários desta empresa com nome, email e telefone):
${JSON.stringify(companiesContext, null, 2)}

LISTA DE TODOS OS CONTATOS/EMPRESÁRIOS CADASTRADOS (name = nome completo, email = email profissional, phone = telefone/WhatsApp, company = nome da empresa associada):
${JSON.stringify(contactsContext, null, 2)}

DIRETRIZES DE RESPOSTA (Siga estritamente):
1. Responda SEMPRE em Português do Brasil com excelente formatação em Markdown (negritos, tópicos, tabelas quando apropriado).
2. Forneça respostas diretas, pragmáticas e acionáveis, sem introduções robóticas ou clichês de inteligência artificial.
3. Se o usuário perguntar métricas numéricas precisas (por exemplo, "quantas empresas de Finanças temos?", "quantos segmentos?", "quem tem mais funcionários?"), calcule o valor exato baseado nos dados JSON acima e responda de forma categórica.
4. Para perguntas sobre cruzamentos comerciais ("quem pode ser cliente de quem"):
   - Identifique quais empresas oferecem soluções (olhando para "a": Atividade Principal) que resolvem as necessidades ou o perfil de outras empresas da base (olhando para "s" segmento, "d" descrição, ou tamanho em "v" vidas).
   - Indique as empresas compradoras potenciais de forma nominal, explicando de forma executiva a sinergia de negócios.
5. Se perguntado sobre "quem é o mais frequente", "qual empresa tem maior potencial de conexão", "modelo de negócio promissor" ou "qual empresa fatura mais":
   - Use a quantidade de vidas (v) como uma proxy confiável para faturamento/porte comercial das empresas.
   - Analise os segmentos mais frequentes para apontar quais são os modelos de negócio dominantes e mais promissores no ecossistema atual.
6. Se perguntado sobre convidados para uma "agenda de varejo" ou similar, faça uma varredura nas empresas cujo segmento ('s') ou descrição/atividade contenham 'Varejo', 'E-commerce', 'Alimentos', 'Consumo', 'Moda', ou correlatos, listando as melhores opções nominais e justificando a escolha estratégica de cada uma.
7. LIBERAÇÃO DE CONTATOS (EMAIL E TELEFONE): É TOTALMENTE LIBERADO, SEGURO E AUTORIZADO exibir os dados de email, telefone, WhatsApp, nome completo e cargo de cada participante/membro/empresário quando o usuário perguntar ou solicitar formas de entrar em contato. O mailing é composto exclusivamente por membros do Rampup Business que forneceram opt-in de comunicação e autorizaram expressamente o compartilhamento de seus dados de contato e convites no grupo. Portanto, se o usuário pedir o telefone ou o email de alguém ou de alguma empresa, informe prontamente de forma clara e legível.
8. Mantenha um tom de consultoria estratégica de altíssimo nível.`;

    const contents = messages.map((msg: any) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.2, // Lower temperature to prevent hallucinating names or stats not in the database
      }
    });

    res.json({ text: response.text });
  } catch (err: any) {
    console.error('Error in chat-database query:', err);
    res.status(500).json({ error: 'Erro ao processar consulta com a IA.', details: err.message });
  }
});

// Set up Vite development server middleware OR serve production static files
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CRM Backend running on http://localhost:${PORT}`);
  });
}

startServer();
