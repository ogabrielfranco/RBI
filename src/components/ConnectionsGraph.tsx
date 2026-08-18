import React, { useState, useMemo } from 'react';
import { Company, Contact, Transaction } from '../types';
import { analyzeConnections } from '../data/matchEngine';
import { getCompanyArchetype, getRecurringEntrepreneurs, classifyCompanySize, calculateCompanyAffinity } from '../utils/strategicHelpers';
import { 
  Network, Info, ArrowUpRight, ArrowDownLeft, Handshake, Users, 
  UserCheck, HelpCircle, Sparkles, MapPin, Building2, Calendar, 
  ChevronRight, ArrowRightLeft, User, MessageCircle, Eye, Grid, Search, ListFilter,
  Maximize2, Minimize2
} from 'lucide-react';

interface ConnectionsGraphProps {
  companies: Company[];
  contacts: Contact[];
  transactions: Transaction[];
  selectedCompany: Company | null;
  onSelectCompany: (company: Company) => void;
  isAnalysisExecuted?: boolean;
  triggerAnalysisRun?: () => void;
}

export default function ConnectionsGraph({ 
  companies, 
  contacts, 
  transactions,
  selectedCompany, 
  onSelectCompany,
  isAnalysisExecuted = false,
  triggerAnalysisRun
}: ConnectionsGraphProps) {
  // Dual-mode toggle: 'companies' | 'entrepreneurs'
  const [viewMode, setViewMode] = useState<'companies' | 'entrepreneurs'>('companies');
  const [activeTab, setActiveTab] = useState<'all' | 'sell' | 'buy' | 'partner'>('all');
  const [layoutStyle, setLayoutStyle] = useState<'constellation' | 'grid'>('constellation');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  // Selection states
  const [internalSelectedCompany, setInternalSelectedCompany] = useState<Company | null>(selectedCompany || companies[0] || null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(contacts[0] || null);
  const [clickedCompanyId, setClickedCompanyId] = useState<string | null>(null);
  const [clickedContactId, setClickedContactId] = useState<string | null>(null);

  // Reset highlights on focus shift
  React.useEffect(() => {
    setClickedCompanyId(null);
    setClickedContactId(null);
  }, [internalSelectedCompany, viewMode]);
  
  // Hover Tooltip state
  const [hoveredNode, setHoveredNode] = useState<{ name: string; subtitle: string; reason: string; type: string } | null>(null);

  // Zoom & Pan states
  const [zoom, setZoom] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ 
        x: e.touches[0].clientX - panX, 
        y: e.touches[0].clientY - panY 
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPanX(e.touches[0].clientX - dragStart.x);
    setPanY(e.touches[0].clientY - dragStart.y);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Sync internal state with prop if selectedCompany changes
  React.useEffect(() => {
    if (selectedCompany) {
      setInternalSelectedCompany(selectedCompany);
      setViewMode('companies');
    }
  }, [selectedCompany]);

  // Handle company switch in constellation
  const handleCompanySelect = (comp: Company) => {
    setInternalSelectedCompany(comp);
    onSelectCompany(comp);
  };

  // --- 1. COMPANIES MODE ORBIT LOGIC ---
  const currentCompany = internalSelectedCompany || companies[0] || null;
  
  const companyMatchData = useMemo(() => {
    if (!currentCompany || !isAnalysisExecuted) return null;
    return analyzeConnections(currentCompany, companies);
  }, [currentCompany, companies, isAnalysisExecuted]);

  const companyOrbitNodes = useMemo(() => {
    if (!companyMatchData || !currentCompany) return [];

    const nodes: Array<{
      company: Company;
      type: 'buyer' | 'seller' | 'partner' | 'connection';
      angle: number;
      orbit: number;
      reason: string;
    }> = [];

    const buyers = (companyMatchData.potentialBuyerIds.map(id => companies.find(c => c.id === id)).filter(Boolean) as Company[]).slice(0, 10);
    const sellers = (companyMatchData.potentialSellerIds.map(id => companies.find(c => c.id === id)).filter(Boolean) as Company[]).slice(0, 10);
    const partners = (companyMatchData.potentialPartnerIds.map(id => companies.find(c => c.id === id)).filter(Boolean) as Company[]).slice(0, 10);
    const general = (companyMatchData.potentialConnectionIds.map(id => companies.find(c => c.id === id)).filter(Boolean) as Company[]).slice(0, 10);

    const showAll = activeTab === 'all';

    // Tier 1: Partners (Inner Orbit - Base Radius 110)
    if (showAll || activeTab === 'partner') {
      partners.forEach((p, idx, arr) => {
        const angle = (idx / (arr.length || 1)) * 2 * Math.PI + 0.5;
        // Stagger the orbit radius if multiple partners exist
        const stagger = arr.length > 4 ? (idx % 2 === 0 ? -22 : 22) : 0;
        nodes.push({
          company: p,
          type: 'partner',
          angle,
          orbit: 110 + stagger,
          reason: companyMatchData.reasons[`partner_${p.id}`] || 'Sinergia de indicação mútua e co-selling.'
        });
      });
    }

    // Tier 2: Buyers (Middle Orbit - Base Radius 195)
    if (showAll || activeTab === 'sell') {
      buyers.forEach((b, idx, arr) => {
        const angle = (idx / (arr.length || 1)) * 2 * Math.PI - 0.5;
        // Stagger the orbit radius if multiple buyers exist
        const stagger = arr.length > 4 ? (idx % 2 === 0 ? -32 : 32) : 0;
        nodes.push({
          company: b,
          type: 'buyer',
          angle,
          orbit: 195 + stagger,
          reason: companyMatchData.reasons[`sell_${b.id}`] || `${currentCompany.name} pode vender soluções corporativas para a ${b.name}.`
        });
      });
    }

    // Tier 3: Sellers (Outer Orbit - Base Radius 280)
    if (showAll || activeTab === 'buy') {
      sellers.forEach((s, idx, arr) => {
        const angle = (idx / (arr.length || 1)) * 2 * Math.PI + 1.8;
        // Stagger the orbit radius if multiple sellers exist
        const stagger = arr.length > 4 ? (idx % 2 === 0 ? -38 : 38) : 0;
        nodes.push({
          company: s,
          type: 'seller',
          angle,
          orbit: 280 + stagger,
          reason: companyMatchData.reasons[`buy_${s.id}`] || `${s.name} oferece soluções complementares para ${currentCompany.name}.`
        });
      });
    }

    // Tier 4: General Connections (Base Radius 200)
    if (showAll && nodes.length === 0) {
      general.forEach((g, idx, arr) => {
        const angle = (idx / (arr.length || 1)) * 2 * Math.PI;
        const stagger = arr.length > 4 ? (idx % 2 === 0 ? -25 : 25) : 0;
        nodes.push({
          company: g,
          type: 'connection',
          angle,
          orbit: 200 + stagger,
          reason: companyMatchData.reasons[`conn_${g.id}`] || 'Empresas no mesmo segmento ou localidade.'
        });
      });
    }

    return nodes;
  }, [companyMatchData, companies, activeTab, currentCompany]);


  // --- 2. ENTREPRENEURS (PEOPLE) MODE ORBIT LOGIC ---
  // Get all active contacts listed or associated with transactions
  const activeContactsList = useMemo(() => {
    // If we have actual contacts in DB, use them; otherwise extract from transactions
    if (contacts.length > 0) return contacts;
    
    // Fallback: extract unique contacts from transactions
    const uniqueMap: Record<string, Contact> = {};
    transactions.forEach(t => {
      const email = t.contactEmail.toLowerCase().trim() || t.contactName.toLowerCase().trim();
      if (!uniqueMap[email]) {
        uniqueMap[email] = {
          id: `cont_gen_${email.replace(/[^a-z0-9]/g, '_')}`,
          name: t.contactName,
          email: t.contactEmail,
          phone: '',
          companyId: t.companyId,
          customFields: {}
        };
      }
    });
    return Object.values(uniqueMap);
  }, [contacts, transactions]);

  const currentContact = selectedContact || activeContactsList[0] || null;
  const currentContactCompany = useMemo(() => {
    if (!currentContact) return null;
    return companies.find(c => c.id === currentContact.companyId) || null;
  }, [currentContact, companies]);

  const contactOrbitNodes = useMemo(() => {
    if (!currentContact || !currentContactCompany || !companyMatchData || !isAnalysisExecuted) return [];

    // Analyze connection vectors for the contact's company
    const matches = analyzeConnections(currentContactCompany, companies);
    
    const nodes: Array<{
      contact: Contact;
      companyName: string;
      type: 'buyer' | 'seller' | 'partner' | 'connection';
      angle: number;
      orbit: number;
      reason: string;
    }> = [];

    // Get other contacts
    const otherContacts = activeContactsList.filter(c => c.id !== currentContact.id && c.companyId !== currentContact.companyId);

    const showAll = activeTab === 'all';

    otherContacts.forEach((other, idx) => {
      const otherCompany = companies.find(c => c.id === other.companyId);
      if (!otherCompany) return;

      let matchType: 'buyer' | 'seller' | 'partner' | 'connection' | null = null;
      let orbit = 200;
      let reason = '';

      // Determine orbit type based on company relationship
      if (matches.potentialPartnerIds.includes(other.companyId)) {
        matchType = 'partner';
        orbit = 110;
        reason = `Sinergia de parceria entre ${currentContact.name} (${currentContactCompany.name}) e ${other.name} (${otherCompany.name}): Ambos atuam em setores com alta cooperação recíproca.`;
      } else if (matches.potentialBuyerIds.includes(other.companyId)) {
        matchType = 'buyer';
        orbit = 195;
        reason = `${other.name} é decisor na ${otherCompany.name}, que é um potencial cliente para contratar a ${currentContactCompany.name}.`;
      } else if (matches.potentialSellerIds.includes(other.companyId)) {
        matchType = 'seller';
        orbit = 280;
        reason = `${other.name} é decisor na ${otherCompany.name}, que fornece soluções estratégicas para o crescimento da ${currentContactCompany.name}.`;
      } else {
        // Check if they attended same events
        const myEvents = transactions.filter(t => t.contactEmail === currentContact.email).map(t => t.eventName);
        const otherEvents = transactions.filter(t => t.contactEmail === other.email).map(t => t.eventName);
        const commonEvents = myEvents.filter(e => otherEvents.includes(e));

        if (commonEvents.length > 0) {
          matchType = 'connection';
          orbit = 200;
          reason = `Networking de Proximidade: Ambos participaram da edição "${commonEvents[0]}". Excelente para retomar contatos!`;
        }
      }

      // Apply quick tab filter
      if (matchType) {
        if (showAll || 
           (activeTab === 'partner' && matchType === 'partner') ||
           (activeTab === 'sell' && matchType === 'buyer') ||
           (activeTab === 'buy' && matchType === 'seller')
        ) {
          nodes.push({
            contact: other,
            companyName: otherCompany.name,
            type: matchType,
            angle: 0, // calculated below
            orbit,
            reason
          });
        }
      }
    });

    // Limit to 10 connections of each orbit type
    const orbitCountMap: Record<number, number> = {};
    const limitedNodes: typeof nodes = [];
    nodes.forEach(n => {
      const currentCount = orbitCountMap[n.orbit] || 0;
      if (currentCount < 10) {
        limitedNodes.push(n);
        orbitCountMap[n.orbit] = currentCount + 1;
      }
    });

    // Spread angles uniformly based on selected nodes in orbits
    const orbitCount: Record<number, number> = {};
    limitedNodes.forEach(n => {
      orbitCount[n.orbit] = (orbitCount[n.orbit] || 0) + 1;
    });

    const orbitIndices: Record<number, number> = {};
    return limitedNodes.map((node) => {
      const totalInOrbit = orbitCount[node.orbit];
      const index = orbitIndices[node.orbit] || 0;
      orbitIndices[node.orbit] = index + 1;

      // Stagger orbit radius if multiple contacts share the same orbit
      let finalOrbit = node.orbit;
      if (totalInOrbit > 4) {
        const staggerAmt = node.orbit === 110 ? 22 : node.orbit === 195 ? 32 : 38;
        finalOrbit += index % 2 === 0 ? -staggerAmt : staggerAmt;
      }

      // Calculate distinct angle spacing for nodes in same radius
      const angle = (index / (totalInOrbit || 1)) * 2 * Math.PI + (node.orbit === 110 ? 0.3 : node.orbit === 195 ? -0.4 : 1.2);
      return {
        ...node,
        orbit: finalOrbit,
        angle
      };
    });

  }, [currentContact, currentContactCompany, activeContactsList, companies, transactions, activeTab, companyMatchData]);

  // --- UTILS ---
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  const getThemeColor = (type: string) => {
    switch (type) {
      case 'buyer': return { stroke: '#818cf8', bg: 'bg-indigo-500', text: 'text-indigo-400', lightBg: 'bg-indigo-950/40', border: 'border-indigo-500/30', glow: '#818cf8' };
      case 'seller': return { stroke: '#fbbf24', bg: 'bg-amber-500', text: 'text-amber-400', lightBg: 'bg-amber-950/40', border: 'border-amber-500/30', glow: '#fbbf24' };
      case 'partner': return { stroke: '#34d399', bg: 'bg-emerald-500', text: 'text-emerald-400', lightBg: 'bg-emerald-950/40', border: 'border-emerald-500/30', glow: '#34d399' };
      default: return { stroke: '#f472b6', bg: 'bg-pink-500', text: 'text-pink-400', lightBg: 'bg-pink-950/40', border: 'border-pink-500/30', glow: '#f472b6' };
    }
  };

  // Contacts associated with the selected central company
  const companyContacts = useMemo(() => {
    if (!currentCompany) return [];
    return activeContactsList.filter(c => c.companyId === currentCompany.id);
  }, [currentCompany, activeContactsList]);

  // Events attended by selected contact
  const selectedContactEvents = useMemo(() => {
    if (!currentContact) return [];
    return transactions.filter(t => t.contactEmail === currentContact.email).map(t => t.eventName);
  }, [currentContact, transactions]);

  const filteredCompanyNodes = useMemo(() => {
    return companyOrbitNodes.filter(node => 
      node.company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.company.segment.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.reason.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [companyOrbitNodes, searchQuery]);

  const filteredContactNodes = useMemo(() => {
    return contactOrbitNodes.filter(node => 
      node.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.reason.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [contactOrbitNodes, searchQuery]);

  // Helper to calculate axial spiral positions for hexagonal grid layout
  const getHexSpiralCoord = (index: number) => {
    if (index === 0) return { q: 0, r: 0 };
    let ring = 1;
    let count = 1;
    while (count + ring * 6 <= index) {
      count += ring * 6;
      ring++;
    }
    const ringIndex = index - count;
    const segment = Math.floor(ringIndex / ring);
    const offset = ringIndex % ring;
    const dirs = [
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 },
      { q: 1, r: 0 }
    ];
    let q = dirs[4].q * ring;
    let r = dirs[4].r * ring;
    for (let s = 0; s < segment; s++) {
      q += dirs[s].q * ring;
      r += dirs[s].r * ring;
    }
    q += dirs[segment].q * offset;
    r += dirs[segment].r * offset;
    return { q, r };
  };

  const hexCompanyNodes = useMemo(() => {
    if (!currentCompany) return [];

    let list = companies.filter(c => c.id !== currentCompany.id);

    // 1. Filter by activeTab (orbit)
    if (activeTab !== 'all' && companyMatchData) {
      if (activeTab === 'partner') {
        list = list.filter(c => companyMatchData.potentialPartnerIds.includes(c.id));
      } else if (activeTab === 'sell') {
        list = list.filter(c => companyMatchData.potentialBuyerIds.includes(c.id));
      } else if (activeTab === 'buy') {
        list = list.filter(c => companyMatchData.potentialSellerIds.includes(c.id));
      }
    }

    // 2. Filter by searchQuery
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      list = list.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.segment.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query) ||
        c.activity.toLowerCase().includes(query)
      );
    }

    // Current company goes first (at the center of the hex spiral)
    const allSorted = [currentCompany, ...list];
    
    return allSorted.map((comp, idx) => {
      const { q, r } = getHexSpiralCoord(idx);
      const hexSpacing = 68;
      const x = 300 + hexSpacing * (1.732 * q + 0.866 * r);
      const y = 300 + hexSpacing * (1.5 * r);
      
      let type: 'center' | 'buyer' | 'seller' | 'partner' | 'connection' = 'connection';
      let reason = 'Empresa parceira do ecossistema.';
      if (comp.id === currentCompany.id) {
        type = 'center';
        reason = 'Esta é a empresa foco central selecionada no radar.';
      } else if (companyMatchData) {
        if (companyMatchData.potentialPartnerIds.includes(comp.id)) {
          type = 'partner';
          reason = companyMatchData.reasons[`partner_${comp.id}`] || 'Sinergia de indicação mútua e co-selling.';
        } else if (companyMatchData.potentialBuyerIds.includes(comp.id)) {
          type = 'buyer';
          reason = companyMatchData.reasons[`sell_${comp.id}`] || `${currentCompany.name} pode vender soluções corporativas para a ${comp.name}.`;
        } else if (companyMatchData.potentialSellerIds.includes(comp.id)) {
          type = 'seller';
          reason = companyMatchData.reasons[`buy_${comp.id}`] || `${comp.name} oferece soluções complementares para ${currentCompany.name}.`;
        } else if (companyMatchData.potentialConnectionIds.includes(comp.id)) {
          type = 'connection';
          reason = companyMatchData.reasons[`conn_${comp.id}`] || 'Empresas no mesmo segmento ou localidade.';
        }
      }
      
      return {
        company: comp,
        type,
        x,
        y,
        reason
      };
    });
  }, [currentCompany, companies, companyMatchData, activeTab, searchQuery]);

  const hexContactNodes = useMemo(() => {
    if (!currentContact || !currentContactCompany || !companyMatchData) return [];

    let list = activeContactsList.filter(c => c.id !== currentContact.id);

    // 1. Filter by activeTab (orbit)
    if (activeTab !== 'all') {
      list = list.filter(other => {
        if (activeTab === 'partner') {
          return companyMatchData.potentialPartnerIds.includes(other.companyId);
        } else if (activeTab === 'sell') {
          return companyMatchData.potentialBuyerIds.includes(other.companyId);
        } else if (activeTab === 'buy') {
          return companyMatchData.potentialSellerIds.includes(other.companyId);
        }
        return false;
      });
    }

    // 2. Filter by searchQuery
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      list = list.filter(other => {
        const comp = companies.find(c => c.id === other.companyId);
        return (
          other.name.toLowerCase().includes(query) ||
          other.email.toLowerCase().includes(query) ||
          (comp && comp.name.toLowerCase().includes(query))
        );
      });
    }

    const allSorted = [currentContact, ...list];
    
    return allSorted.map((contact, idx) => {
      const { q, r } = getHexSpiralCoord(idx);
      const hexSpacing = 68;
      const x = 300 + hexSpacing * (1.732 * q + 0.866 * r);
      const y = 300 + hexSpacing * (1.5 * r);
      
      const comp = companies.find(c => c.id === contact.companyId);
      const companyName = comp ? comp.name : 'Independente';
      
      let type: 'center' | 'buyer' | 'seller' | 'partner' | 'connection' = 'connection';
      let reason = `Empresário participante da rede de relacionamentos.`;
      
      if (contact.id === currentContact.id) {
        type = 'center';
        reason = `Este é o empresário central de referência.`;
      } else if (currentContactCompany && comp) {
        if (companyMatchData.potentialPartnerIds.includes(comp.id)) {
          type = 'partner';
          reason = `Contato estratégico na ${companyName} (Parceiro comercial).`;
        } else if (companyMatchData.potentialBuyerIds.includes(comp.id)) {
          type = 'buyer';
          reason = `Contato corporativo na ${companyName} (Lead de Venda).`;
        } else if (companyMatchData.potentialSellerIds.includes(comp.id)) {
          type = 'seller';
          reason = `Fornecedor na empresa ${companyName}.`;
        }
      }
      
      return {
        contact,
        companyName,
        type,
        x,
        y,
        reason
      };
    });
  }, [currentContact, activeContactsList, currentContactCompany, companyMatchData, companies, activeTab, searchQuery]);

  const clickedCompanyConnections = useMemo(() => {
    if (!clickedCompanyId) return null;
    const clickedComp = companies.find(c => c.id === clickedCompanyId);
    if (!clickedComp) return null;
    return analyzeConnections(clickedComp, companies);
  }, [clickedCompanyId, companies]);

  const isCompanyConnectedToClicked = (compId: string) => {
    if (!clickedCompanyId) return true;
    if (compId === clickedCompanyId) return true;
    if (compId === currentCompany?.id) return true; // Central node is always conceptually connected
    if (!clickedCompanyConnections) return false;
    return (
      clickedCompanyConnections.potentialPartnerIds.includes(compId) ||
      clickedCompanyConnections.potentialBuyerIds.includes(compId) ||
      clickedCompanyConnections.potentialSellerIds.includes(compId) ||
      clickedCompanyConnections.potentialConnectionIds.includes(compId)
    );
  };

  const isContactConnectedToClicked = (contactId: string) => {
    if (!clickedContactId) return true;
    if (contactId === clickedContactId) return true;
    if (contactId === currentContact?.id) return true;
    
    const currentClicked = activeContactsList.find(c => c.id === clickedContactId);
    const targetContact = activeContactsList.find(c => c.id === contactId);
    if (!currentClicked || !targetContact) return false;
    if (currentClicked.companyId === targetContact.companyId) return true;
    
    const comp1 = companies.find(c => c.id === currentClicked.companyId);
    const comp2 = companies.find(c => c.id === targetContact.companyId);
    if (comp1 && comp2) {
      const match = analyzeConnections(comp1, [comp2]);
      return (
        match.potentialPartnerIds.includes(comp2.id) ||
        match.potentialBuyerIds.includes(comp2.id) ||
        match.potentialSellerIds.includes(comp2.id)
      );
    }
    return false;
  };

  // Convert orbit nodes to Cartesian (x, y) coordinates for SVG rendering
  const svgCompanyNodes = useMemo(() => {
    if (!currentCompany) return [];
    return companyOrbitNodes.map(node => {
      const x = 300 + node.orbit * Math.cos(node.angle);
      const y = 300 + node.orbit * Math.sin(node.angle);
      return {
        company: node.company,
        type: node.type,
        x,
        y,
        reason: node.reason
      };
    });
  }, [companyOrbitNodes, currentCompany]);

  const filteredSvgCompanyNodes = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (query === '') return svgCompanyNodes;
    return svgCompanyNodes.filter(node => 
      node.company.name.toLowerCase().includes(query) ||
      node.company.segment.toLowerCase().includes(query) ||
      node.reason.toLowerCase().includes(query)
    );
  }, [svgCompanyNodes, searchQuery]);

  const svgContactNodes = useMemo(() => {
    if (!currentContact) return [];
    return contactOrbitNodes.map(node => {
      const x = 300 + node.orbit * Math.cos(node.angle);
      const y = 300 + node.orbit * Math.sin(node.angle);
      return {
        contact: node.contact,
        companyName: node.companyName,
        type: node.type,
        x,
        y,
        reason: node.reason
      };
    });
  }, [contactOrbitNodes, currentContact]);

  const filteredSvgContactNodes = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (query === '') return svgContactNodes;
    return svgContactNodes.filter(node => 
      node.contact.name.toLowerCase().includes(query) ||
      node.companyName.toLowerCase().includes(query) ||
      node.reason.toLowerCase().includes(query)
    );
  }, [svgContactNodes, searchQuery]);

  const hexPoints = (r: number) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      points.push(`${(r * Math.cos(angle)).toFixed(1)},${(r * Math.sin(angle)).toFixed(1)}`);
    }
    return points.join(' ');
  };

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100" id="connections_view">
      
      {/* 1. Header with Mode Switcher & Filter Buttons */}
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Ecosystem Constellation
            </span>
            <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 text-amber-600 dark:text-amber-400 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center space-x-1">
              <Sparkles className="h-3 w-3" />
              <span>RADAR DE SINERGIA v2.5</span>
            </span>
          </div>
          <h3 className="text-xl font-black font-display text-slate-800 dark:text-white tracking-tight">Círculo de Conexões Inteligentes</h3>
          <p className="text-xs text-slate-400 dark:text-slate-400">Clique em qualquer nó orbital para aproximar o radar e analisar as sinergias cruzadas.</p>
        </div>

        {/* View Mode & Layout Style Switchers */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Real-time search field */}
          <div className="relative shrink-0 w-full sm:w-56">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar no radar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 focus:border-indigo-500 rounded-xl text-xs w-full focus:outline-none font-bold text-slate-700 dark:text-slate-300 shadow-3xs"
            />
          </div>

          {/* Entity Selector: Companies vs Entrepreneurs */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewMode('companies')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'companies'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Empresas</span>
            </button>
            
            <button
              onClick={() => setViewMode('entrepreneurs')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'entrepreneurs'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Empresários</span>
            </button>
          </div>

          {/* Visual Layout: Constellation vs Tabular Grid */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setLayoutStyle('constellation')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                layoutStyle === 'constellation'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              title="Visualizar constelação orbital de nós de conexões"
            >
              <span>🌌 Constelação</span>
            </button>

            <button
              onClick={() => setLayoutStyle('grid')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                layoutStyle === 'grid'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              title="Visualizar em formato de painel de grade estruturada"
            >
              <Grid className="h-3.5 w-3.5" />
              <span>Painel</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* 2. Interactive Info Sidebar */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 flex flex-col justify-between shadow-sm space-y-6">
          <div className="space-y-6">
            
            {viewMode === 'companies' ? (
              // --- COMPANY INFORMATION SIDEBAR ---
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selecionar Empresa no Radar</p>
                  <select
                    value={currentCompany?.id || ''}
                    onChange={(e) => {
                      const comp = companies.find(c => c.id === e.target.value);
                      if (comp) handleCompanySelect(comp);
                    }}
                    className="w-full text-xs font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 shadow-2xs"
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {currentCompany && (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3.5">
                      <div>
                        <span className="text-[9px] bg-indigo-50 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-extrabold px-2 py-0.5 rounded-full uppercase">
                          {currentCompany.segment}
                        </span>
                        <h4 className="text-base font-black text-slate-800 dark:text-white mt-1.5 tracking-tight">{currentCompany.name}</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5 flex items-center">
                          <MapPin className="h-3 w-3 mr-1" /> {currentCompany.location} • {currentCompany.vidas} vidas
                        </p>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 border-t border-slate-200/60 dark:border-slate-800/60 pt-3">
                        <p className="line-clamp-3 italic text-[11px] text-slate-500 dark:text-slate-400">"{currentCompany.description}"</p>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                          <strong>Atividade Comercial:</strong> {currentCompany.activity}
                        </p>
                      </div>
                    </div>

                    {/* Mapped decision-makers list with direct trigger link to switch views */}
                    <div className="space-y-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Decisores / Empresários</p>
                      <div className="space-y-2">
                        {companyContacts.map(contact => (
                          <div 
                            key={contact.id}
                            onClick={() => {
                              setSelectedContact(contact);
                              setViewMode('entrepreneurs');
                            }}
                            className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all flex items-center justify-between cursor-pointer group"
                            title="Visualizar este empresário no radar orbital"
                          >
                            <div className="flex items-center space-x-2.5">
                              <span className="h-6 w-6 rounded-lg bg-indigo-100 text-indigo-700 font-black text-[9px] flex items-center justify-center">
                                {getInitials(contact.name)}
                              </span>
                              <div>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{contact.name}</p>
                                <p className="text-[9px] text-slate-400 dark:text-slate-400">{contact.email}</p>
                              </div>
                            </div>
                            <ArrowRightLeft className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                          </div>
                        ))}
                        {companyContacts.length === 0 && (
                          <p className="text-xs text-slate-400 italic">Nenhum decisor cadastrado para esta empresa.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // --- ENTREPRENEUR (PEOPLE) INFORMATION SIDEBAR ---
              <div className="space-y-5 animate-fadeIn">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selecionar Empresário no Radar</p>
                  <select
                    value={currentContact?.id || ''}
                    onChange={(e) => {
                      const cont = activeContactsList.find(c => c.id === e.target.value);
                      if (cont) setSelectedContact(cont);
                    }}
                    className="w-full text-xs font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 shadow-2xs"
                  >
                    {activeContactsList.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {currentContact && (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3.5">
                      <div className="flex items-start space-x-3">
                        <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                          {getInitials(currentContact.name)}
                        </div>
                        <div>
                          <span className="text-[9px] bg-amber-50 dark:bg-amber-900/60 text-amber-700 border border-amber-100 dark:border-amber-800/40 font-extrabold px-2 py-0.5 rounded-full uppercase">
                            Empresário / Decisor
                          </span>
                          <h4 className="text-sm font-black text-slate-800 dark:text-white mt-1 tracking-tight">{currentContact.name}</h4>
                          {currentContactCompany && (
                            <button 
                              onClick={() => handleCompanySelect(currentContactCompany)}
                              className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center text-left"
                            >
                              <Building2 className="h-3 w-3 mr-1" />
                              {currentContactCompany.name}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 border-t border-slate-200 dark:border-slate-800/80 pt-3">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400"><strong>Contato:</strong> {currentContact.email}</p>
                        {currentContact.phone && <p className="text-[10px] text-slate-500 dark:text-slate-400"><strong>Telefone:</strong> {currentContact.phone}</p>}
                      </div>
                    </div>

                    {/* Attended events list */}
                    <div className="space-y-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Participações em Eventos</p>
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {selectedContactEvents.map((evt, idx) => (
                          <div key={idx} className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-slate-100 dark:border-slate-800/60 flex items-center space-x-2 shadow-2xs">
                            <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                            <span className="text-[10px] text-slate-700 dark:text-slate-300 font-bold truncate" title={evt}>{evt}</span>
                          </div>
                        ))}
                        {selectedContactEvents.length === 0 && (
                          <p className="text-xs text-slate-400 italic">Nenhum evento registrado para este empresário.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Orbit Filter Controls */}
            <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Filtrar Órbitas</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  Todas as Órbitas
                </button>
                <button
                  onClick={() => setActiveTab('partner')}
                  className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold border flex items-center justify-center space-x-1 transition-colors cursor-pointer ${
                    activeTab === 'partner'
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Handshake className="h-3 w-3" />
                  <span>Parcerias</span>
                </button>
                <button
                  onClick={() => setActiveTab('sell')}
                  className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold border flex items-center justify-center space-x-1 transition-colors cursor-pointer ${
                    activeTab === 'sell'
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <ArrowUpRight className="h-3 w-3" />
                  <span>Compradores</span>
                </button>
                <button
                  onClick={() => setActiveTab('buy')}
                  className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold border flex items-center justify-center space-x-1 transition-colors cursor-pointer ${
                    activeTab === 'buy'
                      ? 'bg-amber-600 border-amber-600 text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <ArrowDownLeft className="h-3 w-3" />
                  <span>Vendedores</span>
                </button>
              </div>
            </div>

          </div>

          {/* Legenda de órbitas de conexões */}
          <div className="border-t border-slate-200 pt-4 text-[10px] space-y-2 text-slate-500">
            <p className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Legenda de Órbitas</p>
            <div className="flex items-center space-x-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>Interna: Sinergia de Parceria</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
              <span>Média: Clientes Potenciais (Compram)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>Externa: Fornecedores Potenciais (Vendem)</span>
            </div>
          </div>
        </div>

        {/* 3. Radial Interactive Constellation (SVG) or Strategic Affinity Grid */}
        <div className={`xl:col-span-3 p-6 flex flex-col rounded-2xl border relative overflow-hidden transition-all duration-300 ${
          isFullscreen 
            ? 'fixed inset-0 w-screen h-screen z-50 bg-[#05070c] border-none rounded-none items-center justify-center shadow-none'
            : layoutStyle === 'constellation' 
            ? 'bg-[#05070c] border-slate-800 items-center justify-center min-h-[520px] shadow-2xl' 
            : 'bg-white dark:bg-[#0f172a] border-slate-200/90 dark:border-slate-800 items-stretch justify-start min-h-[520px] shadow-sm space-y-5'
        }`}>
          {!isAnalysisExecuted ? (
            <div className="flex flex-col items-center justify-center text-center p-8 min-h-[440px] w-full space-y-6 my-auto">
              <div className="h-16 w-16 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 shadow-sm animate-pulse">
                <Network className="h-8 w-8" />
              </div>
              <div className="space-y-2 max-w-md">
                <h4 className="text-lg font-black font-display text-slate-800 dark:text-white tracking-tight">Constelação de Ecossistema Suspensa</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Para visualizar o radar de proximidade bilateral, órbitas de sinergias (compradores, fornecedores e parceiros estratégicos) e o grafo de decisores, execute a análise de IA no topo.
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
          ) : layoutStyle === 'constellation' ? (
            <>
              {/* Constellation Header Company/Entrepreneur Switcher */}
              <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 bg-slate-900/95 border border-slate-800 px-3.5 py-2 rounded-xl backdrop-blur-md shadow-2xl">
                <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  <span>Foco Central:</span>
                </span>
                {viewMode === 'companies' ? (
                  <select
                    value={currentCompany?.id || ''}
                    onChange={(e) => {
                      const comp = companies.find(c => c.id === e.target.value);
                      if (comp) handleCompanySelect(comp);
                    }}
                    className="bg-slate-950 text-xs font-black text-white focus:outline-none border border-slate-800 rounded-lg px-2 py-1 cursor-pointer"
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                        🏢 {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={currentContact?.id || ''}
                    onChange={(e) => {
                      const cont = activeContactsList.find(c => c.id === e.target.value);
                      if (cont) setSelectedContact(cont);
                    }}
                    className="bg-slate-950 text-xs font-black text-white focus:outline-none border border-slate-800 rounded-lg px-2 py-1 cursor-pointer"
                  >
                    {activeContactsList.map(c => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                        👤 {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Constellation Tooltip Overlay */}
              {hoveredNode ? (
                <div className="absolute top-16 left-4 right-4 bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-lg border border-slate-800 transition-all z-10 space-y-1 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-1.5 mb-1.5">
                    <span className={`font-black uppercase tracking-wider text-[10px] ${getThemeColor(hoveredNode.type).text}`}>
                      {hoveredNode.type === 'center'
                        ? 'Foco Central'
                        : hoveredNode.type === 'buyer' 
                        ? 'Oportunidade de Venda' 
                        : hoveredNode.type === 'seller' 
                        ? 'Fornecedor Estratégico' 
                        : hoveredNode.type === 'partner' 
                        ? 'Aliança de Parceria' 
                        : 'Conexão Geral'}
                    </span>
                    <span className="text-slate-500 text-[9px] font-bold">Grid Hexagonal de Parcerias</span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-200">
                    <strong>{hoveredNode.name}:</strong> {hoveredNode.reason}
                  </p>
                  <p className="text-[9px] text-indigo-400 font-bold uppercase mt-1">
                    👉 Clique para iluminar conexões • Duplo-clique para focar o radar
                  </p>
                </div>
              ) : (
                <div className="absolute top-16 left-4 text-[10px] text-slate-400 flex items-center space-x-1.5 z-10 bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
                  <Info className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Hexágono Ativo: Clique para iluminar conexões, duplo-clique para focar o radar.</span>
                </div>
              )}

              {/* Zoom & Pan Controls Overlay */}
              <div className="absolute bottom-4 right-4 flex items-center space-x-2 bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl backdrop-blur-md z-10">
                <button 
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} 
                  className="px-2.5 py-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-xs font-black transition-all cursor-pointer"
                  title="Afastar"
                >
                  -
                </button>
                <span className="text-[10px] text-indigo-400 font-mono font-bold w-12 text-center select-none">
                  {Math.round(zoom * 100)}%
                </span>
                <button 
                  onClick={() => setZoom(z => Math.min(2.5, z + 0.25))} 
                  className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-xs font-black transition-all cursor-pointer"
                  title="Aproximar"
                >
                  +
                </button>
                <button 
                  onClick={() => { setZoom(1.0); setPanX(0); setPanY(0); setClickedCompanyId(null); setClickedContactId(null); }} 
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  title="Limpar e Centralizar"
                >
                  ↺
                </button>
                <button 
                  onClick={() => setIsFullscreen(!isFullscreen)} 
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center"
                  title={isFullscreen ? "Sair de Tela Cheia" : "Tela Cheia"}
                >
                  {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Close Fullscreen Overlay Button */}
              {isFullscreen && (
                <button 
                  onClick={() => setIsFullscreen(false)}
                  className="absolute top-4 right-4 z-20 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs px-3.5 py-2.5 rounded-xl shadow-lg flex items-center space-x-1.5 transition-all cursor-pointer border border-rose-500/30"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span>Sair da Tela Cheia</span>
                </button>
              )}

              <svg 
                className={`w-full ${isFullscreen ? 'max-w-[85vh]' : 'max-w-[620px]'} aspect-square select-none cursor-grab active:cursor-grabbing`} 
                viewBox="0 0 600 620"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <defs>
                  <radialGradient id="centralGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.4" />
                    <stop offset="60%" stopColor="#4338ca" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#05070c" stopOpacity="0" />
                  </radialGradient>
                  
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  
                  <filter id="shadow">
                    <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.5" />
                  </filter>
                </defs>

                {/* Background ambient glow effect */}
                <circle cx="300" cy="300" r="180" fill="url(#centralGlow)" />

                {/* Main scaled and panned group */}
                <g transform={`translate(${300 + panX}, ${300 + panY}) scale(${zoom}) translate(-300, -300)`}>
                  
                  {/* Concentric Orbit Circles in the cosmic background */}
                  <circle cx="300" cy="300" r="110" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
                  <circle cx="300" cy="300" r="195" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
                  <circle cx="300" cy="300" r="280" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />

                  {/* Orbit concentric track labels */}
                  <text x="300" y="182" textAnchor="middle" fill="#34d399" fontSize="7.5" fontWeight="black" letterSpacing="1" opacity="0.45" className="select-none pointer-events-none">ÓRBITA INTERNA: PARCERIAS</text>
                  <text x="300" y="97" textAnchor="middle" fill="#818cf8" fontSize="7.5" fontWeight="black" letterSpacing="1" opacity="0.45" className="select-none pointer-events-none">ÓRBITA MÉDIA: COMPRADORES</text>
                  <text x="300" y="12" textAnchor="middle" fill="#fbbf24" fontSize="7.5" fontWeight="black" letterSpacing="1" opacity="0.45" className="select-none pointer-events-none">ÓRBITA EXTERNA: VENDEDORES</text>

                  {viewMode === 'companies' ? (
                    // ==================== ORBITAL ECOSYSTEM COMPANIES ====================
                    <>
                      {/* Connection lines from central focus to orbital nodes */}
                      {filteredSvgCompanyNodes.map((node) => {
                        const isMainClicked = clickedCompanyId !== null;
                        const isTargetConnected = isCompanyConnectedToClicked(node.company.id);
                        const isSourceClicked = clickedCompanyId === node.company.id;
                        
                        let sourceX = 300;
                        let sourceY = 300;
                        
                        if (isMainClicked) {
                          const clickedNode = filteredSvgCompanyNodes.find(n => n.company.id === clickedCompanyId);
                          if (clickedNode) {
                            sourceX = clickedNode.x;
                            sourceY = clickedNode.y;
                          }
                        }
                        
                        const colors = getThemeColor(node.type);
                        const isHighlighted = isMainClicked && isTargetConnected;
                        const isLineVisible = !isMainClicked || (isMainClicked && (isTargetConnected || isSourceClicked));
                        
                        if (!isLineVisible) return null;
                        
                        return (
                          <line
                            key={`orbit_line_${node.company.id}_${node.type}`}
                            x1={sourceX}
                            y1={sourceY}
                            x2={node.x}
                            y2={node.y}
                            stroke={colors.stroke}
                            strokeWidth={isHighlighted ? '3.5' : '1.5'}
                            strokeOpacity={isHighlighted ? '1.0' : '0.22'}
                            strokeDasharray={node.type === 'partner' ? 'none' : '4 4'}
                            filter={isHighlighted ? 'url(#glow)' : undefined}
                            className="transition-all duration-300"
                          />
                        );
                      })}

                      {/* Render Central Company Node */}
                      {currentCompany && (
                        <g
                          transform="translate(300, 300)"
                          filter="url(#shadow)"
                          className="cursor-pointer transition-all duration-300"
                          onMouseEnter={() => setHoveredNode({ 
                            name: currentCompany.name, 
                            subtitle: currentCompany.segment,
                            reason: 'Esta é a empresa foco central selecionada no radar.', 
                            type: 'center' 
                          })}
                          onMouseLeave={() => setHoveredNode(null)}
                        >
                          <polygon 
                            points={hexPoints(33)} 
                            fill="none" 
                            stroke="#4f46e5" 
                            strokeWidth="3.5" 
                            className="animate-pulse"
                            filter="url(#glow)"
                          />
                          <polygon 
                            points={hexPoints(26)} 
                            fill="#312e81" 
                            stroke="#818cf8" 
                            strokeWidth="3" 
                          />
                          <circle 
                            cx="0" 
                            cy="0" 
                            r="15" 
                            fill="#1e1b4b" 
                            stroke="#818cf8" 
                            strokeWidth="1.2" 
                          />
                          <text
                            x="0"
                            y="0"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#ffffff"
                            fontSize="10"
                            fontWeight="black"
                            className="pointer-events-none select-none font-mono"
                          >
                            {getInitials(currentCompany.name)}
                          </text>
                          <text
                            x="0"
                            y="44"
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="9.5"
                            fontWeight="black"
                            className="pointer-events-none select-none font-sans drop-shadow-md"
                          >
                            {currentCompany.name}
                          </text>
                        </g>
                      )}

                      {/* Render Orbital Company Nodes */}
                      {filteredSvgCompanyNodes.map((node) => {
                        const colors = getThemeColor(node.type);
                        const isHovered = hoveredNode && hoveredNode.name === node.company.name;
                        const isMainClicked = clickedCompanyId !== null;
                        const isNodeConnected = isCompanyConnectedToClicked(node.company.id);
                        
                        const isTransparent = isMainClicked && !isNodeConnected;
                        const isGlowing = isMainClicked && isNodeConnected;
                        
                        return (
                          <g
                            key={`orbit_node_${node.company.id}_${node.type}`}
                            transform={`translate(${node.x}, ${node.y})`}
                            filter="url(#shadow)"
                            className="cursor-pointer transition-all duration-300"
                            style={{ opacity: isTransparent ? 0.12 : 1.0 }}
                            onClick={() => {
                              setClickedCompanyId(clickedCompanyId === node.company.id ? null : node.company.id);
                            }}
                            onDoubleClick={() => {
                              handleCompanySelect(node.company);
                            }}
                            onMouseEnter={() => setHoveredNode({ 
                              name: node.company.name, 
                              subtitle: node.company.segment,
                              reason: node.reason, 
                              type: node.type 
                            })}
                            onMouseLeave={() => setHoveredNode(null)}
                          >
                            {(isGlowing || isHovered) && (
                              <polygon 
                                points={hexPoints(31)} 
                                fill="none" 
                                stroke={colors.stroke} 
                                strokeWidth="3" 
                                className="animate-pulse"
                                filter="url(#glow)"
                              />
                            )}

                            <polygon 
                              points={hexPoints(24)} 
                              fill="#090d16" 
                              stroke={colors.stroke} 
                              strokeWidth={isHovered ? '2.5' : '1.5'} 
                            />

                            <circle 
                              cx="0" 
                              cy="0" 
                              r="15" 
                              fill="#0e1726" 
                              stroke="#1e293b" 
                              strokeWidth="1" 
                            />

                            <text
                              x="0"
                              y="0"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#ffffff"
                              fontSize="9.5"
                              fontWeight="black"
                              className="pointer-events-none select-none font-mono"
                            >
                              {getInitials(node.company.name)}
                            </text>

                            <circle 
                              cx="14" 
                              cy="-14" 
                              r="4.5" 
                              fill={colors.stroke} 
                            />

                            <text
                              x="0"
                              y="36"
                              textAnchor="middle"
                              fill={isHovered || isGlowing ? '#f8fafc' : '#64748b'}
                              fontSize="8"
                              fontWeight={isGlowing ? 'black' : 'bold'}
                              className="pointer-events-none select-none transition-colors duration-200"
                            >
                              {node.company.name.slice(0, 11)}{node.company.name.length > 11 ? '..' : ''}
                            </text>
                          </g>
                        );
                      })}
                    </>
                  ) : (
                    // ==================== ORBITAL ECOSYSTEM ENTREPRENEURS ====================
                    <>
                      {/* Connection lines from central focus to orbital contact nodes */}
                      {filteredSvgContactNodes.map((node) => {
                        const isMainClicked = clickedContactId !== null;
                        const isTargetConnected = isContactConnectedToClicked(node.contact.id);
                        const isSourceClicked = clickedContactId === node.contact.id;
                        
                        let sourceX = 300;
                        let sourceY = 300;
                        
                        if (isMainClicked) {
                          const clickedNode = filteredSvgContactNodes.find(n => n.contact.id === clickedContactId);
                          if (clickedNode) {
                            sourceX = clickedNode.x;
                            sourceY = clickedNode.y;
                          }
                        }
                        
                        const colors = getThemeColor(node.type);
                        const isHighlighted = isMainClicked && isTargetConnected;
                        const isLineVisible = !isMainClicked || (isMainClicked && (isTargetConnected || isSourceClicked));
                        
                        if (!isLineVisible) return null;
                        
                        return (
                          <line
                            key={`orbit_cont_line_${node.contact.id}`}
                            x1={sourceX}
                            y1={sourceY}
                            x2={node.x}
                            y2={node.y}
                            stroke={colors.stroke}
                            strokeWidth={isHighlighted ? '3.5' : '1.5'}
                            strokeOpacity={isHighlighted ? '1.0' : '0.22'}
                            strokeDasharray="3 3"
                            filter={isHighlighted ? 'url(#glow)' : undefined}
                            className="transition-all duration-300"
                          />
                        );
                      })}

                      {/* Render Central Entrepreneur Node */}
                      {currentContact && (
                        <g
                          transform="translate(300, 300)"
                          filter="url(#shadow)"
                          className="cursor-pointer transition-all duration-300"
                          onMouseEnter={() => setHoveredNode({ 
                            name: currentContact.name, 
                            subtitle: currentContactCompany?.name || 'Independente',
                            reason: 'Este é o decisor/empresário raiz (foco central) selecionado no radar.', 
                            type: 'center' 
                          })}
                          onMouseLeave={() => setHoveredNode(null)}
                        >
                          <polygon 
                            points={hexPoints(33)} 
                            fill="none" 
                            stroke="#10b981" 
                            strokeWidth="3.5" 
                            className="animate-pulse"
                            filter="url(#glow)"
                          />
                          <polygon 
                            points={hexPoints(26)} 
                            fill="#065f46" 
                            stroke="#34d399" 
                            strokeWidth="3" 
                          />
                          <circle 
                            cx="0" 
                            cy="0" 
                            r="15" 
                            fill="#064e3b" 
                            stroke="#34d399" 
                            strokeWidth="1.2" 
                          />
                          <text
                            x="0"
                            y="0"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#ffffff"
                            fontSize="10"
                            fontWeight="black"
                            className="pointer-events-none select-none font-mono"
                          >
                            {getInitials(currentContact.name)}
                          </text>
                          <text
                            x="0"
                            y="44"
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="9.5"
                            fontWeight="black"
                            className="pointer-events-none select-none font-sans drop-shadow-md"
                          >
                            {currentContact.name}
                          </text>
                        </g>
                      )}

                      {/* Render Orbital Contact Nodes */}
                      {filteredSvgContactNodes.map((node) => {
                        const colors = getThemeColor(node.type);
                        const isHovered = hoveredNode && hoveredNode.name === node.contact.name;
                        const isMainClicked = clickedContactId !== null;
                        const isNodeConnected = isContactConnectedToClicked(node.contact.id);
                        
                        const isTransparent = isMainClicked && !isNodeConnected;
                        const isGlowing = isMainClicked && isNodeConnected;
                        
                        return (
                          <g
                            key={`orbit_cont_node_${node.contact.id}`}
                            transform={`translate(${node.x}, ${node.y})`}
                            filter="url(#shadow)"
                            className="cursor-pointer transition-all duration-300"
                            style={{ opacity: isTransparent ? 0.12 : 1.0 }}
                            onClick={() => {
                              setClickedContactId(clickedContactId === node.contact.id ? null : node.contact.id);
                            }}
                            onMouseEnter={() => setHoveredNode({ 
                              name: node.contact.name, 
                              subtitle: node.companyName,
                              reason: node.reason, 
                              type: node.type 
                            })}
                            onMouseLeave={() => setHoveredNode(null)}
                          >
                            {(isGlowing || isHovered) && (
                              <polygon 
                                points={hexPoints(31)} 
                                fill="none" 
                                stroke={colors.stroke} 
                                strokeWidth="3" 
                                className="animate-pulse"
                                filter="url(#glow)"
                              />
                            )}

                            <polygon 
                              points={hexPoints(24)} 
                              fill="#050a12" 
                              stroke={colors.stroke} 
                              strokeWidth={isHovered ? '2.5' : '1.5'} 
                            />

                            <circle 
                              cx="0" 
                              cy="0" 
                              r="15" 
                              fill="#0a1424" 
                              stroke="#1e293b" 
                              strokeWidth="1" 
                            />

                            <text
                              x="0"
                              y="0"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#ffffff"
                              fontSize="9.5"
                              fontWeight="black"
                              className="pointer-events-none select-none font-mono"
                            >
                              {getInitials(node.contact.name)}
                            </text>

                            <circle 
                              cx="14" 
                              cy="-14" 
                              r="4.5" 
                              fill={colors.stroke} 
                            />

                            <text
                              x="0"
                              y="36"
                              textAnchor="middle"
                              fill={isHovered || isGlowing ? '#f8fafc' : '#64748b'}
                              fontSize="8"
                              fontWeight={isGlowing ? 'black' : 'bold'}
                              className="pointer-events-none select-none transition-colors duration-200"
                            >
                              {node.contact.name.split(' ')[0]}
                            </text>
                          </g>
                        );
                      })}
                    </>
                  )}

                </g>
              </svg>

              {/* Empty Orbit Helper Screen */}
              {((viewMode === 'companies' && filteredSvgCompanyNodes.length === 0) || 
                (viewMode === 'entrepreneurs' && filteredSvgContactNodes.length === 0)) && (
                <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-2 rounded-2xl">
                  <HelpCircle className="h-10 w-10 text-slate-500" />
                  <p className="font-bold text-slate-200">Sem correspondências sob este filtro</p>
                  <p className="text-xs text-slate-400 max-w-sm">Tente limpar a pesquisa para exibir os nós do ecossistema.</p>
                </div>
              )}
            </>
          ) : (
            // ==================== STRATEGIC AFFINITY HIGH-DENSITY GRID ====================
            <div className="space-y-4 animate-fadeIn">
              {/* Search and Metadata Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-800 flex items-center space-x-2">
                    <span>Caminhos de Afinidade Estratégica</span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-extrabold font-mono border border-indigo-100">
                      {viewMode === 'companies' ? filteredCompanyNodes.length : filteredContactNodes.length} conexões
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Foco central atual: <strong className="text-indigo-600">{viewMode === 'companies' ? currentCompany?.name : currentContact?.name}</strong>
                  </p>
                </div>

                {/* Filter Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar por nome, setor ou sinergia..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-1.5 border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 rounded-xl text-xs w-full sm:w-64 focus:outline-none font-bold text-slate-700 shadow-3xs"
                  />
                </div>
              </div>

              {/* Grid content */}
              {viewMode === 'companies' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[460px] overflow-y-auto pr-1">
                    {filteredCompanyNodes.map((node) => {
                      const colors = getThemeColor(node.type);
                      const isSelf = node.company.id === currentCompany?.id;
                      if (isSelf) return null;

                      // Dynamic score calculation
                      const affinityScore = calculateCompanyAffinity(currentCompany!, node.company, transactions);

                      return (
                        <div 
                          key={`${node.company.id}_${node.type}`}
                          className="border border-slate-200 hover:border-indigo-300 bg-white p-4 rounded-xl flex flex-col justify-between transition-all group hover:shadow-sm"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md ${colors.lightBg} ${colors.text} border ${colors.border}`}>
                                  {node.type === 'buyer' 
                                    ? 'Comprador (Venda)' 
                                    : node.type === 'seller' 
                                    ? 'Fornecedor (Compra)' 
                                    : node.type === 'partner' 
                                    ? 'Parceiro Comercial' 
                                    : 'Outra Conexão'}
                                </span>
                                <h5 className="font-extrabold text-sm text-slate-800 group-hover:text-indigo-600 transition-colors leading-tight">
                                  {node.company.name}
                                </h5>
                              </div>

                              {/* Affinity Badge */}
                              <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1 text-center min-w-[50px]">
                                <span className="text-[11px] font-black text-indigo-700 font-mono">{affinityScore}%</span>
                                <p className="text-[7.5px] font-extrabold text-indigo-500 uppercase tracking-wider leading-none">FIT</p>
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                              {node.reason}
                            </p>

                            <div className="flex flex-wrap gap-1.5 text-[9.5px] text-slate-400 font-bold">
                              <span className="bg-slate-100/60 px-2 py-0.5 rounded-md flex items-center">
                                <MapPin className="h-2.5 w-2.5 mr-1 text-slate-400" /> {node.company.location}
                              </span>
                              <span className="bg-slate-100/60 px-2 py-0.5 rounded-md flex items-center">
                                <Building2 className="h-2.5 w-2.5 mr-1 text-slate-400" /> {node.company.vidas} vidas
                              </span>
                              <span className="bg-slate-100/60 px-2 py-0.5 rounded-md flex items-center">
                                <Users className="h-2.5 w-2.5 mr-1 text-slate-400" /> {node.company.segment}
                              </span>
                            </div>
                          </div>

                          <div className="border-t border-slate-100 pt-3 mt-3 flex items-center justify-between">
                            <button
                              onClick={() => handleCompanySelect(node.company)}
                              className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg transition-colors"
                            >
                              <span>Focar Radar Aqui</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                            <span className="text-[8.5px] text-slate-400 font-extrabold bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded uppercase">
                              {getCompanyArchetype(node.company, companies).label}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {filteredCompanyNodes.length === 0 && (
                      <div className="col-span-2 py-12 text-center text-slate-400">
                        <p className="font-bold">Nenhum resultado encontrado para "{searchQuery}"</p>
                        <p className="text-xs">Tente limpar a barra de filtros.</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[460px] overflow-y-auto pr-1">
                    {filteredContactNodes.map((node) => {
                      const colors = getThemeColor(node.type);
                      const isSelf = node.contact.id === currentContact?.id;
                      if (isSelf) return null;

                      return (
                        <div 
                          key={node.contact.id}
                          className="border border-slate-200 hover:border-emerald-300 bg-white p-4 rounded-xl flex flex-col justify-between transition-all group hover:shadow-sm"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md ${colors.lightBg} ${colors.text} border ${colors.border}`}>
                                  {node.type === 'buyer' ? 'Cliente Potencial' : node.type === 'seller' ? 'Fornecedor' : node.type === 'partner' ? 'Parceiro' : 'Relacionamento'}
                                </span>
                                <h5 className="font-extrabold text-sm text-slate-800 group-hover:text-emerald-600 transition-colors leading-tight">
                                  {node.contact.name}
                                </h5>
                                <p className="text-[10px] text-indigo-600 font-bold flex items-center">
                                  <Building2 className="h-3 w-3 mr-1" /> {node.companyName}
                                </p>
                              </div>

                              <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center border border-slate-200">
                                {getInitials(node.contact.name)}
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                              {node.reason}
                            </p>

                            <div className="text-[9.5px] text-slate-400 font-bold">
                              <span>📧 {node.contact.email}</span>
                            </div>
                          </div>

                          <div className="border-t border-slate-100 pt-3 mt-3 flex items-center justify-between">
                            <button
                              onClick={() => setSelectedContact(node.contact)}
                              className="text-[10px] font-black text-emerald-600 hover:text-emerald-800 flex items-center space-x-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-lg transition-colors"
                            >
                              <span>Selecionar Empresário</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                            {node.contact.phone && (
                              <span className="text-[9.5px] text-slate-400 font-mono font-bold">
                                📞 {node.contact.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {filteredContactNodes.length === 0 && (
                      <div className="col-span-2 py-12 text-center text-slate-400">
                        <p className="font-bold">Nenhum resultado encontrado para "{searchQuery}"</p>
                        <p className="text-xs">Tente limpar a barra de filtros.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
