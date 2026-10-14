import {Composition} from 'remotion';
import {PcbVideo} from './compositions/PcbVideo';
import {buildTimeline, FPS, HEIGHT, WIDTH} from './lib/timeline';
import type {PcbVideoData} from './lib/types';
import data03 from '../data/03-rp114n331.json';
import codeLines from './code-lines.json';

const d03 = data03 as PcbVideoData;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Pcb03"
        component={PcbVideo}
        durationInFrames={buildTimeline(d03).duration}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{data: d03, codeLines: codeLines.lines}}
      />
      {/* 9:16 Shorts / Reels / 抖音 version of the same data */}
      <Composition
        id="Pcb03Shorts"
        component={PcbVideo}
        durationInFrames={buildTimeline(d03).duration}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{data: d03, codeLines: codeLines.lines}}
      />
    </>
  );
};
