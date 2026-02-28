import React from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

export const PageLoader: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => (
  <div className="flex-1 flex flex-col items-center justify-center gap-3 p-12 text-stone-400 min-h-[300px]">
    <Loader2 size={28} className="animate-spin text-primary-500" />
    <span className="text-sm font-medium">{label}</span>
  </div>
);

export const PageError: React.FC<{ message?: string; onRetry?: () => void }> = ({
  message = 'Failed to load data. Check your connection.',
  onRetry,
}) => (
  <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12 min-h-[300px]">
    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
      <AlertCircle size={24} className="text-red-500" />
    </div>
    <div className="text-center">
      <p className="font-semibold text-stone-700 mb-1">Something went wrong</p>
      <p className="text-sm text-stone-500 max-w-sm">{message}</p>
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-bold rounded-lg hover:bg-primary-700 transition-colors"
      >
        <RefreshCw size={14} />
        Try Again
      </button>
    )}
  </div>
);
