import { createContext, useContext } from "react";

export const SessionContext = createContext({
  studentId: "",
  working: false,
  setWorking: (_value: boolean) => {},
});

export const useSession = () => useContext(SessionContext);
