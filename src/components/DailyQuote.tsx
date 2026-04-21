import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Quote, Loader2 } from 'lucide-react';
import { format, startOfToday } from 'date-fns';
import { GoogleGenAI } from "@google/genai";

const FALLBACK_QUOTE = { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" };

export default function DailyQuote() {
  const [quote, setQuote] = useState<{ text: string, author: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuote = async () => {
      const today = format(startOfToday(), 'yyyy-MM-dd');
      const cached = localStorage.getItem(`quote_${today}`);

      if (cached) {
        setQuote(JSON.parse(cached));
        setLoading(false);
        return;
      }

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: "Generate a profound daily motivational quote from a well-known philosopher, author, or scientist. Return ONLY JSON in this format: { \"text\": \"...\", \"author\": \"...\" }",
          config: {
            responseMimeType: "application/json",
          }
        });

        const data = JSON.parse(response.text || '{}');
        if (data.text && data.author) {
          localStorage.setItem(`quote_${today}`, JSON.stringify(data));
          setQuote(data);
        } else {
          setQuote(FALLBACK_QUOTE);
        }
      } catch (error) {
        console.error("Failed to fetch daily quote:", error);
        setQuote(FALLBACK_QUOTE);
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, []);

  if (loading) {
    return (
      <div className="bg-panel/30 border-b border-border h-[120px] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary/30" />
      </div>
    );
  }

  if (!quote) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden bg-panel/30 border-b border-border p-4 md:p-8 flex items-center justify-between gap-8 group"
    >
      <div className="flex-1 max-w-4xl">
        <div className="flex items-start gap-4">
          <Quote className="text-primary/20 shrink-0 mt-1" size={24} />
          <div className="space-y-3">
            <h2 className="font-serif italic text-xl md:text-2xl lg:text-3xl leading-[1.1] tracking-tight text-foreground transition-all duration-700 group-hover:scale-[1.01] origin-left">
              "{quote.text}"
            </h2>
            <div className="flex items-center gap-3">
              <div className="h-[1px] w-8 bg-border" />
              <p className="font-mono text-[10px] md:text-xs uppercase tracking-[0.2em] text-[#9BA3AF]">
                {quote.author}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Background oversized character for texture */}
      <div className="absolute -right-8 -bottom-12 font-serif text-[180px] font-black text-foreground/[0.03] select-none pointer-events-none transform rotate-12 transition-transform duration-1000 group-hover:rotate-0">
        {quote.author.charAt(0)}
      </div>
    </motion.div>
  );
}
