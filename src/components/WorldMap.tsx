'use client';

import { useState } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import countries from '@/lib/countries';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface WorldMapProps {
  onCountryClick: (countryCode: string) => void;
  selectedCountry?: string | null;
  onBackgroundClick?: () => void;
}

export default function WorldMap({ onCountryClick, selectedCountry, onBackgroundClick }: WorldMapProps) {
  const [tooltip, setTooltip] = useState<{ name: string; x: number; y: number } | null>(null);

  return (
    <div
      className="relative w-full h-full bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-100"
      onClick={(e) => {
        // Close sidebar when clicking on background (not on a country)
        if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'svg') {
          onBackgroundClick?.();
        }
      }}
    >
      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm rounded-lg shadow-xl pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            marginTop: '-8px',
          }}
        >
          {tooltip.name}
        </div>
      )}

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 147,
          center: [0, 20],
        }}
        className="w-full h-full"
      >
        <ZoomableGroup
          center={[0, 20]}
          zoom={1}
          minZoom={1}
          maxZoom={8}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                // Match country by name from GeoJSON properties
                const geoName = geo.properties?.name || '';

                // Exclude Antarctica (no permanent residents)
                if (geoName === 'Antarctica') {
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      style={{
                        default: {
                          fill: '#e5e7eb',
                          stroke: '#fff',
                          strokeWidth: 0.75,
                          outline: 'none',
                        },
                        hover: {
                          fill: '#e5e7eb',
                          stroke: '#fff',
                          strokeWidth: 0.75,
                          outline: 'none',
                          cursor: 'default',
                        },
                        pressed: {
                          fill: '#e5e7eb',
                          stroke: '#fff',
                          strokeWidth: 0.75,
                          outline: 'none',
                        },
                      }}
                    />
                  );
                }

                const country = countries.find(c =>
                  c.name.toLowerCase() === geoName.toLowerCase() ||
                  // Handle some common naming differences
                  (geoName === 'United States of America' && c.name === 'United States') ||
                  (geoName === 'Czechia' && c.name === 'Czech Republic') ||
                  (geoName === 'Palestine' && c.code === 'PSE')
                );
                const isSelected = selectedCountry === country?.code;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (country) {
                        onCountryClick(country.code);
                      }
                    }}
                    onMouseEnter={(evt) => {
                      if (country) {
                        const { clientX, clientY } = evt;
                        setTooltip({
                          name: country.name,
                          x: clientX,
                          y: clientY,
                        });
                      }
                    }}
                    onMouseLeave={() => {
                      setTooltip(null);
                    }}
                    onMouseMove={(evt) => {
                      if (tooltip && country) {
                        const { clientX, clientY } = evt;
                        setTooltip({
                          name: country.name,
                          x: clientX,
                          y: clientY,
                        });
                      }
                    }}
                    style={{
                      default: {
                        fill: isSelected
                          ? '#8b5cf6' // Purple for selected
                          : '#60a5fa', // Blue for unselected
                        stroke: '#fff',
                        strokeWidth: 0.75,
                        outline: 'none',
                        transition: 'all 0.2s ease',
                      },
                      hover: {
                        fill: isSelected
                          ? '#7c3aed' // Darker purple for selected hover
                          : '#3b82f6', // Darker blue for hover
                        stroke: '#fff',
                        strokeWidth: 1,
                        outline: 'none',
                        cursor: 'pointer',
                      },
                      pressed: {
                        fill: '#6d28d9', // Even darker purple for pressed
                        stroke: '#fff',
                        strokeWidth: 1,
                        outline: 'none',
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}
