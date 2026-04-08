import { createContext, useContext } from "react";

export type SocialCaseEstadoFilterContextValue = {
  /** ID de issues que coinciden con el estado seleccionado. null = sin filtro activo (mostrar todos) */
  filteredIssueIds: Set<string> | null;
};

export const SocialCaseEstadoFilterContext = createContext<SocialCaseEstadoFilterContextValue>({
  filteredIssueIds: null,
});

export const useSocialCaseEstadoFilter = () => useContext(SocialCaseEstadoFilterContext);
