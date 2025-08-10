import { ordinalize } from './ordinalize.js';

export function formatDeployedAtPacific(ptString) {
  if (!ptString || typeof ptString !== 'string') return ptString;
  const match = ptString.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) (P[SD]T)$/);
  if (!match) return ptString;
  const [, yyyy, mm, dd, HH, MM, SS, tz] = match;
  const monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  const monthName = monthNames[Number(mm) - 1] || mm;
  const day = ordinalize(Number(dd));
  return `${monthName} ${day}, ${yyyy}, ${HH}:${MM}:${SS} ${tz}`;
}


