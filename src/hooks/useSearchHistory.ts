import { useState, useEffect, useCallback } from 'react';

const SEARCH_HISTORY_KEY = 'esim_search_history';
const MAX_HISTORY_ITEMS = 10;

export const useSearchHistory = () => {
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Load search history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSearchHistory(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  }, []);

  // Add a search term to history
  const addToHistory = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) return;

    setSearchHistory(prev => {
      // Remove if already exists to avoid duplicates
      const filtered = prev.filter(item => item.toLowerCase() !== searchTerm.toLowerCase());
      
      // Add to beginning and limit to max items
      const newHistory = [searchTerm, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      
      // Save to localStorage
      try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
      } catch (error) {
        console.error('Failed to save search history:', error);
      }
      
      return newHistory;
    });
  }, []);

  // Clear search history
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  }, []);

  // Remove specific item from history
  const removeFromHistory = useCallback((searchTerm: string) => {
    setSearchHistory(prev => {
      const newHistory = prev.filter(item => item !== searchTerm);
      try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
      } catch (error) {
        console.error('Failed to update search history:', error);
      }
      return newHistory;
    });
  }, []);

  return {
    searchHistory,
    addToHistory,
    clearHistory,
    removeFromHistory
  };
};