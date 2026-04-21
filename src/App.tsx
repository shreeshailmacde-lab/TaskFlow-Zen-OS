import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Settings as SettingsIcon,
  Moon,
  Sun,
  Bell,
  CheckCircle2,
  Trash2,
  Filter,
  LogOut,
  User as UserIcon,
  Menu,
  Activity,
  ChevronDown,
  Dumbbell,
  Briefcase,
  Coffee,
  Utensils,
  Book,
  Code,
  Users,
  Phone,
  Mail,
  Heart,
  ShoppingBag,
  Plane,
  Music,
  Home,
  Lightbulb,
  Camera,
  Star,
  BookOpen,
  Flower2,
  Tv as TvIcon,
  Footprints
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  addDays, 
  subDays, 
  startOfToday, 
  isSameDay, 
  parseISO,
  isWithinInterval,
  addHours,
  setHours,
  setMinutes,
  startOfHour,
  addMonths,
  subMonths,
  addYears,
  subYears,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  eachMonthOfInterval,
  startOfYear,
  endOfYear,
  getMonth,
  getYear,
  isBefore,
  differenceInMinutes,
  startOfDay,
  endOfDay
} from 'date-fns';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  setDoc, 
  deleteDoc, 
  Timestamp,
  getDocs,
  writeBatch,
  getDocFromServer
} from 'firebase/firestore';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
} from 'recharts';
import SidebarCalendar from './components/SidebarCalendar';
import DailyQuote from './components/DailyQuote';
import { Task, Category, RecurrenceType } from './types';
import { DEFAULT_CATEGORIES } from './constants';
const INFOGRAPHS = [
  { id: 'none', label: 'None', icon: null },
  { id: 'gym', label: 'GYM', icon: Dumbbell },
  { id: 'work', label: 'Work', icon: Briefcase },
  { id: 'break', label: 'Break', icon: Coffee },
  { id: 'meal', label: 'Meal', icon: Utensils },
  { id: 'study', label: 'Study', icon: Book },
  { id: 'code', label: 'Code', icon: Code },
  { id: 'meeting', label: 'Meeting', icon: Users },
  { id: 'call', label: 'Call', icon: Phone },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'health', label: 'Health', icon: Heart },
  { id: 'shop', label: 'Shop', icon: ShoppingBag },
  { id: 'travel', label: 'Travel', icon: Plane },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'idea', label: 'Idea', icon: Lightbulb },
  { id: 'camera', label: 'Photo', icon: Camera },
  { id: 'reading', label: 'Reading', icon: BookOpen },
  { id: 'sleeping', label: 'Sleeping', icon: Moon },
  { id: 'meditation', label: 'Meditation', icon: Flower2 },
  { id: 'tv', label: 'TV', icon: TvIcon },
  { id: 'walk', label: 'Walk', icon: Footprints },
];

function TaskIcon({ name, size = 14, className = "" }: { name?: string, size?: number, className?: string }) {
  const info = INFOGRAPHS.find(i => i.id === name);
  if (!info || !info.icon) return null;
  const IconComponent = info.icon;
  return <IconComponent size={size} className={className} />;
}
import { getWeekDays, generateRecurringInstances, getHoursArray, formatTime24h } from './lib/dateUtils';
import { cn } from './types';
import { useAuth } from './contexts/AuthContext';
import { db } from './lib/firebase';

