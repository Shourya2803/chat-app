'use client';

import { useUIStore, ToneType } from '@/store/uiStore';
import { Briefcase, Heart, GraduationCap, Sparkles } from 'lucide-react';

const toneOptions: { value: ToneType; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'professional',
    label: 'Professional',
    icon: <Briefcase className="w-5 h-5" />,
    description: 'Business-appropriate language',
  },
  {
    value: 'polite',
    label: 'Polite',
    icon: <Heart className="w-5 h-5" />,
    description: 'Courteous and respectful',
  },
  {
    value: 'formal',
    label: 'Formal',
    icon: <GraduationCap className="w-5 h-5" />,
    description: 'Sophisticated and proper',
  },
];

export default function ToneSelector() {
  const { selectedTone, setSelectedTone, toneEnabled, toggleTone } = useUIStore();

  return (
    <div
      className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary-600" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            AI Tone Transformer
          </p>
        </div>
        <button
          onClick={toggleTone}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            toneEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              toneEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      <div className={`grid grid-cols-3 gap-2 transition-opacity ${!toneEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {toneOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setSelectedTone(option.value)}
            className={`p-3 rounded-lg border-2 transition-all ${
              selectedTone === option.value
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600'
            }`}
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div
                className={`${
                  selectedTone === option.value
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {option.icon}
              </div>
              <div>
                <p
                  className={`font-semibold text-sm ${
                    selectedTone === option.value
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {option.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {option.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

