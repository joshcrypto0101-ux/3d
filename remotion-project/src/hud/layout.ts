import {createContext, useContext} from 'react';

export interface Layout {
  portrait: boolean;
  w: number;
  h: number;
}

export const LayoutContext = createContext<Layout>({portrait: false, w: 1920, h: 1080});
export const useLayout = () => useContext(LayoutContext);
/** Pick a value per orientation. */
export const useP = () => {
  const l = useLayout();
  return <T,>(landscape: T, portrait: T): T => (l.portrait ? portrait : landscape);
};
