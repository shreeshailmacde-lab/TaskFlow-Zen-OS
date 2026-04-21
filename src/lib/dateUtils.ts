import { 
  format, 
  startOfWeek, 
  addDays, 
  isSameDay, 
  addMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  parseISO,
  isAfter,
  isBefore,
  addWeeks,
  isWeekend,
  getDay,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths
} from 'date-fns';
import { Task, RecurrenceType } from '../types';

export function getWeekDays(date: Date) {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function generateRecurringInstances(task: Task, startRange: Date, endRange: Date): Task[] {
  const instances: Task[] = [];
  const taskStart = parseISO(task.startTime);
  const taskEnd = parseISO(task.endTime);
  const durationMs = taskEnd.getTime() - taskStart.getTime();

  if (task.recurrence === 'none') {
    if (taskStart < endRange && taskEnd > startRange) return [task];
    return [];
  }

  // Use a safety buffer to start looking far enough back to catch overnight tasks
  // We look back at least 2 days from the start range to be absolutely safe
  let currentStart = new Date(taskStart);
  let currentEnd = new Date(taskEnd);

  // Buffer: start searching from 48 hours before the startRange
  const searchThreshold = addDays(startRange, -2);

  // Jump ahead to reach the search threshold efficiently
  if (isBefore(currentStart, searchThreshold)) {
    const gapMs = searchThreshold.getTime() - currentStart.getTime();
    
    if (task.recurrence === 'daily' || task.recurrence === 'weekdays' || task.recurrence === 'weekends') {
      const daysToJump = Math.floor(gapMs / (24 * 60 * 60 * 1000));
      currentStart = addDays(currentStart, daysToJump);
    } else if (task.recurrence === 'weekly') {
      const weeksToJump = Math.floor(gapMs / (7 * 24 * 60 * 60 * 1000));
      currentStart = addWeeks(currentStart, weeksToJump);
    } else if (task.recurrence === 'monthly') {
      const monthsToJump = differenceInMonths(searchThreshold, currentStart);
      currentStart = addMonths(currentStart, monthsToJump);
    }
  }

  // Backtrack slightly after jump to ensure we didn't land exactly after an instance we need
  while (isAfter(currentStart, searchThreshold)) {
    if (task.recurrence === 'daily' || task.recurrence === 'weekdays' || task.recurrence === 'weekends') {
      currentStart = addDays(currentStart, -1);
    } else if (task.recurrence === 'weekly') {
      currentStart = addWeeks(currentStart, -1);
    } else if (task.recurrence === 'monthly') {
      currentStart = addMonths(currentStart, -1);
    } else break;
  }

  // Generation loop
  let limit = 0;
  while (currentStart < endRange && limit < 1000) {
    limit++;
    currentEnd = new Date(currentStart.getTime() + durationMs);

    // Rule: overlaps with view range
    const overlaps = currentStart < endRange && currentEnd > startRange;
    
    let shouldInclude = false;
    if (task.recurrence === 'daily') {
      shouldInclude = true;
    } else if (task.recurrence === 'weekdays') {
      shouldInclude = !isWeekend(currentStart);
    } else if (task.recurrence === 'weekends') {
      shouldInclude = isWeekend(currentStart);
    } else if (task.recurrence === 'weekly') {
      shouldInclude = true;
    } else if (task.recurrence === 'monthly') {
      shouldInclude = true;
    }

    if (overlaps && shouldInclude) {
      instances.push({
        ...task,
        startTime: currentStart.toISOString(),
        endTime: currentEnd.toISOString(),
      });
    }

    // Advance
    if (task.recurrence === 'daily' || task.recurrence === 'weekdays' || task.recurrence === 'weekends') {
      currentStart = addDays(currentStart, 1);
    } else if (task.recurrence === 'weekly') {
      currentStart = addWeeks(currentStart, 1);
    } else if (task.recurrence === 'monthly') {
      currentStart = addMonths(currentStart, 1);
    } else break;
  }

  return instances;
}

export function formatTime24h(date: Date) {
  return format(date, 'HH:mm');
}

export function getHoursArray() {
  return Array.from({ length: 24 }, (_, i) => i);
}
