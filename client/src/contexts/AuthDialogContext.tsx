import { createContext, useContext } from "react";

type AuthDialogContextType = {
  openLogin: () => void;
  openRegister: () => void;
};

export const AuthDialogContext = createContext<AuthDialogContextType>({
  openLogin: () => {},
  openRegister: () => {},
});

export function useAuthDialog() {
  return useContext(AuthDialogContext);
}
