import React, { useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="min-h-[40px] px-3.5 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
        >
          Install on iOS
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-stone-900 p-6 shadow-xl border border-stone-200 dark:border-stone-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
                  Install MyWardrobe AI
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                  aria-label="Close guide"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                1. Tap the <strong>Share</strong> button in your Safari toolbar.
                <br />
                2. Scroll down and select <strong>Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-medium"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-5 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-700 px-3.5 py-2 text-xs font-medium text-white shadow-lg">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — Rule-based stylist & cached wardrobe active</span>
    </div>
  );
};
