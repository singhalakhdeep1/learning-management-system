'use client';

import Hls from 'hls.js';
import { useEffect, useRef } from 'react';

interface Props {
  src: string;
  /** Resume position in seconds. */
  startAt?: number;
  /** Called at most every `reportEverySeconds` of playback, and when playback pauses. */
  onProgress?: (positionSeconds: number, durationSeconds: number) => void;
  onEnded?: () => void;
  reportEverySeconds?: number;
}

/**
 * Plays an HLS (.m3u8) stream with hls.js, or a plain MP4/WebM file natively. Safari plays HLS natively,
 * so hls.js is only used where it is supported and the browser cannot do HLS itself.
 */
export default function VideoPlayer({ src, startAt = 0, onProgress, onEnded, reportEverySeconds = 10 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const callbacks = useRef({ onProgress, onEnded });
  callbacks.current = { onProgress, onEnded };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls: Hls | null = null;
    let lastReport = 0;

    const isHlsSource = /\.m3u8(\?|#|$)/i.test(src);
    if (isHlsSource && !video.canPlayType('application/vnd.apple.mpegurl') && Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      video.src = src;
    }

    const resume = () => {
      if (startAt > 5 && Number.isFinite(video.duration) && startAt < video.duration - 5) {
        video.currentTime = startAt;
      }
    };

    const report = () => callbacks.current.onProgress?.(Math.floor(video.currentTime), Math.floor(video.duration || 0));
    const onTimeUpdate = () => {
      if (video.currentTime - lastReport >= reportEverySeconds || video.currentTime < lastReport) {
        lastReport = video.currentTime;
        report();
      }
    };
    const onEndedEvent = () => {
      report();
      callbacks.current.onEnded?.();
    };

    video.addEventListener('loadedmetadata', resume);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('pause', report);
    video.addEventListener('ended', onEndedEvent);

    return () => {
      video.removeEventListener('loadedmetadata', resume);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('pause', report);
      video.removeEventListener('ended', onEndedEvent);
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [src, startAt, reportEverySeconds]);

  return <video ref={videoRef} className="video" controls playsInline preload="metadata" />;
}
