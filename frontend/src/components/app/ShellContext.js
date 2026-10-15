import { createContext, useContext } from "react";

/** Lets any page open the global job form, refresh data, and celebrate rewards. */
export const ShellContext = createContext({ openJobForm: () => {}, refreshKey: 0, bump: () => {}, handleRewards: () => {} });
export const useShell = () => useContext(ShellContext);
