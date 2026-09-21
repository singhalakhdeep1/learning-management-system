import React from 'react';

export default function LmsHomePage() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Learning Management System (LMS)</h1>
      <p>Interactive course catalog, HLS video streaming player, quiz assessment engine, and certificates.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '2rem' }}>
        <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <h3>Full-Stack Web Development</h3>
          <p>48 Modules • 120 Hours of HD Video</p>
        </div>
        <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <h3>Advanced System Design & Distributed Systems</h3>
          <p>32 Modules • 85 Hours</p>
        </div>
        <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <h3>Machine Learning & AI Engineering</h3>
          <p>60 Modules • 140 Hours</p>
        </div>
      </div>
    </div>
  );
}
