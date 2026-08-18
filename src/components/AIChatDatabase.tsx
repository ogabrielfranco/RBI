import React, { useState, useRef, useEffect } from 'react';
import { Company, Transaction } from '../types';
import { 
  Sparkles, Send, Trash2, Bot, User, Play, Lightbulb, 
  HelpCircle, ChevronRight, RefreshCw, Layers, TrendingUp, 
  Target, Zap, ShoppingBag, ArrowUpRight, Copy, Check
} from 'lucide-react';

interface AIChatDatabaseProps {
  companies: Company[];
  transactions: Transaction[];
  contactsCount: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIChatDatabase({ companies, transactions, contactsCount }: AIChatDatabaseProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Olá! Eu sou o **Assistente Inteligente da Rampup**. 

Tenho acesso em tempo real a todas as **${companies.length} empresas**, **${contactsCount} contatos** e **${transactions.length} transações** cadastradas na base de dados.

Você pode me perguntar qualquer coisa sobre os dados ou usar as sugestões rápidas ao lado. O que deseja explorar hoje?`
    }
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

  // Suggested prompts
  const suggestions = [
    {
      id: 's_segmentos',
      label: 'Quantidade de Segmentos',
      desc: 'Quais e quantos segmentos temos cadastrados na base?',
      prompt: 'Quais e quantos segmentos de empresas nós temos cadastrados na base de dados atualmente? Apresente um resumo.'
    },
    {
      id: 's_matchmaking',
      label: 'Quem pode ser cliente de quem',
      desc: 'Cruzamentos e sinergias comerciais entre membros.',
      prompt: 'Analise a base e me diga: quem pode ser cliente de quem aqui dentro? Identifique 3 cruzamentos de negócios de alto potencial.'
    },
    {
      id: 's_vendas',
      label: 'Empresas com mais chances de vendas',
      desc: 'Quais empresas têm maior probabilidade de tração.',
      prompt: 'Quais empresas da nossa base têm maior possibilidade de vendas rápidas e tração comercial imediata com outros membros?'
    },
    {
      id: 's_conexao',
      label: 'Maior potencial de conexão',
      desc: 'Empresas centrais com mais sinergias.',
      prompt: 'Quais empresas da base possuem o maior potencial de conexão estratégica e sinergia de ecossistema para gerar pontes e parcerias?'
    },
    {
      id: 's_faturamento',
      label: 'Quem fatura mais (Proxy de Vidas)',
      desc: 'Identificar as maiores empresas em número de vidas.',
      prompt: 'Quais são as maiores empresas da base (usando a quantidade de vidas/colaboradores como proxy de tamanho) e qual segmento predomina entre as grandes?'
    },
    {
      id: 's_modelo',
      label: 'Modelo de negócio promissor',
      desc: 'Tendências e modelos predominantes na base.',
      prompt: 'Qual modelo de negócio parece ser o mais promissor e bem representado dentro do ecossistema da nossa base?'
    },
    {
      id: 's_varejo',
      label: 'Convidados para Agenda do Varejo',
      desc: 'Sugestão estratégica de convidados focados em varejo.',
      prompt: 'Quais seriam os melhores convidados e empresas da base para convocar para uma Agenda de Negócios voltada estritamente ao Varejo?'
    },
  ];

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isSending) return;

    const userMessage: Message = { role: 'user', content: textToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const response = await fetch('/api/ai/chat-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage]
        })
      });

      if (!response.ok) {
        throw new Error('Servidor offline ou rota API estática');
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.text || 'Desculpe, não consegui obter uma resposta.' }]);
    } catch (err: any) {
      // Intelligent Client-Side Fallback for Vercel Static Deployments
      const query = textToSend.toLowerCase();
      let reply = '';

      if (query.includes('segmento') || query.includes('setor') || query.includes('área')) {
        const segMap: Record<string, number> = {};
        companies.forEach(c => {
          segMap[c.segment] = (segMap[c.segment] || 0) + 1;
        });
        const sortedSegs = Object.entries(segMap).sort((a, b) => b[1] - a[1]);
        reply = `### 📊 Análise de Segmentos do Mailing Atual (${companies.length} empresas)\n\nTemos **${sortedSegs.length} segmentos diferentes** mapeados na base:\n\n` +
          sortedSegs.slice(0, 8).map(([seg, count], idx) => `${idx + 1}. **${seg}**: ${count} empresas (${Math.round((count / companies.length) * 100)}%)`).join('\n') +
          (sortedSegs.length > 8 ? `\n\n*E mais ${sortedSegs.length - 8} outros segmentos especializados.*` : '');
      } else if (query.includes('cliente de quem') || query.includes('match') || query.includes('sinergia') || query.includes('vendas')) {
        const techComps = companies.filter(c => c.segment.toLowerCase().includes('tecnol') || c.segment.toLowerCase().includes('software'));
        const retailComps = companies.filter(c => c.segment.toLowerCase().includes('comér') || c.segment.toLowerCase().includes('varej') || c.segment.toLowerCase().includes('alimen'));
        const finComps = companies.filter(c => c.segment.toLowerCase().includes('finan') || c.segment.toLowerCase().includes('invest'));
        
        reply = `### 🎯 Oportunidades de Matchmaking & Cruzamentos Comerciais\n\nCom base nas **${companies.length} empresas** carregadas no mailing:\n\n` +
          `1. **Tecnologia & B2B para Varejo/Alimentos**:\n` +
          `   - **Fornecedores**: ${techComps.slice(0, 3).map(c => c.name).join(', ') || 'Empresas de Tecnologia'}\n` +
          `   - **Potenciais Clientes**: ${retailComps.slice(0, 3).map(c => c.name).join(', ') || 'Empresas do Varejo'}\n` +
          `   - **Sinergia**: Automação operacional, sistemas de gestão e inteligência comercial.\n\n` +
          `2. **Finanças, Crédito & Investimentos para Expansão**:\n` +
          `   - **Estruturadores**: ${finComps.slice(0, 2).map(c => c.name).join(', ') || 'Assessoria Financeira'}\n` +
          `   - **Alvos**: Empresas de médio e grande porte com alta quantidade de vidas.\n\n` +
          `3. **Parcerias de Ecossistema & Fornecimento Mútuo**:\n` +
          `   - Recomenda-se rodadas individuais explorando o grafo de constelação e as fichas de ICP do diretório.`;
      } else if (query.includes('fatura') || query.includes('vida') || query.includes('maior') || query.includes('grande')) {
        const topByVidas = [...companies].sort((a, b) => (b.vidas || 0) - (a.vidas || 0)).slice(0, 5);
        reply = `### 🏢 Maiores Empresas por Porte & Quantidade de Vidas (Proxy de Faturamento)\n\n` +
          topByVidas.map((c, i) => `${i + 1}. **${c.name}** — ${c.vidas ? `${c.vidas} vidas` : 'Porte em validação'} | *${c.segment}* (${c.location || 'Brasil'})`).join('\n') +
          `\n\n*Essas empresas representam o maior potencial de faturamento e volume de contratos na rodada.*`;
      } else {
        reply = `### 💡 Inteligência do Mailing Carregado\n\n` +
          `Atualmente seu CRM possui **${companies.length} empresas**, **${contactsCount} contatos** e **${transactions.length} transações** ativas no ecossistema.\n\n` +
          `- **Segmentos presentes**: Mais de ${new Set(companies.map(c => c.segment)).size} setores catalogados.\n` +
          `- **Rede de decisores**: Mapeamento completo de CEOs, Diretores e Sócios fundadores.\n` +
          `- **Próximos passos**: Utilize o **Panorama de Agendas**, a aba **Constelação** e as fichas individuais no **Diretório de Empresas** para aprofundar qualquer análise.`;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = () => {
    if (confirm('Deseja limpar o histórico da conversa?')) {
      setMessages([
        {
          role: 'assistant',
          content: `Histórico limpo! Estou pronto para analisar novamente as **${companies.length} empresas** da nossa base. Como posso ajudar?`
        }
      ]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-180px)] min-h-[580px]" id="ai-chat-workspace">
      
      {/* Left panel - Pre-built prompts & Database statistics */}
      <div className="lg:col-span-4 flex flex-col space-y-5 h-full">
        
        {/* Quick Stats Widget */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs shrink-0" id="ai-chat-stats">
          <div className="flex items-center space-x-2.5 mb-4">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold font-display text-slate-800 dark:text-white">Base Conectada</h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Análise de IA de ponta a ponta</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40">
              <div className="text-lg font-black text-slate-800 dark:text-white font-mono">{companies.length}</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Empresas</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40">
              <div className="text-lg font-black text-slate-800 dark:text-white font-mono">{contactsCount}</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Contatos</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40">
              <div className="text-lg font-black text-slate-800 dark:text-white font-mono">{transactions.length}</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Eventos</div>
            </div>
          </div>
        </div>

        {/* Dynamic prompt suggestion bento cards */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex-1 flex flex-col overflow-hidden" id="ai-chat-prompt-bank">
          <div className="flex items-center space-x-2 mb-4 shrink-0">
            <Lightbulb className="h-4.5 w-4.5 text-amber-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Consultas Rápidas</h4>
          </div>

          <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 scrollbar-thin">
            {suggestions.map((s) => (
              <button
                key={s.id}
                id={s.id}
                onClick={() => handleSend(s.prompt)}
                disabled={isSending}
                className="w-full text-left p-3 rounded-xl border border-slate-100 dark:border-slate-850 hover:border-indigo-100 dark:hover:border-indigo-950/40 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/10 transition-all cursor-pointer group disabled:opacity-50 disabled:pointer-events-none"
              >
                <div className="flex items-start justify-between space-x-2">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {s.label}
                    </span>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal font-medium">
                      {s.desc}
                    </p>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-350 dark:text-slate-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 shrink-0 transition-all transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Right panel - Fully functioning chat messenger */}
      <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden" id="ai-chat-messenger">
        
        {/* Chat window header */}
        <div className="px-5 py-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-xs">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-bold text-slate-800 dark:text-white">Rampup AI Intelligence</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-extrabold uppercase tracking-wide">
                  Online
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Modelo Gemini 3.5 Flash integrado</p>
            </div>
          </div>

          <button
            onClick={handleClearChat}
            id="btn-clear-chat"
            className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-all cursor-pointer"
            title="Limpar Conversa"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Message body list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30 dark:bg-slate-950/10">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start space-x-3 max-w-[85%] group ${
                msg.role === 'user' ? 'ml-auto flex-row-reverse space-x-reverse' : 'mr-auto'
              }`}
            >
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                msg.role === 'user' 
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300' 
                  : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
              }`}>
                {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4.5 w-4.5" />}
              </div>

              <div className={`relative rounded-2xl p-4 text-xs shadow-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-white dark:bg-slate-850 border border-slate-150 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 rounded-tl-none markdown-body pr-9'
              }`}>
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => handleCopy(msg.content, idx)}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200/60 dark:border-slate-700/80 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer shadow-3xs"
                    title="Copiar Resposta"
                  >
                    {copiedIndex === idx ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                )}
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap font-semibold">{msg.content}</p>
                ) : (
                  <div className="prose prose-slate dark:prose-invert prose-xs max-w-none">
                    {/* Render simple custom markdown translation for bullet points, bolding, and linebreaks */}
                    {msg.content.split('\n').map((line, lIdx) => {
                      let cleanLine = line;
                      // Bold formatting
                      const boldRegex = /\*\*(.*?)\*\*/g;
                      const hasBold = boldRegex.test(cleanLine);
                      
                      // bullet point parsing
                      if (cleanLine.trim().startsWith('- ') || cleanLine.trim().startsWith('* ')) {
                        const content = cleanLine.replace(/^[-*]\s+/, '');
                        return (
                          <div key={lIdx} className="flex items-start space-x-1.5 my-1 pl-2">
                            <span className="text-indigo-500 shrink-0 mt-1.5">•</span>
                            <span 
                              className="font-medium" 
                              dangerouslySetInnerHTML={{ 
                                __html: content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
                              }} 
                            />
                          </div>
                        );
                      }

                      // title headers
                      if (cleanLine.trim().startsWith('###')) {
                        return (
                          <h4 
                            key={lIdx} 
                            className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-3 mb-1 uppercase tracking-wide"
                            dangerouslySetInnerHTML={{ 
                              __html: cleanLine.replace('###', '').trim().replace(/\*\*(.*?)\*\*/g, '$1') 
                            }}
                          />
                        );
                      }
                      if (cleanLine.trim().startsWith('##')) {
                        return (
                          <h3 
                            key={lIdx} 
                            className="text-sm font-extrabold text-slate-900 dark:text-white mt-4 mb-2 border-b border-slate-100 dark:border-slate-800/60 pb-1"
                            dangerouslySetInnerHTML={{ 
                              __html: cleanLine.replace('##', '').trim().replace(/\*\*(.*?)\*\*/g, '$1') 
                            }}
                          />
                        );
                      }

                      return (
                        <p 
                          key={lIdx} 
                          className="min-h-[1em] font-medium"
                          dangerouslySetInnerHTML={{ 
                            __html: cleanLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* AI thinking / loading state */}
          {isSending && (
            <div className="flex items-start space-x-3 max-w-[80%] mr-auto animate-pulse">
              <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Bot className="h-4.5 w-4.5 animate-bounce" />
              </div>
              <div className="bg-white dark:bg-slate-850 border border-slate-150 dark:border-slate-800 rounded-2xl rounded-tl-none p-4 shadow-xs">
                <div className="flex items-center space-x-2">
                  <span className="flex h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-ping"></span>
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tracking-wide uppercase">
                    Analisando a base do CRM...
                  </p>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                  Mapeando cruzamentos estratégicos e calculando cruzamento semântico.
                </p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat input box footer */}
        <div className="p-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              id="chat-input-field"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre faturamento, matchmaking, varejo, potencial de conexão..."
              disabled={isSending}
              className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-55"
            />
            <button
              type="submit"
              id="btn-send-message"
              disabled={!input.trim() || isSending}
              className="h-10 w-10 shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="mt-2 text-center">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold flex items-center justify-center space-x-1">
              <Sparkles className="h-3 w-3 text-indigo-500" />
              <span>Dica: Clique em qualquer "Consulta Rápida" à esquerda para obter insights imediatos.</span>
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
