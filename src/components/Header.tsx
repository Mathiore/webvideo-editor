import { Upload, Film, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeaderProps {
  hasVideo: boolean;
}

export function Header({ hasVideo }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 glow-primary">
          <Film className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Wasm Video Editor</h1>
          <p className="text-xs text-muted-foreground">Browser-based video processing</p>
        </div>
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20"
      >
        <Zap className="w-3.5 h-3.5 text-success" />
        <span className="text-xs font-medium text-success">Runs locally in your browser</span>
      </motion.div>
    </header>
  );
}
