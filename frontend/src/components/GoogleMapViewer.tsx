import React from 'react';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';
import type { Stop } from '../types';

interface GoogleMapViewerProps {
  origin: string;
  destination: string;
  stops?: Stop[];
  zoom?: number;
  height?: number | string;
  interactive?: boolean;
}

export const GoogleMapViewer: React.FC<GoogleMapViewerProps> = ({
  origin,
  destination,
  stops = [],
  height = 360,
  interactive = true,
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  // Calculate waypoints query string for Google Maps Embed / Directions
  const originQuery = encodeURIComponent(origin || 'Campus Main Gate');
  const destinationQuery = encodeURIComponent(destination || 'Central Campus');
  
  // Format waypoints from intermediate stops
  const waypoints = stops
    .slice(1, stops.length - 1)
    .map(s => encodeURIComponent(s.name))
    .join('|');

  // If user provided a Google Maps API Key in .env
  const embedUrl = apiKey
    ? `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${originQuery}&destination=${destinationQuery}${waypoints ? `&waypoints=${waypoints}` : ''}`
    : `https://maps.google.com/maps?q=${originQuery}+to+${destinationQuery}&t=&z=13&ie=UTF8&iwloc=&output=embed`;

  const externalMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originQuery}&destination=${destinationQuery}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=transit`;

  return (
    <div className="google-map-container" style={{ position: 'relative', width: '100%', height, borderRadius: 14, overflow: 'hidden', border: '1px solid #dce9da', background: '#f5faf4' }}>
      <iframe
        title={`Google Maps Transit Route from ${origin} to ${destination}`}
        width="100%"
        height="100%"
        style={{ border: 0, display: 'block' }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={embedUrl}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          zIndex: 5,
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(6px)',
          padding: '6px 12px',
          borderRadius: 8,
          fontSize: 11,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <MapPin size={13} color="#247653" />
        <span style={{ fontWeight: 600, color: '#174D38' }}>Google Maps Live Route</span>
        <a
          href={externalMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 6, color: '#247653', textDecoration: 'none', fontWeight: 600 }}
          title="Open directions in full Google Maps"
        >
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
};
