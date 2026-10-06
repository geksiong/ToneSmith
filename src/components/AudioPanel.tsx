import React, { useState, useEffect } from 'react';
import { guitarAudio } from '../lib/audioEngine';
import { CircuitAnalysisResult } from '../types/guitar';
import { Mic, MicOff, Volume2, Play, Square, Radio, Music } from 'lucide-react';

interface AudioPanelProps {
  analysis: CircuitAnalysisResult;
}

export const AudioPanel: React.FC<AudioPanelProps> = ({ analysis }) => {
  const [isMicOn, setIsMicOn] = useState(() => guitarAudio.isMicActive);
  const [isRiffPlaying, setIsRiffPlaying] = useState(() => guitarAudio.isRiffPlaying);
  const [currentRiff, setCurrentRiff] = useState<'chords' | 'funk' | 'blues' | 'lead'>(
    () => guitarAudio.currentRiffType
  );
  const [humEnabled, setHumEnabled] = useState(() => guitarAudio.humEnabled);
  const [masterVol, setMasterVol] = useState(0.85);
  const [meterLevel, setMeterLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  // Sync state with audio engine lifecycle events
  useEffect(() => {
    return guitarAudio.subscribe(() => {
      setIsMicOn(guitarAudio.isMicActive);
      setIsRiffPlaying(guitarAudio.isRiffPlaying);
      setCurrentRiff(guitarAudio.currentRiffType);
      setHumEnabled(guitarAudio.humEnabled);
    });
  }, []);

  // Update audio engine with circuit parameters
  useEffect(() => {
    guitarAudio.updateCircuitParameters(analysis);
  }, [analysis]);

  // Real-time meter animation loop
  useEffect(() => {
    let animId: number;
    const updateMeter = () => {
      if (isMicOn || isRiffPlaying) {
        setMeterLevel(guitarAudio.getOutputLevel());
      } else {
        setMeterLevel(0);
      }
      animId = requestAnimationFrame(updateMeter);
    };
    animId = requestAnimationFrame(updateMeter);
    return () => cancelAnimationFrame(animId);
  }, [isMicOn, isRiffPlaying]);

  const toggleMic = async () => {
    try {
      setMicError(null);
      const active = await guitarAudio.toggleMicrophone();
      setIsMicOn(active);
    } catch (e) {
      setMicError('Microphone permission denied or unavailable in this window.');
    }
  };

  const toggleRiff = () => {
    if (guitarAudio.isRiffPlaying || isRiffPlaying) {
      guitarAudio.stopRiff();
      setIsRiffPlaying(false);
      setMeterLevel(0);
    } else {
      guitarAudio.startRiff(currentRiff);
      setIsRiffPlaying(true);
    }
  };

  const handleRiffChange = (riff: 'chords' | 'funk' | 'blues' | 'lead') => {
    setCurrentRiff(riff);
    guitarAudio.setRiffType(riff);
  };

  const toggleHum = () => {
    const next = !humEnabled;
    setHumEnabled(next);
    guitarAudio.setHumEnabled(next);
    guitarAudio.updateCircuitParameters(analysis);
  };

  return (
    <div className="bg-white dark:bg-zinc-900/90 border border-zinc-300 dark:border-zinc-800 rounded-xl p-3 shadow-sm dark:shadow-lg flex flex-col gap-3 transition-colors">
      {/* Header with VU Meter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-mono font-bold text-zinc-950 dark:text-zinc-100">REAL-TIME AUDIO LAB</span>
        </div>

        {/* LED Peak Meter */}
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-800">
          <span className="text-[9px] font-mono text-zinc-800 dark:text-zinc-400 mr-1 font-bold">VU:</span>
          <div className="flex gap-0.5 items-center w-24 h-2.5">
            {[...Array(12)].map((_, i) => {
              const threshold = (i + 1) / 12;
              const isActive = meterLevel >= threshold;
              const isRed = i >= 10;
              const isAmber = i >= 7 && i < 10;
              return (
                <div
                  key={i}
                  className={`flex-1 h-full rounded-xs transition-colors duration-75 ${
                    isActive
                      ? isRed
                        ? 'bg-rose-500 shadow-sm shadow-rose-500/50'
                        : isAmber
                        ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                        : 'bg-emerald-500 shadow-sm shadow-emerald-400/50'
                      : 'bg-zinc-300 dark:bg-zinc-800'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Signal Source Controls (Mic & DI Player) */}
      <div className="grid grid-cols-2 gap-2">
        {/* Microphone Input Toggle */}
        <button
          type="button"
          onClick={toggleMic}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono font-bold transition-all shadow-sm ${
            isMicOn
              ? 'bg-rose-600 text-white border-rose-500 ring-2 ring-rose-500/30 shadow-lg shadow-rose-500/20'
              : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700'
          }`}
        >
          {isMicOn ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />}
          <span>{isMicOn ? 'MIC LIVE (Testing)' : 'USE MICROPHONE'}</span>
        </button>

        {/* DI Guitar Looper Riff Player */}
        <button
          type="button"
          onClick={toggleRiff}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono font-bold transition-all shadow-sm ${
            isRiffPlaying
              ? 'bg-amber-500 text-zinc-950 border-amber-400 ring-2 ring-amber-400/30 shadow-lg shadow-amber-500/20'
              : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700'
          }`}
        >
          {isRiffPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isRiffPlaying ? 'STOP GUITAR RIFF' : 'PLAY CLEAN DI RIFF'}</span>
        </button>
      </div>

      {micError && (
        <div className="p-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-400 dark:border-rose-500/30 rounded text-[10px] font-mono text-rose-900 dark:text-rose-300 text-center font-bold">
          {micError}
        </div>
      )}

      {/* Riff Selector & Hum Simulation */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-800/80">
        {/* Riff selector buttons */}
        <div className="flex items-center gap-1">
          <Music className="w-3 h-3 text-zinc-600 dark:text-zinc-400 ml-1" />
          <span className="text-[10px] font-mono text-zinc-800 dark:text-zinc-400 mr-1 font-bold">Riff:</span>
          {(['chords', 'funk', 'blues', 'lead'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => handleRiffChange(r)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono capitalize transition-all border ${
                currentRiff === r
                  ? 'bg-amber-200 border-amber-500 text-zinc-950 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400 font-bold shadow-xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/60 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 font-semibold'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* 60Hz EMI Hum Toggle */}
        <button
          type="button"
          onClick={toggleHum}
          title="Toggle 60Hz ambient hum sound on single coils"
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono border transition-all ${
            humEnabled
              ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-950 dark:text-amber-300 border-amber-400 dark:border-amber-500/40 font-bold'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 font-medium'
          }`}
        >
          <Radio className="w-3 h-3" />
          <span>60Hz Hum: {humEnabled ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Master Volume Slider */}
      <div className="flex items-center gap-3 pt-1 border-t border-zinc-200 dark:border-zinc-800/80">
        <Volume2 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
        <span className="text-[10px] font-mono text-zinc-800 dark:text-zinc-300 font-bold">Master Level</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={masterVol}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            setMasterVol(v);
            guitarAudio.setMasterVolume(v);
          }}
          className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded accent-amber-500 cursor-pointer"
        />
        <span className="text-[10px] font-mono text-zinc-950 dark:text-zinc-200 w-8 text-right font-black">
          {Math.round(masterVol * 100)}%
        </span>
      </div>
    </div>
  );
};
