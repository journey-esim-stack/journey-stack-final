import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, Loader2, Globe, Clock, Wifi, ShoppingCart, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { getCountryFlag } from '@/utils/countryFlags';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  plans?: PlanData[];
}

interface PlanData {
  id: string;
  title: string;
  country_name: string;
  country_code: string;
  data_amount: string;
  validity_days: number;
  agent_price: number;
  currency: string;
}

interface AIPlanAssistantProps {
  onClose?: () => void;
}

export default function AIPlanAssistant({ onClose }: AIPlanAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! 👋 I'm your AI-powered eSIM assistant. Tell me about your customer's travel needs - destination, duration, and data requirements - and I'll find the perfect plan instantly!",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { addToCart } = useCart();
  const { convertPrice, getCurrencySymbol, selectedCurrency } = useCurrency();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = async (userMessage: string) => {
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Error',
          description: 'Please sign in to use the AI assistant',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `https://cccktfactlzxuprpyhgh.supabase.co/functions/v1/ai-plan-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          toast({
            title: 'Rate Limit',
            description: 'Too many requests. Please wait a moment and try again.',
            variant: 'destructive',
          });
        } else if (response.status === 402) {
          toast({
            title: 'Credits Depleted',
            description: 'AI credits have been used up. Please contact support.',
            variant: 'destructive',
          });
        } else {
          throw new Error('Failed to get AI response');
        }
        setIsLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantContent = '';
      let plansData: PlanData[] | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            
            // Check for tool calls with plan data
            const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;
            if (toolCalls && toolCalls[0]?.function?.arguments) {
              try {
                const args = JSON.parse(toolCalls[0].function.arguments);
                if (args.plans) {
                  plansData = args.plans;
                }
              } catch (e) {
                // Ignore parse errors for partial tool call data
              }
            }
            
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantContent, plans: plansData } : m
                  );
                }
                return [...prev, { role: 'assistant', content: assistantContent, plans: plansData }];
              });
            }
          } catch (e) {
            // Partial JSON, buffer it
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: 'Failed to get AI response. Please try again.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    await streamChat(userMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAddToCart = (plan: PlanData) => {
    const price = convertPrice(Number(plan.agent_price));
    
    addToCart({
      id: plan.id,
      planId: plan.id,
      title: plan.title,
      countryName: plan.country_name,
      countryCode: plan.country_code,
      dataAmount: plan.data_amount,
      validityDays: plan.validity_days,
      agentPrice: price,
      currency: selectedCurrency,
    });

    toast({
      title: "Added to Cart",
      description: `${plan.title} added successfully`,
    });
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-background to-muted/20">
      {/* Header */}
      <div className="p-6 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary/80">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">AI Plan Assistant</h2>
            <p className="text-sm text-muted-foreground">
              Get instant eSIM recommendations powered by AI
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-6" ref={scrollRef}>
        <div className="space-y-6 max-w-4xl mx-auto">
          {messages.map((message, index) => (
            <div key={index}>
              <div
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shrink-0 shadow-lg">
                    <Bot className="w-5 h-5 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-5 py-3 max-w-[75%] shadow-sm ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </p>
                </div>
                {message.role === 'user' && (
                  <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0 shadow-sm">
                    <User className="w-5 h-5 text-accent-foreground" />
                  </div>
                )}
              </div>

              {/* Plan tiles */}
              {message.plans && message.plans.length > 0 && (
                <div className="mt-4 ml-[52px] grid grid-cols-1 md:grid-cols-2 gap-4">
                  {message.plans.map((plan) => (
                    <Card key={plan.id} className="overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-1 border-2">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-3xl">{getCountryFlag(plan.country_code)}</span>
                            <div>
                              <h3 className="font-semibold text-sm line-clamp-1">{plan.title}</h3>
                              <p className="text-xs text-muted-foreground">{plan.country_name}</p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="flex items-center gap-2">
                            <Wifi className="w-4 h-4 text-primary" />
                            <div>
                              <p className="text-xs text-muted-foreground">Data</p>
                              <p className="text-sm font-semibold">{plan.data_amount}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary" />
                            <div>
                              <p className="text-xs text-muted-foreground">Validity</p>
                              <p className="text-sm font-semibold">{plan.validity_days} days</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t">
                          <div>
                            <p className="text-xs text-muted-foreground">Your Price</p>
                            <p className="text-xl font-bold text-primary">
                              {getCurrencySymbol()}{convertPrice(plan.agent_price).toFixed(2)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddToCart(plan)}
                            className="gap-2 shadow-md hover:shadow-lg transition-all"
                          >
                            <ShoppingCart className="w-4 h-4" />
                            Add to Cart
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-3 justify-start">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shrink-0 shadow-lg">
                <Bot className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="bg-card border rounded-2xl px-5 py-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Searching plans...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-6 border-t bg-card/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="e.g., I need a plan for Japan, 2 weeks, 5GB data..."
              disabled={isLoading}
              className="flex-1 rounded-xl border-2 focus:border-primary transition-colors"
            />
            <Button 
              onClick={handleSend} 
              disabled={isLoading || !input.trim()}
              className="rounded-xl px-6 shadow-md hover:shadow-lg transition-all"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <Sparkles className="w-3 h-3" />
            <span>Free AI usage until Oct 13 • Powered by Google Gemini</span>
          </div>
        </div>
      </div>
    </div>
  );
}
