import { Play, Square, Trash2, RefreshCw, RotateCcw } from 'lucide-react';

interface ContainerActionsProps {
  status: string;
  loading: boolean;
  onStart: () => void;
  onStop: () => void;
  onRestart?: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}

export default function ContainerActions({ status, loading, onStart, onStop, onRestart, onDelete, onRefresh }: ContainerActionsProps) {
  const isStopped = status === 'exited' || status === 'created' || status === 'dead';
  const isRunning = status === 'running';

  return (
    <div className="flex gap-2">
      <button
        onClick={onRefresh}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
      >
        <RefreshCw className="h-4 w-4" />
        Refresh
      </button>
      {isStopped && (
        <button
          onClick={onStart}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          Start
        </button>
      )}
      {isRunning && (
        <>
          <button
            onClick={onStop}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-yellow-500 disabled:opacity-50"
          >
            <Square className="h-3.5 w-3.5" />
            Stop
          </button>
          {onRestart && (
            <button
              onClick={onRestart}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Restart
            </button>
          )}
        </>
      )}
      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 rounded-lg border border-red-800 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-900/20"
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </button>
    </div>
  );
}