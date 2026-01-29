import { Video, Shield, Zap, HardDrive } from 'lucide-react';
import { motion } from 'framer-motion';

export function EmptyState() {
  const features = [
    {
      icon: Shield,
      title: 'Private & Secure',
      description: 'Your videos never leave your device. All processing happens locally in your browser.',
    },
    {
      icon: Zap,
      title: 'Fast Processing',
      description: 'Powered by FFmpeg compiled to WebAssembly for near-native performance.',
    },
    {
      icon: HardDrive,
      title: 'No Upload Needed',
      description: 'No server uploads, no bandwidth usage, no waiting for network transfers.',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center h-full text-center px-8"
    >
      {/* Hero icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="relative mb-8"
      >
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center glow-primary">
          <Video className="w-12 h-12 text-primary" />
        </div>
        <div className="absolute -inset-4 rounded-3xl animated-gradient -z-10" />
      </motion.div>

      {/* Title */}
      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-bold text-foreground mb-2"
      >
        Welcome to Wasm Video Editor
      </motion.h2>
      
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-muted-foreground max-w-md mb-8"
      >
        A powerful video editor that runs entirely in your browser. No servers, no uploads, complete privacy.
      </motion.p>

      {/* Features grid */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl"
      >
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 + index * 0.1 }}
            className="glass-card p-4 text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <feature.icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-medium text-foreground mb-1">{feature.title}</h3>
            <p className="text-xs text-muted-foreground">{feature.description}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Get started hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-sm text-muted-foreground mt-8"
      >
        Upload a video or load a sample to get started →
      </motion.p>
    </motion.div>
  );
}
