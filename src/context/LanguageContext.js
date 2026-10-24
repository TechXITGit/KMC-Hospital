import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STRINGS } from "../constants/strings";

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState("en"); // "en" | "hi"

  useEffect(() => {
    loadSavedLanguage();
  }, []);

  const setLanguage = async (lang) => {
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem("@kmc_language", lang);
    } catch (e) {
      // ignore storage errors, keep working in-memory
    }
  };

  const loadSavedLanguage = async () => {
    try {
      const saved = await AsyncStorage.getItem("@kmc_language");
      if (saved) setLanguageState(saved);
      return saved;
    } catch (e) {
      return null;
    }
  };

  const t = useMemo(() => STRINGS[language] || STRINGS.en, [language]);

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, loadSavedLanguage, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
