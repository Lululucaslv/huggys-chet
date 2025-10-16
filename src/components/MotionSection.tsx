import { motion } from 'framer-motion';
import { fadeInUp, springMd, stagger, shouldReduceMotion } from '../lib/anim';
import { useInViewOnce } from '../hooks/useInViewOnce';
import { cn } from '../lib/utils';
import React from 'react';

interface Props {
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  children: React.ReactNode;
  delay?: number;
  variant?: 'fadeUp' | 'fade' | 'scale';
  id?: string;
  style?: React.CSSProperties;
}

const variantMap = {
  fadeUp: fadeInUp,
  fade:   { hidden: { opacity: 0 }, show: { opacity: 1 } },
  scale:  { hidden: { opacity: 0, scale: 0.98 }, show: { opacity: 1, scale: 1 } }
} as const;

export default function MotionSection({ as = 'section', className, children, delay = 0, variant = 'fadeUp', id, style }: Props) {
  const Tag: any = as;
  const { ref, seen } = useInViewOnce<HTMLDivElement>();
  const reduce = shouldReduceMotion();

  if (reduce) return <Tag className={className} id={id} style={style}>{children}</Tag>;

  return (
    <motion.section
      ref={ref}
      className={cn(className)}
      variants={stagger(0.06, delay)}
      initial="hidden"
      animate={seen ? 'show' : 'hidden'}
      viewport={{ once: true }}
      id={id}
      style={style}
    >
      <motion.div variants={variantMap[variant]} transition={springMd}>
        {children}
      </motion.div>
    </motion.section>
  );
}
