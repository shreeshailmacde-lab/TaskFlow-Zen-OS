import React, { useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  startOfWeek, 
  endOfWeek,
  isSameDay,
  isSameMonth,
  addYears,
  subYears,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
  addDays,
  subDays
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../types';

interface SidebarCalendarProps {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
}

type MiniViewType = 'week' | 'month' | 'year';

export default function SidebarCalendar({ currentDate, onDateSelect }: SidebarCalendarProps) {
  const [miniView, setMiniView] = useState<MiniViewType>('month');
  const [navDate, setNavDate] = useState(currentDate);

  const prev = () => {
    if (miniView === 'week') setNavDate(subDays(navDate, 7));
    if (miniView === 'month') setNavDate(subMonths(navDate, 1));
    if (miniView === 'year') setNavDate(subYears(navDate, 1));
  };

  const next = () => {
    if (miniView === 'week') setNavDate(addDays(navDate, 7));
    if (miniView === 'month') setNavDate(addMonths(navDate, 1));
    if (miniView === 'year') setNavDate(addYears(navDate, 1));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9BA3AF]">Matrix</h3>
        <div className="flex bg-foreground/5 p-0.5 rounded-md">
          {(['week', 'month', 'year'] as MiniViewType[]).map(v => (
            <button
              key={v}
              onClick={() => setMiniView(v)}
              className={cn(
                "px-2 py-0.5 text-[8px] font-bold rounded capitalize transition-all",
                miniView === v ? "bg-panel text-foreground shadow-sm" : "text-[#9BA3AF] hover:text-foreground"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-background/20 rounded-xl p-3 border border-border/10 backdrop-blur-sm shadow-inner group/cal">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[11px] font-serif font-black italic text-foreground uppercase tracking-tighter transition-all group-hover/cal:translate-x-1">
            {miniView === 'year' ? format(navDate, 'yyyy') : format(navDate, 'MMMM yyyy')}
          </span>
          <div className="flex gap-0.5">
            <button onClick={prev} className="p-1 hover:bg-foreground/5 rounded text-[#9BA3AF] transition-colors"><ChevronLeft size={12}/></button>
            <button onClick={next} className="p-1 hover:bg-foreground/5 rounded text-[#9BA3AF] transition-colors"><ChevronRight size={12}/></button>
          </div>
        </div>

        {miniView === 'month' && <MonthGrid navDate={navDate} currentDate={currentDate} onDateSelect={onDateSelect} />}
        {miniView === 'week' && <WeekGrid navDate={navDate} currentDate={currentDate} onDateSelect={onDateSelect} />}
        {miniView === 'year' && <YearGrid navDate={navDate} currentDate={currentDate} onDateSelect={(date) => {
          setNavDate(date);
          setMiniView('month');
          onDateSelect(date);
        }} />}
      </div>
    </div>
  );
}

function MonthGrid({ navDate, currentDate, onDateSelect }: { navDate: Date, currentDate: Date, onDateSelect: (d: Date) => void }) {
  const start = startOfWeek(startOfMonth(navDate), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(navDate), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  return (
    <div className="grid grid-cols-7 gap-y-1">
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
        <span key={i} className="text-[8px] font-bold text-[#9BA3AF]/50 text-center mb-1">{d}</span>
      ))}
      {days.map((day, i) => (
        <button
          key={i}
          onClick={() => onDateSelect(day)}
          className={cn(
            "h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-medium transition-all mx-auto",
            !isSameMonth(day, navDate) && "opacity-20",
            isSameDay(day, currentDate) ? "bg-primary text-white" : "text-[#9BA3AF] hover:bg-foreground/5 hover:text-foreground",
            isSameDay(day, new Date()) && !isSameDay(day, currentDate) && "border border-primary/40 text-primary"
          )}
        >
          {format(day, 'd')}
        </button>
      ))}
    </div>
  );
}

function WeekGrid({ navDate, currentDate, onDateSelect }: { navDate: Date, currentDate: Date, onDateSelect: (d: Date) => void }) {
  const start = startOfWeek(navDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day, i) => (
        <button
          key={i}
          onClick={() => onDateSelect(day)}
          className="flex flex-col items-center gap-1 group"
        >
          <span className="text-[8px] font-bold text-[#9BA3AF]/50 uppercase">{format(day, 'EEE').slice(0, 1)}</span>
          <div className={cn(
            "h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold transition-all",
            isSameDay(day, currentDate) ? "bg-primary text-white" : "text-[#9BA3AF] bg-foreground/5 group-hover:bg-foreground/10 group-hover:text-foreground"
          )}>
            {format(day, 'd')}
          </div>
        </button>
      ))}
    </div>
  );
}

function YearGrid({ navDate, onDateSelect }: { navDate: Date, currentDate: Date, onDateSelect: (d: Date) => void }) {
  const months = eachMonthOfInterval({
    start: startOfYear(navDate),
    end: endOfYear(navDate)
  });

  return (
    <div className="grid grid-cols-3 gap-2">
      {months.map((month, i) => (
        <button
          key={i}
          onClick={() => onDateSelect(month)}
          className={cn(
            "h-8 rounded-md flex items-center justify-center text-[9px] font-bold uppercase transition-all bg-foreground/5 text-[#9BA3AF] hover:bg-primary hover:text-white",
            isSameMonth(month, new Date()) && "border border-primary/40 text-primary"
          )}
        >
          {format(month, 'MMM')}
        </button>
      ))}
    </div>
  );
}
