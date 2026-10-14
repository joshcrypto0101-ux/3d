import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
import '@fontsource/noto-sans-sc/chinese-simplified-400.css';
import '@fontsource/noto-sans-sc/chinese-simplified-700.css';
import '@fontsource/noto-sans-sc/latin-400.css';
import '@fontsource/noto-sans-sc/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/noto-serif/latin-400-italic.css';

const PROBES = [
  '400 20px "Noto Sans SC"',
  '700 20px "Noto Sans SC"',
  '400 20px "JetBrains Mono"',
  '700 20px "JetBrains Mono"',
  'italic 400 20px "Noto Serif"',
];
const SAMPLE = '把这张原理图焊成一块板子 RP114 0603 3.30 V';

/** Blocks rendering until every font face the HUD and canvas textures use is loaded. */
export const FontGate: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('Loading fonts', {timeoutInMilliseconds: 60000}));
  useEffect(() => {
    let cancelled = false;
    Promise.all(PROBES.map((p) => document.fonts.load(p, SAMPLE)))
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        setReady(true);
        continueRender(handle);
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);
  if (!ready) return null;
  return <>{children}</>;
};
