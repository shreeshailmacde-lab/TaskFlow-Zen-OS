import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Category = {
  id: string;
  name: string;
  color: string;
  isPriority?: boolean;
};

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'weekdays' | 'weekends';

export type Task = {
  id: string;
  title: string;
  description?: string;
  color?: string; // Optional individual task color
  icon?: string; // Optional icon name from lucide-react
  startTime: string; // ISO string 
  endTime: string;
  categoryId: string;
  recurrence: RecurrenceType;
  reminderSent?: boolean;
};

export type Settings = {
  theme: 'light' | 'dark';
  timeFormat: '12h' | '24h';
};
