import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  AlertTriangle,
  ExternalLink,
  Flag,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  Settings2,
  Tv,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Channel } from '../types/tv.ts';
import { ChannelLogo, COUNTRY_FLAGS, isChannelPlayable } from './ChannelCard.tsx';

interface QualityLevel {
  index: number;
  label: string;
}

interface LivePlayerProps {
  channel: Channel;
  onReportClick: () => void;
}

const MAX_HLS_RECOVERIES = 3;

export function LivePlayer({ channel, onReportClick }: LivePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const recoveryAttemptsRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [autoplayMutedNotice, setAutoplayMutedNotice] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [retryCounter, setRetryCounter] = useState(0);

  const playable = isChannelPlayable(channel);
  const pipSupported =
    typeof document !== 'undefined' && Boolean(document.pictureInPictureEnabled);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setLevels([]);
    setSelectedLevel(-1);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    setErrorMsg(null);
    setIsPlaying(false);
    setIsBuffering(false);
    setAutoplayMutedNotice(false);
    setShowQualityMenu(false);
    recoveryAttemptsRef.current = 0;

    if (
      !playable ||
      !video ||
      (channel.stream_type !== 'hls' && channel.stream_type !== 'direct') ||
      !channel.stream_url
    ) {
      destroyHls();
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const streamUrl = channel.stream_url;
    video.volume = volume;

    const attemptAutoplay = async () => {
      try {
        await video.play();
      } catch {
        // Browser autoplay policy blocked unmuted playback after async navigation;
        // fall back to muted autoplay so live video starts immediately without stalling.
        try {
          video.muted = true;
          setIsMuted(true);
          setAutoplayMutedNotice(true);
          await video.play();
        } catch {
          setIsPlaying(false);
          setIsLoading(false);
        }
      }
    };

    const handlePlaying = () => {
      setIsLoading(false);
      setIsBuffering(false);
      setIsPlaying(true);
      setErrorMsg(null);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
      setIsBuffering(false);
    };

    const handleWaiting = () => setIsBuffering(true);
    const handlePause = () => setIsPlaying(false);
    const handleVideoError = () => {
      setIsLoading(false);
      setIsBuffering(false);
      setErrorMsg('Stream unavailable or blocked by the source provider.');
    };

    video.addEventListener('playing', handlePlaying);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleVideoError);

    if (channel.stream_type === 'hls') {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 30,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          maxBufferHole: 0.5,
          highBufferWatchdogPeriod: 2,
          nudgeMaxRetry: 5,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 10,
          startLevel: -1,
          capLevelToPlayerSize: true,
          manifestLoadingMaxRetry: 4,
          manifestLoadingRetryDelay: 500,
          levelLoadingMaxRetry: 4,
          levelLoadingRetryDelay: 500,
          fragLoadingMaxRetry: 6,
          fragLoadingRetryDelay: 500,
        });
        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
          const parsedLevels: QualityLevel[] = data.levels.map((lvl, idx) => ({
            index: idx,
            label: lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)} kbps`,
          }));
          setLevels(parsedLevels);
          setIsLoading(false);
          void attemptAutoplay();
        });

        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (!data.fatal) return;

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (recoveryAttemptsRef.current < MAX_HLS_RECOVERIES) {
              recoveryAttemptsRef.current += 1;
              setIsBuffering(true);
              hls.startLoad();
              return;
            }
            setIsLoading(false);
            setIsBuffering(false);
            setErrorMsg(
              data.response?.code === 403 || data.response?.code === 451
                ? 'This channel is restricted in your region or blocked by the source provider.'
                : 'Network connection problem while loading the stream manifest.',
            );
            hls.destroy();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            if (recoveryAttemptsRef.current < MAX_HLS_RECOVERIES) {
              recoveryAttemptsRef.current += 1;
              hls.recoverMediaError();
              return;
            }
            setIsLoading(false);
            setIsBuffering(false);
            setErrorMsg('This stream is not supported in your browser or encountered a media error.');
            hls.destroy();
          } else {
            setIsLoading(false);
            setIsBuffering(false);
            setErrorMsg('Stream unavailable. This channel is not currently broadcasting.');
            hls.destroy();
          }
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        void attemptAutoplay();
      } else {
        setIsLoading(false);
        setErrorMsg('This stream is not supported in your browser.');
      }
    } else {
      // Direct HTML5 media stream
      video.src = streamUrl;
      void attemptAutoplay();
    }

    return () => {
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleVideoError);
      destroyHls();
      video.removeAttribute('src');
      video.load();
    };
  }, [channel, playable, retryCounter, destroyHls]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => setErrorMsg('Playback was blocked by browser autoplay policy.'));
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const next = !video.muted;
    video.muted = next;
    setIsMuted(next);
    if (!next) {
      setAutoplayMutedNotice(false);
    }
  }, []);

  const handleVolumeChange = useCallback((val: number) => {
    const video = videoRef.current;
    setVolume(val);
    if (video) {
      video.volume = val;
      video.muted = val === 0;
      setIsMuted(val === 0);
      if (val > 0) setAutoplayMutedNotice(false);
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen().catch(() => undefined);
    } else {
      await document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !pipSupported) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      // Ignore unsupported PiP errors
    }
  }, [pipSupported]);

  const handleQualitySelect = useCallback((idx: number) => {
    setSelectedLevel(idx);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = idx;
    }
    setShowQualityMenu(false);
  }, []);

  // Keyboard shortcuts when player is focused or active
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (channel.stream_type === 'youtube') return;
    if (e.key === ' ' || e.key.toLowerCase() === 'k') {
      e.preventDefault();
      togglePlay();
    } else if (e.key.toLowerCase() === 'm') {
      e.preventDefault();
      toggleMute();
    } else if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.key.toLowerCase() === 'p') {
      e.preventDefault();
      togglePiP();
    }
  };

  // Non-configured / Discovery-Only / Subscription Broadcaster State
  if (!playable || channel.stream_type === 'unconfigured') {
    return (
      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-[#0A101F] border border-slate-800 flex flex-col items-center justify-center p-6 text-center">
        <ChannelLogo channel={channel} size="lg" />
        <h2 className="mt-4 font-display text-xl font-semibold text-white">
          {channel.name} — Official Broadcaster &amp; Subscription Portal
        </h2>
        <p className="mt-2 max-w-lg text-sm text-slate-300">
          {channel.source_attribution ||
            `This entry is a verified broadcaster listing for ${COUNTRY_FLAGS[channel.country_code] || ''} ${channel.country_name}.`}{' '}
          Because this network is subscription-protected or does not provide a 24/7 free public HLS/YouTube embed, direct streaming is available through the broadcaster&rsquo;s official portal.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {channel.official_website && (
            <a
              href={channel.official_website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-500 transition-colors"
            >
              Watch on Official Broadcaster Site
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            type="button"
            onClick={onReportClick}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            <Flag className="w-4 h-4" />
            Suggest Official Stream / Report
          </button>
        </div>
      </div>
    );
  }

  // Authorized External Link Only
  if (channel.stream_type === 'external' && channel.stream_url) {
    return (
      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-[#0A101F] border border-slate-800 flex flex-col items-center justify-center p-6 text-center">
        <Tv className="w-12 h-12 text-rose-500" />
        <h2 className="mt-4 font-display text-xl font-semibold text-white">
          Watch on Official Broadcaster Player
        </h2>
        <p className="mt-2 max-w-md text-sm text-slate-300">
          {channel.name} streams exclusively through its authorized external player.
        </p>
        <a
          href={channel.stream_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-500 transition-colors"
        >
          Open Official Stream
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    );
  }

  // Official YouTube Embed Mode (supports both specific videoId and 24/7 channel live_stream)
  if (channel.stream_type === 'youtube' && (channel.youtube_video_id || channel.youtube_channel_id)) {
    const embedSrc = channel.youtube_video_id
      ? `https://www.youtube.com/embed/${encodeURIComponent(channel.youtube_video_id)}?autoplay=1&playsinline=1&rel=0`
      : `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(channel.youtube_channel_id!)}&autoplay=1&playsinline=1&rel=0`;

    const directYouTubeUrl = channel.youtube_video_id
      ? `https://www.youtube.com/watch?v=${encodeURIComponent(channel.youtube_video_id)}`
      : `https://www.youtube.com/channel/${encodeURIComponent(channel.youtube_channel_id!)}/live`;

    return (
      <div className="space-y-3">
        <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800">
          <iframe
            src={embedSrc}
            title={`${channel.name} Official YouTube Live Broadcast`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full border-0"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Official YouTube Live broadcast embed. If the broadcaster temporarily disables embedding or is between live sessions, use the direct YouTube Live link.
          </span>
          <div className="flex items-center gap-4 shrink-0">
            <a
              href={directYouTubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold hover:underline"
            >
              Open on YouTube Live
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={onReportClick}
              className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-rose-500 font-medium"
            >
              <Flag className="w-3.5 h-3.5" />
              Report Issue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Native HTML5 / HLS.js Player
  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`${channel.name} video player`}
      className="group relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
    >
      <video
        ref={videoRef}
        playsInline
        className="w-full h-full object-contain bg-black"
        onClick={togglePlay}
      />

      {/* Top Overlay: Channel Identity & Verified LIVE */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-4 bg-gradient-to-b from-black/80 via-black/35 to-transparent flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ChannelLogo channel={channel} size="sm" />
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-400">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                LIVE
              </span>
              <span className="text-xs text-slate-300">
                {COUNTRY_FLAGS[channel.country_code] || ''} {channel.country_name}
              </span>
            </div>
            <p className="font-display text-sm font-semibold text-white">{channel.name}</p>
          </div>
        </div>

        {autoplayMutedNotice && isMuted && !errorMsg && (
          <button
            type="button"
            onClick={toggleMute}
            className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/95 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg transition-colors"
          >
            <VolumeX className="w-3.5 h-3.5" />
            Muted for autoplay · Tap to Unmute
          </button>
        )}
      </div>

      {/* Loading / Buffering Overlay */}
      {(isLoading || isBuffering) && !errorMsg && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/50">
          <Loader2 className="w-9 h-9 text-rose-500 animate-spin" />
          <span className="mt-2 text-xs font-medium text-slate-200">
            {isLoading ? 'Connecting to broadcast stream...' : 'Buffering stream...'}
          </span>
        </div>
      )}

      {/* Error Overlay */}
      {errorMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070B14]/95 p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500" />
          <h3 className="mt-3 font-display text-lg font-semibold text-white">Playback Notice</h3>
          <p className="mt-1.5 max-w-md text-sm text-slate-300">{errorMsg}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setRetryCounter((c) => c + 1)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-500 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Stream
            </button>
            <button
              type="button"
              onClick={onReportClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-700 transition-colors"
            >
              <Flag className="w-4 h-4" />
              Report Issue
            </button>
          </div>
        </div>
      )}

      {/* Bottom Controls Bar */}
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause stream' : 'Play stream'}
            className="p-2 rounded-lg text-white hover:bg-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              className="p-2 rounded-lg text-white hover:bg-white/15 transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              aria-label="Volume"
              className="hidden sm:block w-20 accent-rose-600 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {levels.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowQualityMenu((v) => !v)}
                aria-label="Select stream quality"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/20 transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
                {selectedLevel === -1
                  ? 'Auto'
                  : levels.find((l) => l.index === selectedLevel)?.label || 'Auto'}
              </button>
              {showQualityMenu && (
                <div className="absolute right-0 bottom-10 w-36 rounded-lg bg-[#0D1322] border border-slate-700 py-1 shadow-xl z-20">
                  <button
                    type="button"
                    onClick={() => handleQualitySelect(-1)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 ${
                      selectedLevel === -1 ? 'text-rose-400 font-semibold' : 'text-slate-200'
                    }`}
                  >
                    Auto (Adaptive)
                  </button>
                  {levels.map((lvl) => (
                    <button
                      key={lvl.index}
                      type="button"
                      onClick={() => handleQualitySelect(lvl.index)}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 ${
                        selectedLevel === lvl.index
                          ? 'text-rose-400 font-semibold'
                          : 'text-slate-200'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onReportClick}
            aria-label="Report stream issue"
            title="Report stream issue"
            className="p-2 rounded-lg text-white hover:bg-white/15 transition-colors"
          >
            <Flag className="w-4 h-4" />
          </button>

          {pipSupported && (
            <button
              type="button"
              onClick={togglePiP}
              aria-label="Toggle Picture in Picture"
              title="Picture-in-Picture (P)"
              className="p-2 rounded-lg text-white hover:bg-white/15 transition-colors"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title="Fullscreen (F)"
            className="p-2 rounded-lg text-white hover:bg-white/15 transition-colors"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
