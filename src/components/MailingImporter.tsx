import React, { useState } from 'react';
import { Company, Contact, Transaction } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  Upload, FileText, Clipboard, Sparkles, Database, RefreshCw, 
  CheckCircle2, Trash2, AlertTriangle, ChevronRight, Eye, BookOpen, 
  HelpCircle, Check, Loader2, ArrowRight, Download, RefreshCw as ResetIcon
} from 'lucide-react';

interface MailingImporterProps {
  onImportComplete: () => void;
  onLoadDemoData: () => Promise<void>;
  existingCompaniesCount: number;
}

export default function MailingImporter({ 
  onImportComplete, 
  onLoadDemoData,
  existingCompaniesCount 
}: MailingImporterProps) {
  // Mode selection: 'file' | 'paste' | 'demo'
  const [importMode, setImportMode] = useState<'file' | 'paste' | 'demo'>('file');
  
  // File upload state
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  
  // Paste state
  const [pastedText, setPastedText] = useState('');
  
  // Extraction & Parsing state
  const [isParsing, setIsParsing] = useState(false);
  const [parsingProgress, setParsingProgress] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Parsed structured output preview
  const [parsedCompanies, setParsedCompanies] = useState<any[]>([]);
  const [parsedContacts, setParsedContacts] = useState<any[]>([]);
  const [parsedTransactions, setParsedTransactions] = useState<any[]>([]);
  const [previewTab, setPreviewTab] = useState<'companies' | 'contacts' | 'transactions'>('companies');
  
  // Import strategy: merge vs overwrite
  const [overwriteStrategy, setOverwriteStrategy] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setErrorMsg('');

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const parseNumber = (val: any): number | undefined => {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'number') return val;
    
    let str = String(val).trim();
    // Remove currency and spaces
    str = str.replace(/R\$\s*/i, '').replace(/\s+/g, '');
    
    // If it contains percentage symbol, strip it but keep track
    let isPercent = false;
    if (str.includes('%')) {
      isPercent = true;
      str = str.replace('%', '');
    }

    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
      str = str.replace(/,/g, '');
    } else {
      if (lastComma !== -1) {
        str = str.replace(',', '.');
      }
    }

    const num = parseFloat(str);
    if (isNaN(num)) return undefined;
    
    if (isPercent) {
      return num / 100;
    }
    return num;
  };

  const handleExcelImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        setIsParsing(true);
        setErrorMsg('');
        setParsingProgress('Carregando planilha Excel...');
        
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (workbook.SheetNames.length === 0) {
          throw new Error('A planilha está vazia.');
        }
        
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert sheet to json rows (array of objects with header keys)
        const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });
        
        if (rows.length === 0) {
          throw new Error('Nenhuma linha de dados encontrada na planilha.');
        }
        
        setParsingProgress('Mapeando colunas e interpretando dados...');
        
        // Let's get all headers present in the first row
        const headers = Object.keys(rows[0]);
        
        const findKey = (candidates: string[]) => {
          // 1. Try exact match (case-insensitive)
          let found = headers.find(h => candidates.some(c => h.toLowerCase().trim() === c.toLowerCase().trim()));
          if (found) return found;

          // 2. Try substring match where header contains candidate or vice-versa
          found = headers.find(h => candidates.some(c => {
            const hClean = h.toLowerCase().trim();
            const cClean = c.toLowerCase().trim();
            return cClean.length > 2 && (hClean.includes(cClean) || cClean.includes(hClean));
          }));
          return found;
        };
        
        // Find keys by candidates
        const keyCompanyName = findKey(['Empresa', 'Nome da Empresa', 'Nome Empresa', 'Razão Social', 'Company', 'Company Name']);
        const keySegment = findKey(['Segmento', 'Área', 'Setor', 'Sector', 'Segment', 'Area']);
        const keyContactName = findKey(['Nome Completo', 'Nome', 'Contato', 'Name', 'Contact Name', 'Contact']);
        const keyContactEmail = findKey(['Email', 'E-mail', 'Mail', 'Contact Email']);
        const keyContactPhone = findKey(['Telefone', 'Celular', 'Fone', 'Phone', 'Mobile']);
        const keyVidas = findKey(['Quantidade de Vidas', 'Vidas', 'Colaboradores', 'Funcionários', 'Employees', 'Size']);
        const keyDescription = findKey(['Resumo da Empresa', 'Descrição', 'Resumo', 'Description', 'About', 'Resumo Corporativo']);
        const keyActivity = findKey([
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
        const keyLocation = findKey(['Local', 'Cidade', 'UF', 'Cidade/UF', 'Location', 'City']);
        const keyFaturamentoEst = findKey([
          'Faturamento est mes',
          'Faturamento',
          'Faturamento Estimado',
          'Faturamento Estimado Mensal',
          'Faturamento Estimado Médio Mensal (R$)',
          'Faturamento Estimado Médio Mensal',
          'Revenue',
          'Estimated Revenue'
        ]);
        const keyFolhaEst = findKey([
          'folha est mes',
          'folha',
          'Custo de Folha',
          'Custo de Folha Mensal',
          'Custo de Folha Mensal (R$)',
          'Payroll',
          'Estimated Payroll'
        ]);
        const keyMediaSetorEst = findKey([
          'média do setor',
          'media do setor',
          'proporcao de folha',
          'proporção de folha',
          'Proporção Média de Folha',
          'Proporção Média de Folha (%)',
          'Setor %',
          'Média do Setor (%)',
          'Média de Folha (%)',
          'Média de Folha',
          '% do médio do setor'
        ]);

        const keyFutebol = findKey([
          'Time de futebol',
          'Time',
          'Futebol',
          'Soccer',
          'Football Team',
          'Clube',
          'Time Favorito'
        ]);
        const keyAreaAtuacao = findKey([
          'Área de Atuação',
          'Area de Atuacao',
          'Área de atuação',
          'Area de atuacao',
          'Área',
          'Area',
          'Atuação',
          'Atuacao',
          'Campo'
        ]);
        const keyPolitica = findKey([
          'Preferência Política',
          'Preferencia Politica',
          'Política',
          'Politica',
          'Posicionamento Político',
          'Preferencia Voto'
        ]);
        const keyMusica = findKey([
          'Tipo de Música',
          'Tipo de Musica',
          'Música',
          'Musica',
          'Estilo Musical',
          'Gênero Musical',
          'Preferência Musical'
        ]);
        const keyLogo = findKey([
          'Logo',
          'Logomarca',
          'Logo URL',
          'Link da Logo',
          'Company Logo',
          'Logo Empresa',
          'Imagem Logo'
        ]);
        const keyPhoto = findKey([
          'Foto',
          'Foto Empresário',
          'Foto Empresario',
          'Foto do Empresário',
          'Foto do Empresario',
          'Foto do Sócio',
          'Foto URL',
          'Link Foto',
          'Avatar',
          'Photo',
          'Photo URL'
        ]);
        
        const keyEventName = findKey(['Nome do Evento', 'Evento', 'Event', 'Event Name']);
        const keyTicketValue = findKey(['Valor', 'Preço', 'Ingresso', 'Ticket Value', 'Value', 'Price']);
        const keyPaymentStatus = findKey(['Estado de pagamento', 'Status Pagamento', 'Pagamento', 'Status', 'Payment Status']);
        
        if (!keyCompanyName) {
          throw new Error('Não foi possível identificar uma coluna de "Empresa" ou "Nome da Empresa" na planilha Excel. Verifique o cabeçalho.');
        }
        
        const tempCompanies: any[] = [];
        const tempContacts: any[] = [];
        const tempTransactions: any[] = [];
        const addedCompanies = new Set<string>();
        
        rows.forEach((row: any) => {
          const companyName = String(row[keyCompanyName] || '').trim();
          if (!companyName) return;
          
          const compKey = companyName.toLowerCase();
          
          let vidas = 0;
          if (keyVidas && row[keyVidas]) {
            vidas = parseInt(String(row[keyVidas]).replace(/\D/g, '')) || 0;
          }

          let faturamentoEst = keyFaturamentoEst ? parseNumber(row[keyFaturamentoEst]) : undefined;
          let folhaEst = keyFolhaEst ? parseNumber(row[keyFolhaEst]) : undefined;
          let mediaSetorEst = keyMediaSetorEst ? parseNumber(row[keyMediaSetorEst]) : undefined;
          if (mediaSetorEst !== undefined && mediaSetorEst > 1) {
            mediaSetorEst = mediaSetorEst / 100;
          }

          const futebol = keyFutebol && row[keyFutebol] ? String(row[keyFutebol]).trim() : undefined;
          const areaAtuacao = keyAreaAtuacao && row[keyAreaAtuacao] ? String(row[keyAreaAtuacao]).trim() : undefined;
          const politica = keyPolitica && row[keyPolitica] ? String(row[keyPolitica]).trim() : undefined;
          const musica = keyMusica && row[keyMusica] ? String(row[keyMusica]).trim() : undefined;
          const logoUrl = keyLogo && row[keyLogo] ? String(row[keyLogo]).trim() : undefined;
          const photoUrl = keyPhoto && row[keyPhoto] ? String(row[keyPhoto]).trim() : undefined;
          
          if (!addedCompanies.has(compKey)) {
            addedCompanies.add(compKey);
            tempCompanies.push({
              name: companyName,
              segment: keySegment ? String(row[keySegment]).trim() || 'Outros' : 'Outros',
              description: keyDescription ? String(row[keyDescription]).trim() : '',
              activity: keyActivity ? String(row[keyActivity]).trim() : '',
              vidas: vidas,
              location: keyLocation ? String(row[keyLocation]).trim() || 'Fortaleza, CE' : 'Fortaleza, CE',
              faturamentoEst,
              folhaEst,
              mediaSetorEst,
              futebol,
              areaAtuacao,
              politica,
              musica,
              logoUrl
            });
          }
          
          const contactName = keyContactName ? String(row[keyContactName]).trim() : '';
          if (contactName) {
            tempContacts.push({
              name: contactName,
              email: keyContactEmail ? String(row[keyContactEmail]).trim() : '',
              phone: keyContactPhone ? String(row[keyContactPhone]).trim() : '',
              companyName: companyName,
              futebol,
              areaAtuacao,
              politica,
              musica,
              photoUrl
            });
          }
          
          const eventName = keyEventName ? String(row[keyEventName]).trim() : '';
          if (eventName) {
            let value = 0;
            if (keyTicketValue && row[keyTicketValue]) {
              value = parseFloat(String(row[keyTicketValue]).replace('R$', '').replace(/\s+/g, '').replace('.', '').replace(',', '.').trim()) || 0;
            }
            tempTransactions.push({
              companyName: companyName,
              contactName: contactName || 'Participante',
              contactEmail: keyContactEmail ? String(row[keyContactEmail]).trim() : '',
              eventName: eventName,
              value: value,
              paymentStatus: keyPaymentStatus ? String(row[keyPaymentStatus]).trim() || 'Aprovado' : 'Aprovado'
            });
          }
        });
        
        setParsedCompanies(tempCompanies);
        setParsedContacts(tempContacts);
        setParsedTransactions(tempTransactions);
        setParsingProgress(`Planilha Excel processada! Encontradas ${tempCompanies.length} empresas, ${tempContacts.length} contatos e ${tempTransactions.length} transações.`);
        
      } catch (err: any) {
        setErrorMsg('Erro ao ler planilha Excel: ' + err.message);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    setErrorMsg('');
    setParsingProgress('');

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      handleExcelImport(file);
      return;
    }

    const reader = new FileReader();

    if (file.name.endsWith('.json')) {
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          if (json.companies) {
            setParsedCompanies(json.companies || []);
            setParsedContacts(json.contacts || []);
            setParsedTransactions(json.transactions || []);
            setParsingProgress('Arquivo JSON lido com sucesso.');
          } else if (Array.isArray(json)) {
            // Assume array of companies
            setParsedCompanies(json);
            setParsedContacts([]);
            setParsedTransactions([]);
            setParsingProgress('Lista de empresas em JSON lida com sucesso.');
          } else {
            throw new Error('Formato JSON não reconhecido.');
          }
        } catch (err: any) {
          setErrorMsg('Erro ao ler JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.name.endsWith('.txt')) {
      reader.onload = (e) => {
        setFileContent(e.target?.result as string);
        setParsingProgress('Arquivo de texto lido. Pronto para processamento.');
      };
      reader.readAsText(file);
    } else {
      setErrorMsg('Formato de arquivo não suportado diretamente. Carregue um arquivo Excel (.xlsx/.xls), CSV, TSV, JSON ou copie e cole o conteúdo na aba "Copiar e Colar Inteligente".');
    }
  };

  // Helper to dynamically download the Excel template
  const downloadExcelTemplate = () => {
    const sampleData = [
      {
        'Empresa': 'Exemplo Tecnologia LTDA',
        'Segmento': 'Tecnologia & Telecom',
        'Resumo da Empresa': 'Desenvolvimento de software e IA para logística.',
        'Atividade Principal': 'Venda de licenças SaaS B2B.',
        'Vidas': 45,
        'Local': 'Fortaleza, CE',
        'Nome Completo': 'Carlos Andrade',
        'Email': 'carlos.andrade@exemplotech.com.br',
        'Telefone': '(85) 98888-1122',
        'Nome do Evento': 'Rampup Conexões Executivas',
        'Valor': 150.00,
        'Estado de pagamento': 'Aprovado'
      },
      {
        'Empresa': 'Mestre Alimentos S/A',
        'Segmento': 'Alimentos & Bebidas',
        'Resumo da Empresa': 'Distribuidora de alimentos e bebidas para o Nordeste.',
        'Atividade Principal': 'Distribuição de insumos industriais.',
        'Vidas': 120,
        'Local': 'Eusébio, CE',
        'Nome Completo': 'Ana Cláudia Fontenele',
        'Email': 'ana.fontenele@mestrelimentos.com.br',
        'Telefone': '(85) 99911-2233',
        'Nome do Evento': 'Rampup Conexões Executivas',
        'Valor': 150.00,
        'Estado de pagamento': 'Aprovado'
      },
      {
        'Empresa': 'Vanguarda Advocacia',
        'Segmento': 'Jurídico / Advocacia',
        'Resumo da Empresa': 'Escritório de advocacia empresarial de Fortaleza.',
        'Atividade Principal': 'Assessoria jurídica tributária e societária.',
        'Vidas': 15,
        'Local': 'Fortaleza, CE',
        'Nome Completo': 'Dr. Marcos Mendes',
        'Email': 'marcos@vanguarda.adv.br',
        'Telefone': '(85) 3224-5566',
        'Nome do Evento': 'Rampup Conexões Executivas',
        'Valor': 0.00,
        'Estado de pagamento': 'Não pago'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mailing Modelo');
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const url = window.URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_mailing_rbi_crm.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fast Delimiter Parser (for standard CSV/TSV uploads)
  const parseDelimiterFile = () => {
    if (!fileContent) {
      setErrorMsg('Nenhum conteúdo de arquivo carregado.');
      return;
    }

    try {
      setIsParsing(true);
      setErrorMsg('');
      setParsingProgress('Analisando linhas do documento...');

      // Auto detect separator
      const lines = fileContent.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) {
        throw new Error('O arquivo deve conter pelo menos uma linha de cabeçalho e uma linha de dados.');
      }

      const separator = fileContent.includes('\t') ? '\t' : (fileContent.includes(';') ? ';' : ',');
      const headers = lines[0].split(separator).map(h => h.trim().replace(/^["']|["']$/g, ''));
      
      const colIndex = (candidates: string[]) => {
        // 1. Try exact match (case-insensitive)
        let foundIdx = headers.findIndex(h => candidates.some(c => h.toLowerCase().trim() === c.toLowerCase().trim()));
        if (foundIdx !== -1) return foundIdx;

        // 2. Try substring match where header contains candidate or vice-versa
        foundIdx = headers.findIndex(h => candidates.some(c => {
          const hClean = h.toLowerCase().trim();
          const cClean = c.toLowerCase().trim();
          return cClean.length > 2 && (hClean.includes(cClean) || cClean.includes(hClean));
        }));
        return foundIdx;
      };

      // Try mapping standard headers
      const idxCompanyName = colIndex(['Empresa', 'Nome da Empresa', 'Nome Empresa', 'Razão Social', 'Company', 'Company Name']);
      const idxSegment = colIndex(['Segmento', 'Área', 'Setor', 'Sector', 'Segment', 'Area']);
      const idxContactName = colIndex(['Nome Completo', 'Nome', 'Contato', 'Name', 'Contact Name', 'Contact']);
      const idxContactEmail = colIndex(['Email', 'E-mail', 'Mail', 'Contact Email']);
      const idxContactPhone = colIndex(['Telefone', 'Celular', 'Fone', 'Phone', 'Mobile']);
      const idxVidas = colIndex(['Quantidade de Vidas', 'Vidas', 'Colaboradores', 'Funcionários', 'Employees', 'Size']);
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
      const idxLocation = colIndex(['Local', 'Cidade', 'UF', 'Cidade/UF', 'Location', 'City']);
      const idxFaturamentoEst = colIndex([
        'Faturamento est mes',
        'Faturamento',
        'Faturamento Estimado',
        'Faturamento Estimado Mensal',
        'Faturamento Estimado Médio Mensal (R$)',
        'Faturamento Estimado Médio Mensal',
        'Revenue',
        'Estimated Revenue'
      ]);
      const idxFolhaEst = colIndex([
        'folha est mes',
        'folha',
        'Custo de Folha',
        'Custo de Folha Mensal',
        'Custo de Folha Mensal (R$)',
        'Payroll',
        'Estimated Payroll'
      ]);
      const idxMediaSetorEst = colIndex([
        'média do setor',
        'media do setor',
        'proporcao de folha',
        'proporção de folha',
        'Proporção Média de Folha',
        'Proporção Média de Folha (%)',
        'Setor %',
        'Média do Setor (%)',
        'Média de Folha (%)',
        'Média de Folha',
        '% do médio do setor'
      ]);

      const idxFutebol = colIndex([
        'Time de futebol',
        'Time',
        'Futebol',
        'Soccer',
        'Football Team',
        'Clube',
        'Time Favorito'
      ]);
      const idxAreaAtuacao = colIndex([
        'Área de Atuação',
        'Area de Atuacao',
        'Área de atuação',
        'Area de atuacao',
        'Área',
        'Area',
        'Atuação',
        'Atuacao',
        'Campo'
      ]);
      const idxPolitica = colIndex([
        'Preferência Política',
        'Preferencia Politica',
        'Política',
        'Politica',
        'Posicionamento Político',
        'Preferencia Voto'
      ]);
      const idxMusica = colIndex([
        'Tipo de Música',
        'Tipo de Musica',
        'Música',
        'Musica',
        'Estilo Musical',
        'Gênero Musical',
        'Preferência Musical'
      ]);

      // Optional Transaction headers
      const idxEventName = colIndex(['Nome do Evento', 'Evento', 'Event', 'Event Name']);
      const idxTicketValue = colIndex(['Valor', 'Preço', 'Ingresso', 'Ticket Value', 'Value', 'Price']);
      const idxPaymentStatus = colIndex(['Estado de pagamento', 'Status Pagamento', 'Pagamento', 'Status', 'Payment Status']);

      if (idxCompanyName === -1) {
        throw new Error('Não foi possível identificar a coluna de "Empresa" ou "Nome da Empresa" no cabeçalho. Certifique-se de que o arquivo possui um cabeçalho identificável.');
      }

      const tempCompanies: any[] = [];
      const tempContacts: any[] = [];
      const tempTransactions: any[] = [];

      const addedCompanies = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(separator).map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (cells.length === 0 || (cells.length === 1 && !cells[0])) continue;

        const getCellVal = (idx: number) => (idx !== -1 && idx < cells.length) ? cells[idx] : '';

        const companyName = getCellVal(idxCompanyName);
        if (!companyName) continue;

        const compKey = companyName.toLowerCase();
        
        // Extract vidas
        let vidas = 0;
        const vidasStr = getCellVal(idxVidas);
        if (vidasStr) {
          vidas = parseInt(vidasStr.replace(/\D/g, '')) || 0;
        }

        let faturamentoEst = idxFaturamentoEst !== -1 ? parseNumber(getCellVal(idxFaturamentoEst)) : undefined;
        let folhaEst = idxFolhaEst !== -1 ? parseNumber(getCellVal(idxFolhaEst)) : undefined;
        let mediaSetorEst = idxMediaSetorEst !== -1 ? parseNumber(getCellVal(idxMediaSetorEst)) : undefined;
        if (mediaSetorEst !== undefined && mediaSetorEst > 1) {
          mediaSetorEst = mediaSetorEst / 100;
        }

        const futebol = idxFutebol !== -1 ? getCellVal(idxFutebol) : undefined;
        const areaAtuacao = idxAreaAtuacao !== -1 ? getCellVal(idxAreaAtuacao) : undefined;
        const politica = idxPolitica !== -1 ? getCellVal(idxPolitica) : undefined;
        const musica = idxMusica !== -1 ? getCellVal(idxMusica) : undefined;

        if (!addedCompanies.has(compKey)) {
          addedCompanies.add(compKey);
          tempCompanies.push({
            name: companyName,
            segment: getCellVal(idxSegment) || 'Outros',
            description: getCellVal(idxDescription),
            activity: getCellVal(idxActivity),
            vidas: vidas,
            location: getCellVal(idxLocation) || 'Fortaleza, CE',
            faturamentoEst,
            folhaEst,
            mediaSetorEst,
            futebol,
            areaAtuacao,
            politica,
            musica
          });
        }

        // Contact
        const contactName = getCellVal(idxContactName);
        if (contactName) {
          tempContacts.push({
            name: contactName,
            email: getCellVal(idxContactEmail),
            phone: getCellVal(idxContactPhone),
            companyName: companyName,
            futebol,
            areaAtuacao,
            politica,
            musica
          });
        }

        // Transaction (Event entry)
        const eventName = getCellVal(idxEventName);
        if (eventName) {
          let value = 0;
          const valueStr = getCellVal(idxTicketValue);
          if (valueStr) {
            value = parseFloat(valueStr.replace('R$', '').replace(/\s+/g, '').replace('.', '').replace(',', '.').trim()) || 0;
          }
          tempTransactions.push({
            companyName: companyName,
            contactName: contactName || 'Participante',
            contactEmail: getCellVal(idxContactEmail),
            eventName: eventName,
            value: value,
            paymentStatus: getCellVal(idxPaymentStatus) || 'Aprovado'
          });
        }
      }

      setParsedCompanies(tempCompanies);
      setParsedContacts(tempContacts);
      setParsedTransactions(tempTransactions);
      setParsingProgress(`Documento processado! Encontradas ${tempCompanies.length} empresas, ${tempContacts.length} contatos e ${tempTransactions.length} transações de eventos.`);

    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar as colunas do arquivo.');
    } finally {
      setIsParsing(false);
    }
  };

  // AI-Powered Parser (For pasted unstructured PDF or custom spreadsheets text)
  const parseWithGeminiAI = async () => {
    const textToAnalyze = importMode === 'paste' ? pastedText : fileContent;
    
    if (!textToAnalyze || !textToAnalyze.trim()) {
      setErrorMsg('Insira ou cole algum texto de mailing para iniciar a análise.');
      return;
    }

    try {
      setIsParsing(true);
      setErrorMsg('');
      setParsingProgress('Conectando ao assistente Gemini AI...');
      
      const interval = setInterval(() => {
        const statuses = [
          'Analisando a estrutura do texto...',
          'Lendo informações de contatos...',
          'Classificando segmentos de empresas...',
          'Modelando transações de eventos compartilhados...',
          'Consolidando banco de conexões relacionais...',
          'Quase pronto. Formatando pacotes JSON...'
        ];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        setParsingProgress(randomStatus);
      }, 3500);

      const res = await fetch('/api/ai/parse-mailing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToAnalyze })
      });

      clearInterval(interval);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha na resposta do assistente Gemini.');
      }

      const data = await res.json();

      setParsedCompanies(data.companies || []);
      setParsedContacts(data.contacts || []);
      setParsedTransactions(data.transactions || []);
      
      setParsingProgress(`IA Gemini concluiu o mapeamento! Estruturou com precisão ${data.companies?.length || 0} empresas, ${data.contacts?.length || 0} contatos e ${data.transactions?.length || 0} registros de eventos.`);
      
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao processar dados com Inteligência Artificial.');
    } finally {
      setIsParsing(false);
    }
  };

  // Submit parsed data to Database
  const handleSaveToCRM = async () => {
    if (parsedCompanies.length === 0) {
      setErrorMsg('Não há dados estruturados para salvar no CRM.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg('');

      const res = await fetch('/api/mailing/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companies: parsedCompanies,
          contacts: parsedContacts,
          transactions: parsedTransactions,
          overwrite: overwriteStrategy
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao salvar dados de importação.');
      }

      setSaveSuccess(true);
      setTimeout(() => {
        onImportComplete();
      }, 2000);

    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao consolidar importação no banco de dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    setFileName('');
    setFileContent('');
    setPastedText('');
    setParsedCompanies([]);
    setParsedContacts([]);
    setParsedTransactions([]);
    setErrorMsg('');
    setParsingProgress('');
    setSaveSuccess(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn" id="mailing_importer_view">
      
      {/* Intro Header */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-xs text-center space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Database className="h-48 w-48 text-indigo-600" />
        </div>
        
        <div className="inline-flex p-3 bg-indigo-50 dark:bg-indigo-950/55 text-indigo-600 dark:text-indigo-400 rounded-2xl mb-2">
          <Sparkles className="h-8 w-8 animate-pulse" />
        </div>
        
        <div className="space-y-2 max-w-2xl mx-auto">
          <h2 className="text-2xl font-black font-display tracking-tight text-slate-950 dark:text-white">
            Alimente seu CRM de Inteligência Relacional
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Para iniciar as análises de conexões B2B da rodada Rampup, carregue o banco de dados. Você pode subir uma planilha CSV/TSV, colar linhas copiadas do Excel, relatórios de PDF ou ativar nossa Inteligência Artificial para estruturar dados soltos.
          </p>
        </div>

        {existingCompaniesCount > 0 && (
          <div className="pt-2">
            <span className="inline-flex items-center bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-3.5 py-1.5 rounded-full shadow-3xs">
              <CheckCircle2 className="h-4 w-4 mr-1.5 shrink-0" />
              Banco ativo atualmente com {existingCompaniesCount} empresas cadastradas
            </span>
          </div>
        )}
      </div>

      {/* Main Steps */}
      <AnimatePresence mode="wait">
        {!saveSuccess && parsedCompanies.length === 0 ? (
          <motion.div 
            key="config-importer"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 md:grid-cols-12 gap-8"
          >
            {/* Left Sidebar Options */}
            <div className="md:col-span-4 space-y-3">
              <button
                onClick={() => { setImportMode('file'); handleClear(); }}
                className={`w-full p-4 rounded-2xl border text-left flex items-start space-x-3.5 transition-all cursor-pointer ${
                  importMode === 'file'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                    : 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850'
                }`}
              >
                <Upload className="h-5 w-5 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">Upload de Arquivo</h4>
                  <p className={`text-[11.5px] leading-relaxed mt-0.5 ${importMode === 'file' ? 'text-indigo-150' : 'text-slate-450 dark:text-slate-400'}`}>
                    Importe arquivos organizados em CSV, TSV ou JSON.
                  </p>
                </div>
              </button>

              <button
                onClick={() => { setImportMode('paste'); handleClear(); }}
                className={`w-full p-4 rounded-2xl border text-left flex items-start space-x-3.5 transition-all cursor-pointer ${
                  importMode === 'paste'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                    : 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850'
                }`}
              >
                <Clipboard className="h-5 w-5 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">Copiar e Colar Inteligente</h4>
                  <p className={`text-[11.5px] leading-relaxed mt-0.5 ${importMode === 'paste' ? 'text-indigo-150' : 'text-slate-450 dark:text-slate-400'}`}>
                    Cole dados tabulares do Excel ou textos brutos de PDFs/emails.
                  </p>
                </div>
              </button>

              <button
                onClick={() => { setImportMode('demo'); handleClear(); }}
                className={`w-full p-4 rounded-2xl border text-left flex items-start space-x-3.5 transition-all cursor-pointer ${
                  importMode === 'demo'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                    : 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850'
                }`}
              >
                <BookOpen className="h-5 w-5 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">Demonstração Oficial</h4>
                  <p className={`text-[11.5px] leading-relaxed mt-0.5 ${importMode === 'demo' ? 'text-indigo-150' : 'text-slate-450 dark:text-slate-400'}`}>
                    Ative o ecossistema com mailing de teste pré-cadastrado.
                  </p>
                </div>
              </button>
            </div>

            {/* Right Active Ingestion Box */}
            <div className="md:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xs">
              
              {/* FILE UPLOAD MODE */}
              {importMode === 'file' && (
                <div className="space-y-6">
                  <div className="space-y-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="font-display font-bold text-slate-900 dark:text-white text-base">Enviar Planilha ou Arquivo de Dados</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Formatos suportados: Excel <strong>(.xlsx, .xls)</strong>, CSV, TSV, TXT ou JSON.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadExcelTemplate}
                      className="inline-flex items-center space-x-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs px-3.5 py-2 rounded-xl border border-indigo-100 dark:border-indigo-900/40 cursor-pointer shadow-3xs transition-colors self-start sm:self-auto"
                      title="Baixar Modelo de Planilha Excel (.xlsx)"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Baixar Modelo Excel (.xlsx)</span>
                    </button>
                  </div>

                  {!fileName ? (
                    <div 
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 transition-all duration-200 ${
                        dragActive 
                          ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10' 
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-750 bg-slate-50/50 dark:bg-slate-950/25'
                      }`}
                    >
                      <Upload className="h-10 w-10 text-slate-400 animate-bounce" style={{ animationDuration: '4s' }} />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Arrastar e soltar arquivo aqui</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">ou</p>
                      </div>
                      <label className="cursor-pointer bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-250 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs px-4 py-2 rounded-xl transition-colors shadow-3xs">
                        Procurar no computador
                        <input 
                          type="file" 
                          onChange={handleFileChange} 
                          accept=".csv,.tsv,.txt,.json,.xlsx,.xls" 
                          className="hidden" 
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-55/40 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/45 text-indigo-600 dark:text-indigo-400 rounded-xl">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate max-w-sm">{fileName}</p>
                          <p className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Arquivo carregado com sucesso
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={handleClear}
                        className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                        title="Remover arquivo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {fileName && (
                    <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button 
                        onClick={handleClear}
                        className="px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-750 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer"
                      >
                        Limpar
                      </button>

                      {fileName.endsWith('.json') ? (
                        <button 
                          onClick={handleSaveToCRM}
                          disabled={isSaving}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                        >
                          <Database className="h-4 w-4" />
                          <span>Gravar Dados Direto</span>
                        </button>
                      ) : (
                        <div className="flex space-x-2">
                          <button 
                            onClick={parseDelimiterFile}
                            disabled={isParsing}
                            className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center space-x-2 cursor-pointer"
                          >
                            <ChevronRight className="h-4 w-4" />
                            <span>Mapear Colunas</span>
                          </button>
                          
                          <button 
                            onClick={parseWithGeminiAI}
                            disabled={isParsing}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer"
                            title="Deixe o Gemini entender e arrumar as colunas de forma autônoma"
                          >
                            <Sparkles className="h-4 w-4" />
                            <span>Processar com IA</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* COPIAR E COLAR INTELIGENTE (PASTE MODE) */}
              {importMode === 'paste' && (
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-1.5">
                      <h3 className="font-display font-bold text-slate-900 dark:text-white text-base">Recorte e Cola Autônomo</h3>
                      <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/30 font-black text-[8px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Power by Gemini 3.5
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cole colunas copiadas diretamente de planilhas <strong>Excel, tabelas de PDF, listas de emails ou relatórios brutos</strong> de participantes. Nossa IA analisará semanticamente cada linha!
                    </p>
                  </div>

                  <div className="space-y-2">
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder={`Exemplo de colagem aceita:\nNome Completo\tEmpresa\tQuantidade de Vidas\tE-mail\nGabriel Mestre\tMM Estratégia\t15\tgabriel@mme.com\n- OU - \n"Participantes do Evento Rampup: João Silva da empresa ACME LTDA (Segmento: Tecnologia, 42 colaboradores). Contato: joao@acme.com"`}
                      rows={10}
                      className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-950 focus:outline-none focus:border-indigo-500 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 font-mono"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center space-x-1.5">
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>Limpeza, remoção de duplicatas e links automáticos.</span>
                    </div>

                    <div className="flex space-x-3">
                      <button 
                        onClick={handleClear}
                        className="px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-750 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer"
                      >
                        Limpar
                      </button>
                      <button 
                        onClick={parseWithGeminiAI}
                        disabled={isParsing || !pastedText.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        <span>Processar com IA</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* DEMO DATA MODE */}
              {importMode === 'demo' && (
                <div className="space-y-6 text-center py-6">
                  <div className="h-14 w-14 bg-indigo-50 dark:bg-indigo-950/60 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto border border-indigo-100 dark:border-indigo-900/30">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  
                  <div className="space-y-2 max-w-md mx-auto">
                    <h3 className="font-display font-bold text-slate-900 dark:text-white text-base">Seeding do Ecossistema Rampup</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Carregue o mailing oficial pré-configurado contendo mais de 50 empresas de Fortaleza e Ceará, seus decisores mapeados, transações reais e redes complexas para experimentar o dashboard imediatamente.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                    <button 
                      onClick={async () => {
                        try {
                          setIsSaving(true);
                          setErrorMsg('');
                          await onLoadDemoData();
                          setSaveSuccess(true);
                          setTimeout(() => {
                            onImportComplete();
                          }, 1500);
                        } catch (err: any) {
                          setErrorMsg(err.message || 'Falha ao carregar banco de dados de exemplo.');
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      disabled={isSaving}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-sm flex items-center space-x-2 cursor-pointer"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                      <span>Carregar Banco de Exemplo</span>
                    </button>
                  </div>
                </div>
              )}

              {/* LIVE PARSING LOADER */}
              {isParsing && (
                <div className="mt-6 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/60 dark:border-indigo-900/30 rounded-2xl flex items-center space-x-4 animate-pulse">
                  <Loader2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-indigo-950 dark:text-indigo-200">Processamento Ativo</p>
                    <p className="text-[10.5px] text-indigo-600 dark:text-indigo-400 font-semibold">{parsingProgress}</p>
                  </div>
                </div>
              )}

              {/* ERROR BLOCK */}
              {errorMsg && (
                <div className="mt-6 p-4 bg-rose-50 dark:bg-rose-950/35 border border-rose-100 dark:border-rose-900/40 rounded-2xl flex items-start space-x-3 text-rose-800 dark:text-rose-400">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold leading-tight">Falha de Processamento</p>
                    <p className="text-[10.5px] leading-relaxed font-semibold">{errorMsg}</p>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        ) : (
          /* PREVIEW STAGE AND SAVE BLOCK */
          !saveSuccess && parsedCompanies.length > 0 && (
            <motion.div 
              key="preview-importer"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Header Analysis Results */}
              <div className="bg-slate-55/35 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-3 text-left">
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <Eye className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Pré-visualização do Mailing Estruturado</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                      Verifique os registros identificados abaixo antes de salvar permanentemente no CRM Rampup.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button 
                    onClick={handleClear}
                    className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl"
                    title="Descartar e Recomeçar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Data Tabs */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Lists Tabs Panel */}
                <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xs">
                  {/* Selector Header */}
                  <div className="flex bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-850 p-2">
                    <button
                      onClick={() => setPreviewTab('companies')}
                      className={`flex-1 py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                        previewTab === 'companies'
                          ? 'bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 shadow-3xs'
                          : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'
                      }`}
                    >
                      Empresas ({parsedCompanies.length})
                    </button>
                    <button
                      onClick={() => setPreviewTab('contacts')}
                      className={`flex-1 py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                        previewTab === 'contacts'
                          ? 'bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 shadow-3xs'
                          : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'
                      }`}
                    >
                      Contatos ({parsedContacts.length})
                    </button>
                    <button
                      onClick={() => setPreviewTab('transactions')}
                      className={`flex-1 py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                        previewTab === 'transactions'
                          ? 'bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 shadow-3xs'
                          : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'
                      }`}
                    >
                      Eventos / Transações ({parsedTransactions.length})
                    </button>
                  </div>

                  {/* List Viewport */}
                  <div className="p-5 max-h-[360px] overflow-y-auto">
                    
                    {/* Companies Tab Table */}
                    {previewTab === 'companies' && (
                      <div className="space-y-3">
                        {parsedCompanies.map((c, idx) => (
                          <div key={idx} className="p-3 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-200/50 dark:border-slate-850 flex justify-between items-center text-xs">
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-850 dark:text-slate-100">{c.name}</p>
                              <div className="flex items-center space-x-1.5 text-[10px] text-slate-400">
                                <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{c.segment}</span>
                                <span>•</span>
                                <span>{c.location || 'Fortaleza, CE'}</span>
                                <span>•</span>
                                <span>{c.vidas} vidas</span>
                              </div>
                            </div>
                            {c.description && (
                              <p className="text-[10px] text-slate-400 dark:text-slate-550 max-w-xs truncate italic">
                                "{c.description}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Contacts Tab Table */}
                    {previewTab === 'contacts' && (
                      <div className="space-y-3">
                        {parsedContacts.map((co, idx) => (
                          <div key={idx} className="p-3 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-200/50 dark:border-slate-850 flex justify-between items-center text-xs">
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-850 dark:text-slate-100">{co.name}</p>
                              <p className="text-[10px] text-slate-400">{co.email || 'Sem e-mail'} • {co.phone || 'Sem telefone'}</p>
                            </div>
                            <span className="bg-indigo-50 dark:bg-indigo-950/45 text-indigo-700 dark:text-indigo-450 border border-indigo-100/50 dark:border-indigo-900/30 font-bold text-[9.5px] px-2.5 py-0.5 rounded-lg">
                              {co.companyName || 'Sem Empresa'}
                            </span>
                          </div>
                        ))}

                        {parsedContacts.length === 0 && (
                          <p className="text-center text-slate-400 dark:text-slate-500 py-12 text-xs">Nenhum contato identificado no mailing.</p>
                        )}
                      </div>
                    )}

                    {/* Transactions Tab Table */}
                    {previewTab === 'transactions' && (
                      <div className="space-y-3">
                        {parsedTransactions.map((t, idx) => (
                          <div key={idx} className="p-3 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-200/50 dark:border-slate-850 flex justify-between items-center text-xs">
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-850 dark:text-slate-100">{t.eventName || 'RampUp Event'}</p>
                              <p className="text-[10px] text-slate-400">Comprador: {t.contactName || 'Participante'} • {t.contactEmail}</p>
                            </div>
                            <div className="text-right">
                              <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                                R$ {Number(t.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 text-[8.5px] font-bold border border-emerald-150 rounded px-1.5 py-0.2 block mt-0.5">
                                {t.paymentStatus || 'Aprovado'}
                              </span>
                            </div>
                          </div>
                        ))}

                        {parsedTransactions.length === 0 && (
                          <p className="text-center text-slate-400 dark:text-slate-500 py-12 text-xs">Nenhum ingresso ou transação identificado.</p>
                        )}
                      </div>
                    )}

                  </div>
                </div>

                {/* Confirm Settings Panel */}
                <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xs space-y-6 flex flex-col justify-between">
                  <div className="space-y-5">
                    <h4 className="font-display font-bold text-slate-900 dark:text-white text-sm">Configurar Gravação</h4>
                    
                    <div className="space-y-4">
                      {/* Strategy Overwrite Toggle */}
                      <div className="space-y-2">
                        <label className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider block">Método de Importação:</label>
                        
                        <div className="grid grid-cols-1 gap-2.5">
                          {/* Option A: Merge */}
                          <div 
                            onClick={() => setOverwriteStrategy(false)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start space-x-2.5 ${
                              !overwriteStrategy 
                                ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500' 
                                : 'bg-slate-50/50 dark:bg-slate-950/25 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                            }`}
                          >
                            <input 
                              type="radio" 
                              checked={!overwriteStrategy} 
                              onChange={() => setOverwriteStrategy(false)}
                              className="mt-1 accent-indigo-600" 
                            />
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-slate-850 dark:text-slate-250">Mesclar registros</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">
                                Adiciona contatos e mescla informações de empresas que já existirem sem apagar o histórico atual.
                              </p>
                            </div>
                          </div>

                          {/* Option B: Overwrite */}
                          <div 
                            onClick={() => setOverwriteStrategy(true)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start space-x-2.5 ${
                              overwriteStrategy 
                                ? 'bg-rose-50/40 dark:bg-rose-950/15 border-rose-500' 
                                : 'bg-slate-50/50 dark:bg-slate-950/25 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                            }`}
                          >
                            <input 
                              type="radio" 
                              checked={overwriteStrategy} 
                              onChange={() => setOverwriteStrategy(true)}
                              className="mt-1 accent-rose-600" 
                            />
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-slate-850 dark:text-slate-250">Sobrescrever Banco (Reset)</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">
                                Apaga completamente todas as empresas, contatos e transações existentes e cria uma base limpa.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submit Block */}
                  <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-850">
                    {overwriteStrategy && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-start space-x-2 text-[10.5px] text-amber-800 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <span className="font-medium leading-relaxed">
                          Atenção: Ao escolher "Sobrescrever Banco", os dados atuais serão deletados permanentemente.
                        </span>
                      </div>
                    )}

                    <button
                      onClick={handleSaveToCRM}
                      disabled={isSaving}
                      className={`w-full py-3 px-4 rounded-xl text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-sm cursor-pointer transition-all ${
                        overwriteStrategy 
                          ? 'bg-rose-600 hover:bg-rose-700' 
                          : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      <span>Confirmar Importação</span>
                    </button>
                  </div>

                </div>
              </div>
            </motion.div>
          )
        )}

        {/* SUCCESS SPLASH */}
        {saveSuccess && (
          <motion.div 
            key="success-splash"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-16 rounded-3xl text-center space-y-6 shadow-sm flex flex-col justify-center items-center"
          >
            <div className="p-4 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full animate-bounce">
              <Check className="h-10 w-10 stroke-[3]" />
            </div>
            
            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="font-display font-black text-slate-900 dark:text-white text-xl">Integração Concluída com Sucesso!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                O mailing foi importado e indexado com sucesso. Redirecionando para as análises estratégicas...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
