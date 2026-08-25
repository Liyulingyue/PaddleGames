import { useState, useEffect } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export const useParticleEffect = () => {
  const [particles, setParticles] = useState<Particle[]>([]);

  // 创建粒子效果
  const createParticles = (x: number, y: number, color: string) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 8; i++) {
      newParticles.push({
        id: Date.now() + i,
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 2,
        life: 60,
        color: color,
        size: Math.random() * 6 + 4,
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  };

  // 更新粒子
  useEffect(() => {
    const interval = setInterval(() => {
      setParticles(prev =>
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            life: p.life - 1,
            vy: p.vy + 0.1, // 重力
          }))
          .filter(p => p.life > 0)
      );
    }, 16);
    return () => clearInterval(interval);
  }, []);

  const clearParticles = () => {
    setParticles([]);
  };

  return {
    particles,
    createParticles,
    clearParticles,
  };
};