export interface CustomFieldConfig {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  target: 'company' | 'contact';
  options?: string[];
}

export interface Company {
  id: string;
  name: string;
  segment: string;
  description: string; // Resumo da Empresa
  activity: string;    // Atividade Principal (O que vende e para quem)
  vidas: number;       // Quantidade de Vidas
  location: string;    // Local (derived from event location or default CE/Fortaleza)
  icp?: string;        // Perfil de Cliente Ideal (ICP)
  faturamentoEst?: number;    // Faturamento est mes (R$)
  folhaEst?: number;          // folha est mes (R$)
  mediaSetorEst?: number;     // % do médio do setor (as fraction, e.g., 0.15 for 15%)
  futebol?: string;           // Time de futebol
  areaAtuacao?: string;       // Área de atuação
  politica?: string;          // Preferência política
  musica?: string;            // Tipo de música
  redesSociais?: string;      // Redes sociais
  logoUrl?: string;           // Logo da empresa (URL ou Data URL base64)
  customFields: Record<string, any>;
  comments?: string;         // Comentários sobre a empresa
  segmentComments?: string;  // Comentários sobre o segmento
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyId: string;
  futebol?: string;           // Time de futebol
  areaAtuacao?: string;       // Área de atuação
  politica?: string;          // Preferência política
  musica?: string;            // Tipo de música
  redesSociais?: string;      // Redes sociais
  photoUrl?: string;          // Foto do empresário (URL ou Data URL base64)
  customFields: Record<string, any>;
}

export interface Transaction {
  id: string;
  companyId: string;
  contactName: string;
  contactEmail: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  ticketType: string;
  value: number; // parsed float from R$ 157,00 etc
  paymentStatus: 'Aprovado' | 'Não pago' | 'Cancelado' | string;
  purchaseDate: string;
}

export interface MatchAnalysis {
  targetCompanyId: string;
  potentialBuyerIds: string[];      // Who can buy from target (target can sell to them)
  potentialSellerIds: string[];     // Who can sell to target (target can buy from them)
  potentialPartnerIds: string[];    // Mutual synergetic companies
  potentialConnectionIds: string[]; // Highly relevant general connections (same segment, nearby, etc.)
  reasons: Record<string, string>;  // Custom brief explanation for why each match exists
}
