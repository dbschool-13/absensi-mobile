import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { School } from 'lucide-react';

export default function GlobalLoader() {
  const { isGlobalLoading, schoolData } = useAuth();

  if (!isGlobalLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center transition-all duration-300">
      
      {/* Efek Lingkaran Berdenyut */}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-32 h-32 bg-primary/20 rounded-full animate-ping"></div>
        <div className="absolute w-24 h-24 bg-primary/40 rounded-full animate-pulse"></div>
        
        {/* Lingkaran Putih Penampung Logo */}
        <div className="relative z-10 w-20 h-20 rounded-full shadow-2xl flex items-center justify-center overflow-hidden border border-gray-100 p-2">
          {schoolData?.logo_url ? (
            <img 
              src={schoolData.logo_url} 
              alt="Logo Sekolah" 
              className="w-full h-full object-contain animate-[pulse_2s_ease-in-out_infinite]"
            />
          ) : (
             // Fallback jika sekolah belum punya logo di database
            <School size={36} className="text-primary animate-[pulse_2s_ease-in-out_infinite]" />
          )}
        </div>
      </div>

      <h3 className="mt-8 text-lg font-bold text-gray-800 tracking-wider">Memproses...</h3>
      <p className="text-xs text-gray-500 font-medium mt-1">{schoolData?.name || 'Menyiapkan data Anda'}</p>
      
    </div>
  );
}