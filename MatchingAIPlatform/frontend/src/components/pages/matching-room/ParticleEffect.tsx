import React from 'react';

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

interface ParticleEffectProps {
  particles: Particle[];
}

const ParticleEffect: React.FC<ParticleEffectProps> = ({ particles }) => {
  return (
    <>
      {particles.map(particle => (
        <div
          key={particle.id}
          className="particle"
          style={{
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            opacity: particle.life / 60,
          }}
        />
      ))}
    </>
  );
};

export default ParticleEffect;