export default function App() {
  const { user, signInWithGoogle, logout } = useAuth();
  
  // State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [currentDate, setCurrentDate] = useState(startOfToday());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>(() => {
    const saved = localStorage.getItem('timeFormat') as '12h' | '24h';
    return saved || '24h';
  });
  const [view, setView] = useState<'weekly' | 'daily'>('weekly');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showOnlyPriority, setShowOnlyPriority] = useState(false);
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const togglePriority = async (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return;
    
    const newValue = !cat.isPriority;
    
    if (user) {
      try {
        await setDoc(doc(db, `users/${user.uid}/categories`, categoryId), {
          ...cat,
          isPriority: newValue
        }, { merge: true });
      } catch (error) {
        console.error("Error updating priority in Firestore:", error);
      }
    } else {
      setCategories(prev => prev.map(c => c.id === categoryId ? { ...c, isPriority: newValue } : c));
    }
  };

  // Task and Category Real-time Sync
  useEffect(() => {
    if (!user) {
      // If not logged in, use localStorage for "Guest" mode
      const savedTasks = localStorage.getItem('tasks');
      const savedCats = localStorage.getItem('categories');
      if (savedTasks) setTasks(JSON.parse(savedTasks));
      if (savedCats) setCategories(JSON.parse(savedCats));
      return;
    }

    // Tasks Sync
    const tasksQuery = query(collection(db, `users/${user.uid}/tasks`));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          startTime: data.startTime instanceof Timestamp ? data.startTime.toDate().toISOString() : data.startTime,
          endTime: data.endTime instanceof Timestamp ? data.endTime.toDate().toISOString() : data.endTime,
        };
      }) as Task[];
      setTasks(tasksData);
    });

    // Categories Sync
    const catsQuery = query(collection(db, `users/${user.uid}/categories`));
    const unsubscribeCats = onSnapshot(catsQuery, async (snapshot) => {
      if (snapshot.empty) {
        // Initialize default categories for new users
        const batch = writeBatch(db);
        DEFAULT_CATEGORIES.forEach(cat => {
          const docRef = doc(db, `users/${user.uid}/categories`, cat.id);
          batch.set(docRef, { ...cat, userId: user.uid, createdAt: Timestamp.now() });
        });
        await batch.commit();
      } else {
        const catsData = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
        })) as Category[];
        setCategories(catsData);
      }
    });

    return () => {
      unsubscribeTasks();
      unsubscribeCats();
    };
  }, [user]);

  // Connection Test & Profile Sync
  useEffect(() => {
    if (user) {
      const testConnection = async () => {
        try {
          // Initialize user profile
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, {
            displayName: user.displayName || 'Anonymous',
            email: user.email,
            photoURL: user.photoURL,
            updatedAt: Timestamp.now(),
            createdAt: Timestamp.now(),
          }, { merge: true });
          
          // Test server responsiveness
          await getDocFromServer(userRef);
        } catch (error) {
          console.error("Firestore initialization error:", error);
          if (error instanceof Error && error.message.includes('insufficient permissions')) {
            console.error("Authentication mapping or security rules failure.");
          }
        }
      };
      testConnection();
    }
  }, [user]);

  // Local Storage Persistence (GUEST ONLY)
  useEffect(() => {
    if (!user) {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    }
  }, [tasks, user]);

  useEffect(() => {
    if (!user) {
      localStorage.setItem('categories', JSON.stringify(categories));
    }
  }, [categories, user]);

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('timeFormat', timeFormat);
  }, [timeFormat]);

  const displayTime = (date: Date) => {
    return format(date, timeFormat === '24h' ? 'HH:mm' : 'h:mm a');
  };

  // Reminders
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      tasks.forEach(task => {
        const taskTime = parseISO(task.startTime);
        const diff = taskTime.getTime() - now.getTime();
        
        if (diff > 0 && diff < 10 * 60 * 1000 && !task.reminderSent) {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`Upcoming Task: ${task.title}`, {
              body: `Starts at ${formatTime24h(taskTime)}`,
            });
          }
          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, reminderSent: true } : t));
        }
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [tasks]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const visibleDays = useMemo(() => {
    if (view === 'daily') return [currentDate];
    return getWeekDays(currentDate);
  }, [currentDate, view]);

  const allVisibleInstances = useMemo(() => {
    const start = visibleDays[0];
    const end = addDays(visibleDays[visibleDays.length - 1], 1);
    
    let instances = tasks.flatMap(task => generateRecurringInstances(task, start, end));
    
    // Apply Priority Filter if active
    if (showOnlyPriority) {
      const priorityIds = categories.filter(c => c.isPriority).map(c => c.id);
      instances = instances.filter(i => priorityIds.includes(i.categoryId));
    }
    
    if (filterCategoryIds.length > 0) {
      instances = instances.filter(i => filterCategoryIds.includes(i.categoryId));
    }
    
    return instances;
  }, [tasks, visibleDays, filterCategoryIds, showOnlyPriority, categories]);

  const dailyStats = useMemo(() => {
    const dayStart = startOfDay(currentDate);
    const dayEnd = endOfDay(currentDate);
    const totalMinutes = 1440;
    const stats: Record<string, number> = {};
    let scheduledMinutes = 0;

    // Minute-by-minute occupancy map
    // We initialize with a value that represents "Unscheduled"
    const minuteMap = new Array(totalMinutes).fill(null);

    // Exact same data the calendar uses
    const dayTasks = allVisibleInstances.filter(task => {
      const s = parseISO(task.startTime).getTime();
      const e = parseISO(task.endTime).getTime();
      return s < dayEnd.getTime() && e > dayStart.getTime();
    });

    dayTasks.forEach(task => {
      const start = parseISO(task.startTime).getTime();
      const end = parseISO(task.endTime).getTime();

      // Get relative minutes in this day (0 to 1439)
      const startOfDayTS = dayStart.getTime();
      const startRel = Math.max(0, Math.floor((start - startOfDayTS) / 60000));
      const endRel = Math.min(totalMinutes, Math.ceil((end - startOfDayTS) / 60000));

      // Mark the category for these exact minutes
      // If categories overlap, we respect the most recent one (standard calendar behavior)
      for (let i = startRel; i < endRel; i++) {
        if (i >= 0 && i < totalMinutes) {
          minuteMap[i] = task.categoryId;
        }
      }
    });

    // Count the minutes attributed to each category
    minuteMap.forEach(catId => {
      if (catId) {
        stats[catId] = (stats[catId] || 0) + 1;
        scheduledMinutes++;
      }
    });

    return { stats, scheduledMinutes, totalMinutes };
  }, [allVisibleInstances, currentDate]);

  const handleSaveTask = async (taskData: Partial<Task>) => {
    try {
      if (user) {
        const taskId = editingTask?.id || Math.random().toString(36).substr(2, 9);
        const docRef = doc(db, `users/${user.uid}/tasks`, taskId);
        const finalTask = {
          title: taskData.title || 'Untitled',
          description: taskData.description || '',
          color: taskData.color || '',
          icon: taskData.icon || 'none',
          startTime: Timestamp.fromDate(parseISO(taskData.startTime || new Date().toISOString())),
          endTime: Timestamp.fromDate(parseISO(taskData.endTime || addHours(new Date(), 1).toISOString())),
          categoryId: taskData.categoryId || categories[0].id,
          recurrence: taskData.recurrence || 'none',
          userId: user.uid,
          updatedAt: Timestamp.now(),
          ...(editingTask ? {} : { createdAt: Timestamp.now() })
        };
        await setDoc(docRef, finalTask, { merge: true });
      } else {
        // Guest local state
        if (editingTask) {
          setTasks(prev => prev.map(t => t.id === (editingTask as Task).id ? { ...t, ...taskData } as Task : t));
        } else {
          const newTask: Task = {
            id: Math.random().toString(36).substr(2, 9),
            title: taskData.title || 'Untitled',
            description: taskData.description,
            color: taskData.color,
            icon: taskData.icon || 'none',
            startTime: taskData.startTime || new Date().toISOString(),
            endTime: taskData.endTime || addHours(new Date(), 1).toISOString(),
            categoryId: taskData.categoryId || categories[0].id,
            recurrence: taskData.recurrence || 'none',
          };
          setTasks(prev => [...prev, newTask]);
        }
      }
      setIsModalOpen(false);
      setEditingTask(null);
      return true;
    } catch (error) {
      console.error("Error saving task:", error);
      return false;
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, `users/${user.uid}/tasks`, id));
      } catch (error) {
        console.error("Error deleting task from Firestore:", error);
      }
    } else {
      setTasks(prev => prev.filter(t => t.id !== id));
    }
    setIsModalOpen(false);
    setEditingTask(null);
  };

  const nextPeriod = () => setCurrentDate(prev => addDays(prev, view === 'weekly' ? 7 : 1));
  const prevPeriod = () => setCurrentDate(prev => subDays(prev, view === 'weekly' ? 7 : 1));

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden relative">
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-[280px] bg-panel border-r border-border p-6 flex flex-col shrink-0 z-50 transition-transform lg:static lg:translate-x-0 duration-300",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="px-1 mb-10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#3B82F6] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Activity size={16} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-tighter leading-none italic uppercase text-foreground">TaskFlow</span>
            <span className="text-[10px] font-bold text-[#9BA3AF] uppercase tracking-[0.2em] leading-none mt-1">Zen OS</span>
          </div>
        </div>

        {user ? (
          <div className="mb-8 p-3 rounded-lg bg-foreground/5 border border-border/50 flex items-center gap-3">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-border" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <UserIcon size={16} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-foreground truncate">{user.displayName}</p>
              <button 
                onClick={logout}
                className="text-[9px] font-medium text-[#9BA3AF] hover:text-red-500 transition-colors flex items-center gap-1"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={signInWithGoogle}
            className="mb-8 w-full p-3 rounded-lg bg-primary text-white text-[11px] font-bold uppercase tracking-wider hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            Sign in to sync
          </button>
        )}

        <nav className="flex-1 overflow-y-auto space-y-8 scrollbar-hide">
          <div className="pt-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9BA3AF]">Habit Pulse</h3>
              <Activity size={10} className="text-primary animate-pulse" />
            </div>
            
            <div className="relative aspect-square w-full mb-4 group">
              <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all duration-1000" />
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      ...Object.entries(dailyStats.stats).map(([catId, minutes]) => ({
                        name: categories.find(c => c.id === catId)?.name || 'Other',
                        value: minutes,
                        color: categories.find(c => c.id === catId)?.color || '#3b82f6'
                      })),
                      { 
                        name: 'Unscheduled', 
                        value: Math.max(0, 1440 - dailyStats.scheduledMinutes), 
                        color: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' 
                      }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius="65%"
                    outerRadius="90%"
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {[
                      ...Object.entries(dailyStats.stats).map(([catId]) => ({
                        color: categories.find(c => c.id === catId)?.color || '#3b82f6'
                      })),
                      { color: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-panel border border-border p-2 rounded-lg shadow-xl backdrop-blur-md">
                            <p className="text-[10px] font-bold text-foreground">
                              {payload[0].name}: {Math.round(Number(payload[0].value))}m
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[20px] font-serif font-black tracking-tighter leading-none italic">
                  {Math.round(dailyStats.totalMinutes / 60)}h
                </span>
                <span className="text-[8px] font-bold uppercase tracking-widest text-[#9BA3AF]">Total</span>
              </div>
            </div>

            <div className="space-y-3">
              {Object.entries(dailyStats.stats).length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border/40 text-center">
                  <p className="text-[10px] text-[#9BA3AF] font-medium italic">Schedule your first task to see the pulse.</p>
                </div>
              ) : (
                (Object.entries(dailyStats.stats) as [string, number][]).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([catId, minutes]) => {
                  const cat = categories.find(c => c.id === catId);
                  const percentage = Math.round((minutes / dailyStats.totalMinutes) * 100);
                  return (
                    <div key={catId} className="flex flex-col gap-1.5 group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.3)]" style={{ backgroundColor: cat?.color || '#3b82f6' }} />
                          <span className="text-[10px] font-bold uppercase tracking-tight text-foreground transition-colors group-hover:text-primary">{cat?.name}</span>
                        </div>
                        <span className="text-[9px] font-mono font-medium text-[#9BA3AF]">{percentage}%</span>
                      </div>
                      <div className="h-1 w-full bg-foreground/5 rounded-full overflow-hidden">
                         <div 
                           className="h-full transition-all duration-1000 ease-out rounded-full"
                           style={{ width: `${percentage}%`, backgroundColor: cat?.color || '#3b82f6' }}
                         />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-border/20 pt-8">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9BA3AF] mb-4">Manage</h3>
            <QuickAddCategory onAdd={async (name, color) => {
              const id = Math.random().toString(36).substr(2, 9);
              if (user) {
                try {
                  await setDoc(doc(db, `users/${user.uid}/categories`, id), {
                    name,
                    color,
                    userId: user.uid,
                    createdAt: Timestamp.now()
                  });
                } catch (error) {
                  console.error("Error adding category to Firestore:", error);
                }
              } else {
                const newCat: Category = { id, name, color };
                setCategories(prev => [...prev, newCat]);
              }
            }} />
          </div>

          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9BA3AF] mb-4">Preferences</h3>
            <div className="space-y-3">
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="w-full flex items-center justify-between text-xs text-[#9BA3AF] hover:text-foreground transition-colors group"
              >
                <span>Dark Mode</span>
                <div className={cn(
                  "w-6 h-3 rounded-full relative transition-colors bg-border",
                  isDarkMode && "bg-primary/40"
                )}>
                  <div className={cn(
                    "absolute top-0.5 bottom-0.5 w-2 h-2 rounded-full bg-white transition-all shadow-[0_0_8px_rgba(255,255,255,0.4)]",
                    isDarkMode ? "right-0.5" : "left-0.5"
                  )} />
                </div>
              </button>
              <button 
                onClick={() => setTimeFormat(timeFormat === '24h' ? '12h' : '24h')}
                className="w-full flex items-center justify-between text-xs text-[#9BA3AF] hover:text-foreground transition-colors"
              >
                <span>Format</span>
                <span className="font-bold text-[10px] uppercase text-foreground/60">{timeFormat}</span>
              </button>
              <div className="flex items-center justify-between text-xs text-[#9BA3AF]">
                <span>Reminders</span>
                <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
              </div>
              {deferredPrompt && (
                <button 
                  onClick={handleInstall}
                  className="w-full mt-2 flex items-center justify-between text-xs text-primary font-bold hover:text-white transition-colors animate-pulse"
                >
                  <span>Install App</span>
                  <Activity size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-border/20">
            <SidebarCalendar 
              currentDate={currentDate} 
              onDateSelect={(date) => {
                setCurrentDate(date);
                if (view === 'daily') setView('daily'); // Keep view
              }} 
            />
          </div>
        </nav>

        <button 
          onClick={() => {
            setEditingTask(null);
            setIsModalOpen(true);
          }}
          className="mt-auto w-full bg-foreground text-background hover:scale-[1.02] py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] transition-all active:scale-100 shadow-xl shadow-foreground/10 flex items-center justify-center gap-2"
        >
          <Plus size={14} />
          Create Task
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        <DailyQuote />
        <header className="h-[80px] px-4 md:px-8 border-b border-border flex items-center justify-between shrink-0 bg-background/80 backdrop-blur-xl z-40">
          <div className="flex items-center gap-2 md:gap-6">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 hover:bg-panel rounded-lg text-[#9BA3AF] transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#3B82F6] uppercase tracking-[0.2em] mb-1">Timebox Matrix</span>
              <h2 className="text-lg md:text-2xl font-black tracking-tighter text-foreground truncate max-w-[200px] md:max-w-none">
                 {view === 'weekly' 
                  ? `${format(visibleDays[0], 'MMM d')} — ${format(visibleDays[6], 'MMM d')}` 
                  : format(currentDate, 'MMMM d, yyyy')}
              </h2>
            </div>
            <div className="flex items-center gap-1 bg-panel p-1 rounded-lg border border-border/50">
              <button onClick={prevPeriod} className="p-1.5 hover:bg-background hover:text-foreground rounded-md text-[#9BA3AF] transition-all hover:shadow-sm"><ChevronLeft size={16}/></button>
              <button onClick={nextPeriod} className="p-1.5 hover:bg-background hover:text-foreground rounded-md text-[#9BA3AF] transition-all hover:shadow-sm"><ChevronRight size={16}/></button>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase transition-all tracking-wider",
                  filterCategoryIds.length > 0 || showOnlyPriority 
                    ? "bg-primary/20 text-primary border border-primary/30" 
                    : "text-[#9BA3AF] hover:text-foreground hover:bg-foreground/5 border border-transparent"
                )}
              >
                <Filter size={14} />
                <span className="hidden md:inline">Filter</span>
                { (filterCategoryIds.length > 0 || showOnlyPriority) && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                )}
                <ChevronDown size={14} />
              </button>

              <AnimatePresence>
                {showFilterDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowFilterDropdown(false)} 
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-64 bg-panel border border-border rounded-lg shadow-2xl p-4 z-50 overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#9BA3AF]">Filter Views</span>
                        {(filterCategoryIds.length > 0 || showOnlyPriority) && (
                          <button 
                            onClick={() => {
                              setFilterCategoryIds([]);
                              setShowOnlyPriority(false);
                            }}
                            className="text-[9px] font-bold text-primary hover:underline hover:text-white transition-colors"
                          >
                            RESET
                          </button>
                        )}
                      </div>

                      <div className="space-y-4">
                        <button 
                          onClick={() => setShowOnlyPriority(!showOnlyPriority)}
                          className={cn(
                            "w-full flex items-center justify-between p-2 rounded-md transition-all",
                            showOnlyPriority ? "bg-yellow-500/10 text-yellow-500" : "hover:bg-foreground/5 text-[#9BA3AF]"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Star size={14} fill={showOnlyPriority ? "currentColor" : "none"} />
                            <span className="text-xs font-bold uppercase tracking-tight">Priority Only</span>
                          </div>
                          {showOnlyPriority && <CheckCircle2 size={12} />}
                        </button>

                        <div className="h-px bg-border/50" />

                        <div className="grid grid-cols-1 gap-1 max-h-[300px] overflow-y-auto pr-1">
                          {categories.map(cat => (
                            <button 
                              key={cat.id}
                              onClick={() => {
                                setFilterCategoryIds(prev => 
                                  prev.includes(cat.id) 
                                    ? prev.filter(id => id !== cat.id) 
                                    : [...prev, cat.id]
                                );
                              }}
                              className={cn(
                                "flex items-center justify-between p-2 rounded-md transition-all",
                                filterCategoryIds.includes(cat.id) ? "bg-primary/10 text-primary" : "hover:bg-foreground/5 text-[#9BA3AF]"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                <span className="text-xs font-bold uppercase tracking-tight">{cat.name}</span>
                              </div>
                              <Star 
                                size={12} 
                                className={cat.isPriority ? "text-yellow-500" : "opacity-0"} 
                                fill={cat.isPriority ? "currentColor" : "none"} 
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="hidden sm:flex gap-1 bg-panel p-1 rounded-xl border border-border/50">
              <button 
                onClick={() => setView('daily')}
                className={cn(
                  "px-4 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider",
                  view === 'daily' ? "bg-background text-foreground shadow-lg shadow-black/5 ring-1 ring-border/5" : "text-[#9BA3AF] hover:text-foreground"
                )}
              >
                Day
              </button>
              <button 
                onClick={() => setView('weekly')}
                className={cn(
                  "px-4 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider",
                  view === 'weekly' ? "bg-background text-foreground shadow-lg shadow-black/5 ring-1 ring-border/5" : "text-[#9BA3AF] hover:text-foreground"
                )}
              >
                Week
              </button>
            </div>
          </div>
        </header>

        {/* Calendar Grid Container */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="calendar-grid overflow-x-auto">
            <div className="grid-header-cell min-w-[60px]" style={{ background: '#0F1113' }}></div>
            {visibleDays.map((day, i) => (
              <div key={i} className={cn(
                "grid-header-cell flex items-center justify-center gap-1 min-w-[80px] md:min-w-0 gap-1.5",
                isSameDay(day, startOfToday()) && "text-[#3B82F6]"
              )}>
                <span>{format(day, 'EEE')}</span>
                <span className="text-foreground">{format(day, 'd')}</span>
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden">
             <div className="calendar-grid relative min-h-full">
               {/* Hour labels */}
               <div className="flex flex-col">
                 {getHoursArray().map(hour => (
                   <div key={hour} className="time-label font-mono uppercase tracking-tighter">
                     {displayTime(setHours(startOfToday(), hour))}
                   </div>
                 ))}
               </div>

               {/* Day columns */}
               {visibleDays.map((day, dayIndex) => (
                 <div key={dayIndex} className="grid-cell group min-w-[80px] md:min-w-0">
                    {/* Visual markers for grid lines are handled by the gap-1 in calendar-grid and time-label borders */}
                    {getHoursArray().map(hour => (
                      <div key={hour} className="h-[60px] border-b border-border/10"></div>
                    ))}

                    {/* Tasks */}
                    <AnimatePresence>
                      {allVisibleInstances.filter(instance => {
                        const s = parseISO(instance.startTime);
                        const e = parseISO(instance.endTime);
                        const dStart = startOfDay(day);
                        const dEnd = endOfDay(day);
                        return s < dEnd && e > dStart;
                      }).map((task) => {
                        const start = parseISO(task.startTime);
                        const end = parseISO(task.endTime);
                        
                        // Calculate position within THIS day's 24h block
                        let top = 0;
                        if (isSameDay(start, day)) {
                          top = (start.getHours() * 60 + start.getMinutes());
                        }

                        // Calculate visual duration for THIS day's 24h block
                        let actualDurationMinutes = (end.getTime() - start.getTime()) / (60 * 1000);
                        
                        // If it starts before today, it occupies the range from 0 to its (end on today)
                        // If it ends after today, it occupies the range from (start on today) to 1440
                        let displayDuration = 0;
                        const dStartTS = startOfDay(day).getTime();
                        const dEndTS = endOfDay(day).getTime();
                        
                        const effectiveStart = Math.max(start.getTime(), dStartTS);
                        const effectiveEnd = Math.min(end.getTime(), dEndTS);
                        displayDuration = (effectiveEnd - effectiveStart) / (60 * 1000);

                        const category = categories.find(c => c.id === task.categoryId) || categories[0];
                        const displayColor = task.color || category.color;

                        // Sanity check visual height
                        const visualHeight = Math.max(displayDuration, 18);
                        const isShort = visualHeight < 45;
                        const isTiny = visualHeight < 30;

                        return (
                          <motion.div
                            key={`${task.id}-${task.startTime}`}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            onClick={() => {
                              setEditingTask(task);
                              setIsModalOpen(true);
                            }}
                            className={cn(
                              "absolute left-[6px] right-[6px] z-10 cursor-pointer rounded-lg text-[11px] font-medium leading-none transition-all border-l-2 group/task overflow-hidden backdrop-blur-[2px] hover:z-20 hover:scale-[1.02] hover:shadow-2xl hover:shadow-current/20 active:scale-100",
                              isShort ? "px-1.5 py-1" : "p-2.5 shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
                            )}
                            style={{
                              top: `${top}px`,
                              height: `${visualHeight}px`,
                              backgroundColor: isShort ? `${displayColor}1A` : `${displayColor}0D`, 
                              color: displayColor,
                              borderLeftColor: displayColor,
                              boxShadow: !isShort ? `inset 0 0 120px ${displayColor}08` : 'none'
                            }}
                          >
                            <div className={cn(
                              "flex h-full overflow-hidden",
                              isTiny ? "items-center gap-1" : "flex-col"
                            )}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className="p-1 rounded-sm bg-current/10 shrink-0">
                                  <TaskIcon name={task.icon} size={isShort ? 11 : 13} className="shrink-0" />
                                </div>
                                <span className={cn(
                                  "truncate font-bold tracking-tight",
                                  isShort ? "text-[10px]" : "text-[11px]"
                                )}>{task.title}</span>
                                {task.recurrence !== 'none' && !isTiny && (
                                  <div className="ml-auto flex items-center justify-center p-0.5 rounded-full bg-current/5">
                                    <span className="text-[8px] leading-none">⟳</span>
                                  </div>
                                )}
                              </div>
                              {actualDurationMinutes >= 30 && (
                                <div className={cn(
                                  "opacity-70 font-bold uppercase tracking-tighter flex items-center gap-1",
                                  isShort ? "text-[8px] mt-0.5" : "text-[9px] mt-1"
                                )}>
                                  {actualDurationMinutes > 45 && task.icon && task.icon !== 'none' && <div className="w-1 h-1 rounded-full bg-current opacity-30" />}
                                  {displayTime(start)} {actualDurationMinutes >= 45 && `– ${displayTime(end)}`}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </main>

      {/* Settings/Task Modal with theme styles */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-background/90 backdrop-blur-sm"
            />
            <motion.div
              layoutId="task-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl border border-border bg-panel shadow-2xl text-foreground overflow-hidden"
            >
              <div className="p-8 pb-0 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold tracking-tight">{editingTask ? 'EDIT TASK' : 'NEW TASK'}</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full p-2 hover:bg-foreground/10 transition-colors text-foreground/50"
                >
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 pt-6 custom-scrollbar">
                <TaskForm 
                  task={editingTask} 
                  categories={categories}
                  viewDate={currentDate}
                  onSave={handleSaveTask}
                  onDelete={handleDeleteTask}
                  activeFilterCount={filterCategoryIds.length}
                  filterCategoryIds={filterCategoryIds}
                  showOnlyPriority={showOnlyPriority}
                  onAddCategory={async (name, color) => {
                    const id = Math.random().toString(36).substr(2, 9);
                    if (user) {
                      try {
                        const newCatRef = doc(db, `users/${user.uid}/categories`, id);
                        await setDoc(newCatRef, {
                          name,
                          color,
                          userId: user.uid,
                          isPriority: false, // New categories from modal default to non-priority
                          createdAt: Timestamp.now()
                        });
                      } catch (error) {
                        console.error("Error adding category from modal:", error);
                      }
                    } else {
                      const newCat: Category = { id, name, color, isPriority: false };
                      setCategories(prev => [...prev, newCat]);
                    }
                    return id;
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TaskForm({ 
  task, 
  categories, 
  viewDate,
  onSave, 
  onDelete,
  onAddCategory,
  activeFilterCount,
  filterCategoryIds,
  showOnlyPriority
}: { 
  task: Task | null, 
  categories: Category[], 
  viewDate: Date,
  onSave: (data: Partial<Task>) => Promise<boolean>,
  onDelete: (id: string) => void,
  onAddCategory: (name: string, color: string) => Promise<string>,
  activeFilterCount: number,
  filterCategoryIds: string[],
  showOnlyPriority: boolean
}) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  
  const getInitialStartTime = () => {
    if (task?.startTime) return format(parseISO(task.startTime), "yyyy-MM-dd'T'HH:mm");
    
    // Default to the current REAL today's date at a reasonable hour
    const now = new Date();
    // We use now instead of viewDate to satisfy user request for "today's date"
    const target = setHours(setMinutes(now, 0), now.getHours() + 1);
    return format(target, "yyyy-MM-dd'T'HH:mm");
  };

  const getInitialEndTime = () => {
    if (task?.endTime) return format(parseISO(task.endTime), "yyyy-MM-dd'T'HH:mm");
    
    const now = new Date();
    const target = setHours(setMinutes(now, 0), now.getHours() + 2);
    return format(target, "yyyy-MM-dd'T'HH:mm");
  };

  const [startTime, setStartTime] = useState(getInitialStartTime());
  const [endTime, setEndTime] = useState(getInitialEndTime());
  const [endClockTime, setEndClockTime] = useState(task?.endTime ? format(parseISO(task.endTime), "HH:mm") : format(startOfHour(addHours(new Date(), 2)), "HH:mm"));
  const [categoryId, setCategoryId] = useState(task?.categoryId || categories[0].id);
  const [taskColor, setTaskColor] = useState(task?.color || '');
  const [recurrence, setRecurrence] = useState<RecurrenceType>(task?.recurrence || 'none');
  const [icon, setIcon] = useState(task?.icon || 'none');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3b82f6');
  const [isSaving, setIsSaving] = useState(false);

  const selectedCategory = categories.find(c => c.id === categoryId);
  const isHiddenByFilter = (showOnlyPriority && !selectedCategory?.isPriority) || 
                          (activeFilterCount > 0 && !filterCategoryIds.includes(categoryId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      let finalEndTime = endTime;
      if (recurrence !== 'none') {
        const startDate = parseISO(startTime);
        const [hours, minutes] = endClockTime.split(':').map(Number);
        const computedEnd = setMinutes(setHours(startDate, hours), minutes);
        
        if (isBefore(computedEnd, startDate)) {
          finalEndTime = addDays(computedEnd, 1).toISOString();
        } else {
          finalEndTime = computedEnd.toISOString();
        }
      } else {
        finalEndTime = parseISO(endTime).toISOString();
      }

      await onSave({
        title,
        description,
        color: taskColor || undefined,
        icon,
        startTime: parseISO(startTime).toISOString(),
        endTime: finalEndTime,
        categoryId,
        recurrence,
      });
    } catch (error) {
      console.error("Task creation failed:", error);
      setIsSaving(false);
    } 
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9BA3AF]">Title</label>
        <input 
          autoFocus
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="New Task"
          className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm font-medium focus:outline-none focus:border-primary/20 transition-all placeholder:opacity-40"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9BA3AF]">Recurrence</label>
        <select 
          value={recurrence}
          onChange={e => setRecurrence(e.target.value as RecurrenceType)}
          className="w-full rounded-md border border-border bg-background px-4 py-2.5 text-xs focus:outline-none focus:border-primary/20 transition-all appearance-none cursor-pointer"
        >
          <option value="none">Does not repeat</option>
          <option value="daily">Daily</option>
          <option value="weekdays">Weekdays (Mon-Fri)</option>
          <option value="weekends">Weekends (Sat & Sun)</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9BA3AF]">Start Time</label>
          <input 
            type="datetime-local"
            required
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-4 py-2 text-xs focus:outline-none focus:border-primary/20 transition-all font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9BA3AF]">End Time</label>
          {recurrence === 'none' ? (
            <input 
              type="datetime-local"
              required
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-4 py-2 text-xs focus:outline-none focus:border-primary/20 transition-all font-mono"
            />
          ) : (
            <input 
              type="time"
              required
              value={endClockTime}
              onChange={e => setEndClockTime(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-4 py-2 text-xs focus:outline-none focus:border-primary/20 transition-all font-mono"
            />
          )}
          {recurrence !== 'none' && (
            <p className="text-[9px] text-[#9BA3AF] mt-1 font-medium">Daily tasks automatically end on the same day.</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9BA3AF]">Category & Color</label>
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setCategoryId(cat.id);
                setTaskColor(''); // Reset individual color if selecting category defaults
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-[11px] font-bold transition-all border",
                categoryId === cat.id && !taskColor ? "border-[2px]" : "border-border opacity-60 hover:opacity-100"
              )}
              style={{ 
                backgroundColor: `${cat.color}20`,
                color: cat.color,
                borderColor: cat.color
              }}
            >
              {cat.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowNewCategory(!showNewCategory)}
            className="rounded-md border border-dashed border-border px-3 py-1.5 text-[11px] font-bold text-[#9BA3AF] hover:border-white/20 hover:text-white transition-all"
          >
            + NEW CAT
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4 p-3 rounded-md border border-border bg-background">
          <div className="space-y-1 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9BA3AF] block">Override Color</span>
            <p className="text-[9px] text-[#9BA3AF] italic">Custom color for this specific task</p>
          </div>
          <div className="flex items-center gap-2">
            {taskColor && (
              <button 
                type="button" 
                onClick={() => setTaskColor('')}
                className="text-[10px] font-bold uppercase text-red-500 hover:underline"
              >
                Reset
              </button>
            )}
            <input 
              type="color"
              value={taskColor || categories.find(c => c.id === categoryId)?.color || '#3b82f6'}
              onChange={e => setTaskColor(e.target.value)}
              className="h-8 w-8 rounded border border-border bg-transparent p-0 overflow-hidden cursor-pointer shadow-sm"
            />
          </div>
        </div>
      </div>

      {showNewCategory && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2 rounded-md border border-border bg-background p-2"
        >
          <input 
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder="Category name"
            className="flex-1 bg-transparent px-2 py-1 text-xs focus:outline-none placeholder:opacity-40"
          />
          <input 
            type="color"
            value={newCatColor}
            onChange={e => setNewCatColor(e.target.value)}
            className="h-6 w-6 rounded border border-border bg-transparent p-0 overflow-hidden cursor-pointer"
          />
          <button
            type="button"
            onClick={async () => {
              if (newCatName) {
                const id = await onAddCategory(newCatName, newCatColor);
                setCategoryId(id);
                setNewCatName('');
                setShowNewCategory(false);
              }
            }}
            className="rounded bg-foreground text-background px-3 py-1 text-[10px] font-bold uppercase"
          >
            Add
          </button>
        </motion.div>
      )}

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9BA3AF]">Infograph</label>
        <div className="grid grid-cols-6 gap-2 p-2 rounded-md border border-border bg-background">
          {INFOGRAPHS.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIcon(item.id)}
              className={cn(
                "aspect-square flex flex-col items-center justify-center rounded-md transition-all border border-transparent",
                icon === item.id ? "bg-primary/10 border-primary text-primary" : "text-[#9BA3AF] hover:bg-foreground/5 hover:text-foreground"
              )}
              title={item.label}
            >
              {item.icon ? <item.icon size={14} /> : <span className="text-[8px] font-bold uppercase opacity-30">∅</span>}
              <span className="text-[7px] font-bold uppercase tracking-tighter truncate w-full text-center px-0.5">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9BA3AF]">Description</label>
        <textarea 
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Details..."
          rows={3}
          className="w-full rounded-md border border-border bg-background px-4 py-3 text-xs focus:outline-none focus:border-primary/20 transition-all resize-none placeholder:opacity-40"
        />
      </div>

      <div className="flex flex-col gap-3 pt-4 border-t border-border/20">
        <div className="flex gap-2 w-full">
          <button 
            type="submit"
            disabled={isSaving}
            className="flex-1 rounded-md bg-foreground text-background py-3.5 font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : (task ? 'Update Task' : 'Create Task')}
          </button>
          {task && (
            <button 
              type="button"
              disabled={isSaving}
              onClick={() => onDelete(task.id)}
              className="flex h-[44px] w-[44px] items-center justify-center rounded-md border border-border text-red-500 hover:bg-red-500/10 transition-colors bg-background disabled:opacity-50"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
        
        {isHiddenByFilter && (
          <p className="text-[10px] text-yellow-500/80 font-bold uppercase text-center flex items-center justify-center gap-1.5 px-4">
            <Star size={10} fill="currentColor" />
            Note: This category is hidden by your current filters
          </p>
        )}
      </div>
    </form>
  );
}

function QuickAddCategory({ onAdd }: { onAdd: (name: string, color: string) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');

  if (!isAdding) {
    return (
      <button 
        onClick={() => setIsAdding(true)}
        className="w-full flex items-center gap-3 py-2.5 px-2 opacity-50 hover:opacity-100 transition-all text-[11px] font-bold uppercase"
      >
        <Plus size={14} className="text-primary" />
        <span>Add Category</span>
      </button>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-2 border border-border/20 rounded-md bg-foreground/5 space-y-2"
    >
      <input 
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Name..."
        className="w-full bg-transparent border-none text-[12px] p-0 focus:ring-0 placeholder:opacity-40 uppercase font-medium"
      />
      <div className="flex items-center justify-between">
        <input 
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          className="h-5 w-5 rounded border border-border bg-transparent p-0 overflow-hidden cursor-pointer"
        />
        <div className="flex gap-2">
          <button 
            onClick={() => setIsAdding(false)}
            className="text-[10px] font-bold uppercase text-[#9BA3AF] hover:text-foreground"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              if (name) {
                onAdd(name, color);
                setName('');
                setIsAdding(false);
              }
            }}
            className="text-[10px] font-bold uppercase text-primary hover:underline"
          >
            Add
          </button>
        </div>
      </div>
    </motion.div>
  );
}
