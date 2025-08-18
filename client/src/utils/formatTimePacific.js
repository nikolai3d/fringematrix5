import { ordinalize } from './ordinalize.js';

export function formatTimePacific(timestamp) {
  if (!timestamp || typeof timestamp !== 'string' || timestamp === 'N/A') return timestamp;
  
  try {
    // Handle both ISO 8601 and legacy Pacific format
    let date;
    
    // Check if it's the old Pacific format: "2024-01-15 14:30:45 PST"
    const pacificMatch = timestamp.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) (P[SD]T)$/);
    if (pacificMatch) {
      // Already in Pacific format, use the legacy formatter logic
      const [, yyyy, mm, dd, HH, MM, SS, tz] = pacificMatch;
      const monthNames = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December',
      ];
      const monthName = monthNames[Number(mm) - 1] || mm;
      const day = ordinalize(Number(dd));
      return `${monthName} ${day}, ${yyyy}, ${HH}:${MM}:${SS} ${tz}`;
    }
    
    // Parse as ISO 8601 date
    date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return timestamp;
    }
    
    // Convert to Pacific time
    const options = {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'America/Los_Angeles',
      timeZoneName: 'short'
    };
    
    const formatted = date.toLocaleString('en-US', options);
    
    // Handle different possible formats from toLocaleString
    // Format could be "August 17, 2025 at 6:44:27 PM PDT" or similar variations
    const atMatch = formatted.match(/^(.+?) (\d+), (\d{4}) at (.+)$/);
    if (atMatch) {
      const [, month, day, year, time] = atMatch;
      const ordinalDay = ordinalize(Number(day));
      return `${month} ${ordinalDay}, ${year}, ${time}`;
    }
    
    // Fallback for other formats
    const commaMatch = formatted.match(/^(.+?) (\d+), (\d{4}), (.+)$/);
    if (commaMatch) {
      const [, month, day, year, time] = commaMatch;
      const ordinalDay = ordinalize(Number(day));
      return `${month} ${ordinalDay}, ${year}, ${time}`;
    }
    
    return formatted;
  } catch (error) {
    console.warn('Error formatting timestamp:', error);
    return timestamp;
  }
}
