import { motion, HTMLMotionProps } from 'framer-motion';
import React from 'react';
import { cn } from '../../lib/utils';

interface SmartButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'secondary';
  children?: React.ReactNode;
}

export default function SmartButton({ variant = 'primary', className, children, ...props }: SmartButtonProps) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "px-5 py-3 rounded-xl font-medium shadow-sm transition-shadow",
        variant === 'primary' && "bg-[var(--brand-600)] text-white hover:shadow-md",
        variant === 'secondary' && "border border-[var(--line)] hover:bg-gray-50",
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
