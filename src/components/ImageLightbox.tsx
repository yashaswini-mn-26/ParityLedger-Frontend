import React from 'react';

export function ImageLightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  if (!src) return null;
  return (
    <div
      className="lightbox-overlay"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, cursor: 'zoom-out', padding: 24,
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 20, right: 24, background: 'transparent',
          border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer', lineHeight: 1,
        }}
      >
        ×
      </button>
      <img
        src={src}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.5)', cursor: 'default' }}
      />
    </div>
  );
}