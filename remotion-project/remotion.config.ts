import {Config} from '@remotion/cli/config';

// Cloud container: no GPU, use the pre-installed Chromium with software GL.
Config.setBrowserExecutable(
  process.env.REMOTION_BROWSER ?? '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
);
Config.setChromiumOpenGlRenderer('swangle');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setConcurrency(2);
Config.setOverwriteOutput(true);
