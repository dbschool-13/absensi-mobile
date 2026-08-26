import { format, differenceInMinutes } from 'date-fns';
import { id } from 'date-fns/locale';

// Mendapatkan format YYYY-MM-DD untuk ID Dokumen
export const getTodayString = () => {
  return format(new Date(), 'yyyy-MM-dd');
};

// Format tanggal Indonesia: "Senin, 25 Oktober 2023"
export const getFormattedDate = () => {
  return format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id });
};

// Hitung durasi jam kerja
export const calculateWorkHours = (checkInDate, checkOutDate) => {
  if (!checkInDate || !checkOutDate) return 0;
  
  const minutes = differenceInMinutes(checkOutDate, checkInDate);
  const hours = (minutes / 60).toFixed(2); // Dibulatkan 2 desimal
  
  return parseFloat(hours);
};