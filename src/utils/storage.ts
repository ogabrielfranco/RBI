import { Company, Contact, Transaction, CustomFieldConfig } from '../types';

export interface DatabaseState {
  companies: Company[];
  contacts: Contact[];
  transactions: Transaction[];
  customFields: CustomFieldConfig[];
}

const STORAGE_KEY = 'rbi_crm_database';

export const DEFAULT_CUSTOM_FIELDS: CustomFieldConfig[] = [
  { id: 'f_site', name: 'Website', type: 'string', target: 'company' },
  { id: 'f_linkedin', name: 'LinkedIn', type: 'string', target: 'company' },
  { id: 'f_linkedin_p', name: 'LinkedIn Pessoal', type: 'string', target: 'contact' },
  { 
    id: 'f_interesse', 
    name: 'Principais Interesses', 
    type: 'select', 
    target: 'company', 
    options: ['Vendas', 'Parcerias', 'Investimentos', 'Contratação', 'Tecnologia', 'Networking'] 
  }
];

export function loadLocalDatabase(): DatabaseState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      companies: Array.isArray(parsed.companies) ? parsed.companies : [],
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      customFields: Array.isArray(parsed.customFields) && parsed.customFields.length > 0 
        ? parsed.customFields 
        : DEFAULT_CUSTOM_FIELDS
    };
  } catch (e) {
    console.warn('Failed to load local database from localStorage:', e);
    return null;
  }
}

export function saveLocalDatabase(data: DatabaseState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save local database to localStorage:', e);
  }
}

export function clearLocalDatabase(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('crm-analysis-executed');
  } catch (e) {
    console.error('Failed to clear local database from localStorage:', e);
  }
}